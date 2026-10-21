/**
 * Penanganan error terpusat.
 *
 * Aturan penting:
 * - Di mode produksi, pesan error internal (stack trace, detail MongoDB)
 *   TIDAK PERNAH dikirim ke pengguna.
 * - Di mode pengembangan, detail tetap ditampilkan agar mudah debugging.
 */
'use strict';

const AppError = require('../utils/AppError');
const env = require('../config/env');

/** Handler untuk URL yang tidak ditemukan. */
function notFoundHandler(req, res, next) {
  next(AppError.notFound(`Halaman atau endpoint "${req.originalUrl}" tidak ditemukan.`));
}

/**
 * Error handler utama.
 * WAJIB ditulis dengan 4 argumen (err, req, res, next) agar Express mengenali
 * sebagai error handler.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Terjadi kesalahan pada server.';
  let details = err.details;

  // Error yang tidakudia (AppError) dicatat di sisi server agar bisa ditelusuri.
  // Isi log TIDAK pernah dikirim ke pengguna.
  if (!(err instanceof AppError)) {
    // eslint-disable-next-line no-console
    console.error('[error]', err.stack || err);
  }

  // Error dari Mongoose: validasi schema
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Data yang dikirim tidak valid.';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  // Error duplikat (unique index)
  if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_DATA';
    const field = Object.keys(err.keyValue || {})[0];
    message =
      field === 'whatsapp'
        ? 'Nomor WhatsApp tersebut sudah terdaftar. Gunakan nomor lain atau masuk ke akun Anda.'
        : `Data sudah terdaftar (${field || 'duplikat'}).`;
  }

  // Error casting ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Format data tidak valid.';
  }

  // Error dari driver MongoDB (koneksi putus, dsb)
  if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
    statusCode = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'Database sedang tidak dapat diakses. Silakan coba lagi sebentar.';
  }

  if (!(err instanceof AppError) && statusCode >= 500) {
    // Log internal (server side) - aman karena tidak dikirim ke user.
    // eslint-disable-next-line no-console
    console.error('[error]', err.stack || err.message || err);
    message = 'Terjadi kesalahan pada server. Silakan coba lagi.';
    details = undefined;
  }

  const response = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) response.error.details = details;
  if (!env.isProduction && statusCode >= 500) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = { errorHandler, notFoundHandler };
