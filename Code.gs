/**
 * @file Code.gs
 * BACKEND GOOGLE APPS SCRIPT - PORTAL TRYOUT TKA SISWA (VERSI PERBAIKAN & PENINGKATAN)
 * 
 * Database: Google Sheets
 * 
 * DAFTAR SHEET:
 * 1. Users      : [ID, Nama, NIS, Kelas, Username, Password, Role]
 * 2. Tryout     : [ID, Judul, Mapel, Tanggal, Jam Mulai, Jam Selesai, Link TKA, Petunjuk, Status]
 * 3. Konfirmasi : [ID, ID Tryout, NIS, Nama Siswa, Status Konfirmasi, Waktu Permintaan, Waktu Persetujuan]
 * 4. Pengumuman : [ID, Judul, Isi Pengumuman, Tanggal, Status]
 * 
 * PENINGKATAN UTAMA:
 * - Normalisasi Status Fleksibel: Mengenali 'DISETUJUI', 'SIAP DIMULAI', 'Disetujui', 'siap dimulai', 'ACC', 'SETUJU'.
 * - Normalisasi Menunggu: Mengenali 'MENUNGGU', 'MENUNGGU KONFIRMASI', 'Menunggu', 'Pending'.
 * - Normalisasi NIS: Mengabaikan format float seperti '1021.0' atau spasi tak sengaja.
 * - Anti-duplikasi: Menghindari baris ganda di sheet Konfirmasi.
 * - Mendukung GET & POST (Anti-CORS / Bebas Preflight Block).
 * - SpreadsheetApp.flush() untuk memastikan pembaruan langsung tersimpan di sheet.
 */

// ==========================================
// 1. HANDLER HTTP GET & POST
// ==========================================

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'ping';
  var responseData = { success: false, action: action };

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var p = (e && e.parameter) ? e.parameter : {};

    if (action === 'ping') {
      responseData = {
        success: true,
        message: 'Backend Portal Tryout TKA Siswa aktif dan siap digunakan.',
        timestamp: new Date().toISOString()
      };
    } else if (action === 'getInitialData') {
      var nis = p.nis || '';
      responseData = getInitialDataForStudent(ss, nis);
    } else if (action === 'checkStudentStatus') {
      var nis = p.nis || '';
      var idTryout = p.id_tryout || '';
      responseData = checkStudentStatusSecure(ss, nis, idTryout);
    } else if (action === 'getAdminData') {
      responseData = getAdminFullData(ss);
    } else if (action === 'setup' || action === 'setupSheets') {
      responseData = setupSheets();
    }
    // Fallback GET actions (jika POST diblokir oleh CORS jaringan)
    else if (action === 'approvePermission') {
      responseData = handleApprovePermission(ss, p.confirmation_id, p.nis, p.id_tryout);
    } else if (action === 'batchApprove') {
      responseData = handleBatchApprove(ss, p.id_tryout);
    } else if (action === 'rejectPermission') {
      responseData = handleRejectPermission(ss, p.confirmation_id);
    } else if (action === 'requestPermission') {
      responseData = handleRequestPermission(ss, p.id_tryout, p.nis, p.nama_siswa);
    } else if (action === 'toggleTryoutStatus') {
      responseData = handleToggleTryoutStatus(ss, p.id_tryout, p.status);
    } else if (action === 'saveSchoolPassword') {
      responseData = handleSaveSchoolPassword(ss, p.password);
    } else {
      responseData = { success: false, message: 'Aksi GET tidak dikenali: ' + action };
    }
  } catch (err) {
    responseData = { success: false, error: err.toString() };
  }

  return createJsonResponse(responseData);
}

function doPost(e) {
  var responseData = { success: false };

  try {
    var postBody = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postBody = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        postBody = e.parameter || {};
      }
    } else if (e && e.parameter) {
      postBody = e.parameter;
    }

    var action = postBody.action || '';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (action) {
      case 'adminLogin':
        responseData = handleAdminLogin(ss, postBody.username, postBody.password);
        break;

      case 'requestPermission':
        responseData = handleRequestPermission(ss, postBody.id_tryout, postBody.nis, postBody.nama_siswa);
        break;

      case 'approvePermission':
        responseData = handleApprovePermission(ss, postBody.confirmation_id, postBody.nis, postBody.id_tryout);
        break;

      case 'batchApprove':
        responseData = handleBatchApprove(ss, postBody.id_tryout);
        break;

      case 'rejectPermission':
        responseData = handleRejectPermission(ss, postBody.confirmation_id);
        break;

      case 'saveTryout':
        responseData = handleSaveTryout(ss, postBody.tryout);
        break;

      case 'toggleTryoutStatus':
        responseData = handleToggleTryoutStatus(ss, postBody.id_tryout, postBody.status);
        break;

      case 'deleteTryout':
        responseData = handleDeleteTryout(ss, postBody.id_tryout);
        break;

      case 'saveAnnouncement':
        responseData = handleSaveAnnouncement(ss, postBody.announcement);
        break;

      case 'deleteAnnouncement':
        responseData = handleDeleteAnnouncement(ss, postBody.id_pengumuman);
        break;

      case 'setupSheets':
        responseData = setupSheets();
        break;

      case 'saveSchoolPassword':
        responseData = handleSaveSchoolPassword(ss, postBody.password);
        break;

      default:
        responseData = { success: false, message: 'Aksi POST tidak valid: ' + action };
    }
  } catch (err) {
    responseData = { success: false, error: err.toString() };
  }

  return createJsonResponse(responseData);
}

