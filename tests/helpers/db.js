/**
 * Helper pengujian: menyalakan koneksi ke MongoDB.
 *
 * 1. Kalau file URI dari tests/global-setup.js ada, pakai URI itu
 *    (satu database untuk semua berkas test).
 * 2. Kalau tidak, helper menyalakan MongoDB di memory sendiri.
 *
 * Data di memory server hilang setelah test selesai.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mongoose = require('mongoose');

// Environment harus diset SEBELUM app di-require.
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-yang-panjang-minimal-32-karakter-aman';
process.env.IMAGE_PROVIDER = 'local';
process.env.APP_URL = 'http://localhost:3000';

const URI_FILE = path.join(os.tmpdir(), 'kantinsiswa-test-mongo-uri.txt');

let memoryServer = null;

async function setupDatabase() {
  let uri = null;

  if (fs.existsSync(URI_FILE)) {
    uri = fs.readFileSync(URI_FILE, 'utf8').trim();
  }

  if (!uri) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create({ binary: { version: '8.2.6' } });
    uri = memoryServer.getUri();
  }

  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, { dbName: 'kantinsiswa_test' });
}

async function teardownDatabase(app) {
  // Tutup koneksi session store (connect-mongo) supaya proses test bisa keluar.
  if (app && app.sessionStore && typeof app.sessionStore.close === 'function') {
    await app.sessionStore.close();
  }
  await mongoose.connection.close();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

/** Bersihkan semua data antar test (index tetap aman). */
async function clearDatabase() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

module.exports = { setupDatabase, teardownDatabase, clearDatabase, mongoose };
