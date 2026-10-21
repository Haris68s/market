/**
 * Controller super admin.
 *
 * Semua route di berkas ini dijaga middleware requireRole('superadmin').
 * Admin boleh memoderasi, TIDAK boleh mengubah keuangan penjual.
 */
'use strict';

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { User, Store, Product, Order, Review, Transaction, Category, ReviewReport, ActivityLog } = require('../models');
const { logActivity } = require('../services/activity.service');
const reviewService = require('../services/review.service');
const productService = require('../services/product.service');
const settingsService = require('../services/settings.service');
const authService = require('../services/auth.service');
const { getQuery } = require('../middleware/validate');
const { slugify, randomSuffix, escapeRegex } = require('../utils/format');
const { toObjectId } = require('../services/product.service');

/**
 * GET /api/admin/overview
 */
const overview = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalUsers,
    totalSellers,
    activeStores,
    suspendedStores,
    totalProducts,
    activeProducts,
    hiddenProducts,
    totalOrders,
    pendingOrders,
    completedOrders,
    openReports,
    hiddenReviews,
    newUsersToday,
    newOrdersToday,
    monthlyOrders,
    topStores,
    topProducts,
  ] = await Promise.all([
    User.countDocuments({ role: 'seller' }),
    User.countDocuments({ role: 'seller' }),
    Store.countDocuments({ status: 'active' }),
    Store.countDocuments({ status: { $in: ['suspended', 'hidden'] } }),
    Product.countDocuments({}),
    Product.countDocuments({ status: 'active' }),
    Product.countDocuments({ status: 'hidden' }),
    Order.countDocuments({}),
    Order.countDocuments({ status: 'pending' }),
    Order.countDocuments({ status: 'completed' }),
    ReviewReport.countDocuments({ status: 'open' }),
    Review.countDocuments({ status: 'hidden' }),
    User.countDocuments({ role: 'seller', createdAt: { $gte: startOfDay } }),
    Order.countDocuments({ createdAt: { $gte: startOfDay } }),
    // Grafik 6 bulan terakhir: jumlah pesanan per bulan
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
        },
      },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
          value: { $sum: '$subtotal' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    Store.find({ status: 'active' }).sort({ totalSold: -1 }).limit(5).select('name slug totalSold ratingAvg').lean(),
    Product.find({ status: 'active' }).sort({ soldCount: -1 }).limit(5).select('name slug soldCount ratingAvg').lean(),
  ]);

  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('id-ID', { month: 'short' }),
      count: 0,
      value: 0,
    });
  }
  monthlyOrders.forEach((row) => {
    const key = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;
    const target = months.find((m) => m.key === key);
    if (target) {
      target.count = row.count;
      target.value = row.value;
    }
  });

  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        sellers: totalSellers,
        superadmins: await User.countDocuments({ role: 'superadmin' }),
        newToday: newUsersToday,
      },
      stores: { total: activeStores + suspendedStores, active: activeStores, suspended: suspendedStores },
      products: { total: totalProducts, active: activeProducts, hidden: hiddenProducts },
      orders: { total: totalOrders, pending: pendingOrders, completed: completedOrders, newToday: newOrdersToday },
      moderation: { openReports, hiddenReviews },
      monthlyOrders: months,
      topStores,
      topProducts,
      periodStart: startOfMonth,
    },
  });
});

/**
 * GET /api/admin/users
 */
const listUsers = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const filter = {};

  if (query.role && query.role !== 'all') filter.role = query.role;
  if (query.status && query.status !== 'all') filter.status = query.status;
  if (query.q) {
    const safe = escapeRegex(query.q);
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { whatsapp: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
    ];
  }

  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);

  const [items, total] = await Promise.all([
    User.find(filter)
      .select('-passwordHash -resetTokenHash -resetTokenExpires')
      .populate('storeId', 'name slug status ratingAvg ratingCount productCount')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } },
  });
});

/**
 * GET /api/admin/users/:id
 */
const getUser = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const user = await User.findById(id)
    .select('-passwordHash -resetTokenHash -resetTokenExpires')
    .populate('storeId')
    .lean();

  if (!user) throw AppError.notFound('Pengguna tidak ditemukan.');

  const [productCount, orderCount, transactionCount] = await Promise.all([
    Product.countDocuments({ storeId: user.storeId }),
    Order.countDocuments({ storeId: user.storeId }),
    Transaction.countDocuments({ storeId: user.storeId, deletedAt: null }),
  ]);

  res.json({ success: true, data: { user, stats: { productCount, orderCount, transactionCount } } });
});

/**
 * PATCH /api/admin/users/:id/status
 */
