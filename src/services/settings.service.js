/**
 * Service pengaturan (settings).
 *
 * Nilai default berasal dari src/config/app.config.js.
 * Admin dapat menimpa sebagian nilai lewat dashboard dan hasilnya disimpan
 * di collection "settings" (key-value) lalu di-cache di memory.
 */
'use strict';

const { Setting } = require('../models');
const appConfig = require('../config/app.config');

const DEFAULTS = {
  'app.name': appConfig.name,
  'app.supportContact': appConfig.supportContact,
  'app.allowRegistration': true,
  'app.heroTitle': 'Marketplace antar siswa',
  'app.heroSubtitle':
    'Temukan produk dan jasa dari teman sekelas, UKM, atau kelas sebelah. Pesan langsung lewat WhatsApp.',
  'app.featuredMinReviews': appConfig.reviews.featuredMinReviews,
  'app.featuredMinRating': appConfig.reviews.featuredMinRating,
  'marketplace.maxPerPage': appConfig.pagination.defaultLimit,
};

let cache = null;
let cacheAt = 0;
const CACHE_TTL_MS = 30 * 1000;

async function loadSettings() {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache;

  const docs = await Setting.find({}).lean();
  const map = { ...DEFAULTS };

  // Jaga-jaga: kalau pernah ada dua key yang bedanya hanya kapitalisasi
  // (mis. "app.heroTitle" dan "app.herotitle"), pakai yang paling sesuai
  // dengan nama bawaan di DEFAULTS.
  const canonical = new Set(Object.keys(DEFAULTS));
  const perLower = new Map();

  docs.forEach((doc) => {
    const lower = String(doc.key).toLowerCase();
    const existing = perLower.get(lower);
    if (!existing) {
      perLower.set(lower, doc);
      return;
    }
    if (canonical.has(doc.key) && !canonical.has(existing.key)) {
      perLower.set(lower, doc);
    }
  });

  perLower.forEach((doc) => {
    map[doc.key] = doc.value;
  });

  cache = map;
  cacheAt = now;
  return cache;
}

async function getSetting(key, fallback = undefined) {
  const settings = await loadSettings();
  if (settings[key] !== undefined) return settings[key];
  return fallback;
}

async function setSetting(key, value, updatedBy = null) {
  await Setting.findOneAndUpdate(
    { key },
    { value, updatedBy },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  cache = null;
  return loadSettings();
}

async function getPublicSettings() {
  const settings = await loadSettings();
  return {
    appName: settings['app.name'],
    supportContact: settings['app.supportContact'],
    allowRegistration: settings['app.allowRegistration'],
    heroTitle: settings['app.heroTitle'],
    heroSubtitle: settings['app.heroSubtitle'],
  };
}

function clearCache() {
  cache = null;
  cacheAt = 0;
}

module.exports = { loadSettings, getSetting, setSetting, getPublicSettings, clearCache, DEFAULTS };
