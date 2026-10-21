/**
 * Rate limiting (membatasi jumlah request per periode).
 *
 * Tujuannya menahan brute force login, spam pesanan, dan upload berlebihan.
 * Nilai batas dibaca dari config saat request datang, sehingga mudah diuji.
 * Di mode test batas dibuat longgar (lihat src/config/env.js).
 */
'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

function makeLimiter({ maxKey, windowMs, message, code }) {
  return rateLimit({
    windowMs,
    // `limit` boleh berupa fungsi, sehingga batas bisa diubah saat runtime.
    limit: () => env.rateLimit[maxKey],
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: code || 'TOO_MANY_REQUESTS',
          message,
        },
      });
    },
  });
}

/** Pembatas umum untuk seluruh request API. */
const globalLimiter = makeLimiter({
  maxKey: 'globalMax',
  windowMs: env.rateLimit.globalWindowMs,
  message: 'Terlalu banyak permintaan. Silakan coba lagi beberapa saat lagi.',
});

/** Pembatas untuk login & pendaftaran (penting untuk keamanan). */
const authLimiter = makeLimiter({
  maxKey: 'authMax',
  windowMs: env.rateLimit.authWindowMs,
  code: 'RATE_LIMIT_AUTH',
  message: 'Terlalu banyak percobaan. Silakan coba lagi dalam 10 menit.',
});

/** Pembatas untuk pembuatan pesanan (mencegah spam pesanan palsu). */
const orderLimiter = makeLimiter({
  maxKey: 'orderMax',
  windowMs: env.rateLimit.orderWindowMs,
  code: 'RATE_LIMIT_ORDER',
  message: 'Terlalu banyak permintaan pemesanan. Silakan coba lagi nanti.',
});

/** Pembatas untuk upload gambar (menghemat kuota layanan gambar). */
const uploadLimiter = makeLimiter({
  maxKey: 'uploadMax',
  windowMs: env.rateLimit.uploadWindowMs,
  code: 'RATE_LIMIT_UPLOAD',
  message: 'Terlalu banyak unggahan. Silakan coba lagi nanti.',
});

module.exports = { globalLimiter, authLimiter, orderLimiter, uploadLimiter };
