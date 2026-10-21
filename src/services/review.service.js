/**
 * Service ulasan (rating + komentar).
 *
 * Aturan penting:
 * - Rating divalidasi 1..5 di backend.
 * - Ulasan hanya boleh dibuat oleh pembeli yang pesanannya berstatus "selesai".
 * - Satu user tidak boleh mengulas dua kali untuk pesanan/produk yang sama.
 * - Ulasan yang disembunyikan admin TIDAK ikut dihitung dalam rating rata-rata.
 */
'use strict';

const AppError = require('../utils/AppError');
const { Review, Order, Product } = require('../models');
const { toObjectId, refreshProductRating, refreshStoreRating } = require('./product.service');
const appConfig = require('../config/app.config');

/**
 * Buat ulasan baru.
 */
async function createReview({ productId, orderId, buyerId, buyerName, rating, comment }) {
  const value = Number(rating);
  if (!Number.isInteger(value) || value < appConfig.reviews.minRating || value > appConfig.reviews.maxRating) {
    throw AppError.badRequest('Rating harus berupa angka bulat 1 sampai 5.', [
      { field: 'rating', message: 'Pilih 1 sampai 5 bintang.' },
    ]);
  }

  const text = String(comment || '').trim();
  if (text.length < appConfig.reviews.minCommentLength) {
    throw AppError.badRequest(
      `Ulasan minimal ${appConfig.reviews.minCommentLength} karakter.`,
      [{ field: 'comment', message: `Ulasan minimal ${appConfig.reviews.minCommentLength} karakter.` }]
    );
  }

  const product = await Product.findById(toObjectId(productId)).lean();
  if (!product) throw AppError.notFound('Produk tidak ditemukan.');

  let order = null;
  if (orderId) {
    order = await Order.findOne({
      _id: toObjectId(orderId),
      productId: product._id,
      buyerId: toObjectId(buyerId),
    }).lean();

    if (!order) {
      throw AppError.forbidden('Pesanan ini bukan milik Anda atau tidak tersedia.');
    }
    if (order.status !== 'completed') {
      throw AppError.badRequest(
        'Ulasan hanya bisa ditulis setelah pesanan selesai. Hubungi penjual bila pesanan sudah dikirim.'
      );
    }
  } else {
    throw AppError.badRequest('Ulasan harus terhubung dengan pesanan yang sudah selesai.');
  }

  // Cegah ulasan ganda untuk pesanan yang sama.
  const existing = await Review.findOne({ orderId: order._id, buyerId: toObjectId(buyerId) }).lean();
  if (existing) {
    throw AppError.conflict('Anda sudah memberi ulasan untuk pesanan ini.');
  }

  const review = await Review.create({
    productId: product._id,
    storeId: product.storeId,
    sellerId: product.sellerId,
    orderId: order._id,
    buyerId: toObjectId(buyerId),
    rating: value,
    comment: text,
    status: 'published',
    // Transaksi lewat WhatsApp tidak bisa diverifikasi otomatis.
    isVerifiedPurchase: false,
  });

  // Perbarui cache rating.
  await refreshProductRating(product._id);
  await refreshStoreRating(product.storeId);

  return { review, productName: product.name };
}

/**
 * Sembunyikan ulasan (dipakai admin). Alasan WAJIB diisi agar tercatat.
 */
async function hideReview({ reviewId, adminId, reason }) {
  if (!reason || !reason.trim()) {
    throw AppError.badRequest('Alasan penyembunyian ulasan wajib diisi.', [
      { field: 'reason', message: 'Alasan wajib diisi.' },
    ]);
  }

  const review = await Review.findById(toObjectId(reviewId)).lean();
  if (!review) throw AppError.notFound('Ulasan tidak ditemukan.');

  const updated = await Review.findOneAndUpdate(
    { _id: review._id },
    {
      $set: {
        status: 'hidden',
        moderation: { hiddenBy: adminId, hiddenAt: new Date(), reason: reason.trim() },
      },
    },
    { new: true }
  ).lean();

  await refreshProductRating(review.productId);
  await refreshStoreRating(review.storeId);

  return updated;
}

/**
 * Tampilkan ulasan produk untuk halaman publik.
 */
async function listProductReviews(productId, { page = 1, limit = 10 } = {}) {
  const filter = { productId: toObjectId(productId), status: 'published' };
  const [items, total] = await Promise.all([
    Review.find(filter)
      .populate('buyerId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Distribusi bintang 1..5 untuk sebuah produk. */
async function ratingBreakdown(productId) {
  const rows = await Review.aggregate([
    { $match: { productId: toObjectId(productId), status: 'published' } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]);

  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  rows.forEach((row) => {
    breakdown[row._id] = row.count;
  });
  return breakdown;
}

module.exports = { createReview, hideReview, listProductReviews, ratingBreakdown };
