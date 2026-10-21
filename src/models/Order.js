/**
 * Model Order (permintaan pemesanan via WhatsApp).
 *
 * PENTING:
 * - `priceSnapshot` menyimpan harga saat pesanan dibuat. Perubahan harga produk
 *   di kemudian hari TIDAK mengubah catatan pesanan lama.
 * - Status "pending" berarti "menunggu konfirmasi", BUKAN "pesanan berhasil".
 */
'use strict';

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, required: true, unique: true, index: true },

    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    buyerName: { type: String, default: null, trim: true, maxlength: 120 },
    buyerContact: { type: String, default: null, trim: true, maxlength: 20 },

    qty: { type: Number, required: true, min: 1 },
    priceSnapshot: { type: Number, required: true, min: 0 },
    productNameSnapshot: { type: String, required: true },
    productImageSnapshot: { type: String, default: null },
    subtotal: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    source: { type: String, default: 'whatsapp' },

    note: { type: String, default: null, trim: true, maxlength: 500 },

    waMessage: { type: String, default: '' },
    waLink: { type: String, default: '' },
    waOpenedAt: { type: Date, default: null },

    confirmedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null, maxlength: 300 },
  },
  { timestamps: true }
);

orderSchema.index({ storeId: 1, status: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, createdAt: -1 });
orderSchema.index({ productId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
