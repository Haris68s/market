/**
 * Test keuangan: pencatatan pemasukan/pengeluaran, ringkasan, dan ekspor CSV.
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

test('penjual bisa mencatat pemasukan manual', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200100001' });
  const client = await loginSeller(seller);

  const res = await client.post('/api/seller/transactions', {
    type: 'income',
    category: 'penjualan',
    amount: 50000,
    description: 'Penjualan di kantin',
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.transaction.amount, 50000);
  assert.equal(res.body.data.transaction.source, 'manual');
});

test('penjual bisa mencatat pengeluaran manual', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200100002' });
  const client = await loginSeller(seller);

  const res = await client.post('/api/seller/transactions', {
    type: 'expense',
    category: 'kemasan',
    amount: 25000,
    description: 'Beli cup & sedotan',
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.transaction.type, 'expense');
});

test('nominal negatif / nol ditolak', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200100003' });
  const client = await loginSeller(seller);

  const res = await client.post('/api/seller/transactions', {
    type: 'income',
    category: 'penjualan',
    amount: -1000,
  });

  assert.equal(res.status, 400);
});

test('total pemasukan, pengeluaran, dan selisih arus kas dihitung dengan benar', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200100004' });
  const client = await loginSeller(seller);

  await client.post('/api/seller/transactions', { type: 'income', category: 'penjualan', amount: 100000 });
  await client.post('/api/seller/transactions', { type: 'income', category: 'penjualan', amount: 50000 });
  await client.post('/api/seller/transactions', { type: 'expense', category: 'modal', amount: 30000 });
  await client.post('/api/seller/transactions', { type: 'expense', category: 'kemasan', amount: 10000 });

  const res = await client.get('/api/seller/transactions/summary?period=all');

  assert.equal(res.body.data.income, 150000);
  assert.equal(res.body.data.expense, 40000);
  assert.equal(res.body.data.net, 110000);
  assert.equal(res.body.data.transactionCount, 4);
});

test('transaksi toko lain tidak masuk ringkasan (anti IDOR)', async () => {
  const sellerA = await factory.createSeller({ whatsapp: '081200100005' });
  const sellerB = await factory.createSeller({ whatsapp: '081200100006' });

  const clientA = await loginSeller(sellerA);
  await clientA.post('/api/seller/transactions', { type: 'income', category: 'penjualan', amount: 70000 });

  const clientB = await loginSeller(sellerB);
  const res = await clientB.get('/api/seller/transactions/summary?period=all');

  assert.equal(res.body.data.income, 0);
  assert.equal(res.body.data.transactionCount, 0);
});

test('transaksi bisa diedit & dihapus (soft delete)', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200100007' });
  const client = await loginSeller(seller);

  const created = await client.post('/api/seller/transactions', {
    type: 'expense',
    category: 'transportasi',
    amount: 15000,
    description: 'Ojek ke sekolah',
  });
  const id = created.body.data.transaction._id;

  const updated = await client.patch(`/api/seller/transactions/${id}`, { amount: 20000 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.transaction.amount, 20000);

  const deleted = await client.del(`/api/seller/transactions/${id}`);
  assert.equal(deleted.status, 200);

  const list = await client.get('/api/seller/transactions?type=all');
  assert.equal(list.body.data.items.length, 0);
});

test('penjual tidak bisa mengedit transaksi toko lain', async () => {
  const sellerA = await factory.createSeller({ whatsapp: '081200100008' });
  const sellerB = await factory.createSeller({ whatsapp: '081200100009' });
  const transaction = await factory.createTransaction(sellerA.store, sellerA.user._id);

  const clientB = await loginSeller(sellerB);
  const res = await clientB.patch(`/api/seller/transactions/${transaction._id}`, { amount: 999999 });

  assert.equal(res.status, 404);
});

test('filter transaksi berdasarkan tanggal & kategori bekerja', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200100010' });
  const client = await loginSeller(seller);

  const hariIni = new Date().toISOString().slice(0, 10);
  const bulanLalu = new Date();
  bulanLalu.setMonth(bulanLalu.getMonth() - 1);
  const tanggalLama = bulanLalu.toISOString().slice(0, 10);

  await client.post('/api/seller/transactions', {
    type: 'expense',
    category: 'modal',
    amount: 10000,
    date: hariIni,
  });
  await client.post('/api/seller/transactions', {
    type: 'expense',
    category: 'kemasan',
    amount: 20000,
    date: tanggalLama,
  });

  const byCategory = await client.get('/api/seller/transactions?type=all&category=modal');
  assert.equal(byCategory.body.data.items.length, 1);

  const byDate = await client.get(`/api/seller/transactions?type=all&from=${tanggalLama}&to=${hariIni}`);
  assert.equal(byDate.body.data.items.length, 2);
});

test('ekspor CSV mengembalikan file yang bisa diunduh', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200100011' });
  const client = await loginSeller(seller);

  await client.post('/api/seller/transactions', {
    type: 'income',
    category: 'penjualan',
    amount: 12345,
    description: 'Penjualan, dengan koma',
  });

  const res = await client.get('/api/seller/transactions/export?type=all');

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/csv/);
  assert.match(res.headers['content-disposition'], /attachment/);
  assert.match(res.text, /Tanggal/);
  assert.match(res.text, /12345/);
});

test('ringkasan dashboard menampilkan angka kartu statistik', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200100012' });
  const client = await loginSeller(seller);

  const product = await factory.createProduct(seller.store, { status: 'active' });
  const buyer = await factory.createBuyer({ whatsapp: '081200100013' });
  const order = await factory.createOrder(product, seller.store, buyer.user);

  await client.patch(`/api/seller/orders/${order._id}/status`, { status: 'confirmed' });
  await client.post(`/api/seller/transactions`, { type: 'income', category: 'penjualan', amount: 50000 });

  const res = await client.get('/api/seller/dashboard?period=monthly');

  assert.equal(res.status, 200);
  assert.equal(res.body.data.products.active, 1);
  assert.equal(res.body.data.orders.confirmed, 1);
  assert.equal(res.body.data.finance.income, 50000);
  assert.ok(res.body.data.finance.note);
});

test('dashboard tidak bisa diakses tanpa login', async () => {
  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.get('/api/seller/dashboard');
  assert.equal(res.status, 401);
});
