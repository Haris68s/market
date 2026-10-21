/**
 * Konfigurasi aplikasi Express.
 *
 * File ini membuat instance app TANPA menyalakan server, supaya bisa diimpor
 * oleh test (supertest) tanpa membuka port.
 */
'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const appConfig = require('./config/app.config');
const apiRoutes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { csrfProtection } = require('./middleware/csrf');
const { globalLimiter } = require('./middleware/rateLimit');

const app = express();

// Di belakang reverse proxy (Render, Railway, Nginx) agar IP & HTTPS terbaca benar.
if (env.isProduction) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

/* ---------------------------- Keamanan ---------------------------- */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

app.use(compression());

/* ------------------------------ CORS ------------------------------ */
// Hanya origin yang memang diizinkan (.umumnya tidak perlu, karena satu domain).
if (env.cors.allowedOrigins.length > 0) {
  app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (origin && env.cors.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    return next();
  });
}

/* --------------------------- Body parsing -------------------------- */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

/* ----------------------------- Session ----------------------------- */
// connect-mongo membuat koneksi sendiri ke MongoDB (dipakai untuk menyimpan session).
// dbName wajib diisi karena connection string Atlas biasanya tidak menyebut nama database
// (kalau tidak, session akan tersimpan di database "test").
const sessionStore = new MongoStore({
  mongoUrl: env.mongodbUri,
  dbName: env.dbName,
  collectionName: 'sessions',
  ttl: Math.floor(env.session.maxAgeMs / 1000),
  touchAfter: 24 * 3600,
});

app.use(
  session({
    name: env.session.name,
    secret: env.session.secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: sessionStore,
    cookie: {
      httpOnly: true, // tidak bisa dibaca JavaScript => visualizar lebih aman terhadap XSS
      secure: env.session.secure, // hanya dikirim via HTTPS di produksi
      sameSite: env.session.sameSite,
      maxAge: env.session.maxAgeMs,
      path: '/',
    },
  })
);

/* ------------------------------ Rate limit ----------------------------- */
app.use('/api', globalLimiter);

/* ------------------------------ API ------------------------------ */
app.use('/api', csrfProtection, apiRoutes);

/* ------------------------- Halaman statis ------------------------- */
app.use(
  express.static(appConfig.paths.public, {
    extensions: ['html'],
    maxAge: env.isProduction ? '1h' : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

/* -------------------------- Halaman khusus -------------------------- */
const pageRoutes = [
  { path: '/katalog', file: 'katalog.html' },
  { path: '/produk', file: 'produk.html' },
  { path: '/toko', file: 'toko.html' },
  { path: '/masuk', file: 'masuk.html' },
  { path: '/daftar', file: 'daftar.html' },
  { path: '/lupa-password', file: 'lupa-password.html' },
  { path: '/reset-password', file: 'reset-password.html' },
  { path: '/dashboard', file: 'dashboard/index.html' },
  { path: '/dashboard/produk', file: 'dashboard/produk.html' },
  { path: '/dashboard/pesanan', file: 'dashboard/pesanan.html' },
  { path: '/dashboard/keuangan', file: 'dashboard/keuangan.html' },
  { path: '/dashboard/ulasan', file: 'dashboard/ulasan.html' },
  { path: '/dashboard/profil', file: 'dashboard/profil.html' },
  { path: '/admin', file: 'admin/index.html' },
  { path: '/admin/pengguna', file: 'admin/pengguna.html' },
  { path: '/admin/produk', file: 'admin/produk.html' },
  { path: '/admin/kategori', file: 'admin/kategori.html' },
  { path: '/admin/laporan', file: 'admin/laporan.html' },
  { path: '/admin/log', file: 'admin/log.html' },
  { path: '/admin/pengaturan', file: 'admin/pengaturan.html' },
];

pageRoutes.forEach(({ path: routePath, file }) => {
  app.get(routePath, (req, res) => {
    res.sendFile(path.join(appConfig.paths.public, file));
  });
});

/* --------------------------- 404 & error --------------------------- */
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
// Dipakai test untuk menutup koneksi session store dengan rapi.
module.exports.sessionStore = sessionStore;
