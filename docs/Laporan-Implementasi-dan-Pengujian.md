# Laporan Implementasi & Pengujian — KantinSiswa

Dokumen ini merangkum Tahap 2 sampai Tahap 10: apa yang dibangun, di file mana,
bagaimana cara kerjanya, dan **hasil pengujian yang benar-benar dijalankan**.

Dokumen analisis & perancangan ada di [`Tahap-1-Analisis-dan-Perancangan.md`](./Tahap-1-Analisis-dan-Perancangan.md).

---

## Ringkasan Tahap

| Tahap | Hasil | Status |
|---|---|---|
| 1. Analisis & perancangan | Analisis kebutuhan, alur pengguna, skema 10 koleksi, daftar endpoint, risiko, MVP | ✅ |
| 2. Fondasi proyek | Struktur folder, package.json, konfigurasi, Express, koneksi Atlas, 10 model, `/api/health` | ✅ |
| 3. UI marketplace | 4 file CSS, navbar/footer bersama, beranda, katalog, kartu produk, footer, responsif | ✅ |
| 4. Autentikasi & otorisasi | Registrasi, login, logout, session, role, CSRF, rate limit | ✅ |
| 5. Produk & profil toko | CRUD produk, upload gambar (Cloudinary + lokal), profil toko publik | ✅ |
| 6. WhatsApp & pesanan | Pembuatan pesanan, kode referensi, pesan otomatis, 4 status, catat pemasukan | ✅ |
| 7. Rating & ulasan | Rating 1-5, ulasan dari pesanan selesai, moderasi admin, pelaporan | ✅ |
| 8. Dashboard penjual | Ringkasan, produk, pesanan, keuangan (+grafik, CSV), ulasan, profil | ✅ |
| 9. Dashboard super admin | Ringkasan, pengguna, produk, kategori, laporan, log, pengaturan | ✅ |
| 10. Pengujian & deployment | 115 tes otomatis, audit keamanan dasar, README lengkap | ✅ |

---

## Tahap 2 — Fondasi Proyek

### File utama
- `package.json` — dependensi & skrip (`start`, `dev`, `test`, `seed`, `create-admin`, `icons`).
- `.env.example` — semua variabel konfigurasi **tanpa kredensial asli**.
- `src/config/env.js` — membaca & memvalidasi `.env`. Kalau `MONGODB_URI` atau
  `SESSION_SECRET` belum diisi, server **berhenti dengan pesan jelas** (bukan error aneh).
- `src/config/db.js` — koneksi Mongoose dengan retry + status koneksi.
- `src/config/app.config.js` — nama aplikasi, palet warna, pagination, kategori keuangan.
- `src/app.js` — instance Express (tanpa `listen`, supaya bisa dipakai supertest).
- `src/server.js` — connect DB → listen → shutdown rapi saat Ctrl+C.

### Yang sudah diuji
`GET /api/health` mengembalikan `{"status":"ok","database":"connected"}` saat database hidup,
dan status `503` + `database: "disconnected"` bila koneksi database gagal.

---

## Tahap 3 — UI Marketplace

### File
| File | Isi |
|---|---|
| `public/assets/css/base.css` | Reset, token warna (CSS variables), tipografi, tombol, form, tabel, skeleton, toast, modal, pagination, rating, responsif, `prefers-reduced-motion` |
| `public/assets/css/components.css` | Navbar, footer, kartu produk, kartu toko, kartu kategori, breadcrumb, chip, filter bar |
| `public/assets/css/public.css` | Hero, CTA banner, katalog + sidebar filter, detail produk, profil toko, halaman auth, 404/403 |
| `public/assets/css/dashboard.css` | Layout dashboard (sidebar), kartu statistik, chart, toolbar |
| `public/assets/js/api.js` | Wrapper `fetch` + token CSRF + normalisasi error + redirect 401 |
| `public/assets/js/ui.js` | Format rupiah/tanggal, ikon, stars, toast, modal, konfirmasi, skeleton, empty/error state, kartu produk/toko, navbar, footer, guard role |
| `public/assets/js/chart.js` | Pemuat Chart.js *lazy* dari CDN + palet & opsi bersama |
| `public/assets/icons/sprite.svg` | 86 ikon Lucide, dibuat oleh `npm run icons` |

