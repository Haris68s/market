/**
 * Titik masuk server.
 *
 * Urutannya penting:
 * 1. Hubungkan ke MongoDB dulu.
 * 2. Baru mulai menerima request.
 * 3. Tutup koneksi dengan rapi saat server dihentikan (Ctrl+C).
 */
'use strict';

const env = require('./config/env');
const app = require('./app');
const appConfig = require('./config/app.config');
const { connectDatabase, disconnectDatabase } = require('./config/db');
const imageService = require('./services/image.service');

async function start() {
  try {
    await connectDatabase();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('\n[GAGAL] Server tidak dapat dimulai karena database tidak terhubung.');
    // eslint-disable-next-line no-console
    console.error('Periksa MONGODB_URI di file .env, lalu jalankan: npm start\n');
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log(`  ${appConfig.name} siap berjalan`);
    // eslint-disable-next-line no-console
    console.log(`  Mode        : ${env.nodeEnv}`);
    // eslint-disable-next-line no-console
    console.log(`  URL         : ${env.appUrl}`);
    // eslint-disable-next-line no-console
    console.log(`  Database    : ${env.dbName}`);
    // eslint-disable-next-line no-console
    console.log(`  Penyimpanan : ${imageService.provider}${imageService.isImageServiceReady() ? '' : ' (belum siap)'}`);
    // eslint-disable-next-line no-console
    console.log('');
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`\n[${signal}] Mematikan server...`);
    server.close(async () => {
      await disconnectDatabase();
      // eslint-disable-next-line no-console
      console.log('Server ditutup dengan rapi.');
      process.exit(0);
    });
    // Paksa keluar bila ada koneksi yang menggantung.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