// Helper Response JSON dengan header MIME
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 2. NORMALISASI STATUS (KUNCI PERBAIKAN)
// ==========================================

/**
 * Menormalisasi status izin agar fleksibel:
 * Mengakomodasi input manual di Google Sheet: 'DISETUJUI', 'SIAP DIMULAI', 'Disetujui', 'siap dimulai', 'ACC', 'SETUJU'
 */
function normalizeConfirmationStatus(val) {
  if (!val) return 'BELUM_MINTA';
  var s = String(val).trim().toUpperCase();

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

/**
 * Menormalisasi status Tryout
 */
function normalizeTryoutStatus(val) {
  if (!val) return 'DITUTUP';
  var s = String(val).trim().toUpperCase();
  if (s === 'DIBUKA' || s === 'BUKA' || s === 'OPEN' || s === 'SEDANG BERLANGSUNG' || s === 'SEDANG_BERLANGSUNG' || s === 'AKTIF') {
    return 'DIBUKA';
  }
  if (s === 'SELESAI' || s === 'TUTUP' || s === 'CLOSED' || s === 'FINISHED') {
    return 'SELESAI';
  }
  return 'DITUTUP';
}

/**
 * Membersihkan NIS dari format angka float (misal 1021.0 -> 1021)
 */
function cleanNis(val) {
  if (!val && val !== 0) return '';
  return String(val).replace(/\.0+$/, '').trim();
}

// ==========================================
// 3. LOGIKA DATA SISWA (AMAN & AKURAT)
// ==========================================

/**
 * Mengambil data awal untuk siswa.
 * Memastikan status konfirmasi yang diubah di sheet terbaca dengan benar!
 */
function getInitialDataForStudent(ss, nis) {
  var tryoutSheet = getOrCreateSheet(ss, 'Tryout');
  var pengumumanSheet = getOrCreateSheet(ss, 'Pengumuman');
  var konfirmasiSheet = getOrCreateSheet(ss, 'Konfirmasi');
  var usersSheet = getOrCreateSheet(ss, 'Users');

  var cleanedTargetNis = cleanNis(nis);

  // 1. Ambil Pengumuman Aktif
  var pgmData = pengumumanSheet.getDataRange().getValues();
  var pengumumanList = [];
  for (var i = 1; i < pgmData.length; i++) {
    var row = pgmData[i];
    var pStatus = String(row[4] || '').trim().toUpperCase();
    if (row[0] && (pStatus === 'AKTIF' || pStatus === 'ACTIVE')) {
      pengumumanList.push({
        id: row[0],
        judul: row[1],
        isi_pengumuman: row[2],
        tanggal: formatDateCell(row[3]),
        status: 'AKTIF'
      });
    }
  }

  // 2. Ambil Konfirmasi untuk Siswa ini
  var knfData = konfirmasiSheet.getDataRange().getValues();
  var studentConfirmations = {};

  for (var j = 1; j < knfData.length; j++) {
    var kRow = knfData[j];
    if (!kRow[0]) continue;

    var rowNis = cleanNis(kRow[2]);
    var rowTryoutId = String(kRow[1]).trim();

    if (rowNis && rowNis === cleanedTargetNis) {
      var normStatus = normalizeConfirmationStatus(kRow[4]);
      
      // Jika sudah ada record sebelumnya, prioritaskan status DISETUJUI jika ada
      if (!studentConfirmations[rowTryoutId] || normStatus === 'DISETUJUI') {
        studentConfirmations[rowTryoutId] = {
          id: kRow[0],
          id_tryout: rowTryoutId,
          status_konfirmasi: normStatus,
          raw_status: String(kRow[4]),
          waktu_permintaan: formatDateTimeCell(kRow[5]),
          waktu_persetujuan: formatDateTimeCell(kRow[6])
        };
      }
    }
  }

  // 3. Ambil Tryout
  var tryoutData = tryoutSheet.getDataRange().getValues();
  var tryoutList = [];
  for (var k = 1; k < tryoutData.length; k++) {
    var tRow = tryoutData[k];
    if (!tRow[0]) continue;

    var tryoutId = String(tRow[0]).trim();
    var tryoutStatus = normalizeTryoutStatus(tRow[8]);
    var myConfirmation = studentConfirmations[tryoutId];
    var isApproved = myConfirmation && myConfirmation.status_konfirmasi === 'DISETUJUI';

    // KEAMANAN: HANYA berikan link TKA jika status tryout BUKA dan siswa SUDAH DISETUJUI
    var safeLink = '';
    if (isApproved && tryoutStatus === 'DIBUKA') {
      safeLink = tRow[6] || '';
    }

    tryoutList.push({
      id: tryoutId,
      judul: tRow[1],
      mapel: tRow[2],
      tanggal: formatDateCell(tRow[3]),
      jam_mulai: formatTimeCell(tRow[4]),
      jam_selesai: formatTimeCell(tRow[5]),
      link_tka: safeLink,
      petunjuk: tRow[7],
      status: tryoutStatus,
      konfirmasi_siswa: myConfirmation || { status_konfirmasi: 'BELUM_MINTA' }
    });
  }

  // 4. Ambil daftar siswa untuk selector di aplikasi
  var usersData = usersSheet.getDataRange().getValues();
  var siswaList = [];
  for (var u = 1; u < usersData.length; u++) {
    var uRow = usersData[u];
    var uRole = String(uRow[6] || '').toLowerCase().trim();
    if (uRow[0] && (uRole === 'siswa' || !uRole || uRole === 'student')) {
      siswaList.push({
        id: uRow[0],
        nama: uRow[1],
        nis: cleanNis(uRow[2]),
        kelas: uRow[3]
      });
    }
  }

  return {
    success: true,
    pengumuman: pengumumanList,
    tryouts: tryoutList,
    siswaList: siswaList,
    school_password: getSchoolPassword(ss),
    serverTime: new Date().toISOString()
  };
}

/**
 * Validasi ketat saat siswa menekan tombol "Mulai TKA".
 */
function checkStudentStatusSecure(ss, nis, idTryout) {
  if (!nis || !idTryout) {
    return { success: false, message: 'NIS dan ID Tryout wajib diisi.' };
  }

  var tryoutSheet = getOrCreateSheet(ss, 'Tryout');
  var konfirmasiSheet = getOrCreateSheet(ss, 'Konfirmasi');
  var targetNis = cleanNis(nis);
  var targetTryoutId = String(idTryout).trim();

  // Cari tryout
  var tData = tryoutSheet.getDataRange().getValues();
  var targetTryout = null;
  for (var i = 1; i < tData.length; i++) {
    if (String(tData[i][0]).trim() === targetTryoutId) {
      targetTryout = {
        id: tData[i][0],
        judul: tData[i][1],
        mapel: tData[i][2],
        link: tData[i][6],
        status: normalizeTryoutStatus(tData[i][8])
      };
      break;
    }
  }

  if (!targetTryout) {
    return { success: false, message: 'Tryout tidak ditemukan.' };
  }

  if (targetTryout.status !== 'DIBUKA') {
    return { 
      success: false, 
      allowed: false,
      status: targetTryout.status,
      message: 'Tryout ini belum dibuka atau telah selesai.' 
    };
  }

  // Cari konfirmasi siswa
  var kData = konfirmasiSheet.getDataRange().getValues();
  var studentConf = null;
  for (var j = 1; j < kData.length; j++) {
    if (String(kData[j][1]).trim() === targetTryoutId && cleanNis(kData[j][2]) === targetNis) {
      var normSt = normalizeConfirmationStatus(kData[j][4]);
      if (!studentConf || normSt === 'DISETUJUI') {
        studentConf = {
          id: kData[j][0],
          status: normSt
        };
      }
    }
  }

  if (!studentConf) {
    return { 
      success: true, 
      allowed: false, 
      status_konfirmasi: 'BELUM_MINTA',
      message: 'Kamu belum meminta izin kepada guru.' 
    };
  }

  if (studentConf.status === 'DISETUJUI') {
    return {
      success: true,
      allowed: true,
      status_konfirmasi: 'DISETUJUI',
      link_tka: targetTryout.link,
      message: 'Izin telah disetujui guru. Selamat mengerjakan!'
    };
  } else if (studentConf.status === 'MENUNGGU') {
    return {
      success: true,
      allowed: false,
      status_konfirmasi: 'MENUNGGU',
      message: 'Menunggu konfirmasi dan persetujuan dari guru.'
    };
  } else {
    return {
      success: true,
      allowed: false,
      status_konfirmasi: studentConf.status,
      message: 'Izin belum disetujui.'
    };
  }
}

// ==========================================
// 4. LOGIKA ADMIN / GURU
// ==========================================

function handleAdminLogin(ss, username, password) {
  var usersSheet = getOrCreateSheet(ss, 'Users');
  var data = usersSheet.getDataRange().getValues();

  var cleanInputUser = String(username || '').trim().toLowerCase();
  var cleanInputPass = String(password || '').trim();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var uRole = String(row[6] || '').toLowerCase().trim();
    var uUsername = String(row[4] || '').trim().toLowerCase();
    var uPassword = String(row[5] || '').trim();

    // Verifikasi role guru/admin, username (case-insensitive), dan password
    if ((uRole === 'guru' || uRole === 'admin') && uUsername === cleanInputUser && uPassword === cleanInputPass) {
      return {
        success: true,
        message: 'Login guru berhasil.',
        user: {
          id: row[0],
          nama: row[1] || 'Guru Pengawas',
          role: row[6] || 'guru',
          username: row[4]
        }
      };
    }
  }

  // Jika tidak ditemukan di sheet Users, tolak langsung (TIDAK ADA bypass demo)
  return { 
    success: false, 
    message: 'Username atau password guru salah. Silakan cek data akun pada sheet "Users" di Google Spreadsheet Anda.' 
  };
}

