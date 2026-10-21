# KantinSiswa

Marketplace produk & jasa antar siswa SMK. Penjual membuka toko, pembeli mencari dan memesan
lewat WhatsApp, sedangkan penjual mengelola produk, pesanan, dan keuangannya dari dashboard.

> Nama aplikasi bisa diganti dari satu tempat: ubah `APP_NAME` di `.env`
> (atau `src/config/app.config.js`). Tidak ada nama yang ditulis manual di halaman HTML.

---

## Daftar Isi

1. [Fitur](#fitur)
2. [Teknologi](#teknologi)
3. [Cara Menjalankan](#cara-menjalankan)
4. [Membuat Database MongoDB Atlas](#membuat-database-mongodb-atlas)
5. [Konfigurasi Environment](#konfigurasi-environment)
6. [Layanan Penyimpanan Gambar](#layanan-penyimpanan-gambar)
7. [Akun Super Admin](#akun-super-admin)
8. [Data Contoh](#data-contoh)
9. [Menjalankan Pengujian](#menjalankan-pengujian)
10. [Struktur Proyek](#struktur-proyek)
11. [Cara Kerja Penting](#cara-kerja-penting)
12. [Keamanan](#keamanan)
13. [Deployment](#deployment)
14. [Masalah yang Sering Muncul](#masalah-yang-sering-muncul)

---

## Fitur

### Pengunjung
- Beranda: hero, kategori, produk terbaru, produk terlaris, rating tertinggi, toko pilihan.
- Katalog: cari, filter kategori & rentang harga, 5 pilihan urutan, pagination.
- Detail produk: galeri, deskripsi, stok, info toko, rating & ulasan, produk terkait.
- Profil toko: deskripsi, rating, jumlah produk, produk terlaris toko, tombol WhatsApp.
- Halaman 404 dan 403.

### Penjual
- Daftar (nama, toko, WhatsApp, password, kategori, deskripsi, lokasi, setuju aturan) & login.
- Dashboard ringkasan: produk aktif, pesanan, pemasukan, pengeluaran, selisih arus kas, rating.
- CRUD produk + upload foto (JPG/PNG/WebP, maks 4 MB, pratinjau sebelum simpan).
- Manajemen pesanan: ubah status (menunggu → dikonfirmasi → selesai / dibatalkan).
- Keuangan: catat pemasukan & pengeluaran, filter tanggal/kategori, grafik arus kas, ekspor CSV.
- Lihat ulasan produk sendiri, edit profil toko, ganti password.

### Super Admin
- Ringkasan marketplace + grafik pesanan 6 bulan.
- Kelola pengguna & toko (aktifkan/nonaktifkan **wajib alasan**).
- Review & sembunyikan produk/ulasan yang melanggar aturan (wajib alasan).
- CRUD kategori, tangani laporan, lihat log aktivitas, atur pengaturan aplikasi.

### Yang belum ada (disengaja untuk versi awal)
Payment gateway, verifikasi pembelian otomatis, live chat, notifikasi email, dark mode, PWA.

---

## Teknologi

| Bagian | Teknologi | Alasan |
|---|---|---|
| Backend | Node.js + Express 5 | Pustaka paling banyak contoh berbahasa Indonesia |
| Database | MongoDB Atlas (Mongoose 8) | Skema fleksibel, mudah untuk data marketplace |
| Session | `express-session` + `connect-mongo` | Cookie HttpOnly tidak bisa dibaca JavaScript (lebih aman dari JWT di localStorage) |
| Password | `bcryptjs` (cost 12) | Pure JS, tidak butuh kompilasi native di laptop siswa |
| Validasi | Zod 4 | Satu skema dipakai untuk request & response, pesan error otomatis per field |
| Ikon | Lucide (SVG sprite lokal) | Ringan, konsisten, tanpa emoji, tidak butuh internet |
| Grafik | Chart.js (dimuat lazy dari CDN) | Cukup untuk bar/doughnut, hanya dimuat di halaman grafik |
| Gambar | Cloudinary (produksi) / lokal (dev) | File besar TIDAK disimpan di dalam dokumen MongoDB |

---

## Cara Menjalankan

**Prasyarat:** Node.js 18+ (disarankan 20+) dan akun MongoDB Atlas (gratis).

```bash
# 1. Pasang dependensi
npm install

# 2. Siapkan konfigurasi
cp .env.example .env
# lalu edit .env (lihat bagian Konfigurasi Environment)

# 3. Buat ikon SVG sprite (dibuat otomatis sekali)
npm run icons

# 4. Jalankan server
npm start
```

Buka **http://localhost:3000**. Cek kesiapan server:

```bash
curl http://localhost:3000/api/health
# {"success":true,"data":{"status":"ok","database":"connected",...}}
```

Mode pengembangan dengan auto-reload:

```bash
npm run dev
```

---

## Membuat Database MongoDB Atlas

1. Daftar di https://www.mongodb.com/atlas (paket **M0 Free**).
2. Pilih **Shared** → buat cluster gratis (pilih region terdekat, mis. Jakarta).
3. **Database Access** → *Add New Database User* → buat username & password.
   > Simpan password ini, hanya muncul sekali.
4. **Network Access** → *Add IP Address* → pilih *Allow access from anywhere* (`0.0.0.0/0`)
   supaya bisa diakses dari hosting. (Untuk development lokal, `0.0.0.0/0` juga praktis.)
5. **Deployments** → klik *Database* di cluster → **Connect** → pilih *Drivers* → salin
   **Connection String**.
6. Ganti `<username>`, `<password>`, dan nama database dengan `kantinsiswa`:

```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/kantinsiswa
```

> **Penting:** password database hanya boleh ada di `.env`. Jangan pernah menulisnya di
> kode frontend atau meng-commit `.env` ke GitHub.

---

## Konfigurasi Environment

Semua variabel ada di `.env.example`. Yang wajib diisi:

| Variabel | Keterangan |
|---|---|
| `MONGODB_URI` | Connection string Atlas (wajib) |
| `SESSION_SECRET` | String acak minimal 32 karakter (wajib, **jangan** dipakai ulang) |
| `APP_NAME` | Nama aplikasi yang tampil di seluruh halaman |
| `PORT` | Port server (bawaan 3000) |
| `APP_URL` | Alamat website, dipakai untuk membuat tautan produk di pesan WhatsApp |
| `IMAGE_PROVIDER` | `cloudinary` (produksi) atau `local` (development) |
| `SESSION_SECURE` | `true` saat produksi (maksa cookie hanya lewat HTTPS) |

Buat `SESSION_SECRET` yang acak:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Server **berhenti dengan pesan jelas** kalau `MONGODB_URI` atau `SESSION_SECRET` belum diisi.

---

## Layanan Penyimpanan Gambar

Gambar **tidak** disimpan sebagai data biner di dalam dokumen MongoDB. Backend meneruskan
file ke layanan penyimpanan, lalu hanya menyimpan URL + metadata.

### Development (default)

```env
IMAGE_PROVIDER=local
```

Gambar disimpan di `public/uploads/` dan disajikan dari URL `/uploads/...`.
Folder ini sudah masuk `.gitignore`.

### Produksi (Cloudinary)

1. Daftar di https://cloudinary.com (paket gratis **25 credit/bulan**).
2. Dashboard → Settings → API Keys → salin **Cloud name**, **API key**, **API secret**.
3. Isi `.env`:

```env
IMAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

> API secret **tidak pernah** dikirim ke browser. Frontend selalu mengunggah ke
> backend kita (`POST /api/uploads/image`), lalu backend yang meneruskannya ke Cloudinary.

Batas paket gratis Cloudinary: +-25 credit/bulan (1 credit = +-1.000 transformasi/penyimpanan),
maksimal +-25 MB penyimpanan. Aplikasi ini otomatis mengonversi gambar ke WebP + resize maks 1200px
supaya hemat kuota.

Alternatif kalau kuota Cloudinary habis: `imgbb` (API key tunggal, kuota lebih longgar) atau
`UploadThing`. Ganti saja isi `src/services/image.service.js`.

---

## Akun Super Admin

Akun super admin **tidak bisa** dibuat dari halaman pendaftaran. Dibuat lewat skrip:

```bash
# Isi dulu di .env:
# BOOTSTRAP_ADMIN_NAME=Admin KantinSiswa
# BOOTSTRAP_ADMIN_WHATSAPP=081234567890
# BOOTSTRAP_ADMIN_PASSWORD=PasswordKuat123

npm run create-admin
```

Atau jalankan `npm run create-admin` tanpa mengisi `.env` lalu jawab pertanyaannya.

**Setelah akun dibuat, kosongkan variabel `BOOTSTRAP_ADMIN_*` dari `.env`.**

---

## Data Contoh

Untuk mencoba aplikasi dengan data siap pakai:

```bash
npm run seed
```

Membuat 6 kategori, 3 toko contoh (Kedai Budi, Roncesyee, Jasa Andi), 9 produk,
beberapa pesanan selesai, dan ulasan. Password semua akun demo: `Siswa12345`.

---

## Memindahkan Data dari MongoDB Lokal ke Atlas

Kalau kamu sudah ng>data banyak di laptop (lokal) dan mau pindah ke MongoDB Atlas,
pakai skrip migrasi yang sudah disiapkan. **Tidak perlu `mongodump`/`mongorestore`.**

### Cara pakai

```bash
# 1. Isi MONGODB_URI di .env dengan connection string Atlas kamu.
#    (JANGAN lupa ganti bagian passwordnya, bukan "<db_password>".)

# 2. Lihat dulu rencana migrasi tanpa mengubah apa pun
npm run migrate -- --dry-run

# 3. Kalau sudah yakin, jalankan migrasinya
npm run migrate
```

### Opsi yang tersedia

| Opsi | Fungsi |
|---|---|
| `--dry-run` | Tampilkan daftar koleksi & jumlah dokumen, tanpa menyalin |
| `--drop` | Kosongkan dulu koleksi di Atlas (berguna kalau mau mulai bersih) |
| `--yes` / `-y` | Jangan tanya konfirmasi |
| `--only=users,products` | Hanya salin koleksi tertentu |
| `--skip=reviews` | Lewati koleksi tertentu |
| `--source=<uri>` | URI sumber (default `mongodb://127.0.0.1:27017`) |
| `--target=<uri>` | URI target (default dari `MONGODB_URI` di `.env`) |
| `--source-db=<nama>` | Nama database sumber (default `kantinsiswa`) |
| `--target-db=<nama>` | Nama database target (default dari `.env`) |

Contoh migrate dari laptop ke Atlas sambil mengosongkan target dulu:
```bash
npm run migrate -- --drop --yes
```

### Yang dipindahkan & yang dilewati

- Dipindahkan: **semua dokumen** dari semua koleksi + **semua index** (termasuk unique index
  yang melindungi nomor WhatsApp & slug agar tetap berlaku sama seperti di lokal).
- Dilewati: koleksi **`sessions`** (session lama tidak perlu dipindah; connect-mongo akan
  membuat yang baru).
- Password ikut tersalin dalam bentuk **hash** — jadi user tidak perlu daftar ulang.

### Tips penting

- **Stop aplikasi dulu** saat migrasi supaya tidak ada data yang masuk di tengah proses.
- Connection string di layar **disamarkan** (`//user:********@host`), jadi aman kalau
  difoto buat presentasi.
- Kalau migrasi gagal di tengah, jalankan ulang dengan `--drop` untuk hasil yang bersih.
- Setelah migrasi, jalankan `npm run create-admin` di server/Atlas untuk membuat akun
  super admin (kalau belum ada).

### Cara resmi lain (kalau mau pakai tool MongoDB)

```bash
# perlu instal Database Tools dulu
mongodump --uri="mongodb://127.0.0.1:27017" --db=kantinsiswa --out=./backup
mongorestore --uri="mongodb+srv://<user>:<password>@<cluster>.mongodb.net" --db=kantinsiswa ./backup/kantinsiswa
```

---

## Menjalankan Pengujian

```bash
npm test
```

Menggunakan **Node.js Test Runner** bawaan (tanpa framework tambahan) + **supertest**.
Databasetes memakai MongoDB di memory (`mongodb-memory-server`), jadi **tidak perlu**
koneksi Atlas dan data test tidak mengotori database asli.

Isi cakupan tes (115 test):

| Berkas | Yang diuji |
|---|---|
| `tests/auth.test.js` | Pendaftaran, login, password salah, session, ganti password, duplikasi WA |
| `tests/product.test.js` | CRUD produk, validasi harga/stok, filter katalog, pagination, IDOR antar toko |
| `tests/order.test.js` | Pembuatan pesanan, snapshot harga, status pesanan, anti pencatatan ganda |
| `tests/review.test.js` | Rating 1-5, ulasan hanya dari pesanan selesai, moderasi admin |
| `tests/finance.test.js` | Pemasukan/pengeluaran, selisih arus kas, filter, ekspor CSV |
| `tests/security.test.js` | Akses admin, CSRF, sesi tidak aktif, rate limit, kebocoran hash |
| `tests/frontend.test.js` | Semua halaman tersedia, meta viewport, ikon SVG, aset CSS/JS |
| `tests/image.test.js` | Deteksi tipe file, batas ukuran, provider error |

Menjalankan satu berkas saja:

```bash
node --test --test-timeout=90000 --test-global-setup=./tests/global-setup.js tests/auth.test.js
```

---

## Struktur Proyek

```
kantinsiswa/
├── public/                     # Halaman & aset yang dikirim ke browser
│   ├── index.html              # Beranda
│   ├── katalog.html            # Katalog produk
│   ├── produk.html             # Detail produk
│   ├── toko.html               # Profil toko
│   ├── masuk.html / daftar.html / lupa-password.html / reset-password.html
│   ├── 404.html / 403.html
│   ├── dashboard/              # Dashboard penjual (6 halaman)
│   ├── admin/                  # Dashboard super admin (7 halaman)
│   └── assets/
│       ├── css/                # base, components, public, dashboard
│       ├── js/                 # api.js, ui.js, chart.js, per halaman
│       └── icons/sprite.svg    # Ikon Lucide (dibuat oleh npm run icons)
├── src/
│   ├── config/                 # app.config.js, env.js, db.js
│   ├── models/                 # 10 model Mongoose
│   ├── middleware/             # auth, csrf, validate, rateLimit, upload, errorHandler
│   ├── validators/             # Skema Zod per kelompok endpoint
│   ├── controllers/            # Logika permintaan (auth, catalog, order, review, seller, admin, upload)
│   ├── routes/                 # Routing API
│   ├── services/               # Logika bisnis (auth, product, order, review, finance, image, store, settings)
│   ├── utils/                  # AppError, asyncHandler, whatsapp, password, format, csv
│   ├── app.js                  # Konfigurasi Express (tanpa listen)
│   └── server.js               # Titik masuk (connect DB -> listen)
├── scripts/
│   ├── seed.js                 # Data contoh
│   ├── create-admin.js         # Pembuatan akun super admin
│   └── build-icon-sprite.mjs   # Membuat sprite ikon Lucide
├── tests/                      # 115 pengujian otomatis
├── docs/                       # Dokumen Tahap 1 dan laporan implementasi
├── .env.example                # Contoh konfigurasi (tanpa kredensial asli)
├── .gitignore
└── package.json
```

**Alur satu request:**

```
Browser (public/assets/js/api.js)
   │  fetch('/api/orders', { method:'POST', headers:{'X-CSRF-Token':...} })
   ▼
src/routes/*.js          → mendefinisikan URL + middleware (validasi, auth, rate limit)
   ▼
src/middleware/validate.js → Zod membersihkan & memvalidasi input
   ▼
src/controllers/*.js     → orchestrasi request
   ▼
src/services/*.js        → logika bisnis + query MongoDB
   ▼
src/models/*.js          → Mongoose → MongoDB Atlas
```

---

## Cara Kerja Penting

### 1. Pesanan lewat WhatsApp

1. Pembeli memilih jumlah → klik "Pesan via WhatsApp".
2. Backend membuat **kode pesanan** (`KS-YYMMDD-XXXX`), menyimpan **snapshot harga**, dan
   mencatat pesanan dengan status **`pending` (menunggu konfirmasi)**.
3. Browser membuka `https://wa.me/<nomor>?text=<pesan otomatis>`.
4. Pembeli & penjual chatting di WhatsApp.
5. Penjual mengubah status di dashboard: `pending → confirmed → completed`.

> **Membuka WhatsApp bukan berarti pesanan berhasil atau sudah dibayar.**
> Aplikasi tidak bisa memverifikasi pembayaran secara otomatis.

**Snapshot harga:** `priceSnapshot` disimpan saat pesanan dibuat. Kalau penjual menaikkan
harga produk, catatan pesanan lama **tidak** ikut berubah.

**Stok:** backend tidak otomatis mengurangi stok. Stok dianggap keluar saat penjual menandai
pesanan *selesai*.

### 2. Rating & ulasan

- Ulasan **wajib** berasal dari pesanan berstatus *selesai*.
- Satu orang hanya boleh mengulas **satu kali per pesanan** (dijaga unique index).
- Ulasan yang disembunyikan admin **tidak** ikut dihitung ke rating rata-rata.
- **Tidak ada label "terverifikasi"/"belum terverifikasi"** pada ulasan. Fitur itu sengaja
  dihapus: transaksi terjadi lewat WhatsApp sehingga tidak ada sumber pembayaran yang bisa
  diverifikasi otomatis, dan menampilkan label seperti itu hanya menimbulkan kesan palsu.


### 3. Keuangan

```
Total pemasukan = jumlah seluruh transaksi pemasukan pada periode terpilih
Total pengeluaran = jumlah seluruh transaksi pengeluaran pada periode terpilih
Selisih arus kas = total pemasukan - total pengeluaran
```

- Pesanan **tidak** otomatis menjadi pemasukan. Pemasukan dari pesanan hanya dicatat setelah
  penjual mengonfirmasi, lewat tombol "Catat pemasukan".
- Unique index mencegah pencatatan ganda dari satu pesanan yang sama.
- **Selisih arus kas belum tentu sama dengan laba.** Nilainya hanya akurat bila semua modal
  dan biaya ikut dicatat. Aplikasi selalu menampilkan catatan ini di bawah angka.

### 4. Lokasi toko
Toko menyimpan **kota/area** dan **kelas atau lokasi di sekolah** (mis. "Kelas XI RPL 1",
"Perpustakaan", "Kantin Sekolah").

- Yang tampil di halaman publik hanya **kota**, kecuali penjual mencentang
  "Tampilkan kelas / lokasi di sekolah di halaman publik".
- Alamat rumah tidak pernah diminta, jadi tidak ada data pribadi yang bocor.

- **Terlaris** dihitung dari `soldCount`, yaitu pesanan berstatus *selesai* — bukan dari
  jumlah klik tombol WhatsApp.
- **Rating tertinggi** butuh jumlah ulasan minimum (default **3 ulasan** dan rating **4+**)
  supaya 1 ulasan bintang 5 tidak mendominasi beranda. Kalau belum ada data cukup,
  beranda menampilkan produk terbaru sebagai alternatif dan menjelaskan alasannya.
- Tidak ada satu pun angka penjualan atau rating yang dibuat-buat.

---

## Keamanan

| Ancaman | Perlindungan |
|---|---|
| Password bocor | Hash bcrypt cost 12, `select: false`, tidak pernah dikirim ke API |
| SQL/NoSQL injection | Semua input divalidasi Zod (tipe dijamin), filter Mongoose dibangun di service, string regex di-escape |
| XSS | Output di-escape di frontend (`UI.escapeHtml`), CSP Helmet, tidak ada `innerHTML` dari data mentah |
| CSRF | Token double-submit + cookie `SameSite=Lax`, dicek di semua POST/PATCH/DELETE |
| Session fixation | Session ID di-regenerate setiap login |
| Brute force | Rate limit 5 percobaan / 10 menit + lock akun 15 menit setelah 5 gagal |
| IDOR (akses toko lain) | Identitas toko selalu dari session, bukan dari body/parameter request |
| Eskalasi privilege | Role selalu dibaca dari database; pendaftaran publik selalu `seller` |
| Upload berbahaya | Validasi MIME + ukuran + magic bytes, nama file tidak pernah dipakai apa adanya |
| Cookie bocor | `HttpOnly` + `Secure` (produksi) + `SameSite` |
| Stack trace bocor | Error handler terpusat; pesan internal tidak pernah dikirim ke pengguna |
| Kredensial bocor | Hanya ada di `.env` (git-ignored); API key gambar tidak pernah masuk frontend |

> Catatan jujur: aplikasi ini **belum pernah diaudit oleh profesional keamanan**.
> Jalankan audit dan pengujian sendiri sebelum dipakai untuk data nyata.

---

## Deployment

### Apakah database bisa nyala 24/7 tanpa bayar? — YA

**MongoDB Atlas M0 (Free) berjalan 24 jam nonstop.** Yang perlu kamu tahu:

| Batas M0 | Nilai | Arti buat proyek sekolah |
|---|---|---|
| Harga | **$0 selamanya** | Tidak ada tagihan, tidak perlu kartu kredit |
| Penyimpanan | **512 MB** (absolut, bukan per bulan) | Cukup untuk ribuan produk + ulasan |
| RAM / vCPU | Shared | Dipakai bersama pengguna lain |
| Koneksi | **500** bersamaan | Aplikasi kita hanya pakai ~2 koneksi |
| Operasi | **100 operasi/detik** | Jauh di atas kebutuhan 50 siswa |
| Database / collection | 100 / 500 | Koleksi kita ada 10 |
| Transfer data | 10 GB masuk + 10 GB keluar per 7 hari | Cukup untuk gambar & teks |
| Backup otomatis | **Tidak ada** | Ekspor manual (`mongodump`) secara berkala |

**Soal "nyala terus":** Atlas **meng-auto-pause cluster M0 setelah 30 hari tanpa koneksi
sama sekali**, lalu **langsung hidup lagi** begitu ada koneksi baru. Karena aplikasi kita
selalu terhubung ke database (Mongoose + `connect-mongo`), cluster praktis tidak akan pernah
pause selama aplikasinya dipakai.

> **Jadi: database-mu tetap hidup 24/7. Yang bisa "tidur" adalah server aplikasinya.**

### Opsi hosting gratis (server aplikasi)

| Platform | Status free tier (per Oktober 2026) | Sifat |
|---|---|---|
| **Render** (Web Service) | 750 jam instans/bulan, RAM 512 MB, **tidur setelah 15 menit idle**, cold start ±1 menit | Paling gampang setup |
| **Koyeb** | Free tier tersedia, scale-to-zero | Cold start mirip Render |
| **Railway** | **Free tier sudah dihapus** (2023) — hanya kredit trial $5 sekali pakai | Tidak gratis lagi |
| **Fly.io** | **Tidak ada free tier** untuk pengguna baru | Butuh kartu kredit |
| **Oracle Cloud Always Free** | VM **2 OCPU / 12 GB RAM** (Arm) + 200 GB storage, seumur hidup akun | Benar-benar 24/7, tapi harus pasang sendiri |

### Rekomendasi untuk proyek SMK

**Paling mudah & cukup (pilihan utama):**
> **MongoDB Atlas M0** (database, gratis 24/7) + **Render free web service** (aplikasi).
> Kekurangannya: server tidur setelah 15 menit tidak ada yang membukanya. **Saat presentasi,
> buka linknya 1–2 menit lebih awal** supaya sempat "wake up".

**Kalau mau benar-benar 24/7 tanpa cold start:**
> **Oracle Cloud Always Free** — pasang sendiri MongoDB + Node.js + Nginx + Let's Encrypt di
> satu VM. Gratis seumur hidup akun, tidak tidur. Tapi: perlu kartu kredit untuk verifikasi
> (tidak ada biaya selama di bawah batas), sering kena error *"Out of capacity"* saat membuat
> VM, dan setup-nya jauh lebih repot. **Disarankan hanya kalau kamu sudah nyaman pakai
> terminal Linux.**

> ⚠️ **Tidak ada hosting gratis tanpa batas.** Semua platform di atas punya kuota, batas
> memori, dan/atau aturan tidur. Cek ulang batasannya di situs masing-masing sebelum memilih
> platform — aturan free tier sering berubah.

### Tips khusus untuk aplikasi ini

- **Session aman walau server tidur.** Session disimpan di collection `sessions` di MongoDB
  (bukan di memory), jadi walaupun Render tidur server, pengguna **tetap login** dan tidak
  perlu login ulang.
- **Session lama terhapus otomatis.** `connect-mongo` membuat TTL index, jadi session yang
  kadaluarsa dibersihkan sendiri oleh database.
- **Koneksi database tetap terbuka** → cluster Atlas M0 tidak akan ke-pause selama app dipakai.
- **Kuota koneksi aman.** `src/config/db.js` memakai `maxPoolSize: 10`, jauh di bawah batas
  500 koneksi milik M0.
- **Backup manual wajib.** M0 tidak punya backup otomatis. Ekspor sesekali dari Atlas
  (Clusters → *Download Database* / `mongodump`) supaya data tugas sekolahmu aman.
- Kalau data sudah mendekati 512 MB, arsipkan `activity_logs` dan `sessions` — keduanya
  aman dihapus tanpa mengganggu data utama.

### Langkah deployment (contoh Render)

> **Catatan penting soal GitHub:** GitHub (dan GitHub Pages) **hanya bisa menyajikan file
> statis** (HTML/CSS/JS). GitHub Pages **tidak bisa** menjalankan Node.js/Express dan
> **tidak bisa** terhubung ke database. Jadi:
> - **GitHub** = tempat menyimpan kodemu (backup + sumber deploy).
> - **Render** = tempat aplikasinya *jalan* (server + API + frontend sekaligus).
> - **MongoDB Atlas** = tempat datanya *tinggal* (selalu nyala 24/7).
>
> Frontend + backend sebaiknya di-host **bersama** di Render (satu URL). Kalau dipisah
> (frontend di GitHub Pages, backend di Render), kamu perlu mengatur API base URL, CORS, dan
> cookie `SameSite=None; Secure` — repot untuk tugas sekolah.

1. Push kode ke GitHub.
2. Render → *New Web Service* → pilih repo → Environment: **Node**.
3. Build command: `npm install && npm run icons`
   Start command: `npm start`
4. Tambahkan **Environment Variables** dari `.env.example` (termasuk `MONGODB_URI`,
   `SESSION_SECRET`, `APP_URL`, `IMAGE_PROVIDER=cloudinary`, `SESSION_SECURE=true`).
5. Deploy → setelah aktif, jalankan sekali `npm run create-admin` lewat shell Render
   atau buat akun admin dari halaman dashboard (khusus admin pertama).
6. Update `APP_URL` dengan domain Render, lalu `APP_URL` dipakai untuk tautan pesan WhatsApp.

### HTTPS & domain

- Render/Railway/Vercel memberi sertifikat HTTPS otomatis.
- Untuk domain sendiri: tambahkan di panel hosting → buat DNS `CNAME` ke hosting →
  HTTPS otomatis ikut aktif.

### Checklist sebelum produksi

- [ ] `SESSION_SECRET` acak & berbeda dari development
- [ ] `SESSION_SECURE=true`
- [ ] `NODE_ENV=production`
- [ ] `IMAGE_PROVIDER=cloudinary` (atau layanan lain yang stabil)
- [ ] Password `BOOTSTRAP_ADMIN_*` sudah dihapus dari `.env`
- [ ] Database Atlas sudah di-backup /username & IP access sudah dibatasi
- [ ] `npm test` lulus

---

## Masalah yang Sering Muncul

| Gejala | Penyebab & Solusi |
|---|---|
| `MONGODB_URI belum diisi` saat `npm start` | `.env` belum dibuat. `cp .env.example .env` lalu isi. |
| `Server will not connect` / timeout ke Atlas | Cek IP Access di Atlas, cek username & password, cek koneksi internet. |
| `EADDRINUSE` | Port sudah dipakai. Ganti `PORT` di `.env` atau hentikan proses lain. |
| `bcryptjs` gagal install | Hapus `node_modules` lalu `npm install`. Kalau masih gagal, pakai Node 20 LTS. |
| Ikon tidak muncul | Jalankan `npm run icons` (membuat `public/assets/icons/sprite.svg`). |
| `MongoStore is not a function` | Versi `connect-mongo` berbeda. Jalankan `npm install` ulang. |
| Grafik kosong | Chart.js dimuat dari CDN; butuh internet. Halaman lain tetap normal. |
| "Token keamanan tidak valid" | Muat ulang halaman. Token CSRF berubah setelah login/logout. |
| Login ditolak padahal password benar | 5 kali gagal → akun terkunci 15 menit. Tunggu atau hubungi admin. |

---

## Lisensi

MIT — bebas dipakai & dimodifikasi untuk keperluan sekolah.
