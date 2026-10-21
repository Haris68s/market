/**
 * Model User.
 *
 * Field `passwordHash` TIDAK PERNAH dikembalikan ke frontend:
 * pada schema diberi `select: false`, jadi hanya bisa dibaca eksplisit.
 */
'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['seller', 'superadmin'],
      default: 'seller',
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, default: null },
    whatsapp: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },

    status: {
      type: String,
      enum: ['active', 'suspended', 'pending'],
      default: 'active',
      index: true,
    },
    statusReason: { type: String, default: null, maxlength: 300 },

    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null },

    // Pengaman brute force
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },

    // Reset password (tanpa email -> verifikasi manual via WhatsApp oleh admin)
    resetTokenHash: { type: String, default: null, select: false },
    resetTokenExpires: { type: Date, default: null, select: false },
    resetRequestedAt: { type: Date, default: null },

    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, status: 1 });

module.exports = mongoose.model('User', userSchema);
