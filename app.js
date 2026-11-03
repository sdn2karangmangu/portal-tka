/**
 * PORTAL TRYOUT TKA SISWA - app.js
 * Logika Frontend Siswa SD (JavaScript Vanilla)
 * Didukung Normalisasi Status Fleksibel & Sinkronisasi Cepat (Google Sheets + LocalStorage)
 */

// ==========================================
// 1. DATA STATE & DEFAULT SEED DATA
// ==========================================

const DEFAULT_SISWA_LIST = [
  { id: 'USR-03', nama: 'Ahmad Fauzi', nis: '1021', kelas: '6A' },
  { id: 'USR-04', nama: 'Bella Safitri', nis: '1022', kelas: '6A' },
  { id: 'USR-05', nama: 'Dimas Arya Pratama', nis: '1023', kelas: '6B' },
  { id: 'USR-06', nama: 'Siti Nurhaliza', nis: '1024', kelas: '6B' },
  { id: 'USR-07', nama: 'Reza Rahardian', nis: '1025', kelas: '6A' },
  { id: 'USR-08', nama: 'Putri Cantika', nis: '1026', kelas: '6B' }
];

const DEFAULT_TRYOUTS = [
  {
    id: 'TKA-01',
    judul: 'Tryout 1 TKA Matematika - Numerasi Dasar',
    mapel: 'Matematika',
    tanggal: new Date().toISOString().split('T')[0],
    jam_mulai: '08:00',
    jam_selesai: '09:30',
    link_tka: 'https://forms.gle/sampleMathTKA2026',
    petunjuk: 'Kerjakan 30 butir soal pilihan ganda. Dilarang menggunakan kalkulator. Siapkan kertas buram untuk berhitung. Berdoalah sebelum mulai!',
    status: 'DIBUKA'
  },
  {
    id: 'TKA-02',
    judul: 'Tryout TKA Bahasa Indonesia - Literasi Cerita & Teks Informasi',
    mapel: 'Bahasa Indonesia',
    tanggal: new Date().toISOString().split('T')[0],
    jam_mulai: '10:00',
    jam_selesai: '11:30',
    link_tka: 'https://forms.gle/sampleIndoTKA2026',
    petunjuk: 'Bacalah setiap wacana cerita dan puisi dengan cermat. Perhatikan kalimat utama dan ide pokok paragraf sebelum memilih jawaban.',
    status: 'DIBUKA'
  },
  {
    id: 'TKA-03',
    judul: 'Tryout TKA IPAS - Sains Alam & Lingkungan',
    mapel: 'IPAS',
    tanggal: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    jam_mulai: '08:00',
    jam_selesai: '09:30',
    link_tka: 'https://forms.gle/sampleIpasTKA2026',
    petunjuk: 'Materi seputar adaptasi makhluk hidup, magnet, dan siklus air bumi. Ujian akan dibuka besok pagi oleh guru pengawas.',
    status: 'DITUTUP'
  },
  {
    id: 'TKA-04',
    judul: 'Simulasi Mandiri TKA PPKn & Karakter Pancasila',
    mapel: 'PPKn',
    tanggal: '2026-11-01',
    jam_mulai: '08:00',
    jam_selesai: '09:15',
    link_tka: 'https://forms.gle/samplePpknTKA2026',
    petunjuk: 'Simulasi telah sukses terlaksana. Terima kasih atas partisipasi seluruh siswa kelas 6.',
    status: 'SELESAI'
  }
];

const DEFAULT_PENGUMUMAN = [
  {
    id: 'PGM-01',
    judul: '🔔 Pelaksanaan Tryout TKA Hari Ini Dimulai!',
    isi_pengumuman: 'Selamat pagi anak-anak hebat! Tryout TKA Matematika telah dibuka. Pastikan sinyal internet stabil, lalu tekan tombol "MINTA IZIN" agar guru di kelas dapat memberikan akses pengerjaan. Semangat dan jujur selalu!',
    tanggal: new Date().toISOString().split('T')[0],
    status: 'AKTIF'
  },
  {
    id: 'PGM-02',
    judul: '⭐ Tata Tertib & Tips Menjawab',
    isi_pengumuman: 'Jika tombol MULAI TKA masih berwarna kuning (Menunggu Guru), harap tenang dan tunggu beberapa saat ya, guru sedang menyetujui antrean di meja pengawas.',
    tanggal: new Date().toISOString().split('T')[0],
    status: 'AKTIF'
  }
];

