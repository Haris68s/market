/**
 * Proteksi CSRF (Cross-Site Request Forgery).
 *
 * Mekanisme: double-submit token.
 * - Server membuat token acak, menyimpannya di session, dan mengirimkannya ke browser.
 * - Browser wajib mengirim token itu kembali di header "X-CSRF-Token" untuk setiap
 *   request yang mengubah data (POST / PATCH / PUT / DELETE).
 * - Server membandingkan token dengan session memakai perbandingan waktu-konstan.
 *
 * Cookie session juga memakai SameSite=Lax sebagai lapisan pertahanan kedua.
 */
'use strict';

const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { safeCompare } = require('../utils/password');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Pastikan session punya token CSRF, lalu kembalikan tokennya. */
function ensureCsrfToken(req) {
  if (!req.session) return null;
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

/** Endpoint publik untuk mengambil token CSRF (dipanggil frontend sekali per halaman). */
function csrfTokenHandler(req, res) {
  const token = ensureCsrfToken(req);
  res.json({ success: true, data: { csrfToken: token } });
}

/** Middleware: tolak request yang mengubah data tanpa token CSRF yang benar. */
function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const sessionToken = req.session && req.session.csrfToken;
  const headerToken = req.get('X-CSRF-Token') || (req.body && req.body._csrf);

  if (!sessionToken || !headerToken || !safeCompare(sessionToken, headerToken)) {
    return next(
      new AppError(
        403,
        'Token keamanan tidak valid atau sudah kedaluwarsa. Muat ulang halaman lalu coba lagi.',
        'CSRF_INVALID'
      )
    );
  }

  return next();
}

module.exports = { csrfProtection, csrfTokenHandler, ensureCsrfToken };
