/**
 * Pembacaan & validasi environment variable.
 *
 * Semua kredensial hanya boleh ada di file .env (yang TIDAK di-commit ke git).
 * Jalankan `cp .env.example .env` lalu isi nilainya.
 */
'use strict';

require('dotenv').config();

const errors = [];

function required(name, hint) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    errors.push(`Environment variable "${name}" belum diisi. ${hint || ''}`.trim());
    return '';
  }
  return value.trim();
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

// Di mode test, string pemalsu dipakai agar test tidak butuh kredensial asli.
const MONGODB_URI = required(
  'MONGODB_URI',
  'Contoh: mongodb+srv://<user>:<password>@<cluster>.mongodb.net/kantinsiswa'
);
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  (isTest ? 'test-secret-tidak-untuk-produksi' : required('SESSION_SECRET', 'Minimal 32 karakter acak.'));
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

if (!isTest && !isProduction && SESSION_SECRET.length < 32) {
  errors.push('SESSION_SECRET harus minimal 32 karakter. Buat acak dengan: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

const config = {
  nodeEnv,
  isProduction,
  isTest,
  port: Number(process.env.PORT) || 3000,
  appUrl: (process.env.APP_URL || `http://localhost:${Number(process.env.PORT) || 3000}`).replace(/\/$/, ''),

  mongodbUri: MONGODB_URI,
  dbName: process.env.MONGODB_DB_NAME || 'kantinsiswa',

  session: {
    secret: SESSION_SECRET,
    name: process.env.SESSION_COOKIE_NAME || 'ks.sid',
    maxAgeMs: Number(process.env.SESSION_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000,
    // 'lax' mencegah cookie terkirim pada request lintas situs (proteksi CSRF dasar)
    sameSite: process.env.SESSION_SAME_SITE || 'lax',
    secure: process.env.SESSION_SECURE === 'true' || isProduction,
  },

  cors: {
    // Daftar origin yang diizinkan (pisahkan dengan koma). Kosong = hanya same-origin.
    allowedOrigins: (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  cloudinary: {
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    apiSecret: CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER || 'kantinsiswa',
  },

  imageProvider: (process.env.IMAGE_PROVIDER || (CLOUDINARY_CLOUD_NAME ? 'cloudinary' : 'local')).toLowerCase(),

  rateLimit: {
    // Di test, limit dibuat longgar agar tidak menggagalkan skenario lain
    globalMax: isTest ? 100000 : Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 300,
    globalWindowMs: Number(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS) || 15 * 60 * 1000,
    authMax: isTest ? 100000 : Number(process.env.RATE_LIMIT_AUTH_MAX) || 5,
    authWindowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 10 * 60 * 1000,
    orderMax: isTest ? 100000 : Number(process.env.RATE_LIMIT_ORDER_MAX) || 30,
    orderWindowMs: Number(process.env.RATE_LIMIT_ORDER_WINDOW_MS) || 60 * 60 * 1000,
    uploadMax: isTest ? 100000 : Number(process.env.RATE_LIMIT_UPLOAD_MAX) || 60,
    uploadWindowMs: Number(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS) || 60 * 60 * 1000,
  },

  bootstrapAdmin: {
    // Dipakai script scripts/create-admin.js
    name: process.env.BOOTSTRAP_ADMIN_NAME || '',
    email: process.env.BOOTSTRAP_ADMIN_EMAIL || '',
    whatsapp: process.env.BOOTSTRAP_ADMIN_WHATSAPP || '',
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD || '',
  },
};

if (!config.isTest && errors.length > 0) {
  // Gagal cepat & jelas: lebih baik berhenti sekarang daripada error aneh saat runtime.
  const message =
    'Konfigurasi environment belum lengkap:\n' +
    errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n') +
    '\n\nSalin .env.example menjadi .env lalu lengkapi isinya.';
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
}

module.exports = config;
