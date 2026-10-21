/**
 * Middleware autentikasi & otorisasi.
 *
 * Cara kerja session di aplikasi ini:
 * 1. Setelah login, data user ringkas disimpan di `req.session.user`.
 * 2. Setiap request yang butuh login, middleware ini mengambil data user
 *    terbaru dari database lalu mengecek statusnya (active / suspended).
 *    Ini penting: kalau admin menonaktifkan sebuah toko, sesinya langsung
 *    tidak berlaku.
 * 3. Otorisasi selalu dibandingkan dengan role dari DATABASE, bukan dari
 *    session atau dari body request (mencegah pengguna memaksa-minta role admin).
 */
'use strict';

const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { User } = require('../models');

/** Ambil data user dari session (tanpa cek database). Dipakai untuk tombol UI. */
function readSessionUser(req) {
  return req.session && req.session.user ? req.session.user : null;
}

/**
 * Wajib login. Memuat user terbaru dari database.
 */
const requireAuth = asyncHandler(async (req, res, next) => {
  const sessionUser = readSessionUser(req);
  if (!sessionUser || !sessionUser.id) {
    throw AppError.unauthorized('Anda harus masuk terlebih dahulu.');
  }

  const user = await User.findById(sessionUser.id).lean();

  if (!user) {
    // Akun sudah dihapus -> paksa login ulang.
    req.session.destroy(() => {});
    throw AppError.unauthorized('Akun Anda tidak ditemukan. Silakan masuk kembali.');
  }

  if (user.status !== 'active') {
    const message =
      user.status === 'suspended'
        ? 'Akun Anda dinonaktifkan oleh admin. Hubungi admin untuk informasi lebih lanjut.'
        : 'Akun Anda belum aktif. Silakan hubungi admin.';
    req.session.destroy(() => {});
    throw AppError.forbidden(message);
  }

  req.user = user;
  req.storeId = user.storeId || null;
  next();
});

/**
 * Login wajib DAN harus punya role tertentu.
 * Contoh: requireRole('superadmin')
 */
function requireRole(...roles) {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw AppError.unauthorized('Anda harus masuk terlebih dahulu.');
    }
    if (!roles.includes(req.user.role)) {
      throw AppError.forbidden('Anda tidak memiliki izin untuk tindakan ini.');
    }
    next();
  });
}

/** Wajib login DAN harus punya toko (dipakai untuk semua endpoint seller). */
const requireSeller = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw AppError.unauthorized('Anda harus masuk terlebih dahulu.');
  }
  if (req.user.role !== 'seller') {
    throw AppError.forbidden('Halaman ini hanya untuk penjual.');
  }
  if (!req.user.storeId) {
    throw AppError.forbidden('Toko Anda belum tersedia. Hubungi admin.');
  }
  next();
});

/**
 * Login opsional: dipasang di route publik agar halaman bisa menampilkan
 * tombol "Masuk" atau "Dashboard" sesuai status pengunjung.
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const sessionUser = readSessionUser(req);
  if (sessionUser && sessionUser.id) {
    const user = await User.findById(sessionUser.id).select('role name storeId status whatsapp').lean();
    if (user && user.status === 'active') {
      req.user = user;
      req.storeId = user.storeId || null;
    }
  }
  next();
});

module.exports = { requireAuth, requireRole, requireSeller, optionalAuth, readSessionUser };
