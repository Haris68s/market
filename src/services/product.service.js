/**
 * Service produk: query katalog, CRUD, dan pembaruan counter agregat.
 */
'use strict';

const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { Product, Store, Review, Order } = require('../models');
const { slugify, randomSuffix, escapeRegex } = require('../utils/format');
const appConfig = require('../config/app.config');

/** Pastikan ObjectId valid sebelum dipakai di query (anti NoSQL injection). */
function toObjectId(value) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw AppError.badRequest('ID data tidak valid.');
  }
  return new mongoose.Types.ObjectId(String(value));
}

/** Buat slug unik untuk produk. */
async function generateProductSlug(name) {
  const base = slugify(name) || 'produk';
  let candidate = base;
  let attempt = 0;
  // eslint-disable-next-line no-await-in-loop
  while (await Product.exists({ slug: candidate })) {
    attempt += 1;
    candidate = `${base}-${randomSuffix(4)}`;
    if (attempt > 10) candidate = `${base}-${Date.now()}`;
  }
  return candidate;
}

/**
 * Bangun query katalog dari parameter pencarian.
 * Semua nilai sudah divalidasi oleh middleware validate (zod).
 */
function buildCatalogFilter(query) {
  const filter = { status: 'active' };

  if (query.q) {
    const safe = escapeRegex(query.q);
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { description: { $regex: safe, $options: 'i' } },
    ];
  }

  if (query.category) filter.category = query.category;

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {};
    if (query.minPrice !== undefined) filter.price.$gte = query.minPrice;
    if (query.maxPrice !== undefined) filter.price.$lte = query.maxPrice;
  }

  if (query.store) filter.storeId = query.store;

  return filter;
}

/** Peta sort yang aman (tidak boleh input user dipakai langsung sebagai key sort). */
const SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  popular: { soldCount: -1, createdAt: -1 },
  rating: { ratingAvg: -1, ratingCount: -1 },
};

/**
 * Ambil daftar produk dengan filter, sort, dan pagination.
 */
async function listProducts(query) {
  const filter = buildCatalogFilter(query);
  const page = query.page || 1;
  const limit = Math.min(query.limit || appConfig.pagination.defaultLimit, appConfig.pagination.maxLimit);
  const sort = SORT_MAP[query.sort] || SORT_MAP.newest;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('storeId', 'name slug whatsapp ratingAvg ratingCount category location')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

/** Hitung ulang rating produk dari ulasan yang published. */
async function refreshProductRating(productId) {
  const stats = await Review.aggregate([
    { $match: { productId: toObjectId(productId), status: 'published' } },
    { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const avg = stats.length ? Math.round(stats[0].avg * 10) / 10 : 0;
  const count = stats.length ? stats[0].count : 0;

  await Product.updateOne({ _id: toObjectId(productId) }, { $set: { ratingAvg: avg, ratingCount: count } });
  return { avg, count };
}

/** Hitung ulang rating toko dari ulasan yang published. */
async function refreshStoreRating(storeId) {
  const stats = await Review.aggregate([
    { $match: { storeId: toObjectId(storeId), status: 'published' } },
    { $group: { _id: '$storeId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const avg = stats.length ? Math.round(stats[0].avg * 10) / 10 : 0;
  const count = stats.length ? stats[0].count : 0;

  await Store.updateOne({ _id: toObjectId(storeId) }, { $set: { ratingAvg: avg, ratingCount: count } });
  return { avg, count };
}

/** Hitung ulang jumlah produk aktif sebuah toko. */
async function refreshStoreProductCount(storeId) {
  const count = await Product.countDocuments({ storeId: toObjectId(storeId), status: 'active' });
  await Store.updateOne({ _id: toObjectId(storeId) }, { $set: { productCount: count } });
  return count;
}

/** Hitung ulang jumlah pesanan selesai (dipakai untuk "produk terlaris"). */
async function refreshProductSoldCount(productId) {
  const count = await Order.countDocuments({ productId: toObjectId(productId), status: 'completed' });
  await Product.updateOne({ _id: toObjectId(productId) }, { $set: { soldCount: count } });
  return count;
}

/** Hitung ulang total penjualan sebuah toko. */
async function refreshStoreSoldCount(storeId) {
  const count = await Order.countDocuments({ storeId: toObjectId(storeId), status: 'completed' });
  await Store.updateOne({ _id: toObjectId(storeId) }, { $set: { totalSold: count } });
  return count;
}

/** Ambil produk milik toko tertentu (untuk dashboard & profil toko). */
async function listStoreProducts(storeId, query = {}) {
  const filter = { storeId: toObjectId(storeId) };

  if (query.status && query.status !== 'all') filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.q) {
    filter.name = { $regex: escapeRegex(query.q), $options: 'i' };
  }

  const page = query.page || 1;
  const limit = Math.min(query.limit || 12, appConfig.pagination.maxLimit);

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(query.sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/**
 * Pastikan produk benar-benar milik toko yang sedang login.
 * Ini inti proteksi IDOR: identitas toko selalu berasal dari session,
 * bukan dari parameter request.
 */
async function assertProductOwnership(productId, storeId) {
  const product = await Product.findOne({ _id: toObjectId(productId), storeId: toObjectId(storeId) }).lean();
  if (!product) {
    throw AppError.notFound('Produk tidak ditemukan atau bukan milik toko Anda.');
  }
  return product;
}

module.exports = {
  toObjectId,
  generateProductSlug,
  buildCatalogFilter,
  listProducts,
  listStoreProducts,
  refreshProductRating,
  refreshStoreRating,
  refreshStoreProductCount,
  refreshProductSoldCount,
  refreshStoreSoldCount,
  assertProductOwnership,
  SORT_MAP,
};
