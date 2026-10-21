# Tahap 1 — Analisis dan Perancangan
## KantinSiswa (nama sementara, mudah diganti lewat satu konfigurasi)

Dokumen ini adalah **hasil analisis, bukan kode aplikasi**. Isinya dipakai sebagai cetakan biru (blueprint) untuk Tahap 2 dan seterusnya.

---

## 1. Ringkasan Kebutuhan

### 1.1 Identitas aplikasi

| Item | Nilai | Catatan |
|---|---|---|
| Nama | `KantinSiswa` | Diambil dari `src/config/app.config.js` + `APP_NAME` di `.env`. Ganti 1 tempat = seluruh UI ikut berubah. |
| Jenis | Marketplace 2 sisi (pembeli ↔ penjual) | Tanpa payment gateway di versi awal. |
| Platform | Web responsif (desktop / tablet / ponsel) | Vanilla HTML/CSS/JS, tanpa framework berat. |
| Tema | Hijau | `#16A34A` / `#166534` / `#DCFCE7` / `#F8FAF9` / `#FFFFFF` / `#1F2937` / `#6B7280` |

### 1.2 Kebutuhan fungsional

**Modul Visitor (publik, tanpa login)**
- F1. Melihat beranda: kategori, produk terbaru, produk terlaris, rating tertinggi, toko pilihan.
- F2. Mencari & memfilter produk (kata kunci, kategori, rentang harga).
- F3. Mengurutkan: terbaru, harga terendah, harga tertinggi, terlaris, rating tertinggi.
- F4. Melihat detail produk (+ produk terkait).
- F5. Melihat profil toko publik.
- F6. Memesan via WhatsApp (dengan pesan otomatis & kode pesanan).

**Modul Seller (login sebagai penjual)**
- F7. Daftar akun + buka toko, login, logout, ubah profil, ubah password.
- F8. CRUD produk miliknya (draft / aktif / habis / disembunyikan).
- F9. Upload foto produk (validasi tipe + ukuran, pratinjau sebelum simpan).
- F10. Dashboard ringkasan: produk aktif, pesanan, pemasukan, pengeluaran, laba, rating.
- F11. Manajemen pesanan: ubah status (menunggu → dikonfirmasi → selesai / dibatalkan).
- F12. Pencatatan keuangan: tambah/edit/hapus pemasukan & pengeluaran, filter, grafik, ekspor CSV.
- F13. Melihat ulasan produk sendiri.

**Modul Super Admin**
- F14. Ringkasan marketplace, grafik statistik, daftar & pencarian pengguna.
- F15. Aktif/nonaktifkan toko (wajib menyertakan alasan).
- F16. Review & sembunyikan produk / ulasan yang melanggar aturan.
- F17. Kelola kategori produk.
- F18. Tinjau laporan ulasan (moderasi).
- F19. Lihat log aktivitas administratif.
- F20. Kelola pengaturan umum marketplace.

**Modul Cross-cutting**
- F21. Rating 1–5 bintang + ulasan + pelaporan.
- F22. Notifikasi sukses/error, loading state, empty state, error state.
- F23. Keamanan: session, rate limit, proteksi IDOR, validasi backend.

### 1.3 Kebutuhan non-fungsional

| Aspek | Target |
|---|---|
| Performa | Halaman katalog < 1,5 dtk di jaringan 3G; tidak ada library berat; gambar terkompresi & `loading="lazy"`. |
| Perangkat low-spec | Tanpa blur/animasi berat; skeleton loading sederhana; CSS < 60 KB total. |
| Keamanan | Password di-hash, session HttpOnly, rate limit, validasi server, otorisasi per endpoint, tidak ada kredensial di frontend. |
| Aksesibilitas | Kontras teks ≥ 4.5:1, target tombol ≥ 40px, navigasi keyboard, `aria-label` pada ikon. |
| Skalabilitas | Index MongoDB pada field yang di-query, agregasi untuk statistik, `lean()` pada query baca. |
| Portabilitas | `npm install && npm start` → jalan lokal dengan `.env` yang benar. |

---

## 2. Alur Pengguna

### 2.1 Alur Pembeli (Visitor → Pembeli)

