/**
 * Model Review (rating + ulasan).
 *
 * - Satu orang hanya boleh memberi satu ulasan untuk satu pesanan
 *   (dijaga unique sparse index pada { orderId, buyerId }).
 * - Ulasan yang disembunyikan admin tidak ikut dihitung ke rating rata-rata.
 */
'use strict';

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },

    status: {
      type: String,
      enum: ['published', 'hidden', 'pending'],
      default: 'published',
      index: true,
    },
    // Transaksi lewat WhatsApp tidak bisa diverifikasi otomatis => tandai belum terverifikasi.
    isVerifiedPurchase: { type: Boolean, default: false },

    moderation: {
      hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      hiddenAt: { type: Date, default: null },
      reason: { type: String, default: null, maxlength: 300 },
    },
  },
  { timestamps: true }
);

// Mencegah rating ganda untuk pesanan yang sama.
reviewSchema.index({ orderId: 1, buyerId: 1 }, { unique: true, sparse: true });
// Mencegah rating ganda untuk produk yang sama oleh user yang sama (tanpa pesanan).
reviewSchema.index({ productId: 1, buyerId: 1 }, { unique: true, sparse: true, partialFilterExpression: { orderId: null } });
reviewSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