### Prinsip yang diterapkan
- **Tanpa emoji** — semua ikon SVG dari sprite lokal (satu request HTTP, bisa offline).
- **Tanpa library berat** — total CSS ± 40 KB, JS ± 45 KB (belum termasuk Chart.js yang lazy).
- **Font sistem** (`system-ui`) — tidak perlu unduh font dari Google, jadi lebih cepat di
  perangkat low-spec dan tetap jalan tanpa internet.
- **Layout responsif** — grid produk 4→2→1 kolom, sidebar dashboard berubah jadi bar horizontal,
  navbar berubah jadi menu hamburger di bawah 760px.
- **State lengkap** — skeleton saat memuat, empty state saat kosong, error state + tombol
  "coba lagi" saat gagal, toast untuk hasil aksi.

---

## Tahap 4 — Autentikasi & Otorisasi

### Alur
1. `POST /api/auth/register` → validasi Zod → normalisasi WhatsApp → cek unik →
   hash bcrypt (cost 12) → buat `User` + `Store` → session langsung dibuat.
2. `POST /api/auth/login` → session di-**regenerate** (anti session fixation) → session user.
3. Setiap request terproteksi → user **diambil ulang dari database** → status `active` dicek.
   Artinya: begitu admin menonaktifkan seorang penjual, sesinya langsung tidak berlaku.
4. Otorisasi selalu membaca role **dari database**, tidak dari session/body.

### Normalisasi WhatsApp
`+62 812-3456-7890`, `081234567890`, dan `6281234567890` 모두 menjadi `6281234567890`.
Ini penting supaya satu orang tidak bisa membuat akun berkali-kali dengan format berbeda.

### Reset password tanpa email
Permintaan → diverifikasi admin lewat WhatsApp → admin menerbitkan token sekali pakai
(berumur 30 menit, disimpan sebagai **hash SHA-256**) → seller menukar token dengan password baru.
Pesan yang dikembalikan selalu sama supaya tidak membocorkan nomor mana yang terdaftar.

---

## Tahap 5 — Produk & Profil Toko

- Schema `Product` memuat slug unik, harga integer, stok, status
  (`draft` / `active` / `out_of_stock` / `hidden`), galeri (URL + metadata), serta cache
  agregat `soldCount`, `orderCount`, `ratingAvg`, `ratingCount`.
- **Gambar tidak pernah disimpan sebagai binary di MongoDB.** Backend meneruskan file ke
  provider (Cloudinary atau lokal) dan hanya menyimpan URL + dimensi + ukuran file.
- Upload divalidasi 3 lapis: MIME (multer) → ukuran (multer) → **magic bytes** (isi file
  benar-benar gambar PNG/JPEG/WebP) → dicocokkan dengan `Content-Type` yang dikirim.
- Halaman profil toko **tidak pernah menampilkan kelas/lokasi secara otomatis**; hanya kota,
  kecuali penjual mencentang "Tampilkan kelas / lokasi di sekolah di halaman publik".
  Yang ditanyakan ke penjual adalah **kelas atau lokasi di sekolah** (mis. "Kelas XI RPL 1"),
  bukan alamat rumah — supaya tidak ada data pribadi yang bocor.

---

## Tahap 6 — WhatsApp & Pesanan

| Yang | Detail |
|---|---|
| Kode pesanan | `KS-YYMMDD-XXXX` (4 karakter acak tanpa karakter ambigu) |
| Pesan otomatis | Nama produk, harga, jumlah, kode pesanan, nama toko, tautan produk |
| Status awal | `pending` — **bukan** "berhasil" |
| Snapshot harga | `priceSnapshot` + `subtotal` dihitung saat pesanan dibuat |
| Transisi status | `pending → confirmed → completed`, `pending/confirmed → cancelled` |
| Stok | **tidak** otomatis berkurang; dihitung keluar saat status `completed` |
| Anti catat ganda | Unique index `{ storeId, orderId, type, source }` + pengecekan manual |

UI menampilkan catatan tegas: *"Membuka WhatsApp belum berarti pesanan terkonfirmasi atau
pembayaran berhasil."*

---

## Tahap 7 — Rating & Ulasan

