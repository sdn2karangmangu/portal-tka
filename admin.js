/**
 * PORTAL TRYOUT TKA SISWA - admin.js
 * Logika Dashboard Guru & Admin Pengawas (JavaScript Vanilla)
 * Pengelolaan Tryout, Persetujuan Izin Realtime, Pengumuman, & Integrasi Google Sheets
 */

// ==========================================
// 1. AUTHENTICATION & SESSION
// ==========================================

const ADMIN_DEFAULT_USERS = [
  { username: 'guru', password: 'gurujuara123', nama: 'Pak Budi Rahardjo, S.Pd.', role: 'guru' },
  { username: 'admin', password: 'admin123', nama: 'Ibu Siti Aminah, S.Pd.', role: 'admin' }
];

let currentUser = JSON.parse(sessionStorage.getItem('tka_admin_user')) || null;
let currentTab = 'permissions'; // 'permissions', 'tryouts', 'announcements', 'students', 'sheets'
let adminPollingInterval = null;

function cleanNis(val) {
  if (!val && val !== 0) return '';
  return String(val).replace(/\.0+$/, '').trim();
}

/**
 * Normalisasi status konfirmasi yang sangat fleksibel:
 * Mengenali 'DISETUJUI', 'SIAP DIMULAI', 'Disetujui', 'siap dimulai', 'ACC', 'SETUJU', 'MENUNGGU KONFIRMASI'
 */
function normalizeConfirmationStatus(val) {
  if (!val) return 'BELUM_MINTA';
  const s = String(val).trim().toUpperCase();

  if (s === 'DISETUJUI' || s === 'SIAP DIMULAI' || s === 'SIAP_DIMULAI' || 
      s === 'SIAP' || s === 'ACC' || s === 'APPROVED' || s === 'SETUJU' || 
      s === 'SUDAH DISETUJUI' || s === 'DIIZINKAN') {
    return 'DISETUJUI';
  }

  if (s === 'MENUNGGU' || s === 'MENUNGGU KONFIRMASI' || s === 'MENUNGGU_KONFIRMASI' || 
      s === 'PENDING' || s === 'WAITING' || s === 'BELUM DISETUJUI') {
    return 'MENUNGGU';
  }

  if (s === 'DITOLAK' || s === 'TOLAK' || s === 'REJECTED' || s === 'BATAL') {
    return 'DITOLAK';
  }

  return s;
}

function getGasUrl() {
  if (typeof window !== 'undefined' && typeof window.getActiveGasUrl === 'function') {
    return window.getActiveGasUrl();
  }
  if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_GAS_URL && CONFIG.DEFAULT_GAS_URL.trim().startsWith('http')) {
    return CONFIG.DEFAULT_GAS_URL.trim();
  }
  return (localStorage.getItem('tka_gas_url') || '').trim();
}

function checkAuth() {
  const loginOverlay = document.getElementById('loginOverlay');
  const adminMain = document.getElementById('adminMainContent');

  if (!currentUser) {
    if (loginOverlay) loginOverlay.classList.remove('hidden');
    if (adminMain) adminMain.classList.add('hidden');
    if (adminPollingInterval) clearInterval(adminPollingInterval);
  } else {
    if (loginOverlay) loginOverlay.classList.add('hidden');
    if (adminMain) adminMain.classList.remove('hidden');
    updateAdminHeader();
    loadAdminData();
    startAdminPolling();
  }
}

async function handleLogin(e) {
  if (e) e.preventDefault();
  const usernameInput = document.getElementById('adminUsername').value.trim();
  const passwordInput = document.getElementById('adminPassword').value.trim();
  const errorEl = document.getElementById('loginError');

  if (errorEl) errorEl.classList.add('hidden');

  const gasUrl = getGasUrl();

  if (gasUrl) {
    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'adminLogin',
          username: usernameInput,
          password: passwordInput
        })
      });
      const data = await res.json();
      if (data && data.success && data.user) {
        currentUser = data.user;
        sessionStorage.setItem('tka_admin_user', JSON.stringify(currentUser));
        checkAuth();
        return;
      }
    } catch (err) {
      console.warn('Gagal login via GAS, fallback ke lokal:', err);
    }
  }

  // Fallback lokal
  const found = ADMIN_DEFAULT_USERS.find(u => u.username === usernameInput && u.password === passwordInput);
  if (found) {
    currentUser = { username: found.username, nama: found.nama, role: found.role };
    sessionStorage.setItem('tka_admin_user', JSON.stringify(currentUser));
    checkAuth();
  } else {
    if (errorEl) {
      errorEl.innerText = 'Username atau Password salah! Cek kembali atau gunakan akun demo.';
      errorEl.classList.remove('hidden');
    }
  }
}

function handleLogout() {
  currentUser = null;
  sessionStorage.removeItem('tka_admin_user');
  checkAuth();
}