const DEFAULT_KONFIRMASI = [
  {
    id: 'KNF-01',
    id_tryout: 'TKA-01',
    nis: '1021',
    nama_siswa: 'Ahmad Fauzi',
    status_konfirmasi: 'DISETUJUI',
    waktu_permintaan: '2026-11-03 07:55:00',
    waktu_persetujuan: '2026-11-03 07:58:10'
  },
  {
    id: 'KNF-02',
    id_tryout: 'TKA-01',
    nis: '1022',
    nama_siswa: 'Bella Safitri',
    status_konfirmasi: 'MENUNGGU',
    waktu_permintaan: '2026-11-03 07:59:15',
    waktu_persetujuan: '-'
  }
];

// Helper pembersih NIS (menghapus trailing .0 jika dari excel/sheet)
function cleanNis(val) {
  if (!val && val !== 0) return '';
  return String(val).replace(/\.0+$/, '').trim();
}

/**
 * Normalisasi status konfirmasi yang sangat fleksibel:
 * Mendukung variasi 'DISETUJUI', 'SIAP DIMULAI', 'Disetujui', 'siap dimulai', 'ACC', 'SETUJU', 'MENUNGGU KONFIRMASI'
 */
function normalizeConfirmationStatus(val) {
  if (!val) return 'BELUM_MINTA';
  const s = String(val).trim().toUpperCase();

  // Status SIAP DIMULAI / DISETUJUI
  if (s === 'DISETUJUI' || s === 'SIAP DIMULAI' || s === 'SIAP_DIMULAI' || 
      s === 'SIAP' || s === 'ACC' || s === 'APPROVED' || s === 'SETUJU' || 
      s === 'SUDAH DISETUJUI' || s === 'DIIZINKAN') {
    return 'DISETUJUI';
  }

  // Status MENUNGGU KONFIRMASI
  if (s === 'MENUNGGU' || s === 'MENUNGGU KONFIRMASI' || s === 'MENUNGGU_KONFIRMASI' || 
      s === 'PENDING' || s === 'WAITING' || s === 'BELUM DISETUJUI') {
    return 'MENUNGGU';
  }

  // Status DITOLAK
  if (s === 'DITOLAK' || s === 'TOLAK' || s === 'REJECTED' || s === 'BATAL') {
    return 'DITOLAK';
  }

  return s;
}

// Inisialisasi LocalStorage jika belum ada data
function initLocalStorageData() {
  if (!localStorage.getItem('tka_tryouts')) {
    localStorage.setItem('tka_tryouts', JSON.stringify(DEFAULT_TRYOUTS));
  }
  if (!localStorage.getItem('tka_pengumuman')) {
    localStorage.setItem('tka_pengumuman', JSON.stringify(DEFAULT_PENGUMUMAN));
  }
  if (!localStorage.getItem('tka_konfirmasi')) {
    localStorage.setItem('tka_konfirmasi', JSON.stringify(DEFAULT_KONFIRMASI));
  }
  if (!localStorage.getItem('tka_siswa_list')) {
    localStorage.setItem('tka_siswa_list', JSON.stringify(DEFAULT_SISWA_LIST));
  }
  if (!localStorage.getItem('tka_active_student')) {
    localStorage.setItem('tka_active_student', JSON.stringify(DEFAULT_SISWA_LIST[0]));
  }
}

initLocalStorageData();

// ==========================================
// 2. STATE MANAGER
// ==========================================