function getAdminFullData(ss) {
  var tryoutSheet = getOrCreateSheet(ss, 'Tryout');
  var pengumumanSheet = getOrCreateSheet(ss, 'Pengumuman');
  var konfirmasiSheet = getOrCreateSheet(ss, 'Konfirmasi');
  var usersSheet = getOrCreateSheet(ss, 'Users');

  // Tryouts
  var tData = tryoutSheet.getDataRange().getValues();
  var tryouts = [];
  for (var i = 1; i < tData.length; i++) {
    var r = tData[i];
    if (!r[0]) continue;
    tryouts.push({
      id: String(r[0]).trim(),
      judul: r[1],
      mapel: r[2],
      tanggal: formatDateCell(r[3]),
      jam_mulai: formatTimeCell(r[4]),
      jam_selesai: formatTimeCell(r[5]),
      link_tka: r[6],
      petunjuk: r[7],
      status: normalizeTryoutStatus(r[8])
    });
  }

  // Konfirmasi
  var kData = konfirmasiSheet.getDataRange().getValues();
  var konfirmasi = [];
  for (var j = 1; j < kData.length; j++) {
    var kr = kData[j];
    if (!kr[0]) continue;
    konfirmasi.push({
      id: String(kr[0]).trim(),
      id_tryout: String(kr[1]).trim(),
      nis: cleanNis(kr[2]),
      nama_siswa: kr[3],
      status_konfirmasi: normalizeConfirmationStatus(kr[4]),
      raw_status: String(kr[4]),
      waktu_permintaan: formatDateTimeCell(kr[5]),
      waktu_persetujuan: formatDateTimeCell(kr[6])
    });
  }

  // Pengumuman
  var pData = pengumumanSheet.getDataRange().getValues();
  var pengumuman = [];
  for (var k = 1; k < pData.length; k++) {
    var pr = pData[k];
    if (!pr[0]) continue;
    pengumuman.push({
      id: String(pr[0]).trim(),
      judul: pr[1],
      isi_pengumuman: pr[2],
      tanggal: formatDateCell(pr[3]),
      status: String(pr[4] || 'AKTIF').toUpperCase().trim()
    });
  }

  // Siswa
  var uData = usersSheet.getDataRange().getValues();
  var siswa = [];
  for (var u = 1; u < uData.length; u++) {
    var ur = uData[u];
    var role = String(ur[6] || '').toLowerCase().trim();
    if (ur[0] && (role === 'siswa' || !role || role === 'student')) {
      siswa.push({
        id: ur[0],
        nama: ur[1],
        nis: cleanNis(ur[2]),
        kelas: ur[3]
      });
    }
  }

  return {
    success: true,
    tryouts: tryouts,
    konfirmasi: konfirmasi,
    pengumuman: pengumuman,
    siswa: siswa,
    school_password: getSchoolPassword(ss)
  };
}