```
Buka Beranda
   │
   ├─► Cari di navbar ──► Katalog (filter kategori/harga/sort) ──► Detail Produk
   │                                                                   │
   ├─► Klik kategori di beranda ──► Katalog terfilter                     │
   │                                                                   │
   └─► Klik "Toko Pilihan" ──► Profil Toko ──► Daftar produk toko ──────┤
                                                                       ▼
                                                        [Pilih jumlah] → [Pesan via WhatsApp]
                                                                       │
                                                        Backend: cek harga & stok dari DB
                                                        + buat kode pesanan (mis. KS-2608-4F2A)
                                                        + simpan snapshot harga
                                                        + catat pesanan status "menunggu konfirmasi"
                                                                       ▼
                                                        Browser buka wa.me/62xxxx?text=<pesan>
                                                                       ▼
                                        [Pembeli & penjual chatting manual di WhatsApp]
                                                                       ▼
                                                        Penjual konfirmasi di dashboard
                                                        + status → "dikonfirmasi"
                                                        + catat pemasukan (opsional, manual/satu klik)
                                                                       ▼
                                                        Status → "selesai"  → rating & ulasan dibuka
```

**Penting:** membuka WhatsApp **bukan** bukti pembayaran. Pembeli baru bisa memberi ulasan setelah pesanan berstatus *selesai*, dan ulasan akan diberi label **"Belum terverifikasi"** karena verifikasi pembayaran otomatis tidak tersedia.

### 2.2 Alur Penjual (Seller)

```
Daftar (nama, toko, WA, password, kategori, deskripsi, lokasi, setuju aturan)
   │
   ├─ Backend: validasi WA → normalisasi ke 62xxx → cek unik → hash password (bcrypt)
   ├─ Buat dokumen User(role=seller) + Store(status=active, tampilPublik=belum ada produk aktif)
   ▼
Login (rate limit 5×/10 menit per IP+WA) → Session cookie HttpOnly
   │
   ▼
Dashboard Seller
   ├─ Produk      → Tambah (draft/aktif) → Upload gambar → Edit → Hapus (konfirmasi)
   ├─ Pesanan     → Lihat → Ubah status (dikonfirmasi / selesai / dibatalkan)
   │                 └─ Saat "dikonfirmasi": pilih catat pemasukan (cegah dobel)
   ├─ Keuangan    → Catat pemasukan/pengeluaran manual → Filter tanggal+kategori → Grafik → CSV
   ├─ Ulasan      → Lihat rating & ulasan produk sendiri
   └─ Profil      → Ubah nama toko, deskripsi, WA publik, lokasi (pilih yang dipublikasikan)
```

**Aturan Isolasi (Anti-IDOR):** setiap query produk/pesanan/keuangan selalu difilter `storeId = session.storeId`. Menjual wajib. Admin boleh melihat semua, tapi tidak boleh mengubah keuangan penjual.

### 2.3 Alur Super Admin

```
Super Admin TIDAK bisa mendaftar dari UI publik.
   └─ Dibuat lewat proses setup backend: `npm run create-admin` (mengambil data dari .env/CLI interaktif)
      → User(role=superadmin, password di-hash), lalu hapus/rotasi kredensial setup.

Login admin → /admin (middleware requireRole('superadmin'))
   ├─ Ringkasan & grafik
   ├─ Pengguna: cari/filter, detail toko, suspend/activate (wajib alasan)
   ├─ Produk: review, sembunyikan (wajib alasan)
   ├─ Kategori: CRUD (slug unik, urutan tampil)
   ├─ Laporan ulasan: resolve/reject, sembunyikan ulasan (wajib alasan)
   ├─ Log aktivitas
   └─ Pengaturan: nama aplikasi, kontak bantuan, batas halaman, toggle pendaftaran
```

---

## 3. Struktur Halaman

### 3.1 Halaman Publik
| File | Isi |
|---|---|
| `public/index.html` | Beranda: hero, kategori, terbaru, terlaris, rating tertinggi, toko pilihan, ajakan buka toko, footer |
| `public/katalog.html` | Katalog: search, filter kategori/harga, sort, pagination, empty state |
| `public/produk.html` | Detail produk: galeri, harga, deskripsi, stok, info toko, rating, tombol WA, produk terkait |
| `public/toko.html` | Profil toko: deskripsi, kategori, rating, jumlah produk, produk toko, tombol WA |
| `public/lupa-password.html` | Permintaan reset (alur sederhana, MVP) |
| `public/404.html` | Halaman tidak ditemukan |
| `public/403.html` | Akses ditolak |

