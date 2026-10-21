/**
 * Test pemesanan via WhatsApp & manajemen status pesanan.
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

async function loginSeller(seller) {
  const client = createClient(app);
  await client.refreshCsrf();
  const res = await client.login(seller.whatsapp, seller.password);
  assert.equal(res.status, 200);
  return client;
}

test('pembeli membuat pesanan dan mendapatkan kode + tautan WhatsApp', async () => {
  const seller = await factory.createSeller({ whatsapp: '081300000001' });
  const product = await factory.createProduct(seller.store, { name: 'Kopi Susu', price: 12000 });

  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.post('/api/orders', {
    productId: product._id,
    qty: 2,
    buyerName: 'Rina',
    buyerContact: '081500000001',
  });

  assert.equal(res.status, 201);
  assert.ok(res.body.data.order.orderCode.startsWith('KS-'));
  assert.equal(res.body.data.order.price, 12000);
  assert.equal(res.body.data.order.subtotal, 24000);
  // Status awal harus "menunggu konfirmasi", bukan "berhasil"
  assert.equal(res.body.data.order.status, 'pending');
  assert.match(res.body.data.waLink, /^https:\/\/wa\.me\/62\d+\?text=/);
  assert.match(res.body.data.waMessage, /Kopi Susu/);
  assert.match(res.body.data.waMessage, /KS-/);
  assert.match(res.body.data.notice, /belum berarti pesanan terkonfirmasi/i);
});

test('pesan WhatsApp memuat nama produk, harga, jumlah, dan kode pesanan', async () => {
  const seller = await factory.createSeller({ whatsapp: '081300000002' });
  const product = await factory.createProduct(seller.store, { name: 'Roti Bakar', price: 8000 });

  const client = createClient(app);
  await client.refreshCsrf();
  const res = await client.post('/api/orders', { productId: product._id, qty: 3 });

  const message = decodeURIComponent(res.body.data.waMessage);
  assert.match(message, /Roti Bakar/);
  assert.match(message, /8\.000/);
  assert.match(message, /Jumlah: 3/);
  assert.match(message, /Kode pesanan:/);
});

test('harga di snapshot tidak berubah ketika harga produk diubah', async () => {
  const seller = await factory.createSeller({ whatsapp: '081300000003' });
  const product = await factory.createProduct(seller.store, { name: 'Kopi Susu', price: 12000 });

  const client = createClient(app);
  await client.refreshCsrf();
  const order = await client.post('/api/orders', { productId: product._id, qty: 1 });
  const orderId = order.body.data.order.id;

  // Penjual menaikkan harga produk
  const sellerClient = await loginSeller(seller);
  await sellerClient.patch(`/api/seller/products/${product._id}`, { price: 20000 });

  const detail = await sellerClient.get(`/api/seller/orders/${orderId}`);
  assert.equal(detail.body.data.order.priceSnapshot, 12000);
  assert.equal(detail.body.data.order.subtotal, 12000);
});

test('pesanan produk draft ditolak', async () => {
  const seller = await factory.createSeller({ whatsapp: '081300000004' });
  const product = await factory.createProduct(seller.store, { status: 'draft' });

  const client = createClient(app);
  await client.refreshCsrf();
  const res = await client.post('/api/orders', { productId: product._id, qty: 1 });

  assert.equal(res.status, 400);
});

test('jumlah pesanan tidak valid ditolak', async () => {
  const seller = await factory.createSeller({ whatsapp: '081300000005' });
  const product = await factory.createProduct(seller.store);

  const client = createClient(app);
  await client.refreshCsrf();

  const nol = await client.post('/api/orders', { productId: product._id, qty: 0 });
  assert.equal(nol.status, 400);

  const bukanAngka = await client.post('/api/orders', { productId: product._id, qty: 'abc' });
  assert.equal(bukanAngka.status, 400);
});

test('stok habis tetap bisa dipesan tetapi ada peringatan', async () => {
  const seller = await factory.createSeller({ whatsapp: '081300000006' });
  const product = await factory.createProduct(seller.store, { stock: 0 });

  const client = createClient(app);
  await client.refreshCsrf();
  const res = await client.post('/api/orders', { productId: product._id, qty: 1 });

  assert.equal(res.status, 201);
  assert.ok(res.body.data.stockWarning);
});

test('penjual bisa mengubah status pesanan: pending -> confirmed -> completed', async () => {
  const seller = await factory.createSeller({ whatsapp: '081300000007' });
  const buyer = await factory.createBuyer({ whatsapp: '081600000001' });
  const product = await factory.createProduct(seller.store);
  const order = await factory.createOrder(product, seller.store, buyer.user);

  const client = await loginSeller(seller);

  const confirmed = await client.patch(`/api/seller/orders/${order._id}/status`, { status: 'confirmed' });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.data.order.status, 'confirmed');

  const completed = await client.patch(`/api/seller/orders/${order._id}/status`, { status: 'completed' });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.data.order.status, 'completed');
});

test('transisi status yang tidak diperbolehkan ditolak', async () => {
  const seller = await factory.createSeller({ whatsapp: '081300000008' });
  const buyer = await factory.createBuyer({ whatsapp: '081600000002' });
  const product = await factory.createProduct(seller.store);
  const order = await factory.createOrder(product, seller.store, buyer.user, { status: 'completed' });

  const client = await loginSeller(seller);
  const res = await client.patch(`/api/seller/orders/${order._id}/status`, { status: 'confirmed' });

  assert.equal(res.status, 400);
  assert.match(res.body.error.message, /tidak dapat diubah/i);
});

test('penjual tidak bisa mengubah pesanan toko lain', async () => {
  const sellerA = await factory.createSeller({ whatsapp: '081300000009' });
  const sellerB = await factory.createSeller({ whatsapp: '081300000010' });
  const buyer = await factory.createBuyer({ whatsapp: '081600000003' });
  const product = await factory.createProduct(sellerA.store);
  const order = await factory.createOrder(product, sellerA.store, buyer.user);

  const clientB = await loginSeller(sellerB);
  const res = await clientB.patch(`/api/seller/orders/${order._id}/status`, { status: 'confirmed' });

  assert.equal(res.status, 404);
});

test('pesanan selesai menambah penghitung penjualan (produk terlaris)', async () => {
  const seller = await factory.createSeller({ whatsapp: '081300000011' });
  const buyer = await factory.createBuyer({ whatsapp: '081600000004' });
  const product = await factory.createProduct(seller.store);
  const order = await factory.createOrder(product, seller.store, buyer.user);

  const client = await loginSeller(seller);
  await client.patch(`/api/seller/orders/${order._id}/status`, { status: 'confirmed' });
  await client.patch(`/api/seller/orders/${order._id}/status`, { status: 'completed' });

  const list = await client.get('/api/seller/products');
  const found = list.body.data.items.find((p) => String(p._id) === String(product._id));
  assert.equal(found.soldCount, 1);

  // Toko punya produk "terlaris" berdasarkan pesanan selesai
  const featured = await createClient(app).get('/api/products/featured');
  const popularIds = featured.body.data.popular.map((p) => String(p._id));
  assert.ok(popularIds.includes(String(product._id)));
});

test('pemasukan dari pesanan hanya bisa dicatat sekali', async () => {
  const seller = await factory.createSeller({ whatsapp: '081300000012' });
  const buyer = await factory.createBuyer({ whatsapp: '081600000005' });
  const product = await factory.createProduct(seller.store, { price: 15000 });
  const order = await factory.createOrder(product, seller.store, buyer.user);

  const client = await loginSeller(seller);
  await client.patch(`/api/seller/orders/${order._id}/status`, { status: 'confirmed' });

  const first = await client.post(`/api/seller/orders/${order._id}/record-income`, {});
  assert.equal(first.status, 201);
  assert.equal(first.body.data.transaction.amount, 15000);

  const second = await client.post(`/api/seller/orders/${order._id}/record-income`, {});
  assert.equal(second.status, 409);
  assert.match(second.body.error.message, /sudah pernah dicatat/i);
});

test('pemasukan dari pesanan yang belum dikonfirmasi ditolak', async () => {
  const seller = await factory.createSeller({ whatsapp: '081300000013' });
  const buyer = await factory.createBuyer({ whatsapp: '081600000006' });
  const product = await factory.createProduct(seller.store);
  const order = await factory.createOrder(product, seller.store, buyer.user);

  const client = await loginSeller(seller);
  const res = await client.post(`/api/seller/orders/${order._id}/record-income`, {});

  assert.equal(res.status, 400);
});

test('pesanan baru tidak otomatis masuk sebagai pemasukan', async () => {
  const seller = await factory.createSeller({ whatsapp: '081300000014' });
  const buyer = await factory.createBuyer({ whatsapp: '081600000007' });
  const product = await factory.createProduct(seller.store, { price: 20000 });
  await factory.createOrder(product, seller.store, buyer.user);

  const client = await loginSeller(seller);
  const summary = await client.get('/api/seller/transactions/summary?period=all');

  assert.equal(summary.body.data.income, 0);
});
