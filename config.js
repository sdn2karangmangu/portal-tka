/**
 * =========================================================================
 * KONFIGURASI UTAMA - PORTAL TRYOUT TKA SISWA
 * =========================================================================
 * 
 * File ini mengatur Link Tetap (Fixed URL) Backend Google Apps Script.
 * 
 * MANFAAT:
 * Dengan mengisi DEFAULT_GAS_URL di file ini, SELURUH SISWA YANG MEMBUKA
 * DARI RUMAH (melalui HP, laptop, tablet, GitHub Pages, atau Cloudflare Pages)
 * akan OTOMATIS langsung terhubung ke database Google Sheets yang sama
 * tanpa perlu repot mengatur link apapun lagi di HP masing-masing!
 */

const CONFIG = {
  // Masukkan URL Web App Google Apps Script Anda (yang berakhiran /exec) di sini:
  DEFAULT_GAS_URL: "",

  // Identitas Sekolah
  NAMA_SEKOLAH: "SD NEGERI 2 KARANGMAMGU",
  JUDUL_PORTAL: "PORTAL TRYOUT TKA SISWA",
  
  // Waktu polling otomatis dalam milidetik (misal 3500 = 3.5 detik)
  POLLING_INTERVAL_MS: 3500
};

/**
 * Mengambil URL Google Apps Script aktif:
 * 1. Jika CONFIG.DEFAULT_GAS_URL sudah diisi, URL ini yang digunakan di SEMUA perangkat siswa.
 * 2. Jika kosong, sistem menggunakan URL yang tersimpan di localStorage browser penguji/guru.
 */
function getActiveGasUrl() {
  if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_GAS_URL && CONFIG.DEFAULT_GAS_URL.trim().startsWith('http')) {
    return CONFIG.DEFAULT_GAS_URL.trim();
  }
  return (localStorage.getItem('tka_gas_url') || '').trim();
}

// Ekspos ke global window
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
  window.getActiveGasUrl = getActiveGasUrl;
}
