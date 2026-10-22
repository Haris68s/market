/**
 * Test integritas route.
 *
 * Menangkap bug seperti "fn is not a function" yang muncul kalau nama
 * fungsi handler di file route salah tulis atau dipindah ke controller lain.
 *
 * Contoh nyata: `asyncHandler(controller.listSellerReviews)` padahal fungsi
 * itu sebenarnya ada di review.controller.js -> error 500 saat halaman
 * Ulasan dibuka.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ROUTE_FILES = [
  '../src/routes/auth.routes.js',
  '../src/routes/product.routes.js',
  '../src/routes/category.routes.js',
  '../src/routes/store.routes.js',
  '../src/routes/order.routes.js',
  '../src/routes/review.routes.js',
  '../src/routes/report.routes.js',
  '../src/routes/seller.routes.js',
  '../src/routes/admin.routes.js',
  '../src/routes/upload.routes.js',
];

test('semua handler route adalah fungsi yang benar-benar ada', () => {
  const masalah = [];

  ROUTE_FILES.forEach((file) => {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const router = require(file);

    router.stack.forEach((layer) => {
      if (!layer.route) return;
      const metode = Object.keys(layer.route.methods).join(',').toUpperCase();
      const nama = `${metode} ${layer.route.path}`;

      layer.route.stack.forEach((rl, i) => {
        if (typeof rl.handle !== 'function') {
          masalah.push(`${file} -> ${nama} handler#${i} bukan fungsi (${typeof rl.handle})`);
        }
      });
    });
  });

  assert.deepEqual(
    masalah,
    [],
    `Ditemukan handler route yang tidak valid:\n${masalah.join('\n')}`
  );
});

test('semua controller yang dipakai route benar-benar tersedia', () => {
  const masalah = [];

  // Nama fungsi yang dipanggil dari tiap file route
  const daftarPemeriksaan = [
    {
      file: '../src/routes/seller.routes.js',
      module: '../src/controllers/seller.controller.js',
      names: [
        'listProducts', 'createProduct', 'getProduct', 'updateProduct', 'deleteProduct',
        'uploadProductImage', 'deleteProductImage', 'dashboard', 'listTransactions',
        'createTransaction', 'updateTransaction', 'deleteTransaction', 'financeSummary',
        'exportTransactions', 'getProfile', 'updateProfile',
      ],
    },
    {
      file: '../src/routes/seller.routes.js',
      module: '../src/controllers/order.controller.js',
      names: ['listSellerOrders', 'getSellerOrder', 'updateOrderStatus', 'recordIncome'],
    },
    {
      file: '../src/routes/seller.routes.js',
      module: '../src/controllers/review.controller.js',
      names: ['listSellerReviews'],
    },
    {
      file: '../src/routes/admin.routes.js',
      module: '../src/controllers/admin.controller.js',
      names: [
        'overview', 'listUsers', 'getUser', 'updateUserStatus', 'issueResetToken',
        'listStores', 'updateStoreStatus', 'listProducts', 'updateProductStatus',
        'listCategories', 'createCategory', 'updateCategory', 'deleteCategory',
        'listReviews', 'moderateReview', 'listReports', 'resolveReport', 'listOrders',
        'listLogs', 'getSettings', 'updateSettings',
      ],
    },
    {
      file: '../src/routes/auth.routes.js',
      module: '../src/controllers/auth.controller.js',
      names: ['register', 'login', 'logout', 'me', 'updateProfile', 'changePassword', 'requestReset', 'resetPassword'],
    },
    {
      file: '../src/routes/order.routes.js',
      module: '../src/controllers/order.controller.js',
      names: ['createOrder'],
    },
    {
      file: '../src/routes/review.routes.js',
      module: '../src/controllers/review.controller.js',
      names: ['createReview'],
    },
    {
      file: '../src/routes/report.routes.js',
      module: '../src/controllers/review.controller.js',
      names: ['createReport'],
    },
    {
      file: '../src/routes/product.routes.js',
      module: '../src/controllers/catalog.controller.js',
      names: ['listProducts', 'featuredProducts', 'getProduct'],
    },
    {
      file: '../src/routes/category.routes.js',
      module: '../src/controllers/catalog.controller.js',
      names: ['listCategories'],
    },
    {
      file: '../src/routes/store.routes.js',
      module: '../src/controllers/catalog.controller.js',
      names: ['listStores', 'getStore'],
    },
    {
      file: '../src/routes/upload.routes.js',
      module: '../src/controllers/upload.controller.js',
      names: ['uploadImage', 'status'],
    },
  ];

  daftarPemeriksaan.forEach(({ module, names }) => {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const ctrl = require(module);
    names.forEach((name) => {
      if (typeof ctrl[name] !== 'function') {
        masalah.push(`${module} tidak punya fungsi "${name}"`);
      }
    });
  });

  assert.deepEqual(masalah, [], masalah.join('\n'));
});