function fillDemoAccount(user, pass) {
  document.getElementById('adminUsername').value = user;
  document.getElementById('adminPassword').value = pass;
}

function updateAdminHeader() {
  const nameEl = document.getElementById('adminHeaderName');
  if (nameEl && currentUser) {
    nameEl.innerText = currentUser.nama || 'Guru Pengawas';
  }
}

// ==========================================
// 2. DATA LOADING & POLLING
// ==========================================

async function loadAdminData() {
  const gasUrl = getGasUrl();

  let tryouts = [];
  let konfirmasi = [];
  let pengumuman = [];
  let siswa = [];

  if (gasUrl) {
    try {
      const res = await fetch(`${gasUrl}?action=getAdminData&_t=${Date.now()}`);
      const data = await res.json();
      if (data && data.success) {
        tryouts = data.tryouts || [];
        konfirmasi = (data.konfirmasi || []).map(k => ({
          ...k,
          status_konfirmasi: normalizeConfirmationStatus(k.status_konfirmasi)
        }));
        pengumuman = data.pengumuman || [];
        siswa = data.siswa || [];

        // Sinkronkan ke LocalStorage untuk tab siswa lokal
        localStorage.setItem('tka_tryouts', JSON.stringify(tryouts));
        localStorage.setItem('tka_konfirmasi', JSON.stringify(konfirmasi));
        localStorage.setItem('tka_pengumuman', JSON.stringify(pengumuman));
        if (siswa.length > 0) localStorage.setItem('tka_siswa_list', JSON.stringify(siswa));
        if (data.school_password) {
          localStorage.setItem('tka_school_password', data.school_password);
        }
        updateSchoolPasswordBadge(data.school_password);

        updateConnectionBadge(true);
        renderCurrentTab(tryouts, konfirmasi, pengumuman, siswa);
        updateCounters(tryouts, konfirmasi);
        return;
      }
    } catch (err) {
      console.warn('Gagal mengambil data dari Google Apps Script:', err);
      updateConnectionBadge(false);
    }
  } else {
    updateConnectionBadge(false);
  }

  // LocalStorage Fallback
  tryouts = JSON.parse(localStorage.getItem('tka_tryouts')) || [];
  konfirmasi = (JSON.parse(localStorage.getItem('tka_konfirmasi')) || []).map(k => ({
    ...k,
    status_konfirmasi: normalizeConfirmationStatus(k.status_konfirmasi)
  }));
  pengumuman = JSON.parse(localStorage.getItem('tka_pengumuman')) || [];
  siswa = JSON.parse(localStorage.getItem('tka_siswa_list')) || [];

  renderCurrentTab(tryouts, konfirmasi, pengumuman, siswa);
  updateCounters(tryouts, konfirmasi);
}

function updateCounters(tryouts, konfirmasi) {
  const totalTryoutEl = document.getElementById('statTotalTryout');
  const activeTryoutEl = document.getElementById('statActiveTryout');
  const pendingPermEl = document.getElementById('statPendingPermissions');
  const approvedPermEl = document.getElementById('statApprovedPermissions');
  const pendingBadgeEl = document.getElementById('tabPendingBadge');

  const activeCount = tryouts.filter(t => t.status === 'DIBUKA' || t.status === 'SEDANG_BERLANGSUNG').length;
  const pendingCount = konfirmasi.filter(k => normalizeConfirmationStatus(k.status_konfirmasi) === 'MENUNGGU').length;
  const approvedCount = konfirmasi.filter(k => normalizeConfirmationStatus(k.status_konfirmasi) === 'DISETUJUI').length;

  if (totalTryoutEl) totalTryoutEl.innerText = tryouts.length;
  if (activeTryoutEl) activeTryoutEl.innerText = activeCount;
  if (pendingPermEl) pendingPermEl.innerText = pendingCount;
  if (approvedPermEl) approvedPermEl.innerText = approvedCount;

  if (pendingBadgeEl) {
    if (pendingCount > 0) {
      pendingBadgeEl.innerText = pendingCount;
      pendingBadgeEl.classList.remove('hidden');
    } else {
      pendingBadgeEl.classList.add('hidden');
    }
  }
}

function updateConnectionBadge(isConnected) {
  const badge = document.getElementById('adminConnectionStatus');
  if (!badge) return;
  if (isConnected) {
    badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300';
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Terhubung Google Sheets';
  } else {
    badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300';
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500"></span> Mode Simulasi / Siap GAS';
  }
}

function startAdminPolling() {
  if (adminPollingInterval) clearInterval(adminPollingInterval);
  adminPollingInterval = setInterval(() => {
    loadAdminData();
  }, 4000);
}

// ==========================================
// 3. TAB NAVIGATION & RENDERING
// ==========================================

