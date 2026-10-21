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
- Semua ulasan berlabel **"Belum terverifikasi"**, karena pembayaran terjadi di WhatsApp
  dan tidak bisa diverifikasi otomatis.

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

### 4. Produk terlaris & rating tertinggi

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

### Opsi hosting gratis (backend + database)

| Platform | Database | Catatan |
|---|---|---|
| **Render** (Web Service) | MongoDB Atlas M0 | Ada free tier web service (512 MB RAM, build 15 menit). Bundle Node harus versi 18+. |
| **Railway** | MongoDB Atlas M0 | Ada trial gratis, kuota pemakaian terbatas. |
| **Koyeb / Fly.io** | MongoDB Atlas M0 | Free tier kecil, cold start bisa lambat. |

> **Batas paket gratis (perkiraan 2026, bisa berubah):**
> - Atlas M0: 512 MB penyimpanan, satu cluster *shared*, tidak ada backup otomatis.
> - Free tier hosting biasanya punya ** batas memori, waktu build, dan bisa "tidur"
>   (cold start)** sehingga halaman pertama lebih lambat.
> - **Verifikasi lagi batasannya di situs masing-masing sebelum memilih platform.**
>   Jangan menjanjikan hosting gratis tanpa batas.

### Langkah deployment (contoh Render)

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
