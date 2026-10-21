/**
 * Middleware upload gambar (Multer).
 *
 * - Disimpan di memory (buffer), BUKAN di disk, supaya bisa langsung dikirim
 *   ke layanan gambar (Cloudinary) dan tidak ada file sia-sia di server.
 * - Ukuran maksimal & tipe file divalidasi DI SINI (sebelum sampai logika bisnis).
 * - Validasi magic bytes (signature file) dilakukan lagi di service gambar,
 *   karena extension/mime dari browser bisa dipalsukan.
 */
'use strict';

const multer = require('multer');
const AppError = require('../utils/AppError');
const appConfig = require('../config/app.config');

const allowed = appConfig.uploads.allowedMimeTypes;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: appConfig.uploads.maxFileSizeBytes,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!allowed.includes(file.mimetype)) {
      return cb(
        AppError.badRequest('Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.', [
          { field: 'image', message: 'Format gambar harus JPG, PNG, atau WebP.' },
        ])
      );
    }
    return cb(null, true);
  },
});

/** Middleware untuk satu file gambar: field "image" */
const singleImage = upload.single('image');

/** Middleware untuk banyak file gambar: field "images" (maks sesuai config) */
const multipleImages = upload.array('images', appConfig.uploads.maxImagesPerProduct);

module.exports = { singleImage, multipleImages, allowedMimeTypes: allowed };