let currentStudent = JSON.parse(localStorage.getItem('tka_active_student')) || DEFAULT_SISWA_LIST[0];
let activeTryoutFilter = 'active'; // 'active', 'all', 'history'
let pollingInterval = null;
let selectedTryoutForModal = null;
let lastKnownStatuses = {}; // Melacak perubahan status untuk trigger animasi / notifikasi ceria

// ==========================================
// 3. API & DATA FETCHING
// ==========================================

function getGasUrl() {
  if (typeof window !== 'undefined' && typeof window.getActiveGasUrl === 'function') {
    return window.getActiveGasUrl();
  }
  if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_GAS_URL && CONFIG.DEFAULT_GAS_URL.trim().startsWith('http')) {
    return CONFIG.DEFAULT_GAS_URL.trim();
  }
  return (localStorage.getItem('tka_gas_url') || '').trim();
}

/**
 * Mengambil data terkini (Tryout, Pengumuman, Status Izin Siswa)
 */
async function loadPortalData() {
  const gasUrl = getGasUrl();
  const currentNis = cleanNis(currentStudent.nis);

  if (gasUrl) {
    try {
      showLoadingIndicator(true);
      // Gunakan timestamp cache-buster agar respons Google Sheet selalu paling segar
      const url = `${gasUrl}?action=getInitialData&nis=${encodeURIComponent(currentNis)}&_t=${Date.now()}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.success) {
        // Normalisasi status konfirmasi setiap tryout yang diterima dari Google Sheets
        const normalizedTryouts = (data.tryouts || []).map(t => {
          if (t.konfirmasi_siswa) {
            t.konfirmasi_siswa.status_konfirmasi = normalizeConfirmationStatus(t.konfirmasi_siswa.status_konfirmasi);
          }
          return t;
        });

        // Deteksi apakah status baru saja berubah menjadi DISETUJUI
        checkAndNotifyApproval(normalizedTryouts);

        renderAnnouncements(data.pengumuman || []);
        renderTryoutCards(normalizedTryouts);

        if (data.siswaList && data.siswaList.length > 0) {
          localStorage.setItem('tka_siswa_list', JSON.stringify(data.siswaList));
        }

        updateDataSourceBadge('Google Sheets (Online)', 'bg-emerald-100 text-emerald-800 border-emerald-300');
        showLoadingIndicator(false);
        return;
      }
    } catch (e) {
      console.warn('Gagal koneksi ke Google Apps Script, beralih ke penyimpanan lokal:', e);
      updateDataSourceBadge('Mode Simulasi Lokal', 'bg-amber-100 text-amber-800 border-amber-300');
    }
  } else {
    updateDataSourceBadge('Mode Simulasi / Siap Integrasi Sheets', 'bg-blue-100 text-blue-800 border-blue-300');
  }

  // Fallback: LocalStorage Data
  const tryouts = JSON.parse(localStorage.getItem('tka_tryouts')) || DEFAULT_TRYOUTS;
  const pengumuman = JSON.parse(localStorage.getItem('tka_pengumuman')) || DEFAULT_PENGUMUMAN;
  const konfirmasi = JSON.parse(localStorage.getItem('tka_konfirmasi')) || DEFAULT_KONFIRMASI;

  // Gabungkan status izin siswa saat ini dengan normalisasi
  const enrichedTryouts = tryouts.map(t => {
    const studentConf = konfirmasi.find(k => String(k.id_tryout).trim() === String(t.id).trim() && cleanNis(k.nis) === currentNis);
    const rawStatus = studentConf ? studentConf.status_konfirmasi : 'BELUM_MINTA';
    const normStatus = normalizeConfirmationStatus(rawStatus);

    return {
      ...t,
      konfirmasi_siswa: studentConf ? { ...studentConf, status_konfirmasi: normStatus } : { status_konfirmasi: 'BELUM_MINTA' }
    };
  });

  checkAndNotifyApproval(enrichedTryouts);
  renderAnnouncements(pengumuman.filter(p => p.status === 'AKTIF'));
  renderTryoutCards(enrichedTryouts);
  showLoadingIndicator(false);
}

/**
 * Notifikasi suara & visual saat guru menyetujui izin
 */
function checkAndNotifyApproval(tryoutList) {
  tryoutList.forEach(t => {
    const prevStatus = lastKnownStatuses[t.id];
    const currentStatus = t.konfirmasi_siswa ? t.konfirmasi_siswa.status_konfirmasi : 'BELUM_MINTA';

    if (prevStatus === 'MENUNGGU' && currentStatus === 'DISETUJUI') {
      showNotification(`🎉 Izin untuk ${t.mapel} telah disetujui guru! Tombol MULAI TKA sudah aktif.`, 'success');
      playChimeSound();
    }
    lastKnownStatuses[t.id] = currentStatus;
  });
}

// ==========================================
// 4. RENDERERS
// ==========================================

function renderStudentBadge() {
  const badge = document.getElementById('studentBadgeContainer');
  if (!badge) return;

  const initials = currentStudent.nama
    ? currentStudent.nama.split(' ').map(n => n[0]).slice(0, 2).join('')
    : 'SD';

  badge.innerHTML = `
    <div class="flex items-center gap-3 bg-white/90 border-2 border-blue-200 rounded-2xl p-2 pl-3 shadow-sm hover:border-blue-400 transition cursor-pointer" onclick="openStudentPickerModal()">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow">
        ${initials}
      </div>
      <div class="text-left pr-2">
        <div class="flex items-center gap-2">
          <span class="text-xs uppercase font-extrabold tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Kelas ${currentStudent.kelas || '6A'}</span>
          <span class="text-xs text-slate-400 font-mono">NIS: ${currentStudent.nis}</span>
        </div>
        <div class="text-sm font-bold text-slate-800 truncate max-w-[150px] sm:max-w-[190px]">
          ${currentStudent.nama}
        </div>
      </div>
      <div class="text-slate-400 hover:text-blue-600 pr-1">
        <i class="fa-solid fa-arrows-rotate text-sm"></i>
      </div>
    </div>
  `;
}

function renderAnnouncements(list) {
  const container = document.getElementById('announcementContainer');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700 flex items-center gap-3">
        <i class="fa-solid fa-circle-info text-blue-500 text-lg"></i>
        <span>Belum ada pengumuman baru dari guru pengawas.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => `
    <div class="notice-box bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-200/80 mb-3 relative overflow-hidden">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 text-lg shadow-sm">
          <i class="fa-solid fa-bullhorn animate-bounce"></i>
        </div>
        <div class="flex-1">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h4 class="font-bold text-slate-900 text-base flex items-center gap-2">
              ${item.judul}
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                Penting
              </span>
            </h4>
            <span class="text-xs text-slate-400 flex items-center gap-1 font-mono">
              <i class="fa-regular fa-calendar"></i> ${item.tanggal}
            </span>
          </div>
          <p class="text-slate-600 text-sm leading-relaxed">${item.isi_pengumuman}</p>
        </div>
      </div>
    </div>
  `).join('');
}

function getSubjectBadge(mapel) {
  const m = (mapel || '').toLowerCase();
  if (m.includes('matematika') || m.includes('hitung') || m.includes('numerasi')) {
    return { bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'fa-calculator', color: 'text-blue-600' };
  } else if (m.includes('indonesia') || m.includes('literasi') || m.includes('baca')) {
    return { bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'fa-book-open-reader', color: 'text-amber-600' };
  } else if (m.includes('ipa') || m.includes('ipas') || m.includes('sains')) {
    return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fa-flask-vial', color: 'text-emerald-600' };
  } else if (m.includes('ppkn') || m.includes('pancasila')) {
    return { bg: 'bg-red-50 text-red-700 border-red-200', icon: 'fa-award', color: 'text-red-600' };
  } else if (m.includes('inggris')) {
    return { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: 'fa-globe', color: 'text-indigo-600' };
  }
  return { bg: 'bg-slate-50 text-slate-700 border-slate-200', icon: 'fa-graduation-cap', color: 'text-slate-600' };
}

function renderTryoutCards(list) {
  const container = document.getElementById('tryoutListContainer');
  if (!container) return;

  let filtered = list;
  if (activeTryoutFilter === 'active') {
    filtered = list.filter(t => t.status !== 'SELESAI');
  } else if (activeTryoutFilter === 'history') {
    filtered = list.filter(t => t.status === 'SELESAI');
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white rounded-3xl p-10 text-center border-2 border-dashed border-slate-200">
        <div class="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl">
          <i class="fa-solid fa-folder-open"></i>
        </div>
        <h3 class="font-bold text-slate-800 text-lg mb-1">Belum Ada Tryout</h3>
        <p class="text-slate-500 text-sm max-w-md mx-auto">
          Tidak ada data tryout pada kategori ini. Guru akan segera menambahkan jadwal dan link ujian terbaru.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(tryout => {
    const subInfo = getSubjectBadge(tryout.mapel);
    const conf = tryout.konfirmasi_siswa || { status_konfirmasi: 'BELUM_MINTA' };
    const confStatus = normalizeConfirmationStatus(conf.status_konfirmasi);
    const isExamOpen = (tryout.status === 'DIBUKA' || tryout.status === 'SEDANG_BERLANGSUNG');
    const isExamFinished = tryout.status === 'SELESAI';

    let badgeHtml = '';
    let actionBtnHtml = '';

    if (isExamFinished) {
      badgeHtml = `<span class="badge-status badge-selesai"><i class="fa-solid fa-flag-checkered"></i> Selesai</span>`;
      actionBtnHtml = `
        <button disabled class="w-full py-3.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-bold text-sm cursor-not-allowed border border-slate-200">
          <i class="fa-solid fa-circle-check mr-2"></i> Ujian Telah Ditutup
        </button>
      `;
    } else if (!isExamOpen) {
      badgeHtml = `<span class="badge-status badge-belum-dibuka"><i class="fa-solid fa-lock"></i> Belum Dibuka</span>`;
      actionBtnHtml = `
        <button disabled class="w-full py-3.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-bold text-sm cursor-not-allowed border border-slate-200 flex items-center justify-center gap-2">
          <i class="fa-solid fa-lock"></i> Akses Belum Dibuka Guru
        </button>
      `;
    } else {
      // Tryout dibuka oleh guru
      if (confStatus === 'DISETUJUI') {
        badgeHtml = `<span class="badge-status badge-siap"><i class="fa-solid fa-circle-check text-green-600"></i> Siap Dimulai</span>`;
        actionBtnHtml = `
          <button onclick="handleStartExam('${tryout.id}')" class="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-600 hover:from-emerald-600 hover:to-green-700 text-white font-extrabold text-base shadow-lg hover:shadow-xl transition transform active:scale-95 flex items-center justify-center gap-3 btn-mulai-pulse border-2 border-emerald-300 cursor-pointer">
            <i class="fa-solid fa-rocket text-xl"></i>
            <span>MULAI TKA SEKARANG</span>
            <i class="fa-solid fa-arrow-right"></i>
          </button>
        `;
      } else if (confStatus === 'MENUNGGU') {
        badgeHtml = `<span class="badge-status badge-menunggu"><i class="fa-solid fa-clock-rotate-left"></i> Menunggu Konfirmasi</span>`;
        actionBtnHtml = `
          <div class="space-y-2">
            <div class="w-full py-3.5 px-4 rounded-xl shimmer-waiting text-amber-900 font-bold text-sm flex items-center justify-center gap-2 border border-amber-300">
              <i class="fa-solid fa-spinner fa-spin text-amber-700"></i>
              <span>Menunggu Guru Menyetujui Izin...</span>
            </div>
            <button onclick="loadPortalData()" class="w-full py-2 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 flex items-center justify-center gap-1.5 transition cursor-pointer">
              <i class="fa-solid fa-rotate text-xs"></i> Periksa Status Sekarang
            </button>
          </div>
        `;
      } else {
        // Belum minta izin
        badgeHtml = `<span class="badge-status badge-berlangsung"><i class="fa-solid fa-satellite-dish text-blue-600"></i> Sedang Berlangsung</span>`;
        actionBtnHtml = `
          <button onclick="handleRequestPermission('${tryout.id}')" class="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2 border border-orange-400 cursor-pointer">
            <i class="fa-solid fa-hand text-base"></i>
            <span>MINTA IZIN IKUT TKA</span>
          </button>
        `;
      }
    }

    return `
      <div class="tka-card bg-white rounded-3xl p-5 md:p-6 border border-slate-200/90 flex flex-col justify-between relative overflow-hidden">
        <!-- Top Subject & Status -->
        <div>
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${subInfo.bg}">
              <i class="fa-solid ${subInfo.icon} ${subInfo.color}"></i>
              ${tryout.mapel}
            </span>
            ${badgeHtml}
          </div>

          <h3 class="font-extrabold text-slate-900 text-lg md:text-xl leading-snug mb-3">
            ${tryout.judul}
          </h3>

          <!-- Schedule & Hours -->
          <div class="bg-slate-50 rounded-2xl p-3.5 mb-4 border border-slate-100 space-y-2">
            <div class="flex items-center justify-between text-xs text-slate-600">
              <span class="flex items-center gap-1.5 font-medium">
                <i class="fa-regular fa-calendar-check text-blue-500"></i> Tanggal:
              </span>
              <span class="font-bold text-slate-800">${tryout.tanggal}</span>
            </div>
            <div class="flex items-center justify-between text-xs text-slate-600">
              <span class="flex items-center gap-1.5 font-medium">
                <i class="fa-regular fa-clock text-blue-500"></i> Jam Ujian:
              </span>
              <span class="font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded-md">
                ${tryout.jam_mulai} - ${tryout.jam_selesai} WIB
              </span>
            </div>
          </div>

          <!-- Petunjuk Guru -->
          <div class="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-3.5 mb-5 text-xs text-slate-700">
            <div class="font-bold text-amber-900 mb-1 flex items-center gap-1.5">
              <i class="fa-solid fa-chalkboard-user text-amber-600"></i> Petunjuk Guru:
            </div>
            <p class="leading-relaxed text-slate-600 italic">
              "${tryout.petunjuk || 'Kerjakan dengan teliti dan penuh kejujuran.'}"
            </p>
          </div>
        </div>

        <!-- Action Area -->
        <div class="pt-2 border-t border-slate-100">
          ${actionBtnHtml}
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 5. INTERAKSI SISWA
// ==========================================

/**
 * Siswa meminta izin kepada guru
 */
async function handleRequestPermission(tryoutId) {
  const gasUrl = getGasUrl();
  const studentNis = cleanNis(currentStudent.nis);

  showNotification('Sedang mengirim permintaan izin ke guru...', 'info');

  if (gasUrl) {
    try {
      // Gunakan text/plain agar bebas dari CORS preflight OPTIONS request
      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'requestPermission',
          id_tryout: tryoutId,
          nis: studentNis,
          nama_siswa: currentStudent.nama
        })
      });
    } catch (e) {
      console.warn('Gagal POST requestPermission ke GAS, coba GET fallback:', e);
      try {
        await fetch(`${gasUrl}?action=requestPermission&id_tryout=${encodeURIComponent(tryoutId)}&nis=${encodeURIComponent(studentNis)}&nama_siswa=${encodeURIComponent(currentStudent.nama)}&_t=${Date.now()}`);
      } catch (e2) {
        console.warn('GET fallback juga gagal, gunakan lokal:', e2);
      }
    }
  }

  // Update LocalStorage agar responsif seketika
  const konfirmasi = JSON.parse(localStorage.getItem('tka_konfirmasi')) || DEFAULT_KONFIRMASI;
  const existingIndex = konfirmasi.findIndex(k => String(k.id_tryout).trim() === String(tryoutId).trim() && cleanNis(k.nis) === studentNis);
  const now = new Date();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  if (existingIndex >= 0) {
    konfirmasi[existingIndex].status_konfirmasi = 'MENUNGGU';
    konfirmasi[existingIndex].waktu_permintaan = timeStr;
  } else {
    konfirmasi.push({
      id: 'KNF-' + Math.floor(1000 + Math.random() * 9000),
      id_tryout: tryoutId,
      nis: studentNis,
      nama_siswa: currentStudent.nama,
      status_konfirmasi: 'MENUNGGU',
      waktu_permintaan: timeStr,
      waktu_persetujuan: '-'
    });
  }

  localStorage.setItem('tka_konfirmasi', JSON.stringify(konfirmasi));
  showNotification('Permintaan izin telah dikirim ke guru pengawas!', 'success');
  playChimeSound();
  loadPortalData();
  startAutoPolling();
}

