/**
 * Service penyimpanan gambar.
 *
 * Mendukung 2 provider:
 * 1. "cloudinary" (default kalau kredensial Cloudinary diisi) - recommended.
 * 2. "local"  - menyimpan ke folder public/uploads. Cocok untuk development
 *               di laptop sekolah tanpa koneksi internet.
 *
 * Kredensial API TIDAK PERNAH dikirim ke browser. Frontend selalu mengunggah
 * file ke backend kita, lalu backend yang meneruskannya ke provider.
 */
'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const appConfig = require('../config/app.config');
const { slugify, randomSuffix } = require('../utils/format');

/* ------------------------------------------------------------------ */
/* Deteksi tipe file berdasarkan magic bytes (bukan extension)          */
/* ------------------------------------------------------------------ */

/**
 * @returns {'image/jpeg'|'image/png'|'image/webp'|null}
 */
function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Ambil ukuran gambar tanpa library tambahan.
 * Mengembalikan { width, height } atau null jika tidak bisa dibaca.
 */
function readImageSize(buffer, mime) {
  try {
    if (mime === 'image/png') {
      // IHDR selalu di offset 16 pada file PNG
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (mime === 'image/jpeg') {
      let offset = 2;
      while (offset < buffer.length - 9) {
        if (buffer[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = buffer[offset + 1];
        // SOF0..SOF15 kecuali SOF4 (0xC4), SOF8 (0xC8), SOF12 (0xCC)
        const isSOF =
          marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSOF) {
          return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
        }
        const segmentLength = buffer.readUInt16BE(offset + 2);
        offset += 2 + segmentLength;
      }
      return null;
    }
    if (mime === 'image/webp') {
      const chunk = buffer.toString('ascii', 12, 16);
      if (chunk === 'VP8 ') {
        return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
      }
      if (chunk === 'VP8L') {
        const bits = buffer.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === 'VP8X') {
        return {
          width: (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1,
          height: (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1,
        };
      }
    }
  } catch (err) {
    return null;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Provider: Cloudinary                                                 */
/* ------------------------------------------------------------------ */

let cloudinaryClient = null;

function getCloudinary() {
  if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
    return null;
  }
  if (!cloudinaryClient) {
    const { v2 } = require('cloudinary');
    v2.config({
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      api_secret: env.cloudinary.apiSecret,
      secure: true,
    });
    cloudinaryClient = v2;
  }
  return cloudinaryClient;
}

function uploadToCloudinary(buffer, folder) {
  const cloudinary = getCloudinary();
  if (!cloudinary) {
    throw AppError.serviceUnavailable(
      'Layanan penyimpanan gambar belum dikonfigurasi. Hubungi administrator.'
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.cloudinary.folder}/${folder}`,
        resource_type: 'image',
        overwrite: false,
        transformation: [{ width: 1200, height: 1200, crop: 'limit' }],
        format: 'webp',
        quality: 'auto',
      },
      (error, result) => {
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[image] Cloudinary error:', error.message);
          reject(AppError.serviceUnavailable('Gagal mengunggah gambar. Silakan coba lagi.'));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          provider: 'cloudinary',
          width: result.width || null,
          height: result.height || null,
          bytes: result.bytes || buffer.length,
        });
      }
    );
    stream.end(buffer);
  });
}

/* ------------------------------------------------------------------ */
/* Provider: Local (untuk development)                                  */
/* ------------------------------------------------------------------ */

async function uploadToLocal(buffer, folder, mime) {
  const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const dir = path.join(appConfig.paths.uploads, folder);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${Date.now()}-${randomSuffix(6)}.${extension}`;
  await fs.writeFile(path.join(dir, filename), buffer);

  return {
    url: `/uploads/${folder}/${filename}`,
    publicId: `${folder}/${filename}`,
    provider: 'local',
    width: null,
    height: null,
    bytes: buffer.length,
  };
}

/* ------------------------------------------------------------------ */
/* API utama                                                            */
/* ------------------------------------------------------------------ */

/**
 * Unggah satu gambar.
 * @param {Buffer} buffer isi file
 * @param {object} options { folder, mimeType, alt }
 * @returns {Promise<{url, publicId, provider, width, height, bytes, alt}>}
 */
async function uploadImage(buffer, options = {}) {
  if (!buffer || !buffer.length) {
    throw AppError.badRequest('File gambar kosong.');
  }

  const detected = detectImageType(buffer);
  if (!detected) {
    throw AppError.badRequest('File yang diunggah bukan gambar yang valid.', [
      { field: 'image', message: 'File bukan gambar JPG/PNG/WebP yang valid.' },
    ]);
  }

  if (options.mimeType && options.mimeType !== detected) {
    throw AppError.badRequest('Isi file tidak sesuai dengan tipe gambarnya.', [
      { field: 'image', message: 'Isi file tidak cocok dengan format yang dipilih.' },
    ]);
  }

  const folder = slugify(options.folder || 'umum') || 'umum';

  let uploaded;
  try {
    if (env.imageProvider === 'cloudinary') {
      uploaded = await uploadToCloudinary(buffer, folder);
    } else if (env.imageProvider === 'local') {
      uploaded = await uploadToLocal(buffer, folder, detected);
    } else {
      throw AppError.serviceUnavailable(
        'Layanan penyimpanan gambar sedang dinonaktifkan (IMAGE_PROVIDER tidak dikenali).'
      );
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.serviceUnavailable('Layanan penyimpanan gambar sedang tidak tersedia.');
  }

  const size = readImageSize(buffer, detected) || {};

  return {
    url: uploaded.url,
    publicId: uploaded.publicId,
    provider: uploaded.provider,
    width: uploaded.width || size.width || null,
    height: uploaded.height || size.height || null,
    bytes: uploaded.bytes || buffer.length,
    alt: options.alt || '',
  };
}

/** Hapus gambar dari provider. Kegagalan tidak boleh menggagalkan operasi utama. */
async function deleteImage(image) {
  if (!image || !image.publicId) return false;
  try {
    if (image.provider === 'cloudinary') {
      const cloudinary = getCloudinary();
      if (cloudinary) {
        await cloudinary.uploader.destroy(image.publicId);
        return true;
      }
    } else if (image.provider === 'local') {
      const target = path.join(appConfig.paths.uploads, image.publicId);
      // Cegah path traversal: pastikan target berada di dalam folder uploads.
      if (!target.startsWith(appConfig.paths.uploads)) return false;
      await fs.unlink(target).catch(() => {});
      return true;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[image] gagal menghapus:', err.message);
  }
  return false;
}

/** True jika provider gambar siap dipakai. */
function isImageServiceReady() {
  if (env.imageProvider === 'cloudinary') return Boolean(getCloudinary());
  if (env.imageProvider === 'local') return true;
  return false;
}

module.exports = {
  uploadImage,
  deleteImage,
  detectImageType,
  readImageSize,
  isImageServiceReady,
  provider: env.imageProvider,
};