function switchAdminTab(tabName) {
  currentTab = tabName;

  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.remove('bg-blue-600', 'text-white', 'shadow');
    btn.classList.add('text-slate-600', 'hover:bg-slate-100');
  });

  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-100');
    activeBtn.classList.add('bg-blue-600', 'text-white', 'shadow');
  }

  document.querySelectorAll('.admin-panel').forEach(panel => panel.classList.add('hidden'));
  const targetPanel = document.getElementById(`panel-${tabName}`);
  if (targetPanel) targetPanel.classList.remove('hidden');

  loadAdminData();
}

function renderCurrentTab(tryouts, konfirmasi, pengumuman, siswa) {
  if (currentTab === 'permissions') {
    renderPermissionsTable(konfirmasi, tryouts);
  } else if (currentTab === 'tryouts') {
    renderTryoutsTable(tryouts);
  } else if (currentTab === 'announcements') {
    renderAnnouncementsTable(pengumuman);
  } else if (currentTab === 'students') {
    renderStudentsTable(siswa);
  } else if (currentTab === 'sheets') {
    renderSheetsConfig();
  }
}

// ==========================================
// 4. TAB 1: PERMINTAAN IZIN SISWA
// ==========================================

function renderPermissionsTable(konfirmasi, tryouts) {
  const container = document.getElementById('permissionsTableBody');
  const tryoutFilterSelect = document.getElementById('permissionTryoutFilter');
  if (!container) return;

  if (tryoutFilterSelect) {
    const currentVal = tryoutFilterSelect.value;
    tryoutFilterSelect.innerHTML = `
      <option value="">Semua Tryout</option>
      ${tryouts.map(t => `<option value="${t.id}" ${currentVal === t.id ? 'selected' : ''}>${t.judul}</option>`).join('')}
    `;
  }

  const selectedTryout = tryoutFilterSelect ? tryoutFilterSelect.value : '';
  const statusFilter = document.getElementById('permissionStatusFilter')?.value || '';

  let filtered = konfirmasi;
  if (selectedTryout) {
    filtered = filtered.filter(k => String(k.id_tryout).trim() === String(selectedTryout).trim());
  }
  if (statusFilter) {
    filtered = filtered.filter(k => normalizeConfirmationStatus(k.status_konfirmasi) === statusFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center text-slate-400">
          <i class="fa-solid fa-inbox text-3xl mb-2 text-slate-300"></i>
          <p class="font-bold text-slate-600">Tidak ada permintaan izin</p>
          <p class="text-xs">Siswa yang menekan tombol "Minta Izin" akan langsung muncul di sini.</p>
        </td>
      </tr>
    `;
    return;
  }

  // Urutkan: MENUNGGU di atas
  filtered.sort((a, b) => {
    const aNorm = normalizeConfirmationStatus(a.status_konfirmasi);
    const bNorm = normalizeConfirmationStatus(b.status_konfirmasi);
    if (aNorm === 'MENUNGGU' && bNorm !== 'MENUNGGU') return -1;
    if (aNorm !== 'MENUNGGU' && bNorm === 'MENUNGGU') return 1;
    return new Date(b.waktu_permintaan) - new Date(a.waktu_permintaan);
  });

  container.innerHTML = filtered.map(k => {
    const tryout = tryouts.find(t => String(t.id).trim() === String(k.id_tryout).trim());
    const tryoutTitle = tryout ? tryout.judul : k.id_tryout;
    const normStatus = normalizeConfirmationStatus(k.status_konfirmasi);

    let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
    let icon = 'fa-circle-question';
    let label = normStatus;

    if (normStatus === 'DISETUJUI') {
      badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      icon = 'fa-circle-check';
      label = 'DISETUJUI (SIAP DIMULAI)';
    } else if (normStatus === 'MENUNGGU') {
      badgeClass = 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse';
      icon = 'fa-clock-rotate-left';
      label = 'MENUNGGU KONFIRMASI';
    } else if (normStatus === 'DITOLAK') {
      badgeClass = 'bg-red-100 text-red-800 border-red-300';
      icon = 'fa-circle-xmark';
      label = 'DITOLAK';
    }

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="py-3 px-4 font-mono text-xs text-slate-500">${k.waktu_permintaan || '-'}</td>
        <td class="py-3 px-4 font-bold text-slate-800">${k.nama_siswa}</td>
        <td class="py-3 px-4 font-mono text-xs font-semibold text-blue-600">${cleanNis(k.nis)}</td>
        <td class="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">${tryoutTitle}</td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badgeClass}">
            <i class="fa-solid ${icon}"></i> ${label}
          </span>
        </td>
        <td class="py-3 px-4 font-mono text-xs text-slate-500">${k.waktu_persetujuan || '-'}</td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            ${normStatus !== 'DISETUJUI' ? `
              <button onclick="approveStudentPermission('${k.id}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer">
                <i class="fa-solid fa-check"></i>
                <span>Setujui</span>
              </button>
            ` : `
              <span class="text-xs text-emerald-600 font-bold px-2 py-1 bg-emerald-50 rounded-md">
                <i class="fa-solid fa-check-double mr-1"></i> Izin Aktif
              </span>
            `}
            <button onclick="rejectStudentPermission('${k.id}')" title="Reset / Batalkan Izin" class="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg text-xs transition cursor-pointer">
              <i class="fa-solid fa-arrow-rotate-left"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Guru menyetujui izin siswa
 */
async function approveStudentPermission(confirmationId) {
  const gasUrl = getGasUrl();
  const konfirmasi = JSON.parse(localStorage.getItem('tka_konfirmasi')) || [];
  const target = konfirmasi.find(k => String(k.id).trim() === String(confirmationId).trim());

  const targetNis = target ? cleanNis(target.nis) : '';
  const targetTryout = target ? String(target.id_tryout).trim() : '';

  if (gasUrl) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
          action: 'approvePermission', 
          confirmation_id: confirmationId,
          nis: targetNis,
          id_tryout: targetTryout
        })
      });
    } catch (e) {
      console.warn('Gagal POST approve ke GAS, coba GET fallback:', e);
      try {
        await fetch(`${gasUrl}?action=approvePermission&confirmation_id=${encodeURIComponent(confirmationId)}&nis=${encodeURIComponent(targetNis)}&id_tryout=${encodeURIComponent(targetTryout)}&_t=${Date.now()}`);
      } catch (e2) {
        console.warn('GET approve fallback gagal:', e2);
      }
    }
  }

  // Update LocalStorage agar perubahan langsung terbaca di tab manapun
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  konfirmasi.forEach(k => {
    if (String(k.id).trim() === String(confirmationId).trim() || 
        (targetNis && targetTryout && cleanNis(k.nis) === targetNis && String(k.id_tryout).trim() === targetTryout)) {
      k.status_konfirmasi = 'DISETUJUI';
      k.waktu_persetujuan = timeStr;
    }
  });

  localStorage.setItem('tka_konfirmasi', JSON.stringify(konfirmasi));
  showAdminToast('Izin siswa berhasil disetujui! Tombol Mulai TKA di layar siswa kini aktif.');
  loadAdminData();
}

/**
 * Guru menyetujui semua siswa yang berstatus MENUNGGU
 */
async function approveAllPending() {
  const tryoutFilter = document.getElementById('permissionTryoutFilter')?.value || '';
  const konfirmasi = JSON.parse(localStorage.getItem('tka_konfirmasi')) || [];

  const pendingCount = konfirmasi.filter(k => normalizeConfirmationStatus(k.status_konfirmasi) === 'MENUNGGU' && (!tryoutFilter || String(k.id_tryout).trim() === String(tryoutFilter).trim())).length;
  if (pendingCount === 0) {
    alert('Tidak ada siswa dengan status Menunggu pada filter ini.');
    return;
  }

  if (!confirm(`Apakah Anda yakin ingin menyetujui sekaligus ${pendingCount} siswa yang sedang menunggu?`)) {
    return;
  }

  const gasUrl = getGasUrl();
  if (gasUrl) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'batchApprove', id_tryout: tryoutFilter })
      });
    } catch (e) {
      console.warn('Gagal batch approve ke GAS, coba GET fallback:', e);
      try {
        await fetch(`${gasUrl}?action=batchApprove&id_tryout=${encodeURIComponent(tryoutFilter)}&_t=${Date.now()}`);
      } catch (e2) {}
    }
  }

  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  konfirmasi.forEach(k => {
    if (normalizeConfirmationStatus(k.status_konfirmasi) === 'MENUNGGU' && (!tryoutFilter || String(k.id_tryout).trim() === String(tryoutFilter).trim())) {
      k.status_konfirmasi = 'DISETUJUI';
      k.waktu_persetujuan = timeStr;
    }
  });

  localStorage.setItem('tka_konfirmasi', JSON.stringify(konfirmasi));
  showAdminToast(`Berhasil menyetujui ${pendingCount} siswa sekaligus!`);
  loadAdminData();
}

/**
 * Mereset/membatalkan izin siswa
 */
async function rejectStudentPermission(confirmationId) {
  const konfirmasi = JSON.parse(localStorage.getItem('tka_konfirmasi')) || [];
  const target = konfirmasi.find(k => String(k.id).trim() === String(confirmationId).trim());
  if (!target) return;

  if (!confirm(`Reset izin untuk siswa ${target.nama_siswa}? Siswa harus meminta izin kembali.`)) {
    return;
  }

  const gasUrl = getGasUrl();
  if (gasUrl) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'rejectPermission', confirmation_id: confirmationId })
      });
    } catch (e) {
      try {
        await fetch(`${gasUrl}?action=rejectPermission&confirmation_id=${encodeURIComponent(confirmationId)}&_t=${Date.now()}`);
      } catch (e2) {}
    }
  }

  target.status_konfirmasi = 'MENUNGGU';
  target.waktu_persetujuan = '-';
  localStorage.setItem('tka_konfirmasi', JSON.stringify(konfirmasi));

  showAdminToast('Izin siswa telah direset.');
  loadAdminData();
}

// ==========================================
// 5. TAB 2: KELOLA TRYOUT (CRUD + TOGGLE)
// ==========================================

function renderTryoutsTable(tryouts) {
  const container = document.getElementById('tryoutsTableBody');
  if (!container) return;

  if (tryouts.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="py-12 text-center text-slate-400">
          <i class="fa-solid fa-folder-plus text-3xl mb-2 text-slate-300"></i>
          <p class="font-bold text-slate-600">Belum Ada Tryout</p>
          <p class="text-xs">Klik tombol "+ Tambah Tryout Baru" di atas untuk membuat jadwal ujian.</p>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = tryouts.map(t => {
    const isOpen = (t.status === 'DIBUKA' || t.status === 'SEDANG_BERLANGSUNG');
    const isFinished = t.status === 'SELESAI';

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="py-4 px-4 font-bold text-slate-800">
          <div class="font-extrabold text-sm text-slate-900">${t.judul}</div>
          <div class="text-xs text-slate-500 mt-0.5 line-clamp-1 italic">${t.petunjuk || '-'}</div>
        </td>
        <td class="py-4 px-4">
          <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            ${t.mapel}
          </span>
        </td>
        <td class="py-4 px-4 text-xs text-slate-600">
          <div class="font-bold">${t.tanggal}</div>
          <div class="text-slate-400 font-mono">${t.jam_mulai} - ${t.jam_selesai} WIB</div>
        </td>
        <td class="py-4 px-4 text-xs font-mono">
          <a href="${t.link_tka || '#'}" target="_blank" class="text-blue-600 hover:underline max-w-[180px] truncate block" title="${t.link_tka || ''}">
            <i class="fa-solid fa-arrow-up-right-from-square mr-1 text-[10px]"></i>
            ${t.link_tka ? 'Link Ujian' : 'Belum diisi'}
          </a>
        </td>
        <td class="py-4 px-4">
          <div class="flex items-center gap-2">
            <button onclick="toggleTryoutStatus('${t.id}', '${isOpen ? 'DITUTUP' : 'DIBUKA'}')" class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${isOpen ? 'bg-emerald-500' : 'bg-slate-300'}">
              <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOpen ? 'translate-x-6' : 'translate-x-1'}"></span>
            </button>
            <span class="text-xs font-bold ${isOpen ? 'text-emerald-700' : 'text-slate-500'}">
              ${isOpen ? 'DIBUKA' : (isFinished ? 'SELESAI' : 'DITUTUP')}
            </span>
          </div>
        </td>
        <td class="py-4 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="openEditTryoutModal('${t.id}')" class="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs transition cursor-pointer" title="Edit Tryout">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button onclick="deleteTryout('${t.id}')" class="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs transition cursor-pointer" title="Hapus Tryout">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function toggleTryoutStatus(tryoutId, newStatus) {
  const gasUrl = getGasUrl();

  if (gasUrl) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'toggleTryoutStatus', id_tryout: tryoutId, status: newStatus })
      });
    } catch (e) {
      try {
        await fetch(`${gasUrl}?action=toggleTryoutStatus&id_tryout=${encodeURIComponent(tryoutId)}&status=${encodeURIComponent(newStatus)}&_t=${Date.now()}`);
      } catch (e2) {}
    }
  }

  const tryouts = JSON.parse(localStorage.getItem('tka_tryouts')) || [];
  const target = tryouts.find(t => String(t.id).trim() === String(tryoutId).trim());
  if (target) {
    target.status = newStatus;
    localStorage.setItem('tka_tryouts', JSON.stringify(tryouts));
  }

  showAdminToast(`Status tryout diubah menjadi: ${newStatus}`);
  loadAdminData();
}

function openAddTryoutModal() {
  document.getElementById('tryoutModalTitle').innerText = 'Tambah Tryout Baru';
  document.getElementById('tryoutFormId').value = '';
  document.getElementById('tryoutFormJudul').value = '';
  document.getElementById('tryoutFormMapel').value = 'Matematika';
  document.getElementById('tryoutFormTanggal').value = new Date().toISOString().split('T')[0];
  document.getElementById('tryoutFormJamMulai').value = '08:00';
  document.getElementById('tryoutFormJamSelesai').value = '09:30';
  document.getElementById('tryoutFormLink').value = '';
  document.getElementById('tryoutFormPetunjuk').value = 'Kerjakan soal dengan teliti dan penuh kejujuran. Berdoalah sebelum memulai.';
  document.getElementById('tryoutFormStatus').value = 'DIBUKA';

  const modal = document.getElementById('tryoutFormModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function openEditTryoutModal(id) {
  const tryouts = JSON.parse(localStorage.getItem('tka_tryouts')) || [];
  const target = tryouts.find(t => String(t.id).trim() === String(id).trim());
  if (!target) return;

  document.getElementById('tryoutModalTitle').innerText = 'Edit Tryout TKA';
  document.getElementById('tryoutFormId').value = target.id;
  document.getElementById('tryoutFormJudul').value = target.judul;
  document.getElementById('tryoutFormMapel').value = target.mapel;
  document.getElementById('tryoutFormTanggal').value = target.tanggal;
  document.getElementById('tryoutFormJamMulai').value = target.jam_mulai;
  document.getElementById('tryoutFormJamSelesai').value = target.jam_selesai;
  document.getElementById('tryoutFormLink').value = target.link_tka || '';
  document.getElementById('tryoutFormPetunjuk').value = target.petunjuk || '';
  document.getElementById('tryoutFormStatus').value = target.status || 'DIBUKA';

  const modal = document.getElementById('tryoutFormModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeTryoutModal() {
  const modal = document.getElementById('tryoutFormModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleSaveTryout(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('tryoutFormId').value.trim();
  const judul = document.getElementById('tryoutFormJudul').value.trim();
  const mapel = document.getElementById('tryoutFormMapel').value;
  const tanggal = document.getElementById('tryoutFormTanggal').value;
  const jam_mulai = document.getElementById('tryoutFormJamMulai').value;
  const jam_selesai = document.getElementById('tryoutFormJamSelesai').value;
  const link_tka = document.getElementById('tryoutFormLink').value.trim();
  const petunjuk = document.getElementById('tryoutFormPetunjuk').value.trim();
  const status = document.getElementById('tryoutFormStatus').value;

  if (!judul) {
    alert('Nama / Judul tryout wajib diisi!');
    return;
  }

  const tryoutData = { id, judul, mapel, tanggal, jam_mulai, jam_selesai, link_tka, petunjuk, status };

  const gasUrl = getGasUrl();
  if (gasUrl) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveTryout', tryout: tryoutData })
      });
    } catch (err) {
      console.warn('Gagal simpan tryout ke GAS:', err);
    }
  }

  const tryouts = JSON.parse(localStorage.getItem('tka_tryouts')) || [];
  if (id) {
    const index = tryouts.findIndex(t => String(t.id).trim() === id);
    if (index >= 0) tryouts[index] = tryoutData;
  } else {
    tryoutData.id = 'TKA-' + Math.floor(100 + Math.random() * 900);
    tryouts.unshift(tryoutData);
  }

  localStorage.setItem('tka_tryouts', JSON.stringify(tryouts));
  closeTryoutModal();
  showAdminToast('Data Tryout berhasil disimpan!');
  loadAdminData();
}

async function deleteTryout(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus tryout ini? Data yang terhapus tidak dapat dikembalikan.')) {
    return;
  }

  const gasUrl = getGasUrl();
  if (gasUrl) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteTryout', id_tryout: id })
      });
    } catch (e) {
      console.warn('Gagal hapus tryout ke GAS:', e);
    }
  }

  let tryouts = JSON.parse(localStorage.getItem('tka_tryouts')) || [];
  tryouts = tryouts.filter(t => String(t.id).trim() !== String(id).trim());
  localStorage.setItem('tka_tryouts', JSON.stringify(tryouts));

  showAdminToast('Tryout telah dihapus.');
  loadAdminData();
}

// ==========================================
// 6. TAB 3: KELOLA PENGUMUMAN
// ==========================================

function renderAnnouncementsTable(pengumuman) {
  const container = document.getElementById('announcementsTableBody');
  if (!container) return;

  if (pengumuman.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" class="py-12 text-center text-slate-400">
          <p class="font-bold text-slate-600">Belum ada pengumuman</p>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = pengumuman.map(p => `
    <tr class="hover:bg-slate-50 transition border-b border-slate-100">
      <td class="py-4 px-4 font-bold text-slate-800">${p.judul}</td>
      <td class="py-4 px-4 text-xs text-slate-600 max-w-sm">${p.isi_pengumuman}</td>
      <td class="py-4 px-4 text-xs text-slate-500 font-mono">${p.tanggal}</td>
      <td class="py-4 px-4">
        <span class="px-2.5 py-1 rounded-full text-xs font-bold ${p.status === 'AKTIF' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
          ${p.status}
        </span>
      </td>
      <td class="py-4 px-4 text-right">
        <button onclick="deleteAnnouncement('${p.id}')" class="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs transition cursor-pointer">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function openAddAnnouncementModal() {
  document.getElementById('announcementFormJudul').value = '';
  document.getElementById('announcementFormIsi').value = '';
  document.getElementById('announcementFormTanggal').value = new Date().toISOString().split('T')[0];

  const modal = document.getElementById('announcementFormModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeAnnouncementModal() {
  const modal = document.getElementById('announcementFormModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleSaveAnnouncement(e) {
  if (e) e.preventDefault();

  const judul = document.getElementById('announcementFormJudul').value.trim();
  const isi_pengumuman = document.getElementById('announcementFormIsi').value.trim();
  const tanggal = document.getElementById('announcementFormTanggal').value;

  if (!judul || !isi_pengumuman) {
    alert('Judul dan isi pengumuman wajib diisi.');
    return;
  }

  const pData = {
    id: 'PGM-' + Math.floor(100 + Math.random() * 900),
    judul,
    isi_pengumuman,
    tanggal,
    status: 'AKTIF'
  };

  const gasUrl = getGasUrl();
  if (gasUrl) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveAnnouncement', announcement: pData })
      });
    } catch (e) {
      console.warn('Gagal simpan pengumuman ke GAS:', e);
    }
  }

  const pengumuman = JSON.parse(localStorage.getItem('tka_pengumuman')) || [];
  pengumuman.unshift(pData);
  localStorage.setItem('tka_pengumuman', JSON.stringify(pengumuman));

  closeAnnouncementModal();
  showAdminToast('Pengumuman baru berhasil diterbitkan!');
  loadAdminData();
}

async function deleteAnnouncement(id) {
  if (!confirm('Hapus pengumuman ini?')) return;

  const gasUrl = getGasUrl();
  if (gasUrl) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteAnnouncement', id_pengumuman: id })
      });
    } catch (e) {
      console.warn('Gagal hapus pengumuman di GAS:', e);
    }
  }

  let pengumuman = JSON.parse(localStorage.getItem('tka_pengumuman')) || [];
  pengumuman = pengumuman.filter(p => p.id !== id);
  localStorage.setItem('tka_pengumuman', JSON.stringify(pengumuman));

  showAdminToast('Pengumuman dihapus.');
  loadAdminData();
}

