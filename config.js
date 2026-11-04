/**
 * =========================================================================
 * KONFIGURASI UTAMA - PORTAL TRYOUT TKA SISWA
 * =========================================================================
 * 
 * File ini mengatur:
 * 1. Link Tetap (Fixed URL) Backend Google Apps Script.
 * 2. Password Gerbang Masuk Siswa (Satu Sekolah) agar tidak dapat dibuka
 *    oleh sekolah lain, dan dapat diubah sewaktu-waktu oleh Guru di Admin!
 */

const CONFIG = {
  // Masukkan URL Web App Google Apps Script Anda (yang berakhiran /exec) di sini:
  DEFAULT_GAS_URL: "https://script.google.com/macros/s/AKfycbxyhCTlJqB0a5hfPG9xrGQLIf4fMCqwCNK20obj88sILSHivOSd8Fp0w7v94EWLNjjLgA/exec",

  // Password Masuk Siswa Default (Satu Sekolah):
  // Guru dapat mengubah password ini kapan saja melalui Panel Guru (admin.html)!
  DEFAULT_STUDENT_PASSWORD: "tka2026",

  // Identitas Sekolah
  NAMA_SEKOLAH: "SD NEGERI HARAPAN BANGSA",
  JUDUL_PORTAL: "PORTAL TRYOUT TKA SISWA",
  
  // Waktu polling otomatis dalam milidetik (misal 3500 = 3.5 detik)
  POLLING_INTERVAL_MS: 3500
};

/**
 * Mengambil URL Google Apps Script aktif:
 */
function getActiveGasUrl() {
  if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_GAS_URL && CONFIG.DEFAULT_GAS_URL.trim().startsWith('http')) {
    return CONFIG.DEFAULT_GAS_URL.trim();
  }
  return (localStorage.getItem('tka_gas_url') || '').trim();
}

/**
 * Mengambil Password Masuk Siswa Aktif:
 * Prioritas:
 * 1. Password yang disimpan / diubah guru di Panel Admin
 * 2. Password default di CONFIG.DEFAULT_STUDENT_PASSWORD
 */
function getActiveStudentPassword() {
  const custom = (localStorage.getItem('tka_school_password') || '').trim();
  if (custom) return custom;
  if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_STUDENT_PASSWORD) {
    return CONFIG.DEFAULT_STUDENT_PASSWORD.trim();
  }
  return "tka2026";
}

// Ekspos ke global window
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
  window.getActiveGasUrl = getActiveGasUrl;
  window.getActiveStudentPassword = getActiveStudentPassword;
}
