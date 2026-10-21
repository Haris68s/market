/**
 * Model Setting (key-value untuk pengaturan marketplace yang diatur admin).
 */
'use strict';

const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    // Key disimpan apa adanya (mis. "app.heroTitle"). Jangan di-lowercase:
    // kalau di-lowercase, key camelCase akan terduplikasi saat update.
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
