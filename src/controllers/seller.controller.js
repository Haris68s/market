/**
 * Controller dashboard penjual: produk, statistik, keuangan, profil toko.
 */
'use strict';

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { Product, Order, Transaction, Store, Review } = require('../models');
const productService = require('../services/product.service');
const financeService = require('../services/finance.service');
const storeService = require('../services/store.service');
const imageService = require('../services/image.service');
const { logActivity } = require('../services/activity.service');
const { getQuery } = require('../middleware/validate');
const { toObjectId } = require('../services/product.service');
const { toCsv } = require('../utils/csv');
const { normalizeWhatsapp } = require('../utils/whatsapp');
const appConfig = require('../config/app.config');

/* ----------------------------- PRODUK ----------------------------- */

/**
 * GET /api/seller/products
 */
const listProducts = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const result = await productService.listStoreProducts(req.user.storeId, query);

  // Statistik produk terlaris untuk seller.
  const topProducts = await Product.find({ storeId: req.user.storeId, status: 'active' })
    .sort({ soldCount: -1, orderCount: -1 })
    .limit(5)
    .select('name slug price soldCount orderCount stock')
    .lean();

  res.json({
    success: true,
    data: { items: result.items, pagination: result.pagination, topProducts },
  });
});

/**
 * POST /api/seller/products
 */
const createProduct = asyncHandler(async (req, res) => {
  const { name, category, price, description, stock, status } = req.body;

  const slug = await productService.generateProductSlug(name);

  const product = await Product.create({
    storeId: req.user.storeId,
    sellerId: req.user._id,
    name,
    slug,
    category,
    price,
    description,
    stock,
    status,
    images: [],
  });

  await storeService.refreshStoreSummary(req.user.storeId);
  await logActivity(req, 'product.create', { entityType: 'product', entityId: product._id });

  res.status(201).json({ success: true, message: 'Produk berhasil dibuat.', data: { product } });
});

/**
 * GET /api/seller/products/:id
 */
const getProduct = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const product = await productService.assertProductOwnership(id, req.user.storeId);
  res.json({ success: true, data: { product } });
});

/**
 * PATCH /api/seller/products/:id
 */
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  await productService.assertProductOwnership(id, req.user.storeId);

  const patch = {};
  const { name, category, price, description, stock, status } = req.body;

  if (name !== undefined) {
    patch.name = name;
    patch.slug = await productService.generateProductSlug(name);
  }
  if (category !== undefined) patch.category = category;
  if (price !== undefined) patch.price = price;
  if (description !== undefined) patch.description = description;
  if (stock !== undefined) patch.stock = stock;
  if (status !== undefined) patch.status = status;

  const product = await Product.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true }).lean();

  await storeService.refreshStoreSummary(req.user.storeId);
  await logActivity(req, 'product.update', { entityType: 'product', entityId: id });

  res.json({ success: true, message: 'Produk berhasil diperbarui.', data: { product } });
});

/**
 * DELETE /api/seller/products/:id
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const product = await productService.assertProductOwnership(id, req.user.storeId);

  // Hapus gambar dari layanan penyimpanan.
  // eslint-disable-next-line no-restricted-syntax
  for (const image of product.images || []) {
    // eslint-disable-next-line no-await-in-loop
    await imageService.deleteImage(image);
  }

  // Produk yang punya pesanan tidak dihapus permanen, disembunyikan saja
  // supaya riwayat pesanan tetap utuh.
  const orderCount = await Order.countDocuments({ productId: product._id });
  if (orderCount > 0) {
    await Product.updateOne({ _id: product._id }, { $set: { status: 'hidden', hiddenReason: 'Dihapus penjual' } });
    await storeService.refreshStoreSummary(req.user.storeId);
    await logActivity(req, 'product.hide', { entityType: 'product', entityId: id });
    return res.json({
      success: true,
      message: 'Produk disembunyikan (karena punya riwayat pesanan). Data pesanan tetap tersimpan.',
      data: { hidden: true },
    });
  }

  await Product.deleteOne({ _id: product._id });
  await storeService.refreshStoreSummary(req.user.storeId);
  await logActivity(req, 'product.delete', { entityType: 'product', entityId: id });

  return res.json({ success: true, message: 'Produk berhasil dihapus.', data: { deleted: true } });
});

/**
 * POST /api/seller/products/:id/images  (unggah gambar)
 */
