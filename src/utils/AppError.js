/**
 * Error aplikasi yang aman untuk ditampilkan ke pengguna.
 *
 * Aturan: pesan yang sampai ke pengguna TIDAK boleh membocorkan detail internal
 * (stack trace, nama collection, query MongoDB, dll).
 */
'use strict';

class AppError extends Error {
  /**
   * @param {number} statusCode  Kode HTTP (400, 401, 403, 404, 409, 422, 429, 500)
   * @param {string} message      Pesan ramah untuk pengguna (Bahasa Indonesia)
   * @param {string} code         Kode mesin (mis. 'VALIDATION_ERROR')
   * @param {Array}  [details]    Rincian per-field untuk form (opsional)
   */
  constructor(statusCode, message, code = 'APP_ERROR', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Permintaan tidak valid.', details) {
    return new AppError(400, message, 'VALIDATION_ERROR', details);
  }

  static unauthorized(message = 'Anda harus masuk terlebih dahulu.') {
    return new AppError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Anda tidak memiliki akses ke sumber daya ini.') {
    return new AppError(403, message, 'FORBIDDEN');
  }

  static notFound(message = 'Data yang Anda cari tidak ditemukan.') {
    return new AppError(404, message, 'NOT_FOUND');
  }

  static conflict(message = 'Data sudah ada / bentrok.') {
    return new AppError(409, message, 'CONFLICT');
  }

  static unprocessable(message = 'Data tidak dapat diproses.', details) {
    return new AppError(422, message, 'UNPROCESSABLE_ENTITY', details);
  }

  static tooManyRequests(message = 'Terlalu banyak permintaan. Silakan coba lagi nanti.') {
    return new AppError(429, message, 'TOO_MANY_REQUESTS');
  }

  static serviceUnavailable(message = 'Layanan sedang tidak tersedia.') {
    return new AppError(503, message, 'SERVICE_UNAVAILABLE');
  }
}

module.exports = AppError;