// ==========================================
// 5. ACTION MUTATIONS
// ==========================================

/**
 * Siswa meminta izin: memperbarui baris yang sudah ada atau membuat baru tanpa duplikasi.
 */
function handleRequestPermission(ss, idTryout, nis, namaSiswa) {
  if (!idTryout || !nis) {
    return { success: false, message: 'ID Tryout dan NIS wajib diisi.' };
  }

  var konfirmasiSheet = getOrCreateSheet(ss, 'Konfirmasi');
  var data = konfirmasiSheet.getDataRange().getValues();
  var nowStr = formatDateTime(new Date());
  var targetNis = cleanNis(nis);
  var targetTryoutId = String(idTryout).trim();

  // Cek apakah siswa sudah pernah minta izin untuk tryout ini
  for (var i = 1; i < data.length; i++) {
    var rowTryout = String(data[i][1]).trim();
    var rowNis = cleanNis(data[i][2]);

    if (rowTryout === targetTryoutId && rowNis === targetNis) {
      var rowNum = i + 1;
      konfirmasiSheet.getRange(rowNum, 5).setValue('MENUNGGU');
      konfirmasiSheet.getRange(rowNum, 6).setValue(nowStr);
      SpreadsheetApp.flush();
      return { 
        success: true, 
        message: 'Permintaan izin telah diperbarui. Menunggu persetujuan guru.',
        id: data[i][0]
      };
    }
  }

  // Tambahkan baris baru
  var newId = 'KNF-' + Math.floor(1000 + Math.random() * 9000);
  konfirmasiSheet.appendRow([newId, targetTryoutId, targetNis, namaSiswa, 'MENUNGGU', nowStr, '-']);
  SpreadsheetApp.flush();

  return {
    success: true,
    message: 'Permintaan izin berhasil dikirim ke guru!',
    id: newId
  };
}

