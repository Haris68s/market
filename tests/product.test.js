/**
 * Test produk: CRUD, validasi, dan proteksi IDOR antar toko.
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
  assert.equal(res.status, 200, 'login seller harus berhasil');
  return client;
}

test('penjual bisa membuat produk', async () => {
  const seller = await factory.createSeller({ name: 'Budi', whatsapp: '081200000001' });
  const client = await loginSeller(seller);

  const res = await client.post('/api/seller/products', {
    name: 'Kopi Susu Aren',
    category: 'makanan-minuman',
    price: 12000,
    description: 'Kopi susu aren handmade.',
    stock: 10,
    status: 'active',
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.product.name, 'Kopi Susu Aren');
  assert.equal(res.body.data.product.price, 12000);
  assert.ok(res.body.data.product.slug);
});

test('produk tanpa nama / harga negatif ditolak backend', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200000002' });
  const client = await loginSeller(seller);

  const res = await client.post('/api/seller/products', {
    name: '',
    category: 'makanan-minuman',
    price: -500,
    stock: -1,
  });

  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.length > 0);
});

test('harga negatif tidak bisa disimpan walau lolos validasi tipis', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200000003' });
  const client = await loginSeller(seller);

  const res = await client.post('/api/seller/products', {
    name: 'Produk Aneh',
    category: 'makanan-minuman',
    price: -1,
    stock: 5,
  });

  assert.equal(res.status, 400);
});

test('penjual hanya melihat produknya sendiri', async () => {
  const sellerA = await factory.createSeller({ whatsapp: '081200000004' });
  const sellerB = await factory.createSeller({ whatsapp: '081200000005' });

  const clientA = await loginSeller(sellerA);
  const clientB = await loginSeller(sellerB);

  await clientA.post('/api/seller/products', {
    name: 'Produk A',
    category: 'makanan-minuman',
    price: 1000,
    stock: 5,
  });

  const listB = await clientB.get('/api/seller/products');
  assert.equal(listB.body.data.items.length, 0);

  const listA = await clientA.get('/api/seller/products');
  assert.equal(listA.body.data.items.length, 1);
});

test('penjual tidak bisa mengedit produk toko lain (IDOR)', async () => {
  const sellerA = await factory.createSeller({ whatsapp: '081200000006' });
  const sellerB = await factory.createSeller({ whatsapp: '081200000007' });

  const productA = await factory.createProduct(sellerA.store, { name: 'Milik Budi' });

  const clientB = await loginSeller(sellerB);
  const res = await clientB.patch(`/api/seller/products/${productA._id}`, { price: 1 });

  assert.equal(res.status, 404);
  assert.match(res.body.error.message, /bukan milik toko Anda/i);
});

test('penjual tidak bisa menghapus produk toko lain (IDOR)', async () => {
  const sellerA = await factory.createSeller({ whatsapp: '081200000008' });
  const sellerB = await factory.createSeller({ whatsapp: '081200000009' });

  const productA = await factory.createProduct(sellerA.store, { name: 'Milik Budi 2' });

  const clientB = await loginSeller(sellerB);
  const res = await clientB.del(`/api/seller/products/${productA._id}`);

  assert.equal(res.status, 404);
});

test('mengubah nama produk membuat slug baru', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200000010' });
  const client = await loginSeller(seller);

  const created = await client.post('/api/seller/products', {
    name: 'Roti Bakar',
    category: 'makanan-minuman',
    price: 8000,
    stock: 3,
  });

  const updated = await client.patch(`/api/seller/products/${created.body.data.product._id}`, {
    name: 'Roti Bakar Cokelat',
  });

  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.product.slug, 'roti-bakar-cokelat');
});

test('produk bisa dihapus bila belum punya pesanan', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200000011' });
  const client = await loginSeller(seller);

  const created = await client.post('/api/seller/products', {
    name: 'Produk Sekali Pakai',
    category: 'makanan-minuman',
    price: 5000,
    stock: 1,
  });

  const res = await client.del(`/api/seller/products/${created.body.data.product._id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.deleted, true);
});

test('produk yang punya pesanan disembunyikan, tidak dihapus permanen', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200000012' });
  const buyer = await factory.createBuyer({ whatsapp: '081500000001' });
  const product = await factory.createProduct(seller.store);
  await factory.createOrder(product, seller.store, buyer.user);

  const client = await loginSeller(seller);
  const res = await client.del(`/api/seller/products/${product._id}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.hidden, true);
});

test('filter & pencarian produk di katalog bekerja', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200000013' });
  await factory.createProduct(seller.store, { name: 'Kopi Susu', price: 12000, category: 'makanan-minuman' });
  await factory.createProduct(seller.store, { name: 'Roti Bakar', price: 8000, category: 'makanan-minuman' });
  await factory.createProduct(seller.store, { name: 'Hoodie Premium', price: 120000, category: 'fashion' });

  const client = createClient(app);
  await client.refreshCsrf();

  const all = await client.get('/api/products');
  assert.equal(all.body.data.items.length, 3);

  const search = await client.get('/api/products?q=kopi');
  assert.equal(search.body.data.items.length, 1);
  assert.equal(search.body.data.items[0].name, 'Kopi Susu');

  const byCategory = await client.get('/api/products?category=fashion');
  assert.equal(byCategory.body.data.items.length, 1);

  const byPrice = await client.get('/api/products?minPrice=10000&maxPrice=20000');
  assert.equal(byPrice.body.data.items.length, 1);
  assert.equal(byPrice.body.data.items[0].name, 'Kopi Susu');
});

test('parameter pencarian tidak valid ditolak backend', async () => {
  const client = createClient(app);
  await client.refreshCsrf();

  const badSort = await client.get('/api/products?sort=yang-tidak-ada');
  assert.equal(badSort.status, 400);

  const badRange = await client.get('/api/products?minPrice=50000&maxPrice=10000');
  assert.equal(badRange.status, 400);

  const badPage = await client.get('/api/products?page=0');
  assert.equal(badPage.status, 400);
});

test('pagination mengembalikan informasi halaman yang benar', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200000014' });
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await factory.createProduct(seller.store, { name: `Produk ${i}` });
  }

  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.get('/api/products?page=2&limit=2');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.items.length, 2);
  assert.equal(res.body.data.pagination.page, 2);
  assert.equal(res.body.data.pagination.total, 5);
  assert.equal(res.body.data.pagination.totalPages, 3);
  assert.equal(res.body.data.pagination.hasNext, true);
  assert.equal(res.body.data.pagination.hasPrev, true);
});

test('halaman detail produk mengembalikan produk terkait & data toko', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200000015', storeName: 'Toko Uji' });
  const product = await factory.createProduct(seller.store, { name: 'Kopi Susu' });
  await factory.createProduct(seller.store, { name: 'Kopi Hitam', category: 'makanan-minuman' });

  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.get(`/api/products/${product.slug}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.product.name, 'Kopi Susu');
  assert.equal(res.body.data.store.name, 'Toko Uji');
  assert.ok(Array.isArray(res.body.data.related));
});

test('produk draft tidak muncul di katalog publik', async () => {
  const seller = await factory.createSeller({ whatsapp: '081200000016' });
  await factory.createProduct(seller.store, { name: 'Produk Draft', status: 'draft' });

  const client = createClient(app);
  await client.refreshCsrf();

  const res = await client.get('/api/products');
  assert.equal(res.body.data.items.length, 0);
});