const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const { status, reason } = req.body;

  const user = await User.findById(id);
  if (!user) throw AppError.notFound('Pengguna tidak ditemukan.');

  if (user.role === 'superadmin' && status !== 'active') {
    throw AppError.forbidden('Akun super admin tidak dapat dinonaktifkan dari sini.');
  }

  user.status = status;
  user.statusReason = reason;
  await user.save();

  // Toko ikut dinonaktifkan agar pembeli tidak bisa memesan ke toko yang bermasalah.
  if (user.storeId) {
    await Store.updateOne(
      { _id: user.storeId },
      { $set: { status: status === 'active' ? 'active' : 'suspended', statusReason: reason } }
    );
  }

  await logActivity(req, 'admin.user_status', {
    entityType: 'user',
    entityId: id,
    meta: { status, reason },
  });

  res.json({ success: true, message: `Status akun diubah menjadi ${status}.`, data: { user } });
});

/**
 * POST /api/admin/users/:id/reset-token
 * Admin menerbitkan token reset password (dikirim manual lewat WhatsApp).
 */
const issueResetToken = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const result = await authService.issueResetToken({ userId: id });

  await logActivity(req, 'admin.issue_reset_token', {
    entityType: 'user',
    entityId: id,
    meta: { expiresAt: result.expiresAt },
  });

  res.json({
    success: true,
    message: 'Token reset dibuat. Beri tahu seller lewat WhatsApp (token berlaku 30 menit).',
    data: { token: result.token, expiresAt: result.expiresAt, user: result.user },
  });
});

/**
 * GET /api/admin/stores
 */
const listStores = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const filter = {};

  if (query.status && query.status !== 'all') filter.status = query.status;
  if (query.q) {
    const safe = escapeRegex(query.q);
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { slug: { $regex: safe, $options: 'i' } },
    ];
  }

  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);

  const [items, total] = await Promise.all([
    Store.find(filter).populate('ownerId', 'name whatsapp status').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Store.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } },
  });
});

/**
 * PATCH /api/admin/stores/:id/status
 */
const updateStoreStatus = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const { status, reason } = req.body;

  const store = await Store.findById(id);
  if (!store) throw AppError.notFound('Toko tidak ditemukan.');

  store.status = status;
  store.statusReason = reason;
  await store.save();

  // Akun pemiliknya ikut dinonaktifkan supaya tidak bisa lagi berjualan.
  await User.updateOne({ _id: store.ownerId }, { $set: { status: status === 'active' ? 'active' : 'suspended' } });

  await logActivity(req, 'admin.store_status', {
    entityType: 'store',
    entityId: id,
    meta: { status, reason },
  });

  res.json({ success: true, message: `Status toko diubah menjadi ${status}.`, data: { store } });
});

/**
 * GET /api/admin/products
 */
const listProducts = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const filter = {};

  if (query.status && query.status !== 'all') filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.q) {
    filter.name = { $regex: escapeRegex(query.q), $options: 'i' };
  }

  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('storeId', 'name slug')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } },
  });
});

/**
 * PATCH /api/admin/products/:id/status
 */
const updateProductStatus = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const { status, reason } = req.body;

  const product = await Product.findById(id);
  if (!product) throw AppError.notFound('Produk tidak ditemukan.');

  product.status = status;
  product.hiddenReason = status === 'hidden' ? reason : null;
  product.hiddenBy = status === 'hidden' ? req.user._id : null;
  await product.save();

  await logActivity(req, 'admin.product_status', {
    entityType: 'product',
    entityId: id,
    meta: { status, reason },
  });

  res.json({ success: true, message: `Status produk diubah menjadi ${status}.`, data: { product } });
});

/**
 * GET /api/admin/categories
 */
const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ order: 1, name: 1 }).lean();
  res.json({ success: true, data: { items: categories } });
});

/**
 * POST /api/admin/categories
 */
const createCategory = asyncHandler(async (req, res) => {
  const { name, icon, description, order, isActive } = req.body;

  let slug = slugify(name);
  if (await Category.exists({ slug })) slug = `${slug}-${randomSuffix(3)}`;

  const category = await Category.create({ name, slug, icon, description, order, isActive });

  await logActivity(req, 'admin.category_create', { entityType: 'category', entityId: category._id });

  res.status(201).json({ success: true, message: 'Kategori berhasil ditambahkan.', data: { category } });
});

/**
 * PATCH /api/admin/categories/:id
 */
const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const patch = { ...req.body };

  if (patch.name) {
    patch.slug = slugify(patch.name);
    const taken = await Category.exists({ slug: patch.slug, _id: { $ne: id } });
    if (taken) patch.slug = `${patch.slug}-${randomSuffix(3)}`;
  }

  const category = await Category.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true }).lean();
  if (!category) throw AppError.notFound('Kategori tidak ditemukan.');

  await logActivity(req, 'admin.category_update', { entityType: 'category', entityId: id });

  res.json({ success: true, message: 'Kategori diperbarui.', data: { category } });
});