/**
 * Guru menyetujui izin siswa.
 * Mendukung pencarian lewat confirmationId ATAU pasangan (nis, idTryout).
 */
function handleApprovePermission(ss, confirmationId, nis, idTryout) {
  var konfirmasiSheet = getOrCreateSheet(ss, 'Konfirmasi');
  var data = konfirmasiSheet.getDataRange().getValues();
  var nowStr = formatDateTime(new Date());
  var updated = false;

  var targetId = confirmationId ? String(confirmationId).trim() : '';
  var targetNis = nis ? cleanNis(nis) : '';
  var targetTryout = idTryout ? String(idTryout).trim() : '';

  for (var i = 1; i < data.length; i++) {
    var matchId = targetId && String(data[i][0]).trim() === targetId;
    var matchPair = targetNis && targetTryout && cleanNis(data[i][2]) === targetNis && String(data[i][1]).trim() === targetTryout;

    if (matchId || matchPair) {
      var rowNum = i + 1;
      konfirmasiSheet.getRange(rowNum, 5).setValue('DISETUJUI');
      konfirmasiSheet.getRange(rowNum, 7).setValue(nowStr);
      updated = true;
    }
  }

  if (updated) {
    SpreadsheetApp.flush();
    return { success: true, message: 'Izin siswa berhasil disetujui (Status: DISETUJUI).' };
  }

  return { success: false, message: 'Data konfirmasi tidak ditemukan di sheet.' };
}

/**
 * Menyetujui semua siswa yang berstatus MENUNGGU.
 */
function handleBatchApprove(ss, idTryout) {
  var konfirmasiSheet = getOrCreateSheet(ss, 'Konfirmasi');
  var data = konfirmasiSheet.getDataRange().getValues();
  var nowStr = formatDateTime(new Date());
  var count = 0;
  var targetTryout = idTryout ? String(idTryout).trim() : '';

  for (var i = 1; i < data.length; i++) {
    var matchTryout = (!targetTryout || String(data[i][1]).trim() === targetTryout);
    var status = normalizeConfirmationStatus(data[i][4]);

    if (matchTryout && status === 'MENUNGGU') {
      var rowNum = i + 1;
      konfirmasiSheet.getRange(rowNum, 5).setValue('DISETUJUI');
      konfirmasiSheet.getRange(rowNum, 7).setValue(nowStr);
      count++;
    }
  }

  SpreadsheetApp.flush();
  return { 
    success: true, 
    count: count, 
    message: count + ' siswa berhasil disetujui sekaligus.' 
  };
}

/**
 * Mereset/menolak izin siswa.
 */
function handleRejectPermission(ss, confirmationId) {
  var konfirmasiSheet = getOrCreateSheet(ss, 'Konfirmasi');
  var data = konfirmasiSheet.getDataRange().getValues();
  var targetId = String(confirmationId).trim();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId) {
      var rowNum = i + 1;
      konfirmasiSheet.getRange(rowNum, 5).setValue('DITOLAK');
      SpreadsheetApp.flush();
      return { success: true, message: 'Izin siswa telah direset.' };
    }
  }

  return { success: false, message: 'Data konfirmasi tidak ditemukan.' };
}