- Rating 1–5 divalidasi di **frontend dan backend**.
- Ulasan hanya bisa dibuat dari pesanan berstatus `completed` milik pembaca.
- Unique index `{ orderId, buyerId }` mencegah rating ganda untuk pesanan yang sama.
- Ulasan yang disembunyikan admin dikeluarkan dari perhitungan rating (dicek lewat tes).
- **Label verifikasi dihapus** (keputusan user saat polish UI). Semua ulasan dulu diberi
  label "Belum terverifikasi"; karena transaksi lewat WhatsApp tidak punya sumber pembayaran
  yang bisa diverifikasi otomatis, label seperti itu hanya menimbulkan kesan palsu. Field
  `isVerifiedPurchase` ikut dihapus dari model, service, dan API.
- Ada endpoint `POST /api/reports` untuk melaporan ulasan/produk yang tidak pantas.

---

## Tahap 8 — Dashboard Penjual

- **Ringkasan:** 8 kartu statistik + filter periode (harian/mingguan/bulanan/custom) +
  grafik arus kas 14 hari + pesanan terbaru + peringatan stok menipis.
- **Produk:** tabel + pencarian + filter kategori/status + produk terlaris + form tambah/ubah
  (termasuk upload foto dengan pratinjau sebelum disimpan).
- **Pesanan:** daftar + filter status + detail + ubah status + tombol "Catat pemasukan".
- **Keuangan:** catat/edit/hapus transaksi manual, filter tanggal & kategori, grafik,
  ringkasan per kategori, ekspor CSV (dengan BOM UTF-8 agar Excel membaca karakter Indonesia).
- **Ulasan:** daftar ulasan + ringkasan rating (tampil vs disembunyikan).
- **Profil:** edit nama toko/kategori/WhatsApp/deskripsi/lokasi + centang tampil-tauwily,
  ganti password.

Transaksi yang berasal dari pesanan (`source: 'order'`) **tidak boleh diedit atau dihapus**
supaya riwayat pembukuan tetap konsisten.

---

## Tahap 9 — Dashboard Super Admin

Semua route berada di balik `requireAuth` + `requireRole('superadmin')` **di level router**,
bukan hanya dengan menyembunyikan tombol di frontend.

| Halaman | Kemampuan |
|---|---|
| Ringkasan | 8 statistik marketplace + grafik pesanan 6 bulan + toko & produk terlaris |
| Pengguna & Toko | Cari/filter, detail, aktif/nonaktifkan (wajib alasan), terbitkan token reset |
| Produk | Cari/filter, sembunyikan/tampilkan (wajib alasan) |
| Kategori | CRUD + urutan tampil + ikon |
| Laporan & Ulasan | Tangani laporan, moderasi ulasan (wajib alasan) |
| Log Aktivitas | Jejak aktivitas penting (tanpa password/token) |
| Pengaturan | Nama aplikasi, kontak, hero, minimum ulasan, buka/tutup pendaftaran |

Super admin **tidak bisa** dinonaktifkan lewat dashboard, dan admin **tidak bisa**
mengubah keuangan penjual (tidak ada endpoint itu sama sekali).

---

## Tahap 10 — Pengujian

### Cara menjalankan

```bash
npm test
```

Menggunakan **Node.js Test Runner** bawaan + **supertest**.
Database test memakai **MongoDB di memory** (`mongodb-memory-server`) — tidak perlu Atlas,
tidak mengotori database asli.

### Hasil aktual (run terakhir)

```
ℹ tests 115
ℹ suites 0
ℹ pass 115
ℹ fail 0
ℹ duration_ms 53834.828703
```

### Rincian cakupan

