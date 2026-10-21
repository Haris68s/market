/**
 * Koneksi ke MongoDB (Atlas).
 *
 * src/server.js memanggil connectDatabase() sekali di awal.
 * Semua model Mongoose ikut memakai koneksi yang sama.
 */
'use strict';

const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

/*
 * CATATAN Keamanan (penting):
 * Opsi `sanitizeFilter` dari Mongoose TIDAK dipakai di sini karena opsi tersebut
 * membungkus query regex (`$regex`) menjadi `$eq`, sehingga fitur pencarian
 * berbasis kata kunci ikut rusak.
 *
 * Proteksi NoSQL injection kita,andalkan hal berikut:
 * 1. Semua input divalidasi Zod lebih dulu (tipe datanya dijamin string/number),
 *    jadi pengguna tidak bisa mengirim objek seperti { "$ne": null }.
 * 2. Semua filter Mongoose dibangun di dalam service dari nilai yang sudah
 *    tervalidasi - tidak pernah meneruskan body request mentah ke query.
 * 3. String pencarian di-escape dengan escapeRegex() sebelum dipakai sebagai $regex.
 */
let connectingPromise = null;
async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (!connectingPromise) {
    connectingPromise = mongoose
      .connect(env.mongodbUri, {
        dbName: env.dbName,
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10,
        retryWrites: true,
      })
      .then((m) => {
        // eslint-disable-next-line no-console
        console.log(`[db] Terhubung ke MongoDB (database: ${env.dbName})`);
        return m.connection;
      })
      .catch((err) => {
        connectingPromise = null;
        // eslint-disable-next-line no-console
        console.error('[db] Gagal terhubung ke MongoDB:', err.message);
        throw err;
      });
  }

  return connectingPromise;
}

async function disconnectDatabase() {
  connectingPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectDatabase, disconnectDatabase, isDatabaseConnected, mongoose };