### 3.2 Autentikasi
| File | Isi |
|---|---|
| `public/masuk.html` | Login (WA/email + password) |
| `public/daftar.html` | Registrasi penjual lengkap + persetujuan aturan |

### 3.3 Dashboard Penjual (`public/dashboard/…`)
| File | Isi |
|---|---|
| `dashboard/index.html` | Ringkasan + grafik + filter periode |
| `dashboard/produk.html` | Tabel produk, filter, tambah/edit |
| `dashboard/pesanan.html` | Tabel & detail pesanan, ubah status |
| `dashboard/keuangan.html` | Tambah transaksi, filter, grafik arus kas, ekspor CSV |
| `dashboard/ulasan.html` | Ulasan produk sendiri |
| `dashboard/profil.html` | Edit profil toko, WA, lokasi, ganti password |

### 3.4 Dashboard Super Admin (`public/admin/…`)
| File | Isi |
|---|---|
| `admin/index.html` | Ringkasan + grafik |
| `admin/pengguna.html` | Daftar & pencarian penjual, aksi suspend |
| `admin/produk.html` | Review & sembunyikan produk |
| `admin/kategori.html` | CRUD kategori |
| `admin/laporan.html` | Laporan ulasan + moderasi |
| `admin/log.html` | Log aktivitas |
| `admin/pengaturan.html` | Pengaturan marketplace |

### 3.5 Aset
```
public/
├── assets/
│   ├── css/     base.css, components.css, public.css, dashboard.css
│   ├── js/      api.js (fetch wrapper + CSRF), ui.js (toast/skeleton/modal), per-halaman
│   └── icons/   (SVG Lucide, di-inline-kan/di-cache, tanpa emoji)
└── img/         placeholder, logo
```

---

## 4. Rancangan Skema MongoDB

Atlas MongoDB (M0) = **document-based**, tidak ada tabel & JOIN seperti SQL. Relasi dibuat lewat **referensi** (`ref`) dan **denormalisasi** (meny salin angka ringkasan agar query cepat).

### 4.1 `users`
```js
{
  _id: ObjectId,
  role: "seller" | "superadmin",          // default "seller", tidak bisa dipilih dari UI
  name: String,                            // nama lengkap
  email: String | null,                    // opsional, TIDAK dipakai sebagai identitas login
                                            // (disimpan hanya untuk kontak / export admin)
  whatsapp: String,                        // WAHR format "6281234567890" (WA: +62..., tanpa "+")
                                            // INI identitas login → wajib unik
  passwordHash: String,                    // bcrypt, TIDAK pernah dikirim ke client
  status: "active" | "suspended" | "pending",
  storeId: ObjectId | null,                // ref ke stores (untuk seller)
  failedLoginCount: Number,                // default 0
  lockedUntil: Date | null,                // sementara terkunci setelah percobaan gagal
  resetTokenHash: String | null,          // SHA-256 dari token reset password
  resetTokenExpires: Date | null,
  lastLoginAt: Date | null,
  createdAt: Date, updatedAt: Date
}
```
Index: `whatsapp` (unique), `email` (unique sparse), `role+status`.

**Identitas login = nomor WhatsApp** (keputusan sudah dikonfirmasi).
Konsekuensinya:
- Field `email` menjadi opsional dan **tidak bisa dipakai login** (index unique sparse tetap dijaga agar tidak ada duplikat bila diisi).
- Format penulisan dinormalisasi: `+62 812-3456-7890` → `6281234567890`. Semua perbandingan uniqueness dilakukan pada format ini.
- Login juga menerima input `08xx` / `+628xx` lalu dinormalisasi di backend sebelum dicari, agar siswa tidak gagal login karena format beda.
- **Reset password tanpa email** → alur MVP:
  1. Seller mengirim permintaan reset (formulir publik, hanya butuh nomor WA).
  2. Permintaan masuk ke daftar **"Permintaan Reset Password"** di dashboard admin.
  3. Admin menghubungi seller lewat WhatsApp untuk **verifikasi identitas** (bukan cukup hanya tahu nomor).
  4. Admin menerbitkan **token reset sekali pakai** (berumur 30 menit) yang dikirim ke seller melalui WhatsApp.
  5. Seller membuka `/reset-password?token=...`, memasukkan password baru → token langsung hangus.

  Token disimpan di dokumen `users` sebagai `resetTokenHash` (disimpan dalam bentuk hash SHA-256) + `resetTokenExpires` — **tidak** disimpan sebagai teks biasa, sehingga bocornya isi `users` tidak langsung berarti token bisa dipakai. Nilai token asli hanya tampil sekali di layar admin. Aktivitas reset dicatat di `activity_logs` **tanpa** nilai token.