/**
 * DELETE /api/admin/categories/:id
 */
const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;

  const used = await Product.countDocuments({ category: id });
  if (used > 0) {
    throw AppError.conflict(
      `Kategori masih dipakai ${used} produk. Nonaktifkan kategori daripada menghapusnya.`
    );
  }

  const deleted = await Category.findByIdAndDelete(id);
  if (!deleted) throw AppError.notFound('Kategori tidak ditemukan.');

  await logActivity(req, 'admin.category_delete', { entityType: 'category', entityId: id });

  res.json({ success: true, message: 'Kategori dihapus.', data: { deleted: true } });
});

/**
 * GET /api/admin/reviews
 */
const listReviews = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const filter = {};

  if (query.status && query.status !== 'all') filter.status = query.status;
  if (query.rating) filter.rating = Number(query.rating);

  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);

  const [items, total] = await Promise.all([
    Review.find(filter)
      .populate('productId', 'name slug')
      .populate('buyerId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } },
  });
});

/**
 * PATCH /api/admin/reviews/:id  (sembunyikan / tampilkan)
 */
const moderateReview = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const { action, reason } = req.body;

  if (action === 'hide') {
    await reviewService.hideReview({ reviewId: id, adminId: req.user._id, reason });
  } else {
    await Review.updateOne(
      { _id: toObjectId(id) },
      { $set: { status: 'published', moderation: { hiddenBy: null, hiddenAt: null, reason } } }
    );
    const review = await Review.findById(id).lean();
    if (review) {
      await productService.refreshProductRating(review.productId);
      await productService.refreshStoreRating(review.storeId);
    }
  }

  await logActivity(req, 'admin.review_moderation', {
    entityType: 'review',
    entityId: id,
    meta: { action, reason },
  });

  res.json({
    success: true,
    message: action === 'hide' ? 'Ulasan disembunyikan.' : 'Ulasan ditampilkan kembali.',
    data: { updated: true },
  });
});

/**
 * GET /api/admin/reports
 */
const listReports = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const filter = {};

  if (query.status && query.status !== 'all') filter.status = query.status;

  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);

  const [items, total] = await Promise.all([
    ReviewReport.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ReviewReport.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } },
  });
});

/**
 * PATCH /api/admin/reports/:id
 */
const resolveReport = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const { status, resolutionNote } = req.body;

  const report = await ReviewReport.findByIdAndUpdate(
    id,
    { $set: { status, resolutionNote, handledBy: req.user._id, handledAt: new Date() } },
    { new: true }
  ).lean();

  if (!report) throw AppError.notFound('Laporan tidak ditemukan.');

  await logActivity(req, 'admin.report_resolved', {
    entityType: 'report',
    entityId: id,
    meta: { status },
  });

  res.json({ success: true, message: 'Laporan diperbarui.', data: { report } });
});

/**
 * GET /api/admin/orders
 */
const listOrders = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const filter = {};

  if (query.status && query.status !== 'all') filter.status = query.status;

  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);

  const [items, total] = await Promise.all([
    Order.find(filter)
      .populate('productId', 'name slug price')
      .populate('storeId', 'name slug')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } },
  });
});

/**
 * GET /api/admin/logs
 */
const listLogs = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const page = query.page || 1;
  const limit = Math.min(query.limit || 30, 100);

  const [items, total] = await Promise.all([
    ActivityLog.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments({}),
  ]);

  res.json({
    success: true,
    data: { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } },
  });
});

/**
 * GET /api/admin/settings
 */
const getSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.loadSettings();
  res.json({ success: true, data: { settings } });
});

/**
 * PATCH /api/admin/settings
 */
const updateSettings = asyncHandler(async (req, res) => {
  const entries = Object.entries(req.body);

  // eslint-disable-next-line no-restricted-syntax
  for (const [key, value] of entries) {
    // eslint-disable-next-line no-await-in-loop
    await settingsService.setSetting(key, value, req.user._id);
  }

  await logActivity(req, 'admin.update_settings', { meta: { keys: entries.map(([k]) => k) } });

  const settings = await settingsService.loadSettings();
  res.json({ success: true, message: 'Pengaturan berhasil disimpan.', data: { settings } });
});

module.exports = {
  overview,
  listUsers,
  getUser,
  updateUserStatus,
  issueResetToken,
  listStores,
  updateStoreStatus,
  listProducts,
  updateProductStatus,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listReviews,
  moderateReview,
  listReports,
  resolveReport,
  listOrders,
  listLogs,
  getSettings,
  updateSettings,
};
