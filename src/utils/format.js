/**
 * Utilitas format & teks.
 */
'use strict';

const { randomBytes } = require('crypto');

/** Format angka menjadi Rupiah, contoh: 15000 -> "Rp15.000" */
function formatRupiah(value) {
  const number = Number(value) || 0;
  return `Rp${number.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
}

/** Ubah teks menjadi slug URL: "Kopi Susu Gula Aren" -> "kopi-susu-gula-aren" */
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // buang tanda aksen
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Suffix acak untuk membuat slug unik, contoh: "kopi-susu-a1b2" */
function randomSuffix(length = 4) {
  // Huruf ambigu (0/O, 1/I) sengaja dibuang agar mudah dibaca & diketikmanual
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Kode referensi pesanan, contoh: "KS-260821-4F2A" */
function generateOrderCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `KS-${yy}${mm}${dd}-${randomSuffix(4)}`;
}

/** Potong teks panjang dengan rapi */
function truncate(text, max = 160) {
  const str = String(text || '');
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Escape karakter khusus regex.
 * Wajib dipakai sebelum string dari user dimasukkan ke $regex,
 * supaya pengguna tidak bisa menulis pola regex yang berbahaya.
 */
function escapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ambil Inisial untuk avatar (maksimal 2 huruf) */
function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/** Ubah teks menjadi JSON yang aman untuk disisipkan ke dalam <script> HTML */
function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

module.exports = {
  formatRupiah,
  slugify,
  randomSuffix,
  generateOrderCode,
  truncate,
  initials,
  safeJson,
  escapeRegex,
};
