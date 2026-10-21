/**
 * Test frontend: halaman statis, elemen penting, dan responsivitas dasar.
 *
 * Tes ini memeriksa struktur HTML yang served server, bukan tampilan visual.
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

const PAGES = [
  { path: '/', must: ['app-header', 'app-footer', 'kategori-grid', 'terbaru-grid', 'terlaris-grid', 'rating-grid', 'toko-grid'] },
  { path: '/katalog.html', must: ['filter-kategori', 'filter-sort', 'produk-grid', 'pagination'] },
  { path: '/produk.html', must: ['produk-detail', 'app-header'] },
  { path: '/toko.html', must: ['toko-detail'] },
  { path: '/masuk.html', must: ['form-login', 'whatsapp', 'password'] },
  { path: '/daftar.html', must: ['form-register', 'storeName', 'category', 'passwordConfirm', 'agreed'] },
  { path: '/lupa-password.html', must: ['form-reset-request'] },
  { path: '/reset-password.html', must: ['form-reset', 'token', 'newPassword'] },
  { path: '/404.html', must: ['app-header', 'app-footer'] },
  { path: '/403.html', must: ['app-header', 'app-footer'] },
  { path: '/dashboard/index.html', must: ['dash-side', 'stat-grid'] },
  { path: '/dashboard/produk.html', must: ['dash-side', 'daftar-produk'] },
  { path: '/dashboard/pesanan.html', must: ['dash-side', 'daftar-pesanan'] },
  { path: '/dashboard/keuangan.html', must: ['dash-side', 'daftar-transaksi', 'stat-grid'] },
  { path: '/dashboard/ulasan.html', must: ['dash-side', 'daftar-ulasan'] },
  { path: '/dashboard/profil.html', must: ['dash-side', 'form-profil', 'form-password'] },
  { path: '/admin/index.html', must: ['dash-side', 'stat-grid'] },
  { path: '/admin/pengguna.html', must: ['dash-side', 'daftar-pengguna'] },
  { path: '/admin/produk.html', must: ['dash-side', 'daftar-produk'] },
  { path: '/admin/kategori.html', must: ['dash-side', 'daftar-kategori'] },
  { path: '/admin/laporan.html', must: ['dash-side', 'daftar-laporan', 'daftar-ulasan'] },
  { path: '/admin/log.html', must: ['dash-side', 'daftar-log'] },
  { path: '/admin/pengaturan.html', must: ['dash-side', 'form-pengaturan'] },
];

PAGES.forEach((page) => {
  test(`halaman ${page.path} tersedia dan memuat elemen penting`, async () => {
    const client = createClient(app);
    const res = await client.get(page.path);

    assert.equal(res.status, 200);
    assert.match(res.text, /<html lang="id">/);
    page.must.forEach((id) => {
      assert.ok(res.text.includes(`id="${id}"`), `halaman ${page.path} harus punya #${id}`);
    });
  });
});

test('setiap halaman punya meta viewport (tampilan responsif)', async () => {
  const client = createClient(app);
  for (const page of PAGES) {
    // eslint-disable-next-line no-await-in-loop
    const res = await client.get(page.path);
    assert.ok(
      res.text.includes('name="viewport"'),
      `halaman ${page.path} harus punya meta viewport`
    );
    assert.ok(
      res.text.includes('width=device-width'),
      `halaman ${page.path} harus punya viewport width=device-width`
    );
  }
});

test('halaman memakai ikon SVG, bukan emoji', async () => {
  const client = createClient(app);
  const res = await client.get('/');

  assert.ok(res.text.includes('/assets/icons/sprite.svg'));
  // Tidak ada emoji dalam markup halaman utama.
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(res.text), false, 'halaman tidak boleh memakai emoji');
});

test('sprite ikon tersedia dan berisi ikon yang dipakai', async () => {
  const client = createClient(app);
  const res = await client.get('/assets/icons/sprite.svg');

  assert.equal(res.status, 200);
  const isi = res.text || (res.body ? res.body.toString('utf8') : '');
  ['shopping-bag', 'search', 'store', 'package', 'star', 'message-circle', 'wallet'].forEach((name) => {
    assert.ok(isi.includes(`id="${name}"`), `sprite harus punya ikon ${name}`);
  });
});

test('CSS dan JS utama tersedia', async () => {
  const client = createClient(app);
  const files = [
    '/assets/css/base.css',
    '/assets/css/components.css',
    '/assets/css/public.css',
    '/assets/css/dashboard.css',
    '/assets/js/api.js',
    '/assets/js/ui.js',
  ];

  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    const res = await client.get(file);
    assert.equal(res.status, 200, `file ${file} harus bisa diakses`);
  }
});

test('halaman tidakExist mengembalikan 404 dengan pesan yang aman', async () => {
  const client = createClient(app);
  const res = await client.get('/halaman-yang-tidak-ada');

  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.stack, undefined);
});

test('health check melaporkan status database', async () => {
  const client = createClient(app);
  const res = await client.get('/api/health');

  assert.equal(res.status, 200);
  assert.equal(res.body.data.database, 'connected');
});
