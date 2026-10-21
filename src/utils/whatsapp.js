/**
 * Utilitas nomor WhatsApp.
 *
 * Aturan format yang dipakai aplikasi ini:
 *   - Disimpan sebagai format internasional tanpa "+" dan tanpa "0" depan.
 *     Contoh: 081234567890 -> "6281234567890"
 *   - Link wa.me butuh format yang sama: https://wa.me/6281234567890?text=...
 */
'use strict';

const AppError = require('./AppError');

/**
 * Normalisasi assorted nomor telepon menjadi format WhatsApp Indonesia.
 * @param {string} input nomor dari user, bebas format
 * @returns {string} format "628xxxxxxxxxx"
 * @throws {AppError} bila nomornya tidak masuk akal
 */
function normalizeWhatsapp(input) {
  if (input === undefined || input === null || input === '') {
    throw AppError.badRequest('Nomor WhatsApp wajib diisi.', [
      { field: 'whatsapp', message: 'Nomor WhatsApp wajib diisi.' },
    ]);
  }

  let digits = String(input).replace(/\D/g, '');

  // Buang prefiks international / nol supaya dapat nomor lokal saja.
  // Contoh: "6281234567890" -> "81234567890", "081234567890" -> "81234567890"
  if (digits.startsWith('62')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Nomor lokal Indonesia selalu diawali 8, lalu kita pasang prefix 62.
  digits = `62${digits}`;

  // Nomor Indonesia: 62 + 8..13 digit (mis. 6281234567890 = 62 + 11 digit)
  if (!/^62[0-9]{8,13}$/.test(digits)) {
    throw AppError.badRequest('Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx.', [
      { field: 'whatsapp', message: 'Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx.' },
    ]);
  }

  return digits;
}

/** Sama seperti normalizeWhatsapp tetapi mengembalikan null bila tidak valid (tanpa throw) */
function tryNormalizeWhatsapp(input) {
  try {
    return normalizeWhatsapp(input);
  } catch (err) {
    return null;
  }
}

/** Tampilkan nomor dalam format manusiawi: 6281234567890 -> "+62 812-3456-7890" */
function formatWhatsappDisplay(number) {
  const digits = String(number || '').replace(/\D/g, '');
  if (digits.length < 10) return number || '';
  const local = digits.startsWith('62') ? digits.slice(2) : digits;
  const parts = [local.slice(0, 3), local.slice(3, 7), local.slice(7)].filter(Boolean);
  return `+62 ${parts.join('-')}`;
}

/** Buat tautan WhatsApp dengan pesan siap kirim */
function buildWhatsappLink(number, message = '') {
  const digits = String(number).replace(/\D/g, '');
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Susun pesan pemesanan otomatis.
 */
function buildOrderMessage({ productName, price, qty, orderCode, productUrl, storeName, buyerName }) {
  const lines = [];
  if (buyerName) lines.push(`Halo ${buyerName},`);
  else lines.push('Halo,');
  lines.push(`saya ingin memesan *${productName}*.`);
  lines.push(`Harga: Rp${Number(price).toLocaleString('id-ID')}`);
  lines.push(`Jumlah: ${qty}`);
  lines.push(`Kode pesanan: ${orderCode}`);
  if (storeName) lines.push(`Toko: ${storeName}`);
  if (productUrl) lines.push(`Tautan produk: ${productUrl}`);
  lines.push('Apakah produk masih tersedia?');
  return lines.join('\n');
}

module.exports = {
  normalizeWhatsapp,
  tryNormalizeWhatsapp,
  formatWhatsappDisplay,
  buildWhatsappLink,
  buildOrderMessage,
};
