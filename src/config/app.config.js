/**
 * Konfigurasi aplikasi (level kode).
 *
 * Untuk mengubah nama aplikasi, tagline, atau warna tema cukup ubah file ini
 * (atau set env APP_NAME). Tidak ada nama aplikasi yang di-hardcode di halaman HTML.
 */
'use strict';

const path = require('path');

const theme = {
  primary: '#16A34A',
  primaryDark: '#166534',
  primaryLight: '#DCFCE7',
  background: '#F8FAF9',
  surface: '#FFFFFF',
  text: '#1F2937',
  textMuted: '#6B7280',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  info: '#2563EB',
  infoLight: '#DBEAFE',
  border: '#E5E7EB',
};

module.exports = {
  name: process.env.APP_NAME || 'KantinSiswa',
  shortName: process.env.APP_SHORT_NAME || 'KS',
  tagline:
    'Marketplace produk & jasa antar siswa. Beli dari teman sekelas, UKM, atau kelas sebelah tanpa ribet.',
  description:
    'KantinSiswa adalah marketplace yang menghubungkan penjual dan pembeli antar siswa SMK. Pesan lewat WhatsApp, kelola toko sendiri, catat keuangan, dan bangun reputasi.',
  supportContact: process.env.SUPPORT_CONTACT || 'support@kantinsiswa.local',

  theme,

  pagination: {
    defaultLimit: 12,
    maxLimit: 48,
  },

  reviews: {
    minRating: 1,
    maxRating: 5,
    minCommentLength: 5,
    maxCommentLength: 1000,
    // Minimum ulasan agar produk masuk daftar unggulan "Rating Tertinggi"
    featuredMinReviews: 3,
    featuredMinRating: 4,
  },

  orders: {
    // Kuota pesan per jam per IP untuk mencegah spam pesanan
    maxPerHour: 30,
    maxQtyPerOrder: 99,
  },

  uploads: {
    maxFileSizeBytes: 4 * 1024 * 1024, // 4 MB
    maxImagesPerProduct: 5,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },

  finance: {
    // Kategori pemasukan & pengeluaran default
    incomeCategories: [
      { slug: 'penjualan', label: 'Penjualan' },
      { slug: 'bonus', label: 'Bonus / THR' },
      { slug: 'lainnya', label: 'Lainnya' },
    ],
    expenseCategories: [
      { slug: 'modal', label: 'Modal Barang' },
      { slug: 'kemasan', label: 'Kemasan' },
      { slug: 'transportasi', label: 'Transportasi' },
      { slug: 'operasional', label: 'Biaya Operasional' },
      { slug: 'peralatan', label: 'Peralatan' },
      { slug: 'lainnya', label: 'Lainnya' },
    ],
  },

  paths: {
    root: path.resolve(__dirname, '..', '..'),
    public: path.resolve(__dirname, '..', '..', 'public'),
    uploads: path.resolve(__dirname, '..', '..', 'public', 'uploads'),
  },
};
