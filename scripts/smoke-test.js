'use strict';
/**
 * Uji cepat semua endpoint (smoke test).
 * Dipakai untuk mencari route yang error.
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db(process.env.MONGODB_DB_NAME);

  const seller = await db.collection('users').findOne({ role: 'seller' });
  const admin = await db.collection('users').findOne({ role: 'superadmin' });
  const store = await db.collection('stores').findOne({});
  const product = await db.collection('products').findOne({});
  const order = await db.collection('orders').findOne({});
  const transaction = await db.collection('transactions').findOne({});
  const review = await db.collection('reviews').findOne({});
  const category = await db.collection('categories').findOne({});

  await c.close();

  let cookie = '';
  let csrf = '';

  /** Simpan cookie session terbaru (session di-regenerate saat login). */
  function simpanCookie(res) {
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    set.forEach((c) => {
      const pasangan = c.split(';')[0];
      const nama = pasangan.split('=')[0];
      if (cookie) {
        cookie = cookie
          .split('; ')
          .filter((x) => !x.startsWith(`${nama}=`))
          .concat([pasangan])
          .join('; ');
      } else {
        cookie = pasangan;
      }
    });
  }

  async function ambilCsrf() {
    const res = await fetch(`${BASE}/api/csrf`, { headers: { Cookie: cookie }, credentials: 'same-origin' });
    simpanCookie(res);
    const body = await res.json();
    csrf = body.data.csrfToken;
    return csrf;
  }

  async function login(wa, password) {
    cookie = '';
    await ambilCsrf();
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Cookie: cookie },
      body: JSON.stringify({ whatsapp: wa, password }),
      credentials: 'same-origin',
    });
    simpanCookie(res);
    const d = await res.json();
    if (!d.success) console.log('LOGIN GAGAL:', wa, d.error && d.error.message);
    await ambilCsrf();
  }

  async function call(method, path, body) {
    const init = { method, headers: { Cookie: cookie, 'X-CSRF-Token': csrf }, credentials: 'same-origin' };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${BASE}${path}`, init);
    simpanCookie(res);
    let text = '';
    try { text = await res.text(); } catch (e) { text = ''; }
    return { status: res.status, text };
  }

  const results = [];

  // ---- Publik ----
  results.push(['GET  /api/health', await call('GET', '/api/health')]);
  results.push(['GET  /api/categories', await call('GET', '/api/categories')]);
  results.push(['GET  /api/products', await call('GET', '/api/products')]);
  results.push(['GET  /api/products/featured', await call('GET', '/api/products/featured')]);
  if (product) results.push([`GET  /api/products/:slug`, await call('GET', `/api/products/${product.slug}`)]);
  results.push(['GET  /api/stores', await call('GET', '/api/stores')]);
  if (store) results.push(['GET  /api/stores/:slug', await call('GET', `/api/stores/${store.slug}`)]);

  // ---- Seller ----
  await login('081234567890', 'Siswa12345');
  results.push(['GET  /api/seller/products', await call('GET', '/api/seller/products')]);
  results.push(['GET  /api/seller/orders', await call('GET', '/api/seller/orders')]);
  results.push(['GET  /api/seller/transactions', await call('GET', '/api/seller/transactions')]);
  results.push(['GET  /api/seller/transactions/summary', await call('GET', '/api/seller/transactions/summary')]);
  results.push(['GET  /api/seller/transactions/export', await call('GET', '/api/seller/transactions/export')]);
  results.push(['GET  /api/seller/dashboard', await call('GET', '/api/seller/dashboard')]);
  results.push(['GET  /api/seller/reviews', await call('GET', '/api/seller/reviews')]);
  results.push(['GET  /api/seller/profile', await call('GET', '/api/seller/profile')]);
  if (product) {
    results.push([`GET  /api/seller/products/:id`, await call('GET', `/api/seller/products/${product._id}`)]);
  }
  if (order) {
    results.push([`GET  /api/seller/orders/:id`, await call('GET', `/api/seller/orders/${order._id}`)]);
  }
  if (transaction) {
    results.push([`PATCH /api/seller/transactions/:id`, await call('PATCH', `/api/seller/transactions/${transaction._id}`, { description: 'x' })]);
  }

  // ---- Admin ----
  await login('081200000999', 'Admin12345');
  results.push(['GET  /api/admin/overview', await call('GET', '/api/admin/overview')]);
  results.push(['GET  /api/admin/users', await call('GET', '/api/admin/users')]);
  results.push(['GET  /api/admin/stores', await call('GET', '/api/admin/stores')]);
  results.push(['GET  /api/admin/products', await call('GET', '/api/admin/products')]);
  results.push(['GET  /api/admin/categories', await call('GET', '/api/admin/categories')]);
  results.push(['GET  /api/admin/reviews', await call('GET', '/api/admin/reviews')]);
  results.push(['GET  /api/admin/reports', await call('GET', '/api/admin/reports')]);
  results.push(['GET  /api/admin/orders', await call('GET', '/api/admin/orders')]);
  results.push(['GET  /api/admin/logs', await call('GET', '/api/admin/logs')]);
  results.push(['GET  /api/admin/settings', await call('GET', '/api/admin/settings')]);
  if (seller) results.push([`GET  /api/admin/users/:id`, await call('GET', `/api/admin/users/${seller._id}`)]);
  if (product) results.push([`PATCH /api/admin/products/:id/status`, await call('PATCH', `/api/admin/products/${product._id}/status`, { status: 'active', reason: 'cek route saja' })]);
  if (review) results.push([`PATCH /api/admin/reviews/:id`, await call('PATCH', `/api/admin/reviews/${review._id}`, { action: 'restore', reason: 'cek route saja' })]);
  if (category) results.push([`PATCH /api/admin/categories/:id`, await call('PATCH', `/api/admin/categories/${category._id}`, { name: category.name })]);

  console.log('\n=== HASIL UJI SEMUA ENDPOINT ===\n');
  let gagal = 0;
  results.forEach(([nama, r]) => {
    const ok = r.status < 500;
    if (!ok) gagal += 1;
    let ketik = '';
    try {
      const j = JSON.parse(r.text);
      if (j && j.error) ketik = ' | ' + j.error.code + ': ' + String(j.error.message).slice(0, 90);
    } catch (e) { ketik = ' | ' + r.text.slice(0, 90); }
    console.log(`  ${ok ? 'OK ' : 'ERR'} ${r.status} ${nama}${ketik}`);
  });
  console.log(`\n  Total: ${results.length}, error 5xx: ${gagal}\n`);
  process.exit(gagal ? 1 : 0);
})();