// ==========================================
// 7. TAB 4: DAFTAR SISWA
// ==========================================

function renderStudentsTable(siswa) {
  const container = document.getElementById('studentsTableBody');
  if (!container) return;

  container.innerHTML = siswa.map(s => `
    <tr class="hover:bg-slate-50 transition border-b border-slate-100">
      <td class="py-3.5 px-4 font-mono font-bold text-blue-600">${cleanNis(s.nis)}</td>
      <td class="py-3.5 px-4 font-bold text-slate-800">${s.nama}</td>
      <td class="py-3.5 px-4">
        <span class="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold">Kelas ${s.kelas}</span>
      </td>
      <td class="py-3.5 px-4 text-xs text-slate-500">Siswa Aktif</td>
    </tr>
  `).join('');
}

// ==========================================
// 8. TAB 5: INTEGRASI GOOGLE SHEETS
// ==========================================

function renderSheetsConfig() {
  const inputUrl = document.getElementById('sheetsGasUrlInput');
  const activeUrl = getGasUrl();
  if (inputUrl) {
    inputUrl.value = activeUrl;
  }
  const fixedInfo = document.getElementById('fixedUrlBadgeInfo');
  if (fixedInfo) {
    if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_GAS_URL && CONFIG.DEFAULT_GAS_URL.trim().startsWith('http')) {
      fixedInfo.innerHTML = `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300"><i class="fa-solid fa-circle-check text-emerald-600"></i> Link Tetap Terpasang di config.js: <code class="font-mono text-emerald-900">${CONFIG.DEFAULT_GAS_URL}</code></span>`;
    } else {
      fixedInfo.innerHTML = `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200"><i class="fa-solid fa-house-laptop text-blue-600"></i> Untuk akses siswa di rumah, tempelkan link Anda ke file <b>config.js</b> (variabel <code>DEFAULT_GAS_URL</code>) atau klik Simpan URL di sini.</span>`;
    }
  }

  updateSchoolPasswordBadge();
}

