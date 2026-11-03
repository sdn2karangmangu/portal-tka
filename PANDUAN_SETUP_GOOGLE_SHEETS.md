# PANDUAN LENGKAP SETUP GOOGLE SHEETS & GOOGLE APPS SCRIPT
## PORTAL TRYOUT TKA SISWA

Panduan ini menjelaskan langkah demi langkah cara menyiapkan database Google Sheets, memasang backend Google Apps Script (`Code.gs`), mendeploy sebagai Web App publik (CORS), dan menghubungkannya dengan aplikasi Portal Tryout TKA Siswa.

---

### 1. Struktur Database Google Sheets

Buat satu Google Spreadsheet baru di akun Google sekolah (misal: [sheets.new](https://sheets.new)) dengan nama:
**`Database Portal Tryout TKA Siswa`**

Spreadsheet ini memerlukan 4 Sheet (Tab di bagian bawah):

#### Sheet 1: `Users`
Menyimpan data guru pengawas dan siswa SD:
| ID | Nama | NIS | Kelas | Username | Password | Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| USR-01 | Pak Budi Rahardjo, S.Pd. | - | - | guru | gurujuara123 | guru |
| USR-02 | Ibu Siti Aminah, S.Pd. | - | - | admin | admin123 | guru |
| USR-03 | Ahmad Fauzi | 1021 | 6A | ahmad | 1021 | siswa |
| USR-04 | Bella Safitri | 1022 | 6A | bella | 1022 | siswa |
| USR-05 | Dimas Arya Pratama | 1023 | 6B | dimas | 1023 | siswa |
| USR-06 | Siti Nurhaliza | 1024 | 6B | siti | 1024 | siswa |

#### Sheet 2: `Tryout`
Menyimpan jadwal dan link soal TKA:
| ID | Judul | Mapel | Tanggal | Jam Mulai | Jam Selesai | Link TKA | Petunjuk | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TKA-01 | Tryout 1 TKA Matematika - Numerasi | Matematika | 2026-11-03 | 08:00 | 09:30 | https://forms.gle/... | Kerjakan 30 soal pilihan ganda. Berdoa sebelum mulai. | DIBUKA |
| TKA-02 | Tryout TKA Bahasa Indonesia | Bahasa Indonesia | 2026-11-03 | 10:00 | 11:30 | https://forms.gle/... | Bacalah teks cerita dengan cermat. | DIBUKA |

*Status Tryout dapat bernilai:*
- `DIBUKA` (Ujian sedang berlangsung / siswa bisa minta izin)
- `DITUTUP` (Akses belum dibuka oleh guru)
- `SELESAI` (Ujian telah ditutup)

#### Sheet 3: `Konfirmasi`
Menyimpan antrean izin siswa:
| ID | ID Tryout | NIS | Nama Siswa | Status Konfirmasi | Waktu Permintaan | Waktu Persetujuan |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| KNF-01 | TKA-01 | 1021 | Ahmad Fauzi | DISETUJUI | 2026-11-03 07:55:00 | 2026-11-03 07:58:00 |
| KNF-02 | TKA-01 | 1022 | Bella Safitri | MENUNGGU | 2026-11-03 07:59:10 | - |

*Status Konfirmasi:*
- `MENUNGGU` (Siswa menekan tombol Minta Izin)
- `DISETUJUI` (Guru menekan tombol Setujui & link TKA aktif di layar siswa)
- `DITOLAK` (Izin dibatalkan atau direset)

#### Sheet 4: `Pengumuman`
Menyimpan banner pengumuman untuk siswa:
| ID | Judul | Isi Pengumuman | Tanggal | Status |
| :--- | :--- | :--- | :--- | :--- |
| PGM-01 | 🔔 Pelaksanaan Tryout TKA Hari Ini | Selamat pagi! Tryout Matematika telah dibuka. Tekan tombol Minta Izin. | 2026-11-03 | AKTIF |

---

### 2. Memasang Kode Backend `Code.gs`

1. Di Google Sheets Anda, klik menu atas: **Ekstensi (Extensions)** &rarr; **Apps Script**.
2. Akan terbuka tab baru Google Apps Script Editor.
3. Hapus seluruh isi fungsi bawaan `myFunction()`.
4. Buka file **`Code.gs`** dari proyek ini, salin seluruh kodenya, lalu tempel (paste) ke editor Apps Script.
5. Klik ikon **Simpan (Save / Ctrl+S)**.
6. Beri nama proyek di kiri atas: `Backend Tryout TKA`.

#### Inisialisasi Otomatis (Opsional & Sangat Direkomendasikan):
Anda tidak perlu mengetik nama sheet secara manual! 
- Di dropdown menu fungsi atas editor Apps Script, pilih fungsi **`setupSheets`**.
- Klik tombol **Run (Jalankan)**.
- Jika muncul permintaan izin ("Authorization required"), klik **Review Permissions**, pilih akun Google Anda, klik **Advanced** &rarr; **Go to Backend Tryout TKA (unsafe)**, lalu klik **Allow**.
- Script akan otomatis membuat ke-4 sheet (Users, Tryout, Konfirmasi, Pengumuman) beserta data awal yang siap dipakai!

---

### 3. Deploy sebagai Web App Publik

Agar frontend web dapat mengirim dan membaca data dari Google Sheets, script harus dideploy sebagai Web App:

1. Di editor Apps Script, klik tombol biru di kanan atas: **Deploy** &rarr; **New deployment** (Penerapan baru).
2. Di jendela yang muncul, klik ikon gear (roda gigi) di sebelah "Select type", lalu pilih **Web app**.
3. Atur konfigurasi berikut (PENTING!):
   - **Description**: `Portal Tryout API v1`
   - **Execute as** (Jalankan sebagai): **Me (email Anda)**
   - **Who has access** (Siapa yang memiliki akses): **Anyone (Siapa saja)**
   *(Pilihan "Anyone" wajib dipilih agar siswa di berbagai gawai/HP dapat mengakses status tanpa harus login akun Google masing-masing).*
4. Klik tombol **Deploy**.
5. Salin teks pada kolom **Web app URL** yang muncul (berakhiran `/exec`, contoh: `https://script.google.com/macros/s/AKfycb.../exec`).

> **⚠️ PENTING SAAT MEMPERBARUI KODE (RE-DEPLOY):**  
> Jika Anda memperbarui atau mengedit file `Code.gs` di Apps Script, Anda **WAJIB** membuat versi baru agar perubahannya aktif:
> 1. Klik **Deploy** &rarr; **Manage deployments** (Kelola penerapan).
> 2. Klik ikon pensil (**Edit**) di sebelah kanan.
> 3. Pada pilihan **Version**, pilih **New version** (Versi baru).
> 4. Klik tombol **Deploy**. *(URL `/exec` tidak berubah).*

---

### 4. Menghubungkan Frontend ke Backend

1. Buka halaman **Panel Guru** (`admin.html`) di browser Anda.
2. Masuk menggunakan akun guru (default: username `guru`, password `gurujuara123`).
3. Klik tab **"Integrasi Google Sheets"**.
4. Tempelkan URL Web App yang Anda salin tadi ke kolom **Web App URL (exec URL)**.
5. Klik **Simpan URL**, lalu klik **Uji Koneksi**.
6. Status akan langsung berubah menjadi hijau: **"Terhubung Google Sheets (Online)"**.
7. Mulai saat ini, setiap tryout baru, pengumuman, dan konfirmasi siswa yang disetujui akan tersimpan langsung ke Google Sheets sekolah Anda secara realtime!

---

### 5. Troubleshooting Status "Menunggu Konfirmasi" yang Tidak Berubah

Jika Anda mengubah status di sheet atau menekan tombol persetujuan tetapi di layar siswa masih tertulis *"Menunggu Konfirmasi"*, berikut solusinya:

1. **Format Status di Google Sheet (Sheet `Konfirmasi` Kolom E):**
   Backend kini telah diperbarui untuk fleksibel dan otomatis mengenali variasi teks berikut:
   - Status Disetujui / Siap: `DISETUJUI`, `SIAP DIMULAI`, `Disetujui`, `siap dimulai`, `ACC`, `SETUJU`.
   - Status Menunggu: `MENUNGGU`, `MENUNGGU KONFIRMASI`, `Menunggu`.
   - Status Ditolak: `DITOLAK`.

2. **Periksa NIS Siswa Aktif:**
   Pastikan NIS di sheet `Konfirmasi` (Kolom C) sama persis dengan NIS siswa yang sedang dipilih di pojok kanan atas halaman siswa (misal: `1021`). Jika di sheet terformat sebagai angka `1021.0`, sistem kini sudah otomatis membersihkannya.

3. **Periksa Status Tryout (Sheet `Tryout` Kolom I):**
   Link dan tombol hijau hanya aktif jika status Tryout berstatus `DIBUKA` (bukan `DITUTUP` atau `SELESAI`).

4. **Jangan Lupa Update Versi Web App:**
   Salin file `Code.gs` terbaru ini ke Apps Script Anda, lalu lakukan **Deploy &rarr; Manage deployments &rarr; Edit &rarr; New version &rarr; Deploy**.

---

### 5. Cara Hosting Menggunakan GitHub Pages atau Cloudflare Pages

Aplikasi ini dibuat murni menggunakan teknologi standar web: **HTML5, Tailwind CSS, dan JavaScript Vanilla**, sehingga dapat dihosting gratis di mana pun tanpa server tambahan:

#### Opsi A: GitHub Pages
1. Buat repositori baru di GitHub (misal: `portal-tryout-tka`).
2. Unggah file-file berikut ke repositori:
   - `index.html` (halaman siswa)
   - `admin.html` (halaman guru)
   - `style.css`
   - `app.js`
   - `admin.js`
   - `Code.gs`
3. Masuk ke tab **Settings** repositori &rarr; pilih menu **Pages** di sebelah kiri.
4. Pada bagian **Build and deployment &rarr; Branch**, pilih branch `main` (atau `master`) dan folder `/(root)`.
5. Klik **Save**. Dalam 1-2 menit, situs Anda sudah live di:
   `https://[username].github.io/portal-tryout-tka/`

#### Opsi B: Cloudflare Pages
1. Buka dashboard [Cloudflare Pages](https://pages.cloudflare.com).
2. Pilih **Connect to Git** atau **Direct Upload** (drag-and-drop folder berisi `index.html`, `admin.html`, `style.css`, `app.js`, `admin.js`).
3. Klik **Save and Deploy**. Website langsung aktif dengan SSL otomatis dan performa super cepat.

---

### 6. Keamanan Data

- **Penyembunyian Link Ujian**: Link TKA yang dimasukkan guru tidak dibagikan ke siswa sebelum guru menekan tombol **"Setujui"** dan status tryout **"DIBUKA"**.
- Validasi dilakukan langsung di script `Code.gs` (server-side) dan di frontend.
- Siswa hanya dapat meminta izin untuk akun NIS miliknya.
- Akses guru dilindungi autentikasi di halaman `admin.html`.
