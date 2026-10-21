/**
 * Helper pengujian: membuat data contoh langsung di database.
 */
'use strict';

const { User, Store, Product, Category, Order, Review, Transaction } = require('../../src/models');
const { hashPassword } = require('../../src/utils/password');
const { normalizeWhatsapp } = require('../../src/utils/whatsapp');
const { slugify, randomSuffix } = require('../../src/utils/format');

let counter = 0;
function unique(prefix) {
  counter += 1;
  return `${prefix}${Date.now()}${counter}`;
}

async function createSeller({ name = 'Penjual Uji', whatsapp, password = 'Rahasia123', storeName, category = 'makanan-minuman', ...rest } = {}) {
  const number = normalizeWhatsapp(whatsapp || `0812${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`);
  const passwordHash = await hashPassword(password);

  const user = await User.create({
    role: 'seller',
    name,
    whatsapp: number,
    passwordHash,
    status: 'active',
    email: rest.email || null,
  });

  const base = slugify(storeName || `${name} Toko`);
  const store = await Store.create({
    ownerId: user._id,
    name: storeName || `${name} Toko`,
    slug: `${base}-${randomSuffix(4)}`,
    description: rest.description || 'Toko untuk pengujian otomatis.',
    category,
    whatsapp: number,
    location: { address: 'Jl. Uji No. 1', city: 'Bandung', showAddress: true, showExactAddress: false },
    status: 'active',
    ratingAvg: 0,
    ratingCount: 0,
  });

  await User.updateOne({ _id: user._id }, { $set: { storeId: store._id } });

  return { user, store, password, whatsapp: number };
}

async function createAdmin({ name = 'Admin Uji', whatsapp, password = 'Admin12345' } = {}) {
  const number = normalizeWhatsapp(whatsapp || `0813${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`);
  const user = await User.create({
    role: 'superadmin',
    name,
    whatsapp: number,
    passwordHash: await hashPassword(password),
    status: 'active',
  });
  return { user, password, whatsapp: number };
}

async function createBuyer({ name = 'Pembeli Uji', whatsapp, password = 'Pembeli123' } = {}) {
  const number = normalizeWhatsapp(whatsapp || `0814${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`);
  const user = await User.create({
    role: 'seller',
    name,
    whatsapp: number,
    passwordHash: await hashPassword(password),
    status: 'active',
  });
  return { user, password, whatsapp: number };
}

async function createProduct(store, { name = 'Produk Uji', price = 10000, stock = 10, status = 'active', category = 'makanan-minuman', ...rest } = {}) {
  const base = slugify(name);
  const product = await Product.create({
    storeId: store._id,
    sellerId: store.ownerId,
    name,
    slug: `${base}-${randomSuffix(4)}`,
    category,
    price,
    description: rest.description || 'Deskripsi produk untuk pengujian otomatis.',
    stock,
    status,
    images: [],
  });
  return product;
}

async function createCategory(name = 'Kategori Uji') {
  const slug = slugify(name);
  return Category.create({ name, slug: `${slug}-${randomSuffix(3)}`, isActive: true, order: 1 });
}

async function createOrder(product, store, buyer, overrides = {}) {
  return Order.create({
    orderCode: unique('KS-TEST-'),
    productId: product._id,
    storeId: store._id,
    sellerId: store.ownerId,
    buyerId: buyer ? buyer._id : null,
    buyerName: buyer ? buyer.name : 'Pembeli Anonim',
    qty: 1,
    priceSnapshot: product.price,
    productNameSnapshot: product.name,
    subtotal: product.price,
    status: 'pending',
    waMessage: 'pesan uji',
    waLink: 'https://wa.me/628123456789',
    ...overrides,
  });
}

async function createReview(product, store, buyer, { rating = 5, comment = 'Ulasan untuk pengujian otomatis.', status = 'published' } = {}) {
  const order = await createOrder(product, store, buyer, { status: 'completed', completedAt: new Date() });
  const review = await Review.create({
    productId: product._id,
    storeId: store._id,
    sellerId: store.ownerId,
    orderId: order._id,
    buyerId: buyer._id,
    rating,
    comment,
    status,
    isVerifiedPurchase: false,
  });

  // Perbarui cache rating seperti yang dilakukan service di aplikasi.
  // eslint-disable-next-line global-require
  const productService = require('../../src/services/product.service');
  await productService.refreshProductRating(product._id);
  await productService.refreshStoreRating(store._id);

  return { review, order };
}

async function createTransaction(store, sellerId, overrides = {}) {
  return Transaction.create({
    storeId: store._id,
    sellerId,
    type: 'income',
    category: 'penjualan',
    amount: 10000,
    description: 'Transaksi uji',
    date: new Date(),
    source: 'manual',
    ...overrides,
  });
}

module.exports = {
  createSeller,
  createAdmin,
  createBuyer,
  createProduct,
  createCategory,
  createOrder,
  createReview,
  createTransaction,
  unique,
};
