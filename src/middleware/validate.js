/**
 * Middleware validasi input memakai Zod.
 *
 * Semua input dari user WAJIB divalidasi di backend, tidak hanya di frontend.
 * Zod juga otomatis membuang field yang tidak dikenal, sehingga pengguna tidak
 * bisa menyisipkan field seperti "role" atau "storeId" lewat body request.
 */
'use strict';

const AppError = require('../utils/AppError');
const { ZodError } = require('zod');

/**
 * @param {object} schemas  { body, query, params }
 * @returns middleware yang memvalidasi dan MENGGANTI req.body/query/params
 *          dengan hasil validasi (sudah bersih & coerced).
 */
function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        // req.query di Express 5 adalah getter-only, jadi hasil parse disimpan terpisah.
        req.validatedQuery = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        req.validatedParams = schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((issue) => ({
          field: issue.path.join('.') || '(root)',
          message: issue.message,
        }));
        return next(
          AppError.badRequest('Data yang dikirim tidak valid. Periksa kembali isian Anda.', details)
        );
      }
      return next(err);
    }
  };
}

/** Helper: ambil query tervalidasi (fallback ke req.query biasa). */
function getQuery(req) {
  return req.validatedQuery || req.query;
}

/** Helper: ambil params tervalidasi. */
function getParams(req) {
  return req.validatedParams || req.params;
}

module.exports = { validate, getQuery, getParams };