### 4.2 `stores`
```js
{
  _id: ObjectId,
  ownerId: ObjectId,                       // ref users (pemilik)
  name: String,                            // nama toko
  slug: String,                            // unik, mis. "kedai-budi"
  description: String,
  category: String,                        // kategori utama (slug kategori)
  whatsapp: String,                        // kontak publik (bisa berbeda dari akun)
  location: {
    address: String,                       // disimpan lengkap
    city: String,
    showAddress: Boolean,                  // PENJUAL yang memilih apa yang dipublikasikan
    showExactAddress: Boolean              // default false → hanya kota yang tampil
  },
  logo: { url, publicId } | null,
  banner: { url, publicId } | null,
  status: "active" | "suspended" | "hidden",
  statusReason: String | null,             // wajib diisi bila suspended/hidden
  isFeatured: Boolean,                     // "Toko Pilihan" di beranda (diatur admin)
  ratingAvg: Number, ratingCount: Number,  // cache hasil agregasi ulasan
  totalSold: Number,                       // cache jumlah pesanan selesai
  productCount: Number,                    // cache jumlah produk aktif
  createdAt: Date, updatedAt: Date
}
```
Index: `slug` (unique), `ownerId` (unique — 1 toko per penjual), `status`, `ratingAvg` (desc).

### 4.3 `categories`
```js
{ _id, name: String, slug: String (unique), icon: String /* nama ikon Lucide */,
  description: String, order: Number, isActive: Boolean, createdAt }
```

### 4.4 `products`
```js
{
  _id: ObjectId,
  storeId: ObjectId,                       // ref stores
  sellerId: ObjectId,                      // ref users (denormalisasi: facilitate filter cepat)
  name: String,
  slug: String,                            // unik
  category: String,                        // ref category slug
  price: Number,                           // Rupiah, INTEGER (tanpa desimal)
  description: String,
  images: [ { url: String, publicId: String, width: Number, height: Number, alt: String } ],
  stock: Number,                           // >= 0
  status: "draft" | "active" | "out_of_stock" | "hidden",
  hiddenReason: String | null,             // diisi admin saat disembunyikan
  soldCount: Number,                       // cache: pesanan berstatus "selesai"
  orderCount: Number,                      // cache: total permintaan pesanan
  ratingAvg: Number, ratingCount: Number,  // cache: ulasan published
  createdAt: Date, updatedAt: Date
}
```
Index: `slug` (unique), `{ category, status }`, `{ status, createdAt: -1 }`, `{ soldCount: -1 }`, `{ ratingAvg: -1, ratingCount: -1 }`, `storeId`.

> Gambar **tidak** disimpan sebagai binary di dokumen — hanya URL + metadata (terdaftar di spec).

### 4.5 `orders` (permintaan pemesanan via WhatsApp)
```js
{
  _id: ObjectId,
  orderCode: String,                       // "KS-2608-4F2A" (unique, dibuat backend)
  productId: ObjectId, storeId: ObjectId, sellerId: ObjectId,
  buyerId: ObjectId | null,                // null bila belum login
  buyerName: String | null,
  buyerContact: String | null,             // WA pembeli (opsional)
  qty: Number,
  priceSnapshot: Number,                   // HARGA SAAT PESAN DIBUAT (tidak berubah walau harga produk berubah)
  productNameSnapshot: String,
  productImageSnapshot: String | null,
  subtotal: Number,                        // = priceSnapshot * qty
  status: "pending" | "confirmed" | "completed" | "cancelled",
  source: "whatsapp",
  note: String | null,                     // catatan pembeli
  waMessage: String,                       // isi pesan yang dikirim
  waLink: String,                          // tautan wa.me siap pakai
  confirmedAt: Date | null, completedAt: Date | null, cancelledAt: Date | null,
  cancelReason: String | null,
  createdAt: Date, updatedAt: Date
}
```
Index: `orderCode` (unique), `{ storeId, status }`, `{ storeId, createdAt: -1 }`, `productId`.

