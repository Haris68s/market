/**
 * Service pesanan (permintaan pemesanan via WhatsApp).
 *
 * PENTING DIPAHAMI:
 * - Pembuatan pesanan HANYA mencatat permintaan. Status awalnya "pending"
 *   (menunggu konfirmasi), bukan "berhasil".
 * - Backend TIDAK otomatis mengurangi stok. Stok baru dianggap berkurang ketika
 *   penjual menandai pesanan sebagai "selesai" (barang benar-benar keluar).
 * - Harga yang disimpan adalah `priceSnapshot` (harga saat pesanan dibuat).
 */
'use strict';

const AppError = require('../utils/AppError');
const { Order, Product, Store, Transaction } = require('../models');
const { generateOrderCode } = require('../utils/format');
const { buildOrderMessage, buildWhatsappLink } = require('../utils/whatsapp');
const { toObjectId, refreshProductSoldCount, refreshStoreSoldCount } = require('./product.service');

/** Transisi status yang diperbolehkan. */
const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/**
 * Buat permintaan pesanan baru.
 */
async function createOrder({ productId, qty, buyerId, buyerName, buyerContact, note }) {
  const product = await Product.findById(toObjectId(productId)).lean();

  if (!product) {
    throw AppError.notFound('Produk tidak ditemukan.');
  }
  if (product.status === 'draft') {
    throw AppError.badRequest('Produk ini belum dipublikasikan oleh penjual.');
  }
  if (product.status === 'hidden') {
    throw AppError.badRequest('Produk ini sedang dinonaktifkan oleh admin.');
  }

  const store = await Store.findById(toObjectId(product.storeId)).lean();
  if (!store || store.status !== 'active') {
    throw AppError.badRequest('Toko ini sedang tidak aktif. Silakan coba produk lain.');
  }

  const quantity = Number(qty);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw AppError.badRequest('Jumlah pesanan minimal 1.', [
      { field: 'qty', message: 'Jumlah harus berupa angka bulat minimal 1.' },
    ]);
  }

  // Stok habis TIDAK memblokir pesanan, tapi pembeli diberi peringatan.
  const stockWarning =
    product.stock <= 0
      ? 'Stok sedang kosong. Penjual akan mengonfirmasi ketersediaan melalui WhatsApp.'
      : quantity > product.stock
        ? `Stok tersisa ${product.stock}. Penjual akan mengonfirmasi ketersediaan melalui WhatsApp.`
        : null;

  // Snapshot harga saat pesanan dibuat.
  const priceSnapshot = product.price;
  const subtotal = priceSnapshot * quantity;

  const orderCode = generateOrderCode();
  const productUrl = `${process.env.APP_URL || ''}/produk.html?slug=${product.slug}`;

  const waMessage = buildOrderMessage({
    productName: product.name,
    price: priceSnapshot,
    qty: quantity,
    orderCode,
    productUrl,
    storeName: store.name,
    buyerName: buyerName || null,
  });

  const waLink = buildWhatsappLink(store.whatsapp, waMessage);

  const order = await Order.create({
    orderCode,
    productId: product._id,
    storeId: product.storeId,
    sellerId: product.sellerId,
    buyerId: buyerId || null,
    buyerName: buyerName || null,
    buyerContact: buyerContact || null,
    qty: quantity,
    priceSnapshot,
    productNameSnapshot: product.name,
    productImageSnapshot: product.images && product.images[0] ? product.images[0].url : null,
    subtotal,
    status: 'pending',
    note: note || null,
    waMessage,
    waLink,
  });

  // Tambah penghitung permintaan (bukan penjualan).
  await Product.updateOne({ _id: product._id }, { $inc: { orderCount: 1 } });

  return { order, waLink, waMessage, stockWarning };
}

/**
 * Ubah status pesanan milik sebuah toko.
 */
async function updateOrderStatus({ orderId, storeId, status, reason }) {
  const order = await Order.findOne({ _id: toObjectId(orderId), storeId: toObjectId(storeId) }).lean();
  if (!order) {
    throw AppError.notFound('Pesanan tidak ditemukan atau bukan milik toko Anda.');
  }

  const allowed = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    throw AppError.badRequest(
      `Status pesanan tidak dapat diubah dari "${order.status}" menjadi "${status}".`,
      [{ field: 'status', message: `Transisi tidak diperbolehkan. Pilihan: ${allowed.join(', ') || 'tidak ada'}.` }]
    );
  }

  const now = new Date();
  const patch = { status };
  if (status === 'confirmed') patch.confirmedAt = now;
  if (status === 'completed') patch.completedAt = now;
  if (status === 'cancelled') {
    patch.cancelledAt = now;
    patch.cancelReason = reason || null;
  }

  const updated = await Order.findOneAndUpdate({ _id: order._id }, { $set: patch }, { new: true }).lean();

  if (status === 'completed') {
    // Barang dianggap keluar: perbarui penghitung penjualan.
    // eslint-disable-next-line no-await-in-loop
    await refreshProductSoldCount(updated.productId);
    // eslint-disable-next-line no-await-in-loop
    await refreshStoreSoldCount(updated.storeId);
  }

  return updated;
}

/**
 * Catat pemasukan dari sebuah pesanan.
 *
 * Pencegahan pencatatan ganda:
 * - Cek manual: apakah sudah ada transaksi income untuk order ini?
 * - Database: unique sparse index { storeId, orderId, type, source } menolak duplikat.
 */
async function recordIncomeFromOrder({ orderId, storeId, amount, category, description, date }) {
  const order = await Order.findOne({ _id: toObjectId(orderId), storeId: toObjectId(storeId) }).lean();
  if (!order) {
    throw AppError.notFound('Pesanan tidak ditemukan atau bukan milik toko Anda.');
  }
  if (order.status !== 'confirmed' && order.status !== 'completed') {
    throw AppError.badRequest(
      'Pemasukan dari pesanan hanya bisa dicatat setelah pesanan dikonfirmasi atau selesai.'
    );
  }

  const existing = await Transaction.findOne({
    storeId: toObjectId(storeId),
    orderId: order._id,
    type: 'income',
    source: 'order',
  }).lean();

  if (existing) {
    throw AppError.conflict('Pemasukan untuk pesanan ini sudah pernah dicatat.');
  }

  const transaction = await Transaction.create({
    storeId: order.storeId,
    sellerId: order.sellerId,
    type: 'income',
    category: category || 'penjualan',
    amount: amount !== undefined && amount !== null ? Number(amount) : order.subtotal,
    description:
      description || `Penjualan ${order.productNameSnapshot} (${order.orderCode}) - pesanan via WhatsApp`,
    date: date ? new Date(date) : new Date(),
    orderId: order._id,
    source: 'order',
  });

  return transaction;
}

module.exports = { createOrder, updateOrderStatus, recordIncomeFromOrder, ALLOWED_TRANSITIONS };