function handleSaveTryout(ss, tryout) {
  if (!tryout || !tryout.judul) {
    return { success: false, message: 'Judul tryout wajib diisi.' };
  }

  var tryoutSheet = getOrCreateSheet(ss, 'Tryout');
  var data = tryoutSheet.getDataRange().getValues();
  var id = tryout.id ? String(tryout.id).trim() : '';
  var status = normalizeTryoutStatus(tryout.status || 'DIBUKA');

  if (id) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === id) {
        var rowNum = i + 1;
        tryoutSheet.getRange(rowNum, 2).setValue(tryout.judul);
        tryoutSheet.getRange(rowNum, 3).setValue(tryout.mapel || 'Matematika');
        tryoutSheet.getRange(rowNum, 4).setValue(formatDateCell(tryout.tanggal));
        tryoutSheet.getRange(rowNum, 5).setValue(formatTimeCell(tryout.jam_mulai));
        tryoutSheet.getRange(rowNum, 6).setValue(formatTimeCell(tryout.jam_selesai));
        tryoutSheet.getRange(rowNum, 7).setValue(tryout.link_tka || '');
        tryoutSheet.getRange(rowNum, 8).setValue(tryout.petunjuk || '');
        tryoutSheet.getRange(rowNum, 9).setValue(status);
        SpreadsheetApp.flush();
        return { success: true, message: 'Tryout berhasil diperbarui.', id: id };
      }
    }
  }

  var newId = 'TKA-' + Math.floor(100 + Math.random() * 900);
  tryoutSheet.appendRow([
    newId,
    tryout.judul,
    tryout.mapel || 'Matematika',
    formatDateCell(tryout.tanggal) || formatDate(new Date()),
    formatTimeCell(tryout.jam_mulai) || '08:00',
    formatTimeCell(tryout.jam_selesai) || '09:30',
    tryout.link_tka || '',
    tryout.petunjuk || '',
    status
  ]);
  SpreadsheetApp.flush();

  return { success: true, message: 'Tryout baru berhasil ditambahkan.', id: newId };
}

function handleToggleTryoutStatus(ss, idTryout, newStatus) {
  var tryoutSheet = getOrCreateSheet(ss, 'Tryout');
  var data = tryoutSheet.getDataRange().getValues();
  var targetId = String(idTryout).trim();
  var normStatus = normalizeTryoutStatus(newStatus);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId) {
      tryoutSheet.getRange(i + 1, 9).setValue(normStatus);
      SpreadsheetApp.flush();
      return { success: true, message: 'Status tryout berhasil diubah menjadi ' + normStatus };
    }
  }

  return { success: false, message: 'Tryout tidak ditemukan.' };
}

function handleDeleteTryout(ss, idTryout) {
  var tryoutSheet = getOrCreateSheet(ss, 'Tryout');
  var data = tryoutSheet.getDataRange().getValues();
  var targetId = String(idTryout).trim();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId) {
      tryoutSheet.deleteRow(i + 1);
      SpreadsheetApp.flush();
      return { success: true, message: 'Tryout berhasil dihapus.' };
    }
  }

  return { success: false, message: 'Tryout tidak ditemukan.' };
}

function handleSaveAnnouncement(ss, announcement) {
  var pSheet = getOrCreateSheet(ss, 'Pengumuman');
  var data = pSheet.getDataRange().getValues();
  var id = announcement.id ? String(announcement.id).trim() : '';

  if (id) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === id) {
        var rowNum = i + 1;
        pSheet.getRange(rowNum, 2).setValue(announcement.judul);
        pSheet.getRange(rowNum, 3).setValue(announcement.isi_pengumuman);
        pSheet.getRange(rowNum, 4).setValue(announcement.tanggal);
        pSheet.getRange(rowNum, 5).setValue(announcement.status || 'AKTIF');
        SpreadsheetApp.flush();
        return { success: true, message: 'Pengumuman berhasil diperbarui.' };
      }
    }
  }

  var newId = 'PGM-' + Math.floor(100 + Math.random() * 900);
  pSheet.appendRow([
    newId,
    announcement.judul,
    announcement.isi_pengumuman,
    announcement.tanggal || formatDate(new Date()),
    announcement.status || 'AKTIF'
  ]);
  SpreadsheetApp.flush();

  return { success: true, message: 'Pengumuman berhasil dibuat.', id: newId };
}

function handleDeleteAnnouncement(ss, idPengumuman) {
  var pSheet = getOrCreateSheet(ss, 'Pengumuman');
  var data = pSheet.getDataRange().getValues();
  var targetId = String(idPengumuman).trim();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === targetId) {
      pSheet.deleteRow(i + 1);
      SpreadsheetApp.flush();
      return { success: true, message: 'Pengumuman berhasil dihapus.' };
    }
  }

  return { success: false, message: 'Pengumuman tidak ditemukan.' };
}

