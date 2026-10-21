/**
 * Controller autentikasi.
 */
'use strict';

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const authService = require('../services/auth.service');
const { logActivity } = require('../services/activity.service');
const { User, Store } = require('../models');
const { normalizeWhatsapp } = require('../utils/whatsapp');
const { ensureCsrfToken } = require('../middleware/csrf');

/** Bentuk data user yang aman dikirim ke frontend (TANPA hash password). */
function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    role: user.role,
    whatsapp: user.whatsapp,
    email: user.email || null,
    status: user.status,
    storeId: user.storeId || null,
  };
}

/**
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { name, whatsapp, password, passwordConfirm, storeName, category, description, address, city, email, agreed } = req.body;

  if (password !== passwordConfirm) {
    throw AppError.badRequest('Konfirmasi password tidak cocok.', [
      { field: 'passwordConfirm', message: 'Konfirmasi password tidak cocok.' },
    ]);
  }

  const { user, store } = await authService.registerSeller({
    name,
    whatsapp,
    password,
    storeName,
    category,
    description,
    address,
    city,
    email,
    agreed,
  });

  // Langsung buat sesi login setelah daftar.
  req.session.user = { id: user._id, role: user.role, name: user.name, storeId: store._id };
  ensureCsrfToken(req);

  await logActivity(req, 'auth.register', {
    entityType: 'store',
    entityId: store._id,
    meta: { storeName: store.name },
  });

  res.status(201).json({
    success: true,
    message: 'Akun & toko berhasil dibuat. Selamat berjualan!',
    data: { user: publicUser(user), store: { id: store._id, name: store.name, slug: store.slug } },
  });
});

/**
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { whatsapp, password } = req.body;
  const user = await authService.authenticate({ identifier: whatsapp, password });

  // Cegah session fixation: buat id session baru saat login.
  await new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });

  req.session.user = { id: user._id, role: user.role, name: user.name, storeId: user.storeId || null };
  ensureCsrfToken(req);

  await logActivity(req, 'auth.login', { entityType: 'user', entityId: user._id });

  const store = user.storeId ? await Store.findById(user.storeId).select('name slug').lean() : null;

  res.json({
    success: true,
    message: `Selamat datang kembali, ${user.name}!`,
    data: {
      user: publicUser(user),
      store: store ? { id: store._id, name: store.name, slug: store.slug } : null,
      csrfToken: req.session.csrfToken,
    },
  });
});

/**
 * POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  await logActivity(req, 'auth.logout', {});
  await new Promise((resolve) => req.session.destroy(resolve));
  res.clearCookie(process.env.SESSION_COOKIE_NAME || 'ks.sid');
  res.json({ success: true, message: 'Anda sudah keluar.' });
});

/**
 * GET /api/auth/me
 */
const me = asyncHandler(async (req, res) => {
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || !sessionUser.id) {
    return res.json({ success: true, data: { user: null, store: null, csrfToken: ensureCsrfToken(req) } });
  }

  const user = await User.findById(sessionUser.id).lean();
  if (!user || user.status !== 'active') {
    return res.json({ success: true, data: { user: null, store: null, csrfToken: ensureCsrfToken(req) } });
  }

  const store = user.storeId ? await Store.findById(user.storeId).select('name slug status').lean() : null;

  return res.json({
    success: true,
    data: {
      user: publicUser(user),
      store: store ? { id: store._id, name: store.name, slug: store.slug, status: store.status } : null,
      csrfToken: ensureCsrfToken(req),
    },
  });
});

/**
 * PATCH /api/auth/profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, whatsapp } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) throw AppError.notFound('Pengguna tidak ditemukan.');

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email || null;

  if (whatsapp !== undefined) {
    const normalized = normalizeWhatsapp(whatsapp);
    if (normalized !== user.whatsapp) {
      const taken = await User.findOne({ whatsapp: normalized, _id: { $ne: user._id } }).lean();
      if (taken) throw AppError.conflict('Nomor WhatsApp tersebut sudah dipakai akun lain.');
    }
    user.whatsapp = normalized;

    // Nomor kontak toko ikut diperbarui supaya pembeli tetap bisa menghubungi.
    if (user.storeId) {
      await Store.updateOne({ _id: user.storeId }, { $set: { whatsapp: normalized } });
    }
  }

  await user.save();
  req.session.user = { id: user._id, role: user.role, name: user.name, storeId: user.storeId || null };

  await logActivity(req, 'auth.update_profile', { entityType: 'user', entityId: user._id });

  res.json({ success: true, message: 'Profil berhasil diperbarui.', data: { user: publicUser(user) } });
});

/**
 * PATCH /api/auth/password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, newPasswordConfirm } = req.body;

  if (newPassword !== newPasswordConfirm) {
    throw AppError.badRequest('Konfirmasi password baru tidak cocok.', [
      { field: 'newPasswordConfirm', message: 'Konfirmasi password baru tidak cocok.' },
    ]);
  }

  await authService.changePassword({
    userId: req.user._id,
    currentPassword,
    newPassword,
  });

  await logActivity(req, 'auth.change_password', { entityType: 'user', entityId: req.user._id });

  res.json({ success: true, message: 'Password berhasil diubah.' });
});

/**
 * POST /api/auth/request-reset
 */
const requestReset = asyncHandler(async (req, res) => {
  const result = await authService.requestPasswordReset({ whatsapp: req.body.whatsapp });

  await logActivity(req, 'auth.request_reset', {
    entityType: 'user',
    entityId: result.user ? result.user._id : null,
  });

  // Pesan yang sama untuk semua kondisi supaya tidak bocorkan info akun.
  res.json({
    success: true,
    message:
      'Jika nomor tersebut terdaftar, permintaan reset akan diverifikasi admin lewat WhatsApp. Silakan cek pesan Anda.',
  });
});

/**
 * POST /api/auth/reset-password
 * Menukar token reset (dari admin) dengan password baru.
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword, newPasswordConfirm } = req.body;

  if (newPassword !== newPasswordConfirm) {
    throw AppError.badRequest('Konfirmasi password baru tidak cocok.', [
      { field: 'newPasswordConfirm', message: 'Konfirmasi password baru tidak cocok.' },
    ]);
  }

  await authService.resetPasswordWithToken({ token, newPassword });

  await logActivity(req, 'auth.reset_password', {});

  res.json({
    success: true,
    message: 'Password berhasil diubah. Silakan masuk dengan password baru.',
  });
});

module.exports = {
  register,
  login,
  logout,
  me,
  updateProfile,
  changePassword,
  requestReset,
  resetPassword,
  publicUser,
};
