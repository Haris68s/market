/**
 * Model ReviewReport (laporan penyalahgunaan).
 */
'use strict';

const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ['review', 'product', 'user', 'store'],
      required: true,
      index: true,
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    reason: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reporterContact: { type: String, default: null, trim: true, maxlength: 120 },

    status: {
      type: String,
      enum: ['open', 'reviewed', 'resolved', 'rejected'],
      default: 'open',
      index: true,
    },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ReviewReport', reportSchema);
