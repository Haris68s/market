/**
 * Test keamanan: otorisasi admin, proteksi CSRF, dan pembatasan akses.
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

test('penjual tidak bisa mengakses endpoint admin', async () => {
  const seller = await factory.createSeller({ whatsapp: '081210000001' });
  const client = await loginClient(seller);

  const res = await client.get('/api/admin/overview');
  assert.equal(res.status, 403);
  assert.match(res.body.error.message, /izin/i);
});

test('endpoint admin menolak pengunjung tanpa login', async () => {
  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.get('/api/admin/users');
  assert.equal(res.status, 401);
});

test('super admin bisa mengakses dashboard admin', async () => {
  const admin = await factory.createAdmin({ whatsapp: '081210000002' });
  const client = await loginClient(admin);

  const res = await client.get('/api/admin/overview');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.users.superadmins, 1);
});

test('penjual tidak bisa membuat dirinya admin lewat body request', async () => {
  const seller = await factory.createSeller({ whatsapp: '081210000003' });
  const client = await loginClient(seller);

  // Coba paksa role superadmin saat pendaftaran
  const newClient = createClient(app);
  await newClient.refreshCsrf();
  const register = await newClient.post('/api/auth/register', {
    name: 'Penyerang',
    storeName: 'Toko Penyerang',
    whatsapp: '081210000004',
    password: 'Siswa12345',
    passwordConfirm: 'Siswa12345',
    category: 'makanan-minuman',
    agreed: true,
    role: 'superadmin',
    status: 'active',
  });

  assert.equal(register.status, 201);
  // Role SELALU seller, data lain diabaikan
  assert.equal(register.body.data.user.role, 'seller');
});

test('request tanpa token CSRF ditolak', async () => {
  const seller = await factory.createSeller({ whatsapp: '081210000005' });
  const client = await loginClient(seller);

  // Kirim POST tanpa header X-CSRF-Token
  const res = await client.agent
    .post('/api/seller/products')
    .send({ name: 'Tanpa CSRF', category: 'makanan-minuman', price: 1000, stock: 1 });

  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'CSRF_INVALID');
});

test('token CSRF yang salah ditolak', async () => {
  const seller = await factory.createSeller({ whatsapp: '081210000006' });
  const client = await loginClient(seller);

  const res = await client.agent
    .post('/api/seller/products')
    .set('X-CSRF-Token', 'token-palsu-1234567890')
    .send({ name: 'Token Salah', category: 'makanan-minuman', price: 1000, stock: 1 });

  assert.equal(res.status, 403);
});

test('super admin tidak dapat dinonaktifkan dari dashboard admin', async () => {
  const admin = await factory.createAdmin({ whatsapp: '081210000007' });
  const otherAdmin = await factory.createAdmin({ whatsapp: '081210000008' });

  const client = await loginClient(admin);
  const res = await client.patch(`/api/admin/users/${otherAdmin.user._id}/status`, {
    status: 'suspended',
    reason: 'Uji coba menonaktifkan admin lain',
  });

  assert.equal(res.status, 403);
});

test('admin wajib menyertakan alasan saat menonaktifkan toko', async () => {
  const seller = await factory.createSeller({ whatsapp: '081210000009' });
  const admin = await factory.createAdmin({ whatsapp: '081210000010' });
  const client = await loginClient(admin);

  const tanpaAlasan = await client.patch(`/api/admin/stores/${seller.store._id}/status`, {
    status: 'suspended',
    reason: '',
  });
  assert.equal(tanpaAlasan.status, 400);

  const denganAlasan = await client.patch(`/api/admin/stores/${seller.store._id}/status`, {
    status: 'suspended',
    reason: 'Produk melanggar aturan marketplace.',
  });
  assert.equal(denganAlasan.status, 200);
});

test('toko yang dinonaktifkan tidak bisa login lagi', async () => {
  const seller = await factory.createSeller({ whatsapp: '081210000011' });
  const admin = await factory.createAdmin({ whatsapp: '081210000012' });

  const adminClient = await loginClient(admin);
  await adminClient.patch(`/api/admin/users/${seller.user._id}/status`, {
    status: 'suspended',
    reason: 'Melanggar aturan marketplace.',
  });

  const sellerClient = createClient(app);
  await sellerClient.refreshCsrf();
  const res = await sellerClient.login(seller.whatsapp, seller.password);

  assert.equal(res.status, 403);
  assert.match(res.body.error.message, /dinonaktifkan/i);
});

test('sesi penjual yang sudah tidak aktif langsung ditolak', async () => {
  const seller = await factory.createSeller({ whatsapp: '081210000013' });
  const admin = await factory.createAdmin({ whatsapp: '081210000014' });

  const sellerClient = await loginClient(seller);
  const sebelum = await sellerClient.get('/api/seller/dashboard');
  assert.equal(sebelum.status, 200);

  const adminClient = await loginClient(admin);
  await adminClient.patch(`/api/admin/users/${seller.user._id}/status`, {
    status: 'suspended',
    reason: 'Melanggar aturan marketplace.',
  });

  const sesudah = await sellerClient.get('/api/seller/dashboard');
  assert.equal(sesudah.status, 403);
});

test('admin bisa menyembunyikan produk dengan alasan', async () => {
  const seller = await factory.createSeller({ whatsapp: '081210000015' });
  const product = await factory.createProduct(seller.store);
  const admin = await factory.createAdmin({ whatsapp: '081210000016' });
  const client = await loginClient(admin);

  const res = await client.patch(`/api/admin/products/${product._id}/status`, {
    status: 'hidden',
    reason: 'Foto produk tidak sesuai aturan.',
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.product.status, 'hidden');
  assert.equal(res.body.data.product.hiddenReason, 'Foto produk tidak sesuai aturan.');
});

test('daftar admin tidak pernah mengirim hash password', async () => {
  const seller = await factory.createSeller({ whatsapp: '081210000017' });
  const admin = await factory.createAdmin({ whatsapp: '081210000018' });
  const client = await loginClient(admin);

  const res = await client.get('/api/admin/users');
  assert.equal(res.status, 200);
  const text = JSON.stringify(res.body);
  assert.equal(text.includes('$2b$'), false);
  assert.equal(text.includes('passwordHash'), false);
});

test('respons error tidak membocorkan stack trace di produksi', async () => {
  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.get('/api/produk-tidak-ada');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.stack, undefined);
});

test('rate limit login membatasi percobaan berulang', async () => {
  const env = require('../src/config/env');
  const seller = await factory.createSeller({ whatsapp: '081210000019' });
  const client = createClient(app);
  await client.refreshCsrf();

  // Turunkan batas rate limit supaya bisa diuji dengan cepat.
  const batasAsli = env.rateLimit.authMax;
  env.rateLimit.authMax = 3;

  try {
    const results = [];
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await client.post('/api/auth/login', { whatsapp: seller.whatsapp, password: 'Salah' }));
    }

    const limited = results.filter((r) => r.status === 429);
    assert.ok(limited.length > 0, 'seharusnya ada request yang dibatasi rate limit');
  } finally {
    env.rateLimit.authMax = batasAsli;
  }
});

test('password tidak pernah dikembalikan pada endpoint profil', async () => {
  const seller = await factory.createSeller({ whatsapp: '081210000020' });
  const client = await loginClient(seller);

  const res = await client.get('/api/seller/profile');
  assert.equal(res.status, 200);
  assert.equal(JSON.stringify(res.body).includes('$2b$'), false);
});
