/**
 * Global setup untuk test runner Node.
 *
 * Menyalakan SATU MongoDB di memory yang dipakai semua berkas test.
 * URI-nya ditulis ke file sementara supaya berkas test (yang berjalan di
 * proses terpisah) bisa-finding database yang sama.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MongoMemoryServer } = require('mongodb-memory-server');

const URI_FILE = path.join(os.tmpdir(), 'kantinsiswa-test-mongo-uri.txt');

let server = null;

module.exports.setup = async () => {
  server = await MongoMemoryServer.create({
    binary: { version: '8.2.6' },
  });
  fs.writeFileSync(URI_FILE, server.getUri(), 'utf8');
};

module.exports.teardown = async () => {
  try {
    fs.unlinkSync(URI_FILE);
  } catch (err) {
    // file sudah hilang, tidak masalah
  }
  if (server) {
    await server.stop();
    server = null;
  }
};

module.exports.URI_FILE = URI_FILE;