/**
 * Memperbarui tampilan badge password sekolah aktif di panel admin
 */
function updateSchoolPasswordBadge(pass) {
  const currentPass = pass || (typeof window.getActiveStudentPassword === 'function' 
    ? window.getActiveStudentPassword() 
    : (localStorage.getItem('tka_school_password') || 'tka2026'));
  const badge = document.getElementById('adminCurrentSchoolPassBadge');
  if (badge) {
    badge.innerText = currentPass;
  }
}

/**
 * Menyimpan password gerbang masuk siswa baru (satu sekolah)
 */
async function handleSaveSchoolPassword() {
  const input = document.getElementById('adminNewSchoolPassInput');
  if (!input) return;
  const newPass = input.value.trim();

  if (!newPass) {
    alert('Password baru tidak boleh kosong!');
    input.focus();
    return;
  }

  // Simpan di LocalStorage agar langsung aktif di browser ini & tab lain
  localStorage.setItem('tka_school_password', newPass);
  updateSchoolPasswordBadge(newPass);

  // Simpan ke Google Apps Script / Google Sheets
  const gasUrl = getGasUrl();
  if (gasUrl) {
    try {
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveSchoolPassword',
          password: newPass
        })
      });
    } catch (e) {
      console.warn('Gagal POST saveSchoolPassword ke GAS, mencoba GET fallback:', e);
      try {
        await fetch(`${gasUrl}?action=saveSchoolPassword&password=${encodeURIComponent(newPass)}&_t=${Date.now()}`);
      } catch (e2) {
        console.warn('GET saveSchoolPassword fallback gagal:', e2);
      }
    }
  }

  input.value = '';
  showAdminToast(`Password masuk siswa berhasil diperbarui menjadi: "${newPass}"`);
}