/**
 * Siswa memulai ujian (Membuka modal konfirmasi terlebih dahulu)
 */
async function handleStartExam(tryoutId) {
  const tryouts = JSON.parse(localStorage.getItem('tka_tryouts')) || DEFAULT_TRYOUTS;
  const target = tryouts.find(t => String(t.id).trim() === String(tryoutId).trim());
  if (!target) return;

  selectedTryoutForModal = target;

  document.getElementById('modalExamTitle').innerText = target.judul;
  document.getElementById('modalExamMapel').innerText = target.mapel;
  document.getElementById('modalExamTime').innerText = `${target.jam_mulai} - ${target.jam_selesai} WIB`;
  document.getElementById('modalStudentName').innerText = `${currentStudent.nama} (Kelas ${currentStudent.kelas})`;

  const modal = document.getElementById('examConfirmModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

/**
 * Konfirmasi final untuk membuka link ujian di tab baru
 */
async function executeOpenExamLink() {
  if (!selectedTryoutForModal) return;

  const gasUrl = getGasUrl();
  const studentNis = cleanNis(currentStudent.nis);
  let examUrl = selectedTryoutForModal.link_tka;

  if (gasUrl) {
    try {
      const res = await fetch(`${gasUrl}?action=checkStudentStatus&nis=${encodeURIComponent(studentNis)}&id_tryout=${encodeURIComponent(selectedTryoutForModal.id)}&_t=${Date.now()}`);
      const data = await res.json();
      if (data && data.allowed && data.link_tka) {
        examUrl = data.link_tka;
      } else {
        alert('Maaf, akses ujian belum disetujui di server atau tryout telah ditutup.');
        closeExamConfirmModal();
        loadPortalData();
        return;
      }
    } catch (e) {
      console.warn('Validasi server gagal, menggunakan link lokal:', e);
    }
  }

  closeExamConfirmModal();

  if (examUrl) {
    window.open(examUrl, '_blank', 'noopener,noreferrer');
  } else {
    alert('Link ujian belum dimasukkan oleh guru.');
  }
}

function closeExamConfirmModal() {
  const modal = document.getElementById('examConfirmModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// ==========================================
// 6. STUDENT PICKER MODAL
// ==========================================

function openStudentPickerModal() {
  const modal = document.getElementById('studentPickerModal');
  const listContainer = document.getElementById('studentPickerList');
  if (!modal || !listContainer) return;

  const siswaList = JSON.parse(localStorage.getItem('tka_siswa_list')) || DEFAULT_SISWA_LIST;

  listContainer.innerHTML = siswaList.map(s => {
    const isSelected = cleanNis(s.nis) === cleanNis(currentStudent.nis);
    return `
      <div onclick="selectStudent('${s.nis}')" class="p-3.5 rounded-2xl border-2 ${isSelected ? 'border-blue-600 bg-blue-50/80 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-300'} flex items-center justify-between cursor-pointer transition">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'} flex items-center justify-center font-bold text-sm">
            ${s.kelas}
          </div>
          <div>
            <div class="font-bold text-slate-800 text-sm">${s.nama}</div>
            <div class="text-xs text-slate-500 font-mono">NIS: ${s.nis} &bull; Kelas ${s.kelas}</div>
          </div>
        </div>
        <div>
          ${isSelected ? '<i class="fa-solid fa-circle-check text-blue-600 text-lg"></i>' : '<span class="text-xs text-blue-600 font-bold px-2 py-1 rounded bg-blue-50">Pilih</span>'}
        </div>
      </div>
    `;
  }).join('');

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function selectStudent(nis) {
  const siswaList = JSON.parse(localStorage.getItem('tka_siswa_list')) || DEFAULT_SISWA_LIST;
  const target = siswaList.find(s => cleanNis(s.nis) === cleanNis(nis));
  if (target) {
    currentStudent = target;
    localStorage.setItem('tka_active_student', JSON.stringify(target));
    renderStudentBadge();
    loadPortalData();
    closeStudentPickerModal();
    showNotification(`Selamat datang, ${target.nama}!`, 'info');
  }
}

function closeStudentPickerModal() {
  const modal = document.getElementById('studentPickerModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// ==========================================
// 7. POLLING & AUTO-REFRESH
// ==========================================

function startAutoPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  // Cek setiap 3.5 detik untuk respons cepat saat guru menyetujui
  pollingInterval = setInterval(() => {
    loadPortalData();
  }, 3500);
}

// ==========================================
// 8. HELPERS & UTILITIES
// ==========================================

function setTryoutFilter(type) {
  activeTryoutFilter = type;
  document.querySelectorAll('.filter-tab-btn').forEach(btn => {
    btn.classList.remove('bg-blue-600', 'text-white', 'shadow');
    btn.classList.add('bg-white', 'text-slate-600', 'hover:bg-slate-50');
  });

  const activeBtn = document.getElementById(`filter-btn-${type}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-white', 'text-slate-600', 'hover:bg-slate-50');
    activeBtn.classList.add('bg-blue-600', 'text-white', 'shadow');
  }

  loadPortalData();
}

function showNotification(message, type = 'info') {
  const toast = document.getElementById('appToast');
  const toastMsg = document.getElementById('appToastMsg');
  if (!toast || !toastMsg) return;

  toastMsg.innerText = message;
  toast.classList.remove('hidden', 'translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 3500);
}

function showLoadingIndicator(show) {
  const loader = document.getElementById('portalSyncSpinner');
  if (loader) {
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
  }
}

function updateDataSourceBadge(label, colorClasses) {
  const badge = document.getElementById('dataSourceIndicator');
  if (!badge) return;
  badge.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClasses}`;
  badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-current"></span> ${label}`;
}

function playChimeSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    // AudioContext blocked
  }
}

function openHelpModal() {
  const modal = document.getElementById('helpModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeHelpModal() {
  const modal = document.getElementById('helpModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function startDigitalClock() {
  const clockEl = document.getElementById('digitalClock');
  if (!clockEl) return;
  const update = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    clockEl.innerText = `${hours}:${mins}:${secs} WIB`;
  };
  update();
  setInterval(update, 1000);
}

// Sinkronisasi Real-Time antar Tab Browser
window.addEventListener('storage', (e) => {
  if (e.key === 'tka_konfirmasi' || e.key === 'tka_tryouts' || e.key === 'tka_gas_url') {
    loadPortalData();
  }
});

// Expose globals for HTML onclicks
window.handleRequestPermission = handleRequestPermission;
window.handleStartExam = handleStartExam;
window.executeOpenExamLink = executeOpenExamLink;
window.closeExamConfirmModal = closeExamConfirmModal;
window.openStudentPickerModal = openStudentPickerModal;
window.closeStudentPickerModal = closeStudentPickerModal;
window.selectStudent = selectStudent;
window.setTryoutFilter = setTryoutFilter;
window.openHelpModal = openHelpModal;
window.closeHelpModal = closeHelpModal;
window.loadPortalData = loadPortalData;

// Init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  renderStudentBadge();
  startDigitalClock();
  loadPortalData();
  startAutoPolling();
});
