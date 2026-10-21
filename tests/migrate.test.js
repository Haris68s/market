/**
 * Test skrip migrasi data lokal -> server lain.
 *
 * Menguji fungsi inti migrasi (salin dokumen + salin index) memakai dua
 * database di memory server yang sama.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient } = require('mongodb');

const { setupDatabase, teardownDatabase, clearDatabase } = require('./helpers/db');
const { copyCollection, maskUri, parseArgs } = require('../scripts/migrate-to-atlas');

let app;
let client;
let sourceDb;
let targetDb;

test.before(async () => {
  await setupDatabase();
  app = require('../src/app');

  // Pakai URI yang sama dengan yang dipakai helper db (dijamin terisi).
  const uri = process.env.MONGODB_URI;
  assert.ok(uri, 'MONGODB_URI harus terisi oleh helper db');

  client = new MongoClient(uri);
  await client.connect();
  sourceDb = client.db('uji_migrasi_sumber');
  targetDb = client.db('uji_migrasi_target');
});

test.after(async () => {
  await client.db('uji_migrasi_sumber').dropDatabase();
  await client.db('uji_migrasi_target').dropDatabase();
  await client.close();
  await teardownDatabase(app);
});

test.beforeEach(async () => {
  await sourceDb.dropDatabase();
  await targetDb.dropDatabase();
});

test('dokumen tersalin lengkap ke database target', async () => {
  await sourceDb.collection('produk').insertMany([
    { nama: 'Kopi Susu', harga: 12000, stok: 10 },
    { nama: 'Roti Bakar', harga: 8000, stok: 5 },
    { nama: 'Es Teh', harga: 5000, stok: 20 },
  ]);

  const result = await copyCollection(sourceDb, targetDb, 'produk', {});

  assert.equal(result.copied, 3);
  assert.equal(result.totalDocs, 3);

  const tersalin = await targetDb.collection('produk').find({}).toArray();
  assert.equal(tersalin.length, 3);
  assert.deepEqual(
    tersalin.map((d) => d.nama).sort(),
    ['Es Teh', 'Kopi Susu', 'Roti Bakar']
  );
});

test('index ikut tersalin supaya unique constraint tetap berlaku', async () => {
  await sourceDb.collection('pengguna').insertMany([
    { whatsapp: '628111', name: 'A' },
    { whatsapp: '628222', name: 'B' },
  ]);
  await sourceDb.collection('pengguna').createIndex({ whatsapp: 1 }, { unique: true, name: 'whatsapp_1' });

  const result = await copyCollection(sourceDb, targetDb, 'pengguna', {});

  assert.ok(result.indexes >= 1, 'index harus ikut tersalin');

  const indexes = await targetDb.collection('pengguna').listIndexes().toArray();
  const unik = indexes.find((i) => i.name === 'whatsapp_1');
  assert.ok(unik, 'index whatsapp_1 harus ada di target');
  assert.equal(unik.unique, true);

  // Unique constraint harus benar-benar berlaku di target
  await assert.rejects(
    () => targetDb.collection('pengguna').insertOne({ whatsapp: '628111', name: 'C' }),
    (err) => err.code === 11000
  );
});

test('opsi --drop mengosongkan target sebelum menyalin', async () => {
  await sourceDb.collection('produk').insertMany([{ nama: 'Baru' }]);
  await targetDb.collection('produk').insertMany([{ nama: 'Lama' }, { nama: 'Lama2' }]);

  await copyCollection(sourceDb, targetDb, 'produk', { drop: true });

  const tersalin = await targetDb.collection('produk').find({}).toArray();
  assert.equal(tersalin.length, 1);
  assert.equal(tersalin[0].nama, 'Baru');
});

test('koleksi kosong tetaphandled tanpa error', async () => {
  const result = await copyCollection(sourceDb, targetDb, 'koleksi_kosong', {});
  assert.equal(result.copied, 0);
  assert.equal(result.totalDocs, 0);
});

test('password string di sampler aman ditampilkan', () => {
  const uri = 'mongodb+srv://user:supersecret@cluster0.mongodb.net/db';
  const masked = maskUri(uri);
  assert.equal(masked.includes('supersecret'), false);
  assert.ok(masked.includes('********'));
  // URI tanpa kredensial tetap aman
  assert.equal(maskUri('mongodb://127.0.0.1:27017'), 'mongodb://127.0.0.1:27017');
});

test('argumen baris perintah terbaca dengan benar', () => {
  const args = parseArgs(['--dry-run', '--drop', '--yes', '--only=users,products', '--skip=reviews']);
  assert.equal(args.dryRun, true);
  assert.equal(args.drop, true);
  assert.equal(args.yes, true);
  assert.deepEqual(args.only, ['users', 'products']);
  assert.deepEqual(args.skip, ['reviews']);
});
