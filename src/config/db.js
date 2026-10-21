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

/**
 * Memberi pesan yang jelas kalau koneksi gagal.
 * Masalah database Atlas sering dikira "server mati", padahal penyebabnya
 * biasanya password atau IP Access yang belum benar.
 */
function logKoneksiGagal(err) {
  const pesan = err.message || String(err);
  // eslint-disable-next-line no-console
  console.error('\n[db] Gagal terhubung ke MongoDB\n');
  // eslint-disable-next-line no-console
  console.error('  Pesan  :', pesan);

  if (/auth/i.test(pesan)) {
    // eslint-disable-next-line no-console
    console.error('\n  Kemungkinan penyebab:');
    // eslint-disable-next-line no-console
    console.error('  1. Password di MONGODB_URI masih placeholder, misalnya "<db_password>".');
    // eslint-disable-next-line no-console
    console.error('     Ganti dengan password asli dari Atlas > Database Access > Database Users.');
    // eslint-disable-next-line no-console
    console.error('  2. Username salah atau belum dibuat.');
    // eslint-disable-next-line no-console
    console.error('  3. Password mengandung karakter khusus (@, :, /, ?, #) yang belum di-encode.');
    // eslint-disable-next-line no-console
    console.error('     Contoh: password "rahasia@123" jadi "rahasia%40123".');
  } else if (/getaddrinfo|ENOTFOUND/i.test(pesan)) {
    // eslint-disable-next-line no-console
    console.error('\n  Kemungkinan penyebab: hostname cluster salah di MONGODB_URI.');
  } else if (/timed out|timeout|network/i.test(pesan)) {
    // eslint-disable-next-line no-console
    console.error('\n  Kemungkinan penyebab:');
    // eslint-disable-next-line no-console
    console.error('  1. IP Address belum diizinkan di Atlas > Network Access.');
    // eslint-disable-next-line no-console
    console.error('     Tambahkan 0.0.0.0/0 (Allow access from anywhere).');
    // eslint-disable-next-line no-console
    console.error('  2. Koneksi internet bermasalah.');
  }

  // eslint-disable-next-line no-console
  console.error('');
}
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
        logKoneksiGagal(err);
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
