/**
 * Test autentikasi: pendaftaran, login, sesi, dan proteksi endpoint.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { setupDatabase, teardownDatabase, clearDatabase } = require('./helpers/db');
const { createClient } = require('./helpers/client');

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

const validRegister = {
  name: 'Budi Santoso',
  storeName: 'Kedai Budi',
  whatsapp: '081234567890',
  password: 'Siswa12345',
  passwordConfirm: 'Siswa12345',
  category: 'makanan-minuman',
  description: 'Jajan enak buat kelas.',
  address: 'Jl. Sekolah No. 1',
  city: 'Bandung',
  agreed: true,
};

test('pendaftaran penjual berhasil membuat user & toko', async () => {
  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.post('/api/auth/register', validRegister);

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.role, 'seller');
  assert.equal(res.body.data.user.whatsapp, '6281234567890');
  assert.equal(res.body.data.store.name, 'Kedai Budi');
  // Hash password tidak boleh keluar dari API.
  assert.equal(res.body.data.user.passwordHash, undefined);
  assert.equal(JSON.stringify(res.body).includes('$2b$'), false);
});

test('pendaftaran gagal jika konfirmasi password tidak cocok', async () => {
  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.post('/api/auth/register', {
    ...validRegister,
    passwordConfirm: 'Siswa12346',
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.error.message, /Konfirmasi password/i);
});

test('pendaftaran gagal jika password terlalu pendek', async () => {
  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.post('/api/auth/register', {
    ...validRegister,
    password: '123',
    passwordConfirm: '123',
  });

  assert.equal(res.status, 400);
  assert.ok(Array.isArray(res.body.error.details));
});

test('pendaftaran gagal jika rules marketplace tidak disetujui', async () => {
  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.post('/api/auth/register', { ...validRegister, agreed: false });

  assert.equal(res.status, 400);
});

test('pendaftaran gagal jika nomor WhatsApp sudah dipakai', async () => {
  const client = createClient(app);
  await client.refreshCsrf();
  await client.post('/api/auth/register', validRegister);

  const res = await client.post('/api/auth/register', {
    ...validRegister,
    storeName: 'Toko Lain',
  });

  assert.equal(res.status, 409);
  assert.match(res.body.error.message, /sudah terdaftar/i);
});

test('pendaftaran menolak nomor WhatsApp tidak valid', async () => {
  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.post('/api/auth/register', { ...validRegister, whatsapp: '123' });

  assert.equal(res.status, 400);
});

test('login berhasil dengan nomor WhatsApp dan mengembalikan sesi', async () => {
  const client = createClient(app);
  await client.refreshCsrf();
  await client.post('/api/auth/register', validRegister);

  const res = await client.login('081234567890', 'Siswa12345');

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.role, 'seller');

  const me = await client.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.name, 'Budi Santoso');
});

test('login dengan format WhatsApp berbeda tetap berhasil (normalisasi)', async () => {
  const client = createClient(app);
  await client.refreshCsrf();
  await client.post('/api/auth/register', validRegister);

  const res = await client.login('+62 812-3456-7890', 'Siswa12345');

  assert.equal(res.status, 200);
});

test('login gagal dengan password salah', async () => {
  const client = createClient(app);
  await client.refreshCsrf();
  await client.post('/api/auth/register', validRegister);

  const res = await client.login('081234567890', 'PasswordSalah');

  assert.equal(res.status, 401);
  assert.match(res.body.error.message, /salah/i);
});

test('login gagal dengan nomor yang tidak terdaftar', async () => {
  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.login('089999999999', 'Siswa12345');

  assert.equal(res.status, 401);
});

test('endpoint seller menolak akses tanpa login', async () => {
  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.get('/api/seller/products');

  assert.equal(res.status, 401);
});

test('logout mengakhiri sesi', async () => {
  const client = createClient(app);
  await client.refreshCsrf();
  await client.post('/api/auth/register', validRegister);
  await client.login('081234567890', 'Siswa12345');

  const out = await client.post('/api/auth/logout');
  assert.equal(out.status, 200);

  const me = await client.get('/api/auth/me');
  assert.equal(me.body.data.user, null);
});

test('ganti password butuh password lama yang benar', async () => {
  const client = createClient(app);
  await client.refreshCsrf();
  await client.post('/api/auth/register', validRegister);
  await client.login('081234567890', 'Siswa12345');

  const salah = await client.patch('/api/auth/password', {
    currentPassword: 'SalahSekali',
    newPassword: 'PasswordBaru123',
    newPasswordConfirm: 'PasswordBaru123',
  });
  assert.equal(salah.status, 400);

  const benar = await client.patch('/api/auth/password', {
    currentPassword: 'Siswa12345',
    newPassword: 'PasswordBaru123',
    newPasswordConfirm: 'PasswordBaru123',
  });
  assert.equal(benar.status, 200);

  const loginBaru = await client.login('081234567890', 'PasswordBaru123');
  assert.equal(loginBaru.status, 200);
});