| Berkas | Jumlah | Yang diuji |
|---|---|---|
| `tests/auth.test.js` | 13 | Pendaftaran (sukses, konfirmasi password salah, password pendek, tidak setuju aturan, WA duplikat, WA invalid), login (berhasil, format berbeda, password salah, nomor tak terdaftar), proteksi endpoint tanpa login, logout, ganti password |
| `tests/product.test.js` | 14 | CRUD produk, validasi harga/stok, isolasi antar toko, **IDOR edit & hapus produk milik orang lain**, slug baru saat nama diubah, hapus vs sembunyikan bila ada pesanan, pencarian/filter katalog, parameter tidak valid, pagination, detail + produk terkait, draft tidak tampil |
| `tests/order.test.js` | 11 | Pembuatan pesanan, isi pesan WhatsApp, snapshot harga tidak berubah, draft ditolak, qty invalid, stok habis, transisi status, transisi tidak sah, **pesanan toko lain tidak bisa diubah**, penghitung penjualan, **pemasukan hanya sekali**, pemesanan belum dikonfirmasi ditolak, **pesanan baru tidak jadi pemasukan** |
| `tests/review.test.js` | 12 | Ulasan dari pesanan selesai, pesanan belum selesai ditolak, pesanan orang lain ditolak, rating ganda ditolak, rating di luar 1-5 ditolak, komentar pendek ditolak, tanpa login ditolak, rata-rata rating, ulasan tersembunyi tidak dihitung, alasan moderasi wajib, orderId acak ditolak |
| `tests/finance.test.js` | 11 | Catat pemasukan/pengeluaran, nominal negatif, total & selisih arus kas, isolasi toko lain, edit & hapus, **IDOR edit transaksi**, filter tanggal/kategori, ekspor CSV, kartu statistik dashboard, dashboard tanpa login |
| `tests/security.test.js` | 15 | Penjual tidak bisa akses endpoint admin, admin tanpa login ditolak, super admin boleh, role tidak bisa dipaksa saat daftar, **CSRF tanpa token ditolak**, token salah ditolak, super admin tak bisa dinonaktifkan, alasan wajib, **toko nonaktif tak bisa login**, **sesi tak aktif langsung ditolak**, moderasi produk, **hash password tak pernah muncul**, **stack trace tak bocor**, **rate limit login**, hash tak bocor di profil |
| `tests/frontend.test.js` | 12 | 23 halaman tersedia & punya elemen penting, meta viewport di semua halaman, ikon SVG (bukan emoji), sprite ikon lengkap, aset CSS/JS tersedia, 404 aman, health check |
| `tests/image.test.js` | 9 | Deteksi tipe dari magic bytes, baca ukuran tanpa library, file non-gambar ditolak, upload lokal berhasil, tipe tidak cocok ditolak, file > 4 MB ditolak, tipe tidak didukung ditolak, **provider tak terkonfigurasi → 503 dengan pesan jelas**, endpoint status |
| **Total** | **115** | **Semua lulus** |

### Pengujian manual di browser (dilakukan lewat browser otomatis + curl)

| Yang diuji | Hasil |
|---|---|
| Beranda memuat kategori, produk terbaru/terlaris/rating, toko pilihan | ✅ data nyata tampil |
| Katalog: filter kategori dari URL | ✅ "Menampilkan 3 dari 3 produk" |
| Login admin (`081200000999`) → redirect ke `/admin/index.html` | ✅ |
| Login penjual (`081234567890`) → dashboard | ✅ 8 kartu statistik terisi (3 produk aktif, 4 pesanan, 3 selesai) |
| 7 halaman admin | ✅ 0 error console |
| 6 halaman dashboard penjual | ✅ 0 error console |
| 10 halaman publik | ✅ 0 error console (2 inline-CSP violation sudah diperbaiki) |
| `PATCH /api/admin/settings` | ✅ tersimpan, terbaca kembali |
| `npm run seed` | ✅ 6 kategori, 3 toko, 9 produk, 3 pesanan selesai |
| `npm run create-admin` | ✅ akun super admin dibuat |

### Bug yang ditemukan & diperbaiki selama pengerjaan

