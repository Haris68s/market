/**
 * Model Transaction (pembukuan keuangan toko).
 *
 * - Unique sparse index pada { storeId, orderId, type, source } mencegah
 *   pencatatan pemasukan ganda dari satu pesanan yang sama.
 */
'use strict';

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    type: { type: String, enum: ['income', 'expense'], required: true, index: true },
    category: { type: String, required: true, trim: true, lowercase: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    description: { type: String, default: '', trim: true, maxlength: 300 },

    // Tanggal transaksi (bisa berbeda dari tanggal pencatatan)
    date: { type: Date, required: true, index: true },

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    source: { type: String, enum: ['manual', 'order'], default: 'manual' },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

transactionSchema.index({ storeId: 1, date: -1 });
transactionSchema.index({ storeId: 1, type: 1, date: -1 });
transactionSchema.index(
  { storeId: 1, orderId: 1, type: 1, source: 1 },
  { unique: true, sparse: true, partialFilterExpression: { orderId: { $ne: null } } }
);

module.exports = mongoose.model('Transaction', transactionSchema);
