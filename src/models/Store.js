/**
 * Model Store (toko penjual).
 */
'use strict';

const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    category: { type: String, required: true, trim: true, index: true },

    // Kontak publik. Boleh berbeda dari nomor WhatsApp akun.
    whatsapp: { type: String, required: true, trim: true },

    location: {
      address: { type: String, default: '', trim: true, maxlength: 300 },
      city: { type: String, default: '', trim: true, maxlength: 100 },
      // Penjual sendiri yang menentukan apa yang ditampilkan publik.
      // Default: alamat detail TIDAK ditampilkan, hanya kota.
      showAddress: { type: Boolean, default: false },
      showExactAddress: { type: Boolean, default: false },
    },

    logo: { type: { type: String, default: null } },
    banner: { type: { type: String, default: null } },

    status: {
      type: String,
      enum: ['active', 'suspended', 'hidden'],
      default: 'active',
      index: true,
    },
    statusReason: { type: String, default: null, maxlength: 300 },

    isFeatured: { type: Boolean, default: false },

    // Cache hasil agregasi (dihitung ulang saat ulasan / pesanan berubah)
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    totalSold: { type: Number, default: 0, min: 0 },
    productCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

storeSchema.index({ status: 1, ratingAvg: -1 });
storeSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Store', storeSchema);