### 4.6 `reviews`
```js
{
  _id: ObjectId,
  productId: ObjectId, storeId: ObjectId, sellerId: ObjectId,
  orderId: ObjectId | null, buyerId: ObjectId | null,
  rating: Number,                          // integer 1..5 (divalidasi backend)
  comment: String,                         // 10..1000 karakter
  status: "published" | "hidden" | "pending",
  isVerifiedPurchase: Boolean,             // default false → label "Belum terverifikasi"
  moderation: { hiddenBy: ObjectId|null, hiddenAt: Date|null, reason: String|null },
  createdAt: Date, updatedAt: Date
}
```
Index: `{ productId, status }`, `{ storeId, createdAt: -1 }`, unique `{ orderId: 1, buyerId: 1 }` (sparse) → mencegah rating ganda per pesanan.

### 4.7 `transactions` (keuangan)
```js
{
  _id: ObjectId,
  storeId: ObjectId, sellerId: ObjectId,
  type: "income" | "expense",
  category: String,                        // income: penjualan, bonus, lainnya
                                          // expense: modal, kemasan, transportasi, operasional, alat, lainnya
  amount: Number,                          // > 0
  description: String,
  date: Date,                              // tanggal transaksi (bukan tanggal input)
  orderId: ObjectId | null,               // referensi pesanan (opsional)
  source: "manual" | "order",              // "order" = hasil konfirmasi pesanan
  deletedAt: Date | null,                  // soft delete (aman untuk pembukuan)
  createdAt: Date, updatedAt: Date
}
```
Index: `{ storeId, date: -1 }`, `{ storeId, type }`, unique sparse `{ storeId, orderId, type, source }` → **mencegah pencatatan ganda** dari satu pesanan.

### 4.8 `reviews_reports` (laporan)
```js
{ _id, targetType: "review"|"product"|"user"|"store", targetId: ObjectId,
  reason: String, description: String|null, reporterId: ObjectId|null,
  status: "open"|"reviewed"|"resolved"|"rejected",
  handledBy: ObjectId|null, resolutionNote: String|null,
  createdAt: Date, updatedAt: Date }
```

### 4.9 `settings` (key-value)
```js
{ _id, key: String (unique), value: Mixed, updatedBy: ObjectId|null, updatedAt: Date }
```
Contoh key: `app.name`, `app.contact`, `app.allowRegistration`, `app.maxPerPage`.

### 4.10 `activity_logs`
```js
{ _id, actorId: ObjectId|null, actorRole: String, action: String,
  entityType: String, entityId: String|null, meta: Object, ip: String, userAgent: String,
  createdAt: Date }
```
> Tidak pernah menyimpan password, hash, atau session token.

### 4.11 Relasi antar data (ringkasan)

```
User (seller) 1 ─── 1 Store ─── ∞ Product
                                 │
Store 1 ─── ∞ Order ─── 1 Product │  Order 0..1 ─── 1 Transaction
                                 │
Product 1 ─── ∞ Review ─── 0..1 Order
                                 │
Category 1 ─── ∞ Product        Review ─── 0..1 Report
```

---

## 5. Daftar Endpoint API

Semua prefix `/api`. Format respons seragam:
```json
{ "success": true, "data": {...}, "message": "..." }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

### 5.1 Publik
| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/categories` | Daftar kategori aktif |
| GET | `/api/products` | Katalog: `?q=&category=&minPrice=&maxPrice=&sort=&page=&limit=` (validasi backend) |
| GET | `/api/products/featured` | Data beranda: terbaru / terlaris / rating tertinggi / toko pilihan |
| GET | `/api/products/:slug` | Detail produk + toko + rating + produk terkait |
| GET | `/api/stores/:slug` | Profil toko + produknya |
| GET | `/api/stores` | Daftar toko (untuk daftar "toko pilihan") |
| POST | `/api/orders` | Buat permintaan pesanan → `{ orderCode, waLink, waMessage }` |
| POST | `/api/reviews` | Buat ulasan (butuh login) |
| POST | `/api/reports` | Kirim laporan |