const uploadProductImage = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const product = await productService.assertProductOwnership(id, req.user.storeId);

  if (!req.file) {
    throw AppError.badRequest('Tidak ada file gambar yang diterima.');
  }
  if ((product.images || []).length >= appConfig.uploads.maxImagesPerProduct) {
    throw AppError.badRequest(
      `Maksimal ${appConfig.uploads.maxImagesPerProduct} gambar per produk. Hapus gambar lama terlebih dahulu.`
    );
  }

  const uploaded = await imageService.uploadImage(req.file.buffer, {
    folder: 'products',
    mimeType: req.file.mimetype,
    alt: product.name,
  });

  product.images.push(uploaded);
  await product.save();

  await logActivity(req, 'product.upload_image', { entityType: 'product', entityId: id });

  res.status(201).json({
    success: true,
    message: 'Gambar berhasil diunggah.',
    data: { image: uploaded, total: product.images.length },
  });
});

/**
 * DELETE /api/seller/products/:id/images/:imageId
 */
const deleteProductImage = asyncHandler(async (req, res) => {
  const { id, imageId } = req.validatedParams || req.params;
  const product = await productService.assertProductOwnership(id, req.user.storeId);

  const index = (product.images || []).findIndex((img) => String(img._id) === imageId);
  if (index === -1) {
    throw AppError.notFound('Gambar tidak ditemukan.');
  }

  const [removed] = product.images.splice(index, 1);
  await imageService.deleteImage(removed);
  await product.save();

  await logActivity(req, 'product.delete_image', { entityType: 'product', entityId: id });

  res.json({ success: true, message: 'Gambar dihapus.', data: { product } });
});

/* ---------------------------- DASHBOARD ---------------------------- */

/**
 * GET /api/seller/dashboard
 */
const dashboard = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const { start, end } = financeService.getPeriodRange(query.period, query.from, query.to);

  const storeId = req.user.storeId;
  const orderMatch = { storeId, ...(start ? { createdAt: { $gte: start, $lte: end } } : {}) };

  const [productStats, orderStats, finance, store, recentOrders, lowStock] = await Promise.all([
    Product.aggregate([
      { $match: { storeId: toObjectId(storeId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { ...orderMatch, storeId: toObjectId(storeId) } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$subtotal' } } },
    ]),
    financeService.summarize({ storeId, from: start, to: end }),
    Store.findById(storeId).lean(),
    Order.find({ storeId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Product.find({ storeId, status: 'active', stock: { $lte: 3 } })
      .sort({ stock: 1 })
      .limit(5)
      .select('name slug stock')
      .lean(),
  ]);

  const productSummary = { active: 0, draft: 0, out_of_stock: 0, hidden: 0, total: 0 };
  productStats.forEach((row) => {
    if (productSummary[row._id] !== undefined) productSummary[row._id] = row.count;
    productSummary.total += row.count;
  });

  const orderSummary = { pending: 0, confirmed: 0, completed: 0, cancelled: 0, total: 0 };
  orderStats.forEach((row) => {
    if (orderSummary[row._id] !== undefined) orderSummary[row._id] = row.count;
    orderSummary.total += row.count;
  });

  res.json({
    success: true,
    data: {
      period: { start, end, label: query.period },
      products: productSummary,
      orders: orderSummary,
      finance: {
        income: finance.income,
        expense: finance.expense,
        net: finance.net,
        note: finance.note,
      },
      rating: { average: store ? store.ratingAvg : 0, count: store ? store.ratingCount : 0 },
      store: store ? { name: store.name, slug: store.slug, status: store.status } : null,
      recentOrders,
      lowStock,
    },
  });
});

/* ----------------------------- KEUANGAN ----------------------------- */

/**
 * GET /api/seller/transactions
 */
const listTransactions = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const result = await financeService.listTransactions({
    storeId: req.user.storeId,
    type: query.type,
    category: query.category,
    from: query.from,
    to: query.to,
    page: query.page,
    limit: query.limit,
  });

  res.json({ success: true, data: result });
});

/**
 * POST /api/seller/transactions
 */
const createTransaction = asyncHandler(async (req, res) => {
  const transaction = await financeService.createTransaction({
    storeId: req.user.storeId,
    sellerId: req.user._id,
    ...req.body,
  });

  await logActivity(req, 'transaction.create', {
    entityType: 'transaction',
    entityId: transaction._id,
    meta: { type: transaction.type, amount: transaction.amount },
  });

  res.status(201).json({
    success: true,
    message: 'Transaksi berhasil dicatat.',
    data: { transaction },
  });
});

/**
 * PATCH /api/seller/transactions/:id
 */
const updateTransaction = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const transaction = await financeService.updateTransaction({
    transactionId: id,
    storeId: req.user.storeId,
    ...req.body,
  });

  await logActivity(req, 'transaction.update', { entityType: 'transaction', entityId: id });

  res.json({ success: true, message: 'Transaksi berhasil diperbarui.', data: { transaction } });
});

