/**
 * Test layanan gambar: validasi file, provider, dan penanganan error.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { setupDatabase, teardownDatabase, clearDatabase } = require('./helpers/db');
const { createClient } = require('./helpers/client');
const factory = require('./helpers/factory');
const imageService = require('../src/services/image.service');

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

/** Buffer PNG 1x1 yang valid. */
function tinyPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

/** Buffer yang bukan gambar sama sekali. */
function notAnImage() {
  return Buffer.from('<?php echo "halo"; ?>', 'utf8');
}

test('tipe gambar dideteksi dari magic bytes', () => {
  assert.equal(imageService.detectImageType(tinyPng()), 'image/png');
  assert.equal(imageService.detectImageType(notAnImage()), null);
});

test('ukuran gambar terbaca tanpa library tambahan', () => {
  const size = imageService.readImageSize(tinyPng(), 'image/png');
  assert.equal(size.width, 1);
  assert.equal(size.height, 1);
});

test('file yang bukan gambar ditolak', async () => {
  await assert.rejects(
    () => imageService.uploadImage(notAnImage(), { folder: 'products' }),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /bukan gambar/i);
      return true;
    }
  );
});

test('upload gambar berhasil memakai provider local', async () => {
  const result = await imageService.uploadImage(tinyPng(), { folder: 'products', alt: 'Test' });

  assert.ok(result.url.startsWith('/uploads/products/'));
  assert.equal(result.provider, 'local');
  assert.equal(result.width, 1);
  assert.ok(fs.existsSync(path.join(appConfigUploads(), result.publicId)));
});

function appConfigUploads() {
  // eslint-disable-next-line global-require
  return require('../src/config/app.config').paths.uploads;
}

test('upload file dengan tipe tidak cocok ditolak', async () => {
  await assert.rejects(
    () => imageService.uploadImage(tinyPng(), { folder: 'products', mimeType: 'image/jpeg' }),
    (err) => {
      assert.equal(err.statusCode, 400);
      return true;
    }
  );
});

test('halaman upload gambar menolak file terlalu besar', async () => {
  const seller = await factory.createSeller({ whatsapp: '081900000001' });
  const client = createClient(app);
  await client.refreshCsrf();
  await client.login(seller.whatsapp, seller.password);

  const file = Buffer.alloc(5 * 1024 * 1024, 0); // 5 MB
  const res = await client
    .agent
    .post('/api/seller/products/' + '000000000000000000000000' + '/images')
    .set('X-CSRF-Token', await client.getCsrfToken())
    .attach('image', file, { filename: 'besar.jpg', contentType: 'image/jpeg' });

  assert.ok(res.status >= 400);
  assert.equal(res.body.success, false);
});

test('halaman upload gambar menolak tipe file yang tidak didukung', async () => {
  const seller = await factory.createSeller({ whatsapp: '081900000002' });
  const client = createClient(app);
  await client.refreshCsrf();
  await client.login(seller.whatsapp, seller.password);

  const res = await client
    .agent
    .post('/api/seller/products/' + '000000000000000000000000' + '/images')
    .set('X-CSRF-Token', await client.getCsrfToken())
    .attach('image', Buffer.from('halo'), { filename: 'virus.exe', contentType: 'application/x-msdownload' });

  assert.equal(res.status, 400);
  assert.match(res.body.error.message, /tidak didukung/i);
});

test('layanan gambar yang tidak dikonfigurasi memberi pesan jelas', async () => {
  // eslint-disable-next-line global-require
  const env = require('../src/config/env');
  const asli = env.imageProvider;
  env.imageProvider = 'tidak-ada';

  try {
    await assert.rejects(
      () => imageService.uploadImage(tinyPng(), { folder: 'products' }),
      (err) => {
        assert.equal(err.statusCode, 503);
        assert.match(err.message, /layanan penyimpanan gambar/i);
        return true;
      }
    );
  } finally {
    env.imageProvider = asli;
  }
});

test('endpoint status upload melaporkan provider yang dipakai', async () => {
  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.get('/api/uploads/status');
  assert.equal(res.status, 200);
  assert.ok(res.body.data.provider);
});