| Bug | Gejala | Perbaikan |
|---|---|---|
| Normalisasi WhatsApp salah | `081234567890` ditolak backend | Logika prefix `62`/`0` dirapikan |
| `mongoose.set('sanitizeFilter', true)` merusak pencarian | Query `$regex` dibungkus jadi `$eq` → CastError | Opsi `sanitizeFilter` dihapus; perlindungan NoSQL injection relies on validasi Zod + filter yang dibangun di service + `escapeRegex()` |
| `$day` bukan operator MongoDB | Agregasi arus kas error | Diganti `$dayOfMonth` |
| `const [totals] = await aggregate(...)` | Error saat tidak ada transaksi | Diganti `const totals = await ...` |
| Route seller memakai controller yang salah | 500 "fn is not a function" | `order.controller` diimpor terpisah di `seller.routes.js` |
| `connect-mongo` v6 tidak punya `MongoStore.create` | Server crash saat boot | Diganti `const { MongoStore } = require('connect-mongo')` + `new MongoStore()` |
| Key pengaturan di-lowercase | `app.heroTitle` & `app.herotitle` tersimpan dua-duanya | `lowercase` dihapus dari schema + dedupe aman di service |
| Token CSRF basi setelah login/logout | Permintaan menulis gagal 403 | Token disimpan otomatis dari setiap respons + di-reset saat logout |
| Inline script di 404/403 | Diblokir Content-Security-Policy | Dipindah ke `assets/js/simple-layout.js` |
| `app` tidak terdefinisi di `server.js` | Server crash saat start | `require('./app')` ditambahkan |

### Audit keamanan dasar (manual)

| Poin | Status |
|---|---|
| Password di-hash, tidak pernah keluar dari API | ✅ (tes otomatis) |
| Role tidak bisa dipaksa lewat body request | ✅ (tes otomatis) |
| IDOR antar toko (produk/pesanan/transaksi) | ✅ (tes otomatis, 3 skenario) |
| Endpoint admin terlindungi di server | ✅ (tes otomatis) |
| CSRF aktif pada semua request menulis | ✅ (tes otomatis) |
| Rate limit login aktif | ✅ (tes otomatis) |
| Validasi server-side untuk semua input utama | ✅ (Zod di 5 berkas validator) |
| Filter MongoDB tidak menerima objek mentah dari user | ✅ |
| Kredensial hanya di `.env` (tidak di-commit) | ✅ (`.gitignore`) |
| Error tidak membocorkan stack trace | ✅ (tes otomatis) |
| Upload divalidasi 3 lapis | ✅ (tes otomatis) |
| Log aktivitas tanpa password/token | ✅ (tidak ada field rahasia di model log) |

> **Catatan jujur:** audit di atas adalah pemeriksaan internal, **bukan** audit keamanan
> profesional. Belum ada penetration test, belum ada review kode oleh pihak lain, dan
> aplikasi belum pernah dipakai dengan data nyata yang sensitif. Lakukan review tambahan
> sebelum dipakai luas.

---

## Yang Belum Ditolak (batas versi awal)

| Fitur | Alasan | Versi sederhana yang dipakai |
|---|---|---|
| Payment gateway | Butuh rekening merchant & biaya | Bayar via WhatsApp + pencatatan manual |
| Verifikasi pembelian otomatis | Tidak ada sumber pembayaran yang bisa dicek | Tanpa label verifikasi + moderasi |
| Live chat | Kompleks (WebSocket) | Chat WhatsApp |
| Notifikasi email | Perlu layanan email | Toast in-app |
| Dark mode | Perlu token warna ganda | Terus terang |
| Multi-penjual per toko | Menyederhanakan scoping & keamanan | 1 toko per penjual |
| Kategori bertingkat | Tidak diperlukan untuk versi awal | 1 level |

---

## Kesimpulan

Aplikasi sudah memenuhi kriteria "versi awal" di prompt:

- ✅ Pengunjung bisa melihat, mencari, dan memfilter produk.
- ✅ Penjual bisa mendaftar dan login dengan aman.
- ✅ Penjual bisa mengelola produk miliknya sendiri.
- ✅ Pembeli bisa memulai pemesanan lewat WhatsApp.
- ✅ Permintaan pesanan bisa dikelola lewat dashboard.
- ✅ Rating dan ulasan bisa disimpan serta dimoderasi.
- ✅ Penjual bisa mencatat pemasukan dan pengeluaran.
- ✅ Statistik keuangan dihitung dari data benar (dengan 115 tes otomatis).
- ✅ Produk terlaris & rating tertinggi memakai data nyata, bukan angka buatan.
- ✅ Super admin punya akses khusus yang terlindungi di server.
- ✅ Tampilan responsif (desktop / tablet / ponsel).
- ✅ Tidak ada tombol utama tanpa fungsi.
- ✅ Dokumentasi instalasi & konfigurasi ada di `README.md`.
- ✅ Pengujian terdokumentasi di dokumen ini, lengkap dengan hasil run nyata.