### 5.2 Autentikasi
| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/auth/register` | Daftar penjual (validasi WA, hashing) |
| POST | `/api/auth/login` | Login (rate limit) |
| POST | `/api/auth/logout` | Keluar + hapus session |
| GET | `/api/auth/me` | Profil sesi berjalan (role, store) |
| PATCH | `/api/auth/profile` | Update nama & WA akun |
| PATCH | `/api/auth/password` | Ganti password (verifikasi password lama) |
| POST | `/api/auth/request-reset` | Permintaan reset (MVP: tanpa email → verifikasi manual via WhatsApp oleh admin) |

### 5.3 Seller (butuh session role `seller`)
| Method | Path | Keterangan |
|---|---|---|
| GET/POST | `/api/seller/products` | Daftar (filter q/kategori/status) & tambah produk |
| GET/PATCH/DELETE | `/api/seller/products/:id` | Detail, ubah, hapus (soft/hard sesuai aturan) |
| POST | `/api/seller/products/:id/images` | Upload gambar (signed upload ke Cloudinary) |
| DELETE | `/api/seller/products/:id/images/:imageId` | Hapus gambar |
| GET | `/api/seller/orders` | Daftar pesanan + filter status |
| GET | `/api/seller/orders/:id` | Detail pesanan |
| PATCH | `/api/seller/orders/:id/status` | Ubah status (dikonfirmasi → selesai/batal) |
| POST | `/api/seller/orders/:id/record-income` | Catat pemasukan dari pesanan (anti dobel) |
| GET/POST | `/api/seller/transactions` | Daftar (filter tanggal/kategori) & tambah transaksi |
| PATCH/DELETE | `/api/seller/transactions/:id` | Ubah / hapus transaksi manual |
| GET | `/api/seller/transactions/summary` | Total income/expense/laba + data grafik |
| GET | `/api/seller/transactions/export` | Ekspor CSV |
| GET | `/api/seller/reviews` | Ulasan produk sendiri |
| GET | `/api/seller/dashboard` | Statistik ringkasan + filter periode |

### 5.4 Super Admin (butuh session role `superadmin`)
| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/admin/overview` | Ringkasan angka marketplace + grafik |
| GET | `/api/admin/users` | Daftar + pencarian + filter |
| GET | `/api/admin/users/:id` | Detail pengguna & tokonya |
| PATCH | `/api/admin/users/:id/status` | Aktif/nonaktifkan (wajib `reason`) |
| GET | `/api/admin/products` | Daftar produk (termasuk yang disembunyikan) |
| PATCH | `/api/admin/products/:id/status` | Sembunyikan/tampilkan (wajib `reason`) |
| GET/POST/PATCH/DELETE | `/api/admin/categories` | CRUD kategori |
| GET | `/api/admin/reports` | Daftar laporan |
| PATCH | `/api/admin/reports/:id` | Tangani laporan |
| GET | `/api/admin/reviews` | Daftar ulasan |
| PATCH | `/api/admin/reviews/:id` | Sembunyikan ulasan (wajib `reason`) |
| GET | `/api/admin/logs` | Log aktivitas |
| GET/PATCH | `/api/admin/settings` | Pengaturan marketplace |

