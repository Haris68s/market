/**
 * Controller upload gambar (dipakai untuk logo toko & banner).
 *
 * Frontend TIDAK pernah talks langsung ke Cloudinary, supaya API key & secret
 * tidak terekspos di browser.
 */
'use strict';

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const imageService = require('../services/image.service');
const { logActivity } = require('../services/activity.service');

/**
 * POST /api/uploads/image
 */
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw AppError.badRequest('Tidak ada file yang diterima.');
  }

  const uploaded = await imageService.uploadImage(req.file.buffer, {
    folder: req.body.folder || 'umum',
    mimeType: req.file.mimetype,
    alt: req.body.alt || '',
  });

  await logActivity(req, 'upload.image', { meta: { folder: req.body.folder || 'umum' } });

  res.status(201).json({
    success: true,
    message: 'Gambar berhasil diunggah.',
    data: { image: uploaded },
  });
});

/**
 * GET /api/uploads/status  (cek apakah layanan gambar siap)
 */
const status = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      ready: imageService.isImageServiceReady(),
      provider: imageService.provider,
    },
  });
});

module.exports = { uploadImage, status };
