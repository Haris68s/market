/**
 * Test rating & ulasan: validasi, aturan satu ulasan per pesanan, moderasi.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { setupDatabase, teardownDatabase, clearDatabase } = require('./helpers/db');
const { createClient } = require('./helpers/client');
const factory = require('./helpers/factory');

let app;

test.before(async () => {
  await setupDatabase();
  app = require('../src/app');
});

test.after(async () => {
  await teardownDatabase(app);
});

test.beforeEach(async () => {
  await clearDatabase();
});

async function loginClient(user) {
  const client = createClient(app);
  await client.refreshCsrf();
  const res = await client.login(user.whatsapp, user.password);
  assert.equal(res.status, 200);
  return client;
}

test('pembeli bisa mengulas produk dari pesanan yang sudah selesai', async () => {
  const seller = await factory.createSeller({ whatsapp: '081700000001' });
  const buyer = await factory.createBuyer({ whatsapp: '081800000001' });
  const product = await factory.createProduct(seller.store);
  const order = await factory.createOrder(product, seller.store, buyer.user, {
    status: 'completed',
    completedAt: new Date(),
  });

  const client = await loginClient(buyer);
  const res = await client.post('/api/reviews', {
    productId: product._id,
    orderId: order._id,
    rating: 5,
    comment: 'Enak banget, Recommended!',
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.review.rating, 5);
  // Fitur "terverifikasi" dihapus: tidak ada lagi penanda di respons API.
  assert.equal(res.body.data.review.isVerifiedPurchase, undefined);
});

test('ulasan ditolak bila pesanan belum selesai', async () => {
  const seller = await factory.createSeller({ whatsapp: '081700000002' });
  const buyer = await factory.createBuyer({ whatsapp: '081800000002' });
  const product = await factory.createProduct(seller.store);
  const order = await factory.createOrder(product, seller.store, buyer.user, { status: 'pending' });

  const client = await loginClient(buyer);
  const res = await client.post('/api/reviews', {
    productId: product._id,
    orderId: order._id,
    rating: 5,
    comment: 'Ulasan terlalu cepat',
  });

  assert.equal(res.status, 400);
  assert.match(res.body.error.message, /selesai/i);
});

test('ulasan ditolak bila pesanan milik orang lain', async () => {
  const seller = await factory.createSeller({ whatsapp: '081700000003' });
  const buyer = await factory.createBuyer({ whatsapp: '081800000003' });
  const other = await factory.createBuyer({ whatsapp: '081800000004' });
  const product = await factory.createProduct(seller.store);
  const order = await factory.createOrder(product, seller.store, other.user, { status: 'completed' });

  const client = await loginClient(buyer);
  const res = await client.post('/api/reviews', {
    productId: product._id,
    orderId: order._id,
    rating: 1,
    comment: 'Ulasan ini bukan hak saya',
  });

  assert.equal(res.status, 403);
});

test('satu pembeli tidak bisa mengulas dua kali untuk pesanan yang sama', async () => {
  const seller = await factory.createSeller({ whatsapp: '081700000004' });
  const buyer = await factory.createBuyer({ whatsapp: '081800000005' });
  const product = await factory.createProduct(seller.store);
  const order = await factory.createOrder(product, seller.store, buyer.user, { status: 'completed' });

  const client = await loginClient(buyer);
  const payload = {
    productId: product._id,
    orderId: order._id,
    rating: 5,
    comment: 'Ulasan pertama yang sah',
  };

  const first = await client.post('/api/reviews', payload);
  assert.equal(first.status, 201);

  const second = await client.post('/api/reviews', payload);
  assert.equal(second.status, 409);
});

test('rating di luar rentang 1-5 ditolak backend', async () => {
  const seller = await factory.createSeller({ whatsapp: '081700000005' });
  const buyer = await factory.createBuyer({ whatsapp: '081800000006' });
  const product = await factory.createProduct(seller.store);
  const order = await factory.createOrder(product, seller.store, buyer.user, { status: 'completed' });

  const client = await loginClient(buyer);

  const nol = await client.post('/api/reviews', {
    productId: product._id,
    orderId: order._id,
    rating: 0,
    comment: 'Ratingnya nol',
  });
  assert.equal(nol.status, 400);

  const enam = await client.post('/api/reviews', {
    productId: product._id,
    orderId: order._id,
    rating: 6,
    comment: 'Ratingnya lebih dari lima',
  });
  assert.equal(enam.status, 400);
});

test('komentar terlalu pendek ditolak', async () => {
  const seller = await factory.createSeller({ whatsapp: '081700000006' });
  const buyer = await factory.createBuyer({ whatsapp: '081800000007' });
  const product = await factory.createProduct(seller.store);
  const order = await factory.createOrder(product, seller.store, buyer.user, { status: 'completed' });

  const client = await loginClient(buyer);
  const res = await client.post('/api/reviews', {
    productId: product._id,
    orderId: order._id,
    rating: 5,
    comment: 'ok',
  });

  assert.equal(res.status, 400);
});

test('ulasan tanpa login ditolak', async () => {
  const seller = await factory.createSeller({ whatsapp: '081700000007' });
  const product = await factory.createProduct(seller.store);

  const client = createClient(app);
  await client.refreshCsrf();
  const res = await client.post('/api/reviews', {
    productId: product._id,
    orderId: product._id,
    rating: 5,
    comment: 'Ulasan tanpa login',
  });

  assert.equal(res.status, 401);
});

test('rating rata-rata produk dihitung dari ulasan yang valid saja', async () => {
  const seller = await factory.createSeller({ whatsapp: '081700000008' });
  const product = await factory.createProduct(seller.store);

  const buyer1 = await factory.createBuyer({ whatsapp: '081800000008' });
  const buyer2 = await factory.createBuyer({ whatsapp: '081800000009' });
  const buyer3 = await factory.createBuyer({ whatsapp: '081800000010' });

  await factory.createReview(product, seller.store, buyer1.user, { rating: 5 });
  await factory.createReview(product, seller.store, buyer2.user, { rating: 4 });
  await factory.createReview(product, seller.store, buyer3.user, { rating: 3 });

  const client = createClient(app);
  await client.refreshCsrf();
  const res = await client.get(`/api/products/${product.slug}`);

  assert.equal(res.body.data.product.ratingAvg, 4);
  assert.equal(res.body.data.product.ratingCount, 3);
});

test('ulasan yang disembunyikan admin tidak ikut dihitung rating', async () => {
  const seller = await factory.createSeller({ whatsapp: '081700000009' });
  const product = await factory.createProduct(seller.store);
  const buyer = await factory.createBuyer({ whatsapp: '081800000011' });

  const { review } = await factory.createReview(product, seller.store, buyer.user, { rating: 1 });
  await factory.createReview(product, seller.store, buyer.user, { rating: 5 });

  const admin = await factory.createAdmin({ whatsapp: '081900000001' });
  const adminClient = await loginClient(admin);
  const hide = await adminClient.patch(`/api/admin/reviews/${review._id}`, {
    action: 'hide',
    reason: 'Ulasan tidak pantas (kata kasar).',
  });
  assert.equal(hide.status, 200);

  const client = createClient(app);
  await client.refreshCsrf();
  const res = await client.get(`/api/products/${product.slug}`);

  assert.equal(res.body.data.product.ratingCount, 1);
  assert.equal(res.body.data.product.ratingAvg, 5);
});

test('admin wajib menyertakan alasan saat menyembunyikan ulasan', async () => {
  const seller = await factory.createSeller({ whatsapp: '081700000010' });
  const product = await factory.createProduct(seller.store);
  const buyer = await factory.createBuyer({ whatsapp: '081800000012' });
  const { review } = await factory.createReview(product, seller.store, buyer.user);

  const admin = await factory.createAdmin({ whatsapp: '081900000002' });
  const adminClient = await loginClient(admin);

  const res = await adminClient.patch(`/api/admin/reviews/${review._id}`, { action: 'hide', reason: '' });
  assert.equal(res.status, 400);
});

test('ulasan tidak bisa dibuat bila tidak ada pesanan (orderId acak)', async () => {
  const seller = await factory.createSeller({ whatsapp: '081700000011' });
  const buyer = await factory.createBuyer({ whatsapp: '081800000013' });
  const product = await factory.createProduct(seller.store);

  const client = await loginClient(buyer);
  const res = await client.post('/api/reviews', {
    productId: product._id,
    orderId: '000000000000000000000000',
    rating: 5,
    comment: 'Ulasan tanpa pesanan',
  });

  assert.equal(res.status, 403);
});
