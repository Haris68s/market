/**
 * Service autentikasi.
 *
 * Identitas login = nomor WhatsApp (format internal 628xxxxxxxxxx).
 * Password disimpan sebagai hash bcrypt. Hash TIDAK PERNAH dikembalikan ke API.
 */
'use strict';

const AppError = require('../utils/AppError');
const { User, Store } = require('../models');
const { hashPassword, verifyPassword, generateResetToken, hashResetToken } = require('../utils/password');
const { normalizeWhatsapp, tryNormalizeWhatsapp } = require('../utils/whatsapp');
const { slugify, randomSuffix } = require('../utils/format');

const MAX_FAILED_LOGIN = 5;
const LOCK_MINUTES = 15;

/** Buat slug toko yang unik. */
async function generateStoreSlug(name) {
  const base = slugify(name) || 'toko';
  let candidate = base;
  let attempt = 0;
  // eslint-disable-next-line no-await-in-loop
  while (await Store.exists({ slug: candidate })) {
    attempt += 1;
    candidate = `${base}-${randomSuffix(4)}`;
    if (attempt > 10) candidate = `${base}-${Date.now()}`;
  }
  return candidate;
}

/**
 * Daftar akun penjual baru + sekalian membuka toko.
 */
async function registerSeller(payload) {
  const { name, password, storeName, category, description, address, city } = payload;
  const whatsapp = normalizeWhatsapp(payload.whatsapp);

  const existing = await User.findOne({ whatsapp }).lean();
  if (existing) {
    throw AppError.conflict(
      'Nomor WhatsApp tersebut sudah terdaftar. Silakan masuk ke akun Anda atau gunakan nomor lain.'
    );
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await User.create({
      role: 'seller', // role SELALU seller untuk pendaftaran publik
      name: name.trim(),
      whatsapp,
      passwordHash,
      status: 'active',
      email: payload.email ? String(payload.email).trim().toLowerCase() : null,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw AppError.conflict('Nomor WhatsApp tersebut sudah terdaftar.');
    }
    throw err;
  }

  const slug = await generateStoreSlug(storeName);

  const store = await Store.create({
    ownerId: user._id,
    name: storeName.trim(),
    slug,
    description: description || '',
    category,
    whatsapp,
    location: {
      address: address || '',
      city: city || '',
      showAddress: Boolean(city || address),
      // Alamat detail TIDAK ditampilkan publik kecuali penjual mencentangnya.
      showExactAddress: false,
    },
    status: 'active',
  });

  await User.updateOne({ _id: user._id }, { $set: { storeId: store._id } });
  user.storeId = store._id;

  return { user, store };
}

/**
 * Proses login.
 */
async function authenticate({ identifier, password }) {
  const whatsapp = tryNormalizeWhatsapp(identifier);
  if (!whatsapp) {
    throw AppError.badRequest('Nomor WhatsApp tidak valid.', [
      { field: 'whatsapp', message: 'Masukkan nomor WhatsApp yang terdaftar.' },
    ]);
  }

  const user = await User.findOne({ whatsapp }).select('+passwordHash').lean();

  // Pesan error sengaja sama untuk "tidak ada" dan "password salah",
  // supaya penyerang tidak bisa menebak nomor mana yang terdaftar.
  const genericError = 'Nomor WhatsApp atau password salah.';

  if (!user) {
    throw AppError.unauthorized(genericError);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil - new Date()) / 60000);
    throw AppError.forbidden(
      `Akun terkunci sementara karena terlalu banyak percobaan login. Coba lagi dalam ${minutes} menit.`
    );
  }

  if (user.status === 'suspended') {
    throw AppError.forbidden(
      'Akun Anda dinonaktifkan oleh admin. Hubungi admin untuk informasi lebih lanjut.'
    );
  }
  if (user.status === 'pending') {
    throw AppError.forbidden('Akun Anda belum aktif. Silakan hubungi admin.');
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);

  if (!passwordOk) {
    const failedLoginCount = (user.failedLoginCount || 0) + 1;
    const patch = { failedLoginCount };
    if (failedLoginCount >= MAX_FAILED_LOGIN) {
      patch.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      patch.failedLoginCount = 0;
    }
    await User.updateOne({ _id: user._id }, { $set: patch });
    throw AppError.unauthorized(
      failedLoginCount >= MAX_FAILED_LOGIN
        ? `Terlalu banyak percobaan gagal. Akun dikunci selama ${LOCK_MINUTES} menit.`
        : genericError
    );
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } }
  );

  return user;
}

/** Ubah password (wajib menyertakan password lama). */
async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw AppError.notFound('Pengguna tidak ditemukan.');

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    throw AppError.badRequest('Password lama tidak cocok.', [
      { field: 'currentPassword', message: 'Password lama tidak cocok.' },
    ]);
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  return true;
}

/** Admin membuatkan permintaan reset (dicatat, belum ada token). */
async function requestPasswordReset({ whatsapp }) {
  const number = tryNormalizeWhatsapp(whatsapp);
  if (!number) {
    throw AppError.badRequest('Nomor WhatsApp tidak valid.', [
      { field: 'whatsapp', message: 'Masukkan nomor WhatsApp yang valid.' },
    ]);
  }

  const user = await User.findOne({ whatsapp: number }).lean();
  if (!user) {
    // Jangan bocorkan apakah nomor terdaftar.
    return { found: false };
  }

  await User.updateOne({ _id: user._id }, { $set: { resetRequestedAt: new Date() } });
  return { found: true, user };
}

/**
 * Admin menerbitkan token reset sekali pakai.
 * Token yang dikembalikan harus dikirim manual ke seller via WhatsApp.
 */
async function issueResetToken({ userId }) {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('Pengguna tidak ditemukan.');

  const token = generateResetToken();
  user.resetTokenHash = hashResetToken(token);
  user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 menit
  await user.save();

  return { token, expiresAt: user.resetTokenExpires, user: { id: user._id, name: user.name, whatsapp: user.whatsapp } };
}

/** Seller menukar token dengan password baru. */
async function resetPasswordWithToken({ token, newPassword }) {
  if (!token || !token.trim()) {
    throw AppError.badRequest('Token reset tidak valid.');
  }

  const tokenHash = hashResetToken(token.trim());
  const user = await User.findOne({ resetTokenHash: tokenHash }).select('+passwordHash +resetTokenHash');
  if (!user) {
    throw AppError.badRequest('Token reset tidak valid atau sudah dipakai.');
  }
  if (!user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    user.resetTokenHash = null;
    user.resetTokenExpires = null;
    await user.save();
    throw AppError.badRequest('Token reset sudah kedaluwarsa. Minta token baru ke admin.');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.resetTokenHash = null;
  user.resetTokenExpires = null;
  user.failedLoginCount = 0;
  user.lockedUntil = null;
  await user.save();

  return true;
}

module.exports = {
  registerSeller,
  authenticate,
  changePassword,
  requestPasswordReset,
  issueResetToken,
  resetPasswordWithToken,
  generateStoreSlug,
  MAX_FAILED_LOGIN,
};
