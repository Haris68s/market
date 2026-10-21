/**
 * Wrapper untuk asynchronous route handler.
 *
 * Tanpa ini, error dari `await` di dalam handler TIDAK otomatis tertangkap Express.
 * Dengan ini, error dilempar ke next(err) dan ditangani error handler terpusat.
 *
 * Catatan: Express 5 sudah otomatis menangani Promise rejection, tetapi wrapper ini
 * tetap dipakai agar kode eksplisit dan mudah dipahami.
 */
'use strict';

module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