function saveGasUrl() {
  const inputUrl = document.getElementById('sheetsGasUrlInput');
  if (!inputUrl) return;

  const val = inputUrl.value.trim();
  localStorage.setItem('tka_gas_url', val);
  showAdminToast('URL Web App Google Apps Script berhasil disimpan!');
  testGasConnection();
}

async function testGasConnection() {
  const gasUrl = getGasUrl();
  const resultEl = document.getElementById('gasTestResult');
  if (!resultEl) return;

  if (!gasUrl) {
    resultEl.innerHTML = '<span class="text-amber-600 font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> URL Google Apps Script masih kosong. Aplikasi berjalan dalam mode simulasi lokal.</span>';
    return;
  }

  resultEl.innerHTML = '<span class="text-blue-600 font-bold"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Menghubungi Google Apps Script...</span>';

  try {
    const res = await fetch(`${gasUrl}?action=ping&_t=${Date.now()}`);
    const data = await res.json();
    if (data && data.success) {
      resultEl.innerHTML = `<span class="text-emerald-600 font-bold"><i class="fa-solid fa-circle-check mr-1"></i> Terhubung Sukses! Backend Google Apps Script aktif (${data.message || 'OK'}).</span>`;
      loadAdminData();
    } else {
      resultEl.innerHTML = `<span class="text-red-600 font-bold"><i class="fa-solid fa-circle-xmark mr-1"></i> Terhubung tetapi respons tidak valid: ${JSON.stringify(data)}</span>`;
    }
  } catch (err) {
    resultEl.innerHTML = `<span class="text-red-600 font-bold"><i class="fa-solid fa-circle-xmark mr-1"></i> Gagal terhubung. Pastikan Web App di-deploy dengan akses: "Anyone" (Siapa saja). Error: ${err.message}</span>`;
  }
}