// ==========================================
// 6. AUTO SETUP SPREADSHEET
// ==========================================

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Users Sheet
  var uSheet = getOrCreateSheet(ss, 'Users');
  if (uSheet.getLastRow() === 0) {
    uSheet.appendRow(['ID', 'Nama', 'NIS', 'Kelas', 'Username', 'Password', 'Role']);
    uSheet.appendRow(['USR-01', 'Pak Budi Rahardjo, S.Pd.', '-', '-', 'guru', 'gurujuara123', 'guru']);
    uSheet.appendRow(['USR-02', 'Ibu Siti Aminah, S.Pd.', '-', '-', 'admin', 'admin123', 'guru']);
    uSheet.appendRow(['USR-03', 'Ahmad Fauzi', '1021', '6A', 'ahmad', '1021', 'siswa']);
    uSheet.appendRow(['USR-04', 'Bella Safitri', '1022', '6A', 'bella', '1022', 'siswa']);
    uSheet.appendRow(['USR-05', 'Dimas Arya Pratama', '1023', '6B', 'dimas', '1023', 'siswa']);
    uSheet.appendRow(['USR-06', 'Siti Nurhaliza', '1024', '6B', 'siti', '1024', 'siswa']);
    uSheet.appendRow(['USR-07', 'Reza Rahardian', '1025', '6A', 'reza', '1025', 'siswa']);
    uSheet.appendRow(['USR-08', 'Putri Cantika', '1026', '6B', 'putri', '1026', 'siswa']);
  }

  // 2. Tryout Sheet
  var tSheet = getOrCreateSheet(ss, 'Tryout');
  if (tSheet.getLastRow() === 0) {
    tSheet.appendRow(['ID', 'Judul', 'Mapel', 'Tanggal', 'Jam Mulai', 'Jam Selesai', 'Link TKA', 'Petunjuk', 'Status']);
    tSheet.appendRow([
      'TKA-01',
      'Tryout 1 TKA Matematika - Numerasi Dasar',
      'Matematika',
      formatDate(new Date()),
      '08:00',
      '09:30',
      'https://forms.gle/sampleMathTKA2026',
      'Kerjakan 30 butir soal pilihan ganda. Dilarang menggunakan kalkulator. Berdoalah sebelum mengerjakan.',
      'DIBUKA'
    ]);
    tSheet.appendRow([
      'TKA-02',
      'Tryout TKA Bahasa Indonesia - Literasi Membaca',
      'Bahasa Indonesia',
      formatDate(new Date()),
      '10:00',
      '11:30',
      'https://forms.gle/sampleIndoTKA2026',
      'Bacalah setiap teks wacana dengan teliti. Teliti kembali jawaban sebelum mengumpulkan.',
      'DIBUKA'
    ]);
    tSheet.appendRow([
      'TKA-03',
      'Tryout TKA IPAS - Sains & Lingkungan',
      'IPAS',
      formatDate(new Date(Date.now() + 86400000)),
      '08:00',
      '09:30',
      'https://forms.gle/sampleIpasTKA2026',
      'Materi mencakup siklus air, energi alternatif, dan rantai makanan.',
      'DITUTUP'
    ]);
  }

  // 3. Konfirmasi Sheet
  var kSheet = getOrCreateSheet(ss, 'Konfirmasi');
  if (kSheet.getLastRow() === 0) {
    kSheet.appendRow(['ID', 'ID Tryout', 'NIS', 'Nama Siswa', 'Status Konfirmasi', 'Waktu Permintaan', 'Waktu Persetujuan']);
    kSheet.appendRow(['KNF-01', 'TKA-01', '1021', 'Ahmad Fauzi', 'DISETUJUI', formatDateTime(new Date()), formatDateTime(new Date())]);
    kSheet.appendRow(['KNF-02', 'TKA-01', '1022', 'Bella Safitri', 'MENUNGGU', formatDateTime(new Date()), '-']);
    kSheet.appendRow(['KNF-03', 'TKA-01', '1023', 'Dimas Arya Pratama', 'MENUNGGU', formatDateTime(new Date()), '-']);
  }

  // 4. Pengumuman Sheet
  var pSheet = getOrCreateSheet(ss, 'Pengumuman');
  if (pSheet.getLastRow() === 0) {
    pSheet.appendRow(['ID', 'Judul', 'Isi Pengumuman', 'Tanggal', 'Status']);
    pSheet.appendRow([
      'PGM-01',
      '🔔 Pelaksanaan Tryout TKA Hari Ini',
      'Selamat pagi siswa hebat! Tryout Matematika telah dibuka. Pastikan kamu berada di ruangan yang tenang dan tekan tombol MINTA IZIN agar guru dapat memverifikasi kehadiranmu.',
      formatDate(new Date()),
      'AKTIF'
    ]);
    pSheet.appendRow([
      'PGM-02',
      '⭐ Tips Sukses Mengerjakan TKA',
      'Kerjakan soal yang dirasa paling mudah terlebih dahulu, jangan terburu-buru, dan gunakan kertas coretan untuk menghitung dengan cermat.',
      formatDate(new Date()),
      'AKTIF'
    ]);
  }

  SpreadsheetApp.flush();
  return {
    success: true,
    message: 'Seluruh sheet (Users, Tryout, Konfirmasi, Pengumuman) berhasil diinisialisasi!'
  };
}

