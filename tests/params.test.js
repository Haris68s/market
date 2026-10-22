/**
 * Test regresi: parameter yang dikirim frontend harus diterima backend.
 *
 * Bug yang pernah terjadi:
 * Halaman dashboard produk/pesanan dan halaman admin mengirim `limit=50`,
 * sementara skema validasi membatasi `max(48)` -> HTTP 400
 * "Data yang dikirim tidak valid" -> tabel produk gagal dimuat.
 *
 * Test ini mengunci batas tersebut supaya tidak terulang.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { setupDatabase, teardownDatabase, clearDatabase } = require('./helpers/db');
const { createClient } = require('./helpers/client');
const factory = require('./helpers/factory');
const appConfig = require('../src/config/app.config');

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

/** Parameter yang benar-benar dikirim oleh file frontend. */
const PARAMETER_FRONTEND = {
  sellerProducts: { q: '', category: '', status: 'all', limit: 50 },
  sellerProductsFilter: { q: 'kopi', category: 'makanan-minuman', status: 'active', sort: 'newest', page: 1, limit: 50 },
  sellerOrders: { status: 'all', limit: 50 },
  sellerTransactions: { type: 'all', category: 'all', limit: 100 },
  sellerDashboard: { period: 'monthly' },
  adminUsers: { q: '', role: 'all', status: 'all', limit: 50 },
  adminProducts: { q: '', status: 'all', limit: 50 },
  adminReviews: { status: 'all', limit: 50 },
  adminReports: { status: 'all', limit: 50 },
  adminOrders: { status: 'all', limit: 50 },
  adminLogs: { status: 'all', limit: 50 },
  katalog: { q: '', category: '', sort: 'newest', page: 1, limit: 12 },
};

test('batas limit di skema >= limit yang dipakai frontend', () => {
  const batas = appConfig.pagination.maxLimit;
  const limitFrontend = Object.values(PARAMETER_FRONTEND)
    .map((p) => p.limit)
    .filter((v) => typeof v === 'number');

  const terbesar = Math.max(...limitFrontend);
  assert.ok(
    batas >= terbesar,
    `appConfig.pagination.maxLimit (${batas}) harus >= limit frontend terbesar (${terbesar})`
  );
});

test('halaman dashboard seller memuat data tanpa error validasi', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200100001' });
  const client = createClient(app);
  await client.refreshCsrf();
  await client.login(seller.whatsapp, seller.password);

  const res = await client.get('/api/seller/products?' + new URLSearchParams(PARAMETER_FRONTEND.sellerProducts));
  assert.equal(res.status, 200, JSON.stringify(res.body && res.body.error));

  const filter = await client.get(
    '/api/seller/products?' + new URLSearchParams(PARAMETER_FRONTEND.sellerProductsFilter)
  );
  assert.equal(filter.status, 200, JSON.stringify(filter.body && filter.body.error));

  const orders = await client.get('/api/seller/orders?' + new URLSearchParams(PARAMETER_FRONTEND.sellerOrders));
  assert.equal(orders.status, 200, JSON.stringify(orders.body && orders.body.error));

  const trx = await client.get(
    '/api/seller/transactions?' + new URLSearchParams(PARAMETER_FRONTEND.sellerTransactions)
  );
  assert.equal(trx.status, 200, JSON.stringify(trx.body && trx.error));

  const dash = await client.get('/api/seller/dashboard?' + new URLSearchParams(PARAMETER_FRONTEND.sellerDashboard));
  assert.equal(dash.status, 200, JSON.stringify(dash.body && dash.error));
});

test('halaman admin memuat data tanpa error validasi', async () => {
  const admin = await factory.createAdmin({ whatsapp: '081200100002' });
  const client = createClient(app);
  await client.refreshCsrf();
  await client.login(admin.whatsapp, admin.password);

  const daftar = [
    ['/api/admin/users', PARAMETER_FRONTEND.adminUsers],
    ['/api/admin/products', PARAMETER_FRONTEND.adminProducts],
    ['/api/admin/reviews', PARAMETER_FRONTEND.adminReviews],
    ['/api/admin/reports', PARAMETER_FRONTEND.adminReports],
    ['/api/admin/orders', PARAMETER_FRONTEND.adminOrders],
    ['/api/admin/logs', PARAMETER_FRONTEND.adminLogs],
  ];

  for (const [path, params] of daftar) {
    // eslint-disable-next-line no-await-in-loop
    const res = await client.get(`${path}?${new URLSearchParams(params)}`);
    assert.equal(res.status, 200, `${path} -> ${JSON.stringify(res.body && res.body.error)}`);
  }
});

test('katalog publik menerima parameter dari halaman katalog', async () => {
  const client = createClient(app);
  const res = await client.get('/api/products?' + new URLSearchParams(PARAMETER_FRONTEND.katalog));
  assert.equal(res.status, 200, JSON.stringify(res.body && res.body.error));
});

test('limit yang melebihi batas tetap ditolak (validasi tetap bekerja)', async () => {
  const client = createClient(app);
  const res = await client.get('/api/products?limit=9999');
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});