/**
 * DELETE /api/seller/transactions/:id
 */
const deleteTransaction = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const transaction = await financeService.deleteTransaction({
    transactionId: id,
    storeId: req.user.storeId,
  });

  await logActivity(req, 'transaction.delete', { entityType: 'transaction', entityId: id });

  res.json({ success: true, message: 'Transaksi dihapus.', data: { transaction } });
});

/**
 * GET /api/seller/transactions/summary
 */
const financeSummary = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const { start, end } = financeService.getPeriodRange(query.period, query.from, query.to);
  const summary = await financeService.summarize({
    storeId: req.user.storeId,
    from: start,
    to: end,
  });

  res.json({ success: true, data: { ...summary, period: { start, end, label: query.period } } });
});

/**
 * GET /api/seller/transactions/export  (CSV)
 */
const exportTransactions = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const { start, end } = financeService.getPeriodRange(query.period, query.from, query.to);

  const result = await financeService.listTransactions({
    storeId: req.user.storeId,
    type: query.type,
    category: query.category,
    from: start,
    to: end,
    page: 1,
    limit: 1000,
  });

  const csv = toCsv(result.items, [
    { key: 'date', label: 'Tanggal', format: (v) => new Date(v).toISOString().slice(0, 10) },
    { key: 'type', label: 'Jenis' },
    { key: 'category', label: 'Kategori' },
    { key: 'amount', label: 'Nominal' },
    { key: 'description', label: 'Deskripsi' },
    { key: 'source', label: 'Sumber' },
  ]);

  await logActivity(req, 'transaction.export', { meta: { rows: result.items.length } });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="transaksi-${Date.now()}.csv"`);
  res.send(`\uFEFF${csv}`); // BOM agar Excel membaca karakter Indonesia dengan benar
});

/* ------------------------------ PROFIL ------------------------------ */

/**
 * GET /api/seller/profile
 */
const getProfile = asyncHandler(async (req, res) => {
  const store = await Store.findById(req.user.storeId).lean();
  if (!store) throw AppError.notFound('Toko tidak ditemukan.');

  const reviewCount = await Review.countDocuments({ storeId: req.user.storeId, status: 'published' });

  res.json({
    success: true,
    data: {
      store: {
        ...store,
        whatsappDisplay: store.whatsapp,
      },
      rating: { average: store.ratingAvg, count: store.ratingCount, published: reviewCount },
    },
  });
});

/**
 * PATCH /api/seller/profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  if (payload.whatsapp) {
    payload.whatsapp = normalizeWhatsapp(payload.whatsapp);
  }

  const store = await storeService.updateStoreProfile({
    storeId: req.user.storeId,
    sellerId: req.user._id,
    payload,
  });

  await logActivity(req, 'store.update_profile', { entityType: 'store', entityId: store._id });

  res.json({ success: true, message: 'Profil toko berhasil diperbarui.', data: { store } });
});

module.exports = {
  listProducts,
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  deleteProductImage,
  dashboard,
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  financeSummary,
  exportTransactions,
  getProfile,
  updateProfile,
};
