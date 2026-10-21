/**
 * Service toko: profil toko yang dilihat publik & profil yang dikelola penjual.
 */
'use strict';

const AppError = require('../utils/AppError');
const { Store, Product } = require('../models');
const { toObjectId, refreshStoreProductCount, refreshStoreRating } = require('./product.service');

/**
 * Data toko untuk tampilan publik.
 * Alamat detail hanya ditampilkan bila penjual mencentangnya.
 */
function toPublicStore(store) {
  if (!store) return null;
  const location = store.location || {};
  return {
    _id: store._id,
    name: store.name,
    slug: store.slug,
    description: store.description,
    category: store.category,
    whatsapp: store.whatsapp,
    ratingAvg: store.ratingAvg || 0,
    ratingCount: store.ratingCount || 0,
    productCount: store.productCount || 0,
    totalSold: store.totalSold || 0,
    isFeatured: Boolean(store.isFeatured),
    logo: store.logo || null,
    banner: store.banner || null,
    createdAt: store.createdAt,
    location: {
      city: location.showAddress || location.city ? location.city : '',
      address: location.showExactAddress ? location.address : '',
    },
  };
}

/**
 * Ambil detail toko + produknya untuk halaman profil toko.
 */
async function getStorePublicProfile(slug, { page = 1, limit = 12, sort = 'newest' } = {}) {
  const store = await Store.findOne({ slug, status: 'active' }).lean();
  if (!store) {
    throw AppError.notFound('Toko tidak ditemukan atau sedang tidak aktif.');
  }

  const filter = { storeId: store._id, status: 'active' };
  const sortOption = sort === 'popular' ? { soldCount: -1, createdAt: -1 } : { createdAt: -1 };

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  const bestSeller = await Product.findOne({ storeId: store._id, status: 'active' })
    .sort({ soldCount: -1, createdAt: -1 })
    .lean();

  return {
    store: toPublicStore(store),
    products: items,
    bestSeller: bestSeller && bestSeller.soldCount > 0 ? bestSeller : null,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/**
 * Update profil toko oleh pemiliknya.
 */
async function updateStoreProfile({ storeId, sellerId, payload }) {
  const store = await Store.findOne({ _id: toObjectId(storeId), ownerId: toObjectId(sellerId) });
  if (!store) {
    throw AppError.notFound('Toko tidak ditemukan.');
  }

  const { name, description, category, whatsapp, location, logo, banner } = payload;

  if (name !== undefined) store.name = String(name).trim();
  if (description !== undefined) store.description = String(description).trim();
  if (category !== undefined) store.category = category;
  if (whatsapp !== undefined) store.whatsapp = whatsapp;
  if (logo !== undefined) store.logo = logo;
  if (banner !== undefined) store.banner = banner;

  if (location && typeof location === 'object') {
    if (location.address !== undefined) store.location.address = String(location.address).trim();
    if (location.city !== undefined) store.location.city = String(location.city).trim();
    if (location.showAddress !== undefined) store.location.showAddress = Boolean(location.showAddress);
    if (location.showExactAddress !== undefined) {
      store.location.showExactAddress = Boolean(location.showExactAddress);
    }
  }

  await store.save();
  return store;
}

/**
 * Hitung ulang ringkasan toko (dipanggil setelah perubahan produk/ulasan).
 */
async function refreshStoreSummary(storeId) {
  await refreshStoreProductCount(storeId);
  await refreshStoreRating(storeId);
}

module.exports = { toPublicStore, getStorePublicProfile, updateStoreProfile, refreshStoreSummary };
