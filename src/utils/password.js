/**
 * Utilitas kata sandi.
 *
 * - Hash  : bcrypt (pure JS "bcryptjs") dengan cost 12.
 * - Reset : token acak disimpan sebagai SHA-256, jadi isi database tidak bisa
 *           dipakai langsung untuk reset password.
 */
'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;

/** Hash password dengan bcrypt. Password TIDAK PERNAH disimpan sebagai teks biasa. */
async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Cocokkan password dengan hash. Selalu kembalikan boolean (tidak melontarkan detail). */
async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch (err) {
    return false;
  }
}

/** Buat token reset acak (dipakai admin lalu dikirim ke seller via WhatsApp) */
function generateResetToken() {
  return crypto.randomBytes(24).toString('hex');
}

/** Hash token reset dengan SHA-256 untuk disimpan di database */
function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/** Bandingkan dua string tanpa membocorkan informasi waktu (timing attack) */
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Penilaian kekuatan password sederhana (skor 0..4) */
function passwordStrength(password) {
  const value = String(password || '');
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateResetToken,
  hashResetToken,
  safeCompare,
  passwordStrength,
};