function copyCodeGsContent() {
  alert('Silakan salin seluruh kode dari file Code.gs yang telah diperbarui di repositori ini, lalu tempelkan ke editor Apps Script Google Sheets Anda dan klik Deploy > New deployment.');
}

function resetToDefaultData() {
  if (!confirm('Apakah Anda ingin mereset seluruh data simulasi ke pengaturan awal?')) return;
  localStorage.removeItem('tka_tryouts');
  localStorage.removeItem('tka_konfirmasi');
  localStorage.removeItem('tka_pengumuman');
  localStorage.removeItem('tka_siswa_list');
  location.reload();
}

// ==========================================
// 9. TOAST NOTIFICATION
// ==========================================

function showAdminToast(message) {
  const toast = document.getElementById('adminToast');
  const msgEl = document.getElementById('adminToastMsg');
  if (!toast || !msgEl) return;

  msgEl.innerText = message;
  toast.classList.remove('hidden', 'translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 3500);
}

// Expose globals
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.fillDemoAccount = fillDemoAccount;
window.switchAdminTab = switchAdminTab;
window.approveStudentPermission = approveStudentPermission;
window.approveAllPending = approveAllPending;
window.rejectStudentPermission = rejectStudentPermission;
window.toggleTryoutStatus = toggleTryoutStatus;
window.openAddTryoutModal = openAddTryoutModal;
window.openEditTryoutModal = openEditTryoutModal;
window.closeTryoutModal = closeTryoutModal;
window.handleSaveTryout = handleSaveTryout;
window.deleteTryout = deleteTryout;
window.openAddAnnouncementModal = openAddAnnouncementModal;
window.closeAnnouncementModal = closeAnnouncementModal;
window.handleSaveAnnouncement = handleSaveAnnouncement;
window.deleteAnnouncement = deleteAnnouncement;
window.saveGasUrl = saveGasUrl;
window.testGasConnection = testGasConnection;
window.copyCodeGsContent = copyCodeGsContent;
window.resetToDefaultData = resetToDefaultData;
window.loadAdminData = loadAdminData;
window.handleSaveSchoolPassword = handleSaveSchoolPassword;
window.updateSchoolPasswordBadge = updateSchoolPasswordBadge;

// Init
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});
