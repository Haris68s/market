/**
 * Controller katalog publik: beranda, daftar produk, detail produk, profil toko.
 */
'use strict';

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { Product, Category, Store, Review, Order } = require('../models');
const productService = require('../services/product.service');
const storeService = require('../services/store.service');
const reviewService = require('../services/review.service');
const { getQuery } = require('../middleware/validate');
const appConfig = require('../config/app.config');

/**
 * GET /api/categories
 */
const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
  res.json({ success: true, data: { items: categories } });
});

/**
 * GET /api/products  (katalog + pencarian + filter)
 */
const listProducts = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const result = await productService.listProducts(query);

  // Batasi info toko yang dikirim (jangan kirim data internal toko).
  const items = result.items.map((product) => ({
    ...product,
    store: product.storeId
      ? {
          _id: product.storeId._id,
          name: product.storeId.name,
          slug: product.storeId.slug,
          ratingAvg: product.storeId.ratingAvg,
          ratingCount: product.storeId.ratingCount,
          category: product.storeId.category,
          location: product.storeId.location,
        }
      : null,
    storeId: product.storeId ? product.storeId._id : product.storeId,
  }));

  res.json({ success: true, data: { items, pagination: result.pagination } });
});

/**
 * GET /api/products/featured  (data untuk beranda)
 */
const featuredProducts = asyncHandler(async (req, res) => {
  const minReviews = appConfig.reviews.featuredMinReviews;
  const minRating = appConfig.reviews.featuredMinRating;

  const [newest, popular, topRated, stores, categories] = await Promise.all([
    Product.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('storeId', 'name slug ratingAvg ratingCount')
      .lean(),
    // "Terlaris" dihitung dari pesanan yang benar-benar SELESAI (soldCount).
    Product.find({ status: 'active', soldCount: { $gt: 0 } })
      .sort({ soldCount: -1, ratingAvg: -1 })
      .limit(8)
      .populate('storeId', 'name slug ratingAvg ratingCount')
      .lean(),
    // "Rating tertinggi" butuh jumlah ulasan minimum supaya tidak bias.
    Product.find({ status: 'active', ratingCount: { $gte: minReviews }, ratingAvg: { $gte: minRating } })
      .sort({ ratingAvg: -1, ratingCount: -1 })
      .limit(8)
      .populate('storeId', 'name slug ratingAvg ratingCount')
      .lean(),
    Store.find({ status: 'active', isFeatured: true })
      .sort({ ratingAvg: -1, totalSold: -1 })
      .limit(6)
      .lean(),
    Category.find({ isActive: true }).sort({ order: 1, name: 1 }).limit(12).lean(),
  ]);

  // Bila belum ada cukup data rating, tunjukkan produk terbaru sebagai alternatif.
  const hasTopRated = topRated.length > 0;

  res.json({
    success: true,
    data: {
      newest,
      popular,
      topRated: hasTopRated ? topRated : [],
      topRatedFallback: hasTopRated ? null : newest.slice(0, 4),
      featuredStores: stores.map(storeService.toPublicStore),
      categories,
      meta: {
        minReviews,
        minRating,
        note: hasTopRated
          ? null
          : `Belum ada produk dengan ${minReviews}+ ulasan dan rating ${minRating}+.`,
      },
    },
  });
});

/**
 * GET /api/products/:slug  (detail produk)
 */
const getProduct = asyncHandler(async (req, res) => {
  const { slug } = req.validatedParams || req.params;

  const product = await Product.findOne({ slug, status: { $ne: 'draft' } })
    .populate('storeId')
    .lean();

  if (!product) {
    throw AppError.notFound('Produk tidak ditemukan.');
  }

  const store = product.storeId;
  const publicStore = storeService.toPublicStore(store);

  // Produk terkait: kategori sama, selain produk ini.
  const related = await Product.find({
    _id: { $ne: product._id },
    category: product.category,
    status: 'active',
  })
    .sort({ soldCount: -1, createdAt: -1 })
    .limit(4)
    .populate('storeId', 'name slug')
    .lean();

  const reviews = await reviewService.listProductReviews(product._id, { page: 1, limit: 5 });
  const breakdown = await reviewService.ratingBreakdown(product._id);

  // Pembeli boleh mengulas bila punya pesanan SELESAI untuk produk ini
  // dan belum memberikan ulasan untuk pesanan tersebut.
  let canReview = false;
  let reviewableOrderId = null;
  if (req.user) {
    const completedOrders = await Order.find({
      productId: product._id,
      buyerId: req.user._id,
      status: 'completed',
    })
      .select('_id')
      .lean();

    if (completedOrders.length > 0) {
      const reviewed = await Review.find({
        buyerId: req.user._id,
        orderId: { $in: completedOrders.map((o) => o._id) },
      })
        .select('orderId')
        .lean();

      const belumDiulas = completedOrders.filter(
        (o) => !reviewed.some((r) => String(r.orderId) === String(o._id))
      );
      canReview = belumDiulas.length > 0;
      if (canReview) reviewableOrderId = belumDiulas[0]._id;
    }
  }

  res.json({
    success: true,
    data: {
      product: {
        ...product,
        storeId: store ? store._id : product.storeId,
      },
      store: publicStore,
      related,
      reviews: reviews.items,
      reviewPagination: reviews.pagination,
      ratingBreakdown: breakdown,
      canReview,
      reviewableOrderId,
    },
  });
});

/**
 * GET /api/stores  (daftar toko)
 */
const listStores = asyncHandler(async (req, res) => {
  const stores = await Store.find({ status: 'active' })
    .sort({ isFeatured: -1, ratingAvg: -1, totalSold: -1 })
    .limit(24)
    .lean();

  res.json({ success: true, data: { items: stores.map(storeService.toPublicStore) } });
});

/**
 * GET /api/stores/:slug  (profil toko)
 */
const getStore = asyncHandler(async (req, res) => {
  const { slug } = req.validatedParams || req.params;
  const query = getQuery(req);

  const result = await storeService.getStorePublicProfile(slug, {
    page: query.page || 1,
    limit: query.limit || 12,
    sort: query.sort || 'newest',
  });

  res.json({ success: true, data: result });
});

module.exports = {
  listCategories,
  listProducts,
  featuredProducts,
  getProduct,
  listStores,
  getStore,
};