### 5.5 Endpoint pendukung
| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/uploads/image` | Menerima file → unggah ke Cloudinary → kembalikan URL + metadata |
| GET | `/api/health` | Cek status server & koneksi DB |

---

## 6. Risiko, Keterbatasan & Keputusan Teknis

### 6.1 Risiko terbesar: pemesanan via WhatsApp
| Risiko | Dampak | Mitigasi |
|---|---|---|
| Tidak ada verifikasi pembayaran otomatis | Bisa ada pesanan palsu / tidak dibayar | Status "menunggu konfirmasi"; konfirmasi tetap dilakukan penjual secara manual; catatan eksplisit di UI |
| Nomor WA bisa dipakai/dibohongi pembeli | Spam pesanan palsu | Rate limit endpoint order, catat IP, seller bisa membatalkan |
| Stok bisa bentrok (2 orang pesan stok 1) | Oversell | Backend tidak decreased stok otomatis; seller yang memvalidasi saat konfirmasi |
| Pembeli bisa memberi ulasan tanpa transaksi | Rating palsu | Ulasan wajib dari pesanan berstatus *selesai*; label "Belum terverifikasi"; minimal 1 ulasan untuk masuk daftar rating tertinggi |
| Perubahan harga produk mengubah riwayat | Data keuangan kacau | `priceSnapshot` & `subtotal` disimpan saat pesanan dibuat |
| Pembukaan WhatsApp = "sukses"? | Salah paham | Pesanan dicatat backend dengan status *menunggu konfirmasi*, bukan *berhasil* |
| `wa.me` butuh nomor format internasional | Link rusak | Normalisasi ke `62xxx` di backend, validasi regex `^62[0-9]{8,13}$` |

### 6.2 Risiko teknis
| Risiko | Mitigasi |
|---|---|
| NoSQL injection (`{$ne:null}` pada body) | Validasi tipe & whitelist field, `mongoose` casting ObjectId, dan middleware validasi (zod/express-validator) |
| IDOR (akses produk toko lain) | Semua query seller difilter `storeId` dari session, bukan dari body |
| Password bocor | Hash bcrypt (cost 12), `select: false` pada field hash, tidak pernah dikirim |
| Session fixation / CSRF | Session ID di-regenerate saat login; SameSite=Lax + token CSRF double-submit pada POST/PATCH/DELETE; cookie HttpOnly+Secure |
| Brute force login | Rate limit 5 percobaan / 10 menit per IP+identifier + `lockedUntil` di user |
| Upload file berbahaya | Validasi MIME + ukuran ≤ 4 MB + cek signature file; hanya tahap 1 (rasio/gambar) |
| Beban MongoDB free tier | Index benar, `lean()`, pagination, agregasi untuk statistik |
| Cloudinary free tier terbatas | Kuota 25 "credit"/bulan; sediakan `imgbb` sebagai cadangan & batasi ukuran unggah |
|QX MongoDB Atlas M0 512 MB | Pantau ukuran; arsip/log lama bila perlu |

### 6.3 Keputusan teknis yang diambil (dan alasannya)
| Keputusan | Alasan |
|---|---|
| **Session + cookie** (bukan JWT di localStorage) | JWT di localStorage rentan XSS; cookie HttpOnly tidak bisa dibaca JavaScript. Cocok untuk dashboard session-based. |
| **bcryptjs** (JS murni) | `argon2` butuh kompilasi native (`node-gyp`) yang sering gagal di laptop siswa; `bcryptjs` pure-JS, algoritma bcrypt tetap sah. |
| **Express + Mongoose** | Pustuka ini paling banyak dipakai pada tutorial berbahasa Indonesia, ORM-nya otomatis melakukan casting dan melindungi sebagian attack NoSQL injection. |
| **Chart.js** (UMD dari CDN, dimuat lazy) | Ringan, mudah, cukup untuk bar/doughnut. Tidak di-bundle di semua halaman. |
| **Lucide Icons** (SVG inline / sprite lokal) | Ringan, konsisten, aksesibel, memenuhi syarat "tanpa emoji". |
| **Cloudinary unsigned/signed upload via backend** | Rahasia API tidak pernah masuk frontend; dapat resize/optimasi (format WebP) → hemat kuota & bandwidth. |
| **Vanilla JS, tanpa SPA framework** | Sesuai permintaan;-state management cukup dengan modul `api.js` + `ui.js`. |
| **Server-side rendering file statis + fetch API** | SEO & performa sederhana; tanpa biaya build step. |

---

## 7. Rekomendasi MVP (realistis untuk pelajar SMK)

### 7.1 Yang masuk versi awal (Wajib)
1. Auth: daftar/login/logout + session + role seller & superadmin.
2. Katalog: cari, filter kategori & harga, sort, pagination.
3. Detail produk + profil toko.
4. CRUD produk (gambar via Cloudinary, maks 5 foto).
5. Pesan via WhatsApp + pencatatan pesanan + 4 status.
6. Rating & ulasan (dari pesanan selesai) + moderasi admin.
7. Dashboard penjual: ringkasan, produk, pesanan, keuangan (manual), ulasan, profil.
8. Dashboard admin: ringkasan, pengguna (suspend), produk (sembunyikan), kategori, laporan ulasan, log.
9. Keamanan: rate limit, validasi, IDOR protection, helmet, CSRF, batas ukuran upload.

### 7.2 Yang ditunda ke versi berikutnya (disarankan)
| Fitur | Alasan ditunda | Sederhanakan versi awal |
|---|---|---|
| Payment gateway | Butuh rekening merchant & biaya | Payment via WhatsApp + pencatatan manual |
| Verifikasi pembelian otomatis | Butuh integrasi pembayaran | Label "Belum terverifikasi" + moderasi |
| Live chat di dalam aplikasi | Kompleks, butuh WebSocket | Chat WhatsApp |
| Multi-bahasa | Menambah beban | Bahasa Indonesia saja |
| Notifikasi email otomatis | Butuh layanan email & konfigurasi | Notifikasi in-app (toast) + WhatsApp |
| Rating dinamis / widget animasi | Tampilan angka statis + daftar ulasan | Angka statis + review list |
| Mode gelap | Butuh token warna ganda | Terus terang dulu |
| PWA / offline | Butuh service worker | Tidak dulu |
| Multi-penjual per toko | Kompleks | 1 toko per penjual (sederhana & jelas) |

### 7.3 Batas MVP agar tidak over-scope
- **Tanpa** upload multiple banyak (<=5 gambar/produk).
- **Tanpa** kategori bertingkat (1 level).
- **Tanpa** pengaturan Remember-me yang bertahan lama (session 7 hari).
- **Tanpa** chat internal.
- **Tanpa** billing/verifikasi email wajib (opsional, default auto-verify).

---

## 8. Checklist Babrak (untuk Tahap 2)
- [ ] Struktur folder dibuat
- [ ] `package.json` + dependensi (express, mongoose, express-session, connect-mongo, bcryptjs, helmet, express-rate-limit, zod/express-validator, multer, dotenv, cookie-parser, compression, node-csv)
- [ ] `.env.example` (tanpa kredensial asli) + `.gitignore`
- [ ] `src/config/app.config.js` (nama aplikasi, tema, pagination)
- [ ] `src/config/db.js` (koneksi Atlas + retry)
- [ ] `src/app.js` + `src/server.js` (Express + helmet + rate limit + error handler)
- [ ] `src/models/*` (10 model)
- [ ] Uji: server jalan + `GET /api/health` = OK + DB terhubung

---

*Dokumen ini akan diperbarui pada setiap tahap. Semua keputusan di atas bisa diubah bila Anda memilih opsi lain — beri tahu saja sebelum implementasi.*

---

## 9. Catatan Keputusan (Decision Log)

| # | Keputusan | Status | Alasan |
|---|---|---|---|
| D1 | Identitas login = **nomor WhatsApp** | ✅ Disetujui (user) | Sesuai konteks "TokoSiswa": WA adalah kontak utama siswa. Email jadi opsional, bukan identitas. |
| D2 | Hash password = **bcryptjs** (cost 12) | ✅ Dipilih | Pure-JS, tidak butuh kompilasi native → grievance install di laptop siswa. |
| D3 | Autentikasi = **server-side session + cookie HttpOnly** | ✅ Dipilih | JWT di localStorage rentan XSS. Cookie HttpOnly tidak bisa dibaca JS. |
| D4 | Penyimpanan gambar = **Cloudinary** (upload signed via backend) | ⏳ Menunggu konfirmasi | Alternatif cadangan: imgbb / UploadThing. Perlu ditanyakan ke user. |
| D5 | 1 toko = 1 penjual (MVP) | ✅ Dipilih | Menjaga scoping & keamanan sederhana (Anti-IDOR per `storeId` tetap wajib). |
| D6 | Transaksi "pembelian" **tidak** otomatis jadi pemasukan | ✅ Dipilih | Sesuai spec; hanya dicatat setelah penjual mengonfirmasi. |
| D7 | Ulasan **wajib** berasal dari pesanan berstatus *selesai* | ✅ Dipilih | Menekan rating palsu tanpa sistem verifikasi pembayaran. |
| D8 | alamat toko **tidak** otomatis ditampilkan | ✅ Dipilih | Field `location.showExactAddress` default `false` → hanya kota yang tampil. |
| D9 | Super admin dibuat via **script setup backend** | ✅ Dipilih | Tidak bisa didaftarkan dari UI publik. |

### Keputusan yang masih perlu konfirmasi (satu per satu)
1. **D4 — layanan gambar**: Cloudinary (kuota 25 credit/bulan, optimasi WebP) vs imgbb (kuota besar, optimasi lebih terbatas) vs UploadThing (developer menyertakan storage di provider).
2. **Reset password**: alur admin-verifikasi-lewat-WA (sudah ditulis di §4.1) sudah cukup, atau perlu versi otomatis?
3. **Minimum ulasan** untuk masuk daftar "Rating Tertinggi" di beranda: saya sarankan **≥ 3 ulasan** + rating ≥ 4.0.