// ==========================================
// 7. HELPER FUNCTIONS
// ==========================================

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function formatDate(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function formatDateTime(date) {
  var dStr = formatDate(date);
  var hh = String(date.getHours()).padStart(2, '0');
  var mm = String(date.getMinutes()).padStart(2, '0');
  var ss = String(date.getSeconds()).padStart(2, '0');
  return dStr + ' ' + hh + ':' + mm + ':' + ss;
}

function formatDateCell(val) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var tz = (ss && ss.getSpreadsheetTimeZone()) || Session.getScriptTimeZone() || 'Asia/Jakarta';
      return Utilities.formatDate(val, tz, 'yyyy-MM-dd');
    } catch (e) {
      return formatDate(val);
    }
  }
  var str = String(val).trim();
  if (!str || str === '-' || str === 'null' || str === 'undefined') return '';
  if (str.indexOf('T') !== -1) {
    var d = new Date(str);
    if (!isNaN(d.getTime())) {
      var y = d.getFullYear();
      var m = ('0' + (d.getMonth() + 1)).slice(-2);
      var day = ('0' + d.getDate()).slice(-2);
      return y + '-' + m + '-' + day;
    }
  }
  return str;
}

/**
 * Memformat sel waktu dari Google Sheets menjadi 'HH:mm' yang bersih.
 * Mengatasi masalah format Date Google Sheets (1899-12-30T...Z) maupun string waktu lainnya.
 */
function formatTimeCell(val) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var tz = (ss && ss.getSpreadsheetTimeZone()) || Session.getScriptTimeZone() || 'Asia/Jakarta';
      return Utilities.formatDate(val, tz, 'HH:mm');
    } catch (e) {
      var hh = ('0' + val.getHours()).slice(-2);
      var mm = ('0' + val.getMinutes()).slice(-2);
      return hh + ':' + mm;
    }
  }
  var str = String(val).trim();
  if (!str || str === '-' || str === 'null' || str === 'undefined') return '';

  // Jika string mengandung format ISO / 1899-12-30
  if (str.indexOf('1899-12-30') !== -1 || str.indexOf('T') !== -1) {
    var d = new Date(str);
    if (!isNaN(d.getTime())) {
      try {
        var tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
        return Utilities.formatDate(d, tz, 'HH:mm');
      } catch (e) {
        var hh = ('0' + d.getHours()).slice(-2);
        var mm = ('0' + d.getMinutes()).slice(-2);
        return hh + ':' + mm;
      }
    }
  }

  // Jika format HH:mm:ss atau HH:mm
  var match = str.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return ('0' + match[1]).slice(-2) + ':' + match[2];
  }

  return str;
}

function formatDateTimeCell(val) {
  if (!val) return '-';
  if (val instanceof Date) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var tz = (ss && ss.getSpreadsheetTimeZone()) || Session.getScriptTimeZone() || 'Asia/Jakarta';
      return Utilities.formatDate(val, tz, 'yyyy-MM-dd HH:mm:ss');
    } catch (e) {
      return formatDateTime(val);
    }
  }
  return String(val);
}

/**
 * Mengambil password masuk siswa satu sekolah dari sheet Users
 */
function getSchoolPassword(ss) {
  try {
    var usersSheet = getOrCreateSheet(ss, 'Users');
    var data = usersSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var role = String(data[i][6] || '').toLowerCase().trim();
      var username = String(data[i][4] || '').toLowerCase().trim();
      if (role === 'sekolah' || username === 'password_siswa' || username === 'portal_siswa') {
        var p = String(data[i][5] || '').trim();
        if (p) return p;
      }
    }
  } catch (e) {}
  return 'tka2026'; // Default fallback jika belum diatur
}

/**
 * Menyimpan password masuk siswa baru ke sheet Users
 */
function handleSaveSchoolPassword(ss, newPassword) {
  if (!newPassword || String(newPassword).trim() === '') {
    return { success: false, message: 'Password sekolah tidak boleh kosong.' };
  }

  var usersSheet = getOrCreateSheet(ss, 'Users');
  var data = usersSheet.getDataRange().getValues();
  var passStr = String(newPassword).trim();

  for (var i = 1; i < data.length; i++) {
    var role = String(data[i][6] || '').toLowerCase().trim();
    var username = String(data[i][4] || '').toLowerCase().trim();
    if (role === 'sekolah' || username === 'password_siswa' || username === 'portal_siswa') {
      usersSheet.getRange(i + 1, 6).setValue(passStr);
      SpreadsheetApp.flush();
      return { success: true, message: 'Password masuk siswa berhasil diperbarui.', password: passStr };
    }
  }

  // Tambah baris baru khusus konfigurasi password sekolah
  usersSheet.appendRow(['CFG-01', 'Kunci Masuk Siswa', '-', '-', 'password_siswa', passStr, 'sekolah']);
  SpreadsheetApp.flush();
  return { success: true, message: 'Password masuk siswa berhasil dibuat dan disimpan.', password: passStr };
}
