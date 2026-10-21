/**
 * Migrasi data dari MongoDB lokal ke MongoDB Atlas (atau server lain).
 *
 * Dipakai saat kamu sudah selesai ng>data di laptop dan mau pindah ke Atlas.
 *
 * CARA PAKAI:
 *   1. Pastikan server lokal kamu masih jalan (atau jalankan mongod lokal).
 *   2. Isi MONGODB_URI di .env dengan connection string Atlas.
 *   3. Jalankan:
 *
 *        npm run migrate                 # salin semua data
 *        npm run migrate -- --dry-run    # lihat dulu rencana, tanpa menyalin
 *        npm run migrate -- --drop       # kosongkan dulu koleksi target
 *
 * PENTING:
 * - Kredensial database hanya dibaca dari .env / argumen, tidak pernah dicetak utuh.
 * - Koleksi "sessions" dilewati (session lama tidak perlu dipindah).
 * - Index ikut disalin supaya unique constraint tetap berlaku.
 */
'use strict';

require('dotenv').config();

const readline = require('readline');
const { MongoClient } = require('mongodb');

/* ------------------------------------------------------------------ */
/* Parsing argumen                                                      */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const args = { drop: false, dryRun: false, yes: false };

  argv.forEach((arg) => {
    if (arg === '--drop') args.drop = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--yes' || arg === '-y') args.yes = true;
    else if (arg.startsWith('--source=')) args.source = arg.slice(9);
    else if (arg.startsWith('--target=')) args.target = arg.slice(9);
    else if (arg.startsWith('--source-db=')) args.sourceDb = arg.slice(12);
    else if (arg.startsWith('--target-db=')) args.targetDb = arg.slice(12);
    else if (arg.startsWith('--only=')) args.only = arg.slice(7).split(',').map((s) => s.trim());
    else if (arg.startsWith('--skip=')) args.skip = arg.slice(7).split(',').map((s) => s.trim());
  });

  return args;
}

/** Sembunyikan password di connection string supaya aman ditampilkan. */
function maskUri(uri) {
  return String(uri).replace(/\/\/([^:]+):([^@]+)@/, '//$1:********@');
}

function humanSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/* ------------------------------------------------------------------ */
/* Inti migrasi                                                         */
/* ------------------------------------------------------------------ */

async function listCollectionNames(db) {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  return collections.map((c) => c.name).filter((n) => !n.startsWith('system.'));
}

async function copyCollection(sourceDb, targetDb, name, options) {
  const started = Date.now();
  const sourceCollection = sourceDb.collection(name);
  const targetCollection = targetDb.collection(name);

  const totalDocs = await sourceCollection.countDocuments();
  const sizeRows = await sourceCollection
    .aggregate([{ $group: { _id: null, size: { $sum: { $bsonSize: '$$ROOT' } } } }])
    .toArray();
  const totalBytes = sizeRows.length ? sizeRows[0].size : 0;

  if (options.drop) {
    await targetCollection.deleteMany({});
  }

  // Salin dokumen per batch supaya tidak makan RAM untuk data besar.
  const BATCH = 500;
  let copied = 0;
  let cursor = sourceCollection.find({});

  for await (const batch of cursor.stream()) {
    // eslint-disable-next-line no-await-in-loop
    const docs = Array.isArray(batch) ? batch : [batch];
    if (!docs.length) continue;
    // eslint-disable-next-line no-await-in-loop
    await targetCollection.insertMany(docs, { ordered: false });
    copied += docs.length;
    if (copied % 2000 === 0) {
      process.stdout.write(`    ... ${copied}/${totalDocs}\n`);
    }
  }
  await cursor.close();

  // Salin index (kecuali index bawaan _id_) supaya unique constraint tetap berlaku.
  let indexCount = 0;
  try {
    const indexes = await sourceCollection.listIndexes().toArray();
    for (const index of indexes) {
      if (index.name === '_id_') continue;

      // Hanya kirim opsi yang memang terisi (MongoDB menolak nilai null).
      const indexOptions = { name: index.name };
      if (index.unique) indexOptions.unique = true;
      if (index.sparse) indexOptions.sparse = true;
      if (typeof index.expireAfterSeconds === 'number') {
        indexOptions.expireAfterSeconds = index.expireAfterSeconds;
      }
      if (index.partialFilterExpression) {
        indexOptions.partialFilterExpression = index.partialFilterExpression;
      }
      // Index text: listIndexes() mengubah bentuknya jadi internal
      // ({_fts:"text"}), jadi bobot field-aslinya harus ikut disalin.
      if (index.weights) {
        indexOptions.weights = index.weights;
      }
      if (index.default_language) {
        indexOptions.default_language = index.default_language;
      }
      if (index.language_override) {
        indexOptions.language_override = index.language_override;
      }

      // eslint-disable-next-line no-await-in-loop
      await targetCollection.createIndex(index.key, indexOptions);
      indexCount += 1;
    }
  } catch (err) {
    process.stdout.write(`    (index dilewati: ${err.message})\n`);
  }

  return {
    name,
    totalDocs,
    copied,
    bytes: totalBytes,
    indexes: indexCount,
    ms: Date.now() - started,
  };
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const sourceUri = args.source || process.env.MIGRATE_SOURCE_URI || 'mongodb://127.0.0.1:27017';
  const sourceDbName = args.sourceDb || process.env.MIGRATE_SOURCE_DB || 'kantinsiswa';
  const targetUri = args.target || process.env.MIGRATE_TARGET_URI || process.env.MONGODB_URI || '';
  const targetDbName = args.targetDb || process.env.MIGRATE_TARGET_DB || process.env.MONGODB_DB_NAME || 'kantinsiswa';

  console.log('\n=== Migrasi Data MongoDB ===\n');
  console.log(`  Sumber : ${maskUri(sourceUri)} / ${sourceDbName}`);
  console.log(`  Target : ${targetUri ? `${maskUri(targetUri)} / ${targetDbName}` : '(belum diisi)'}`);

  if (!targetUri) {
    console.error('\n[ERROR] URI target belum diisi.');
    console.error('Isi MONGODB_URI di file .env, atau jalankan:');
    console.error('  node scripts/migrate-to-atlas.js --target="mongodb+srv://user:password@cluster.mongodb.net"\n');
    process.exit(1);
  }

  if (sourceUri === targetUri && sourceDbName === targetDbName) {
    console.error('\n[ERROR] Sumber dan target sama. Migrasi tidak akan terjadi.\n');
    process.exit(1);
  }

  const skip = new Set(args.skip || ['sessions']);
  if (args.only) {
    ['sessions'].forEach((s) => skip.add(s));
  }

  const sourceClient = new MongoClient(sourceUri, { serverSelectionTimeoutMS: 10000 });
  const targetClient = new MongoClient(targetUri, { serverSelectionTimeoutMS: 15000 });

  try {
    await sourceClient.connect();
    await targetClient.connect();
  } catch (err) {
    console.error(`\n[ERROR] Gagal terhubung: ${err.message}`);
    console.error('Cek server lokal menyala & connection string target sudah benar.\n');
    await sourceClient.close().catch(() => {});
    await targetClient.close().catch(() => {});
    process.exit(1);
  }

  const sourceDb = sourceClient.db(sourceDbName);
  const targetDb = targetClient.db(targetDbName);

  let names = await listCollectionNames(sourceDb);

  if (args.only) {
    names = names.filter((n) => args.only.includes(n));
  }
  names = names.filter((n) => !skip.has(n));

  if (!names.length) {
    console.log('\n  Tidak ada koleksi yang akan disalin.\n');
    await sourceClient.close();
    await targetClient.close();
    return;
  }

  // Hitung dulu supaya ada ikhtisar sebelum Askal menanyakan.
  const plans = [];
  for (const name of names) {
    // eslint-disable-next-line no-await-in-loop
    const count = await sourceDb.collection(name).countDocuments();
    plans.push({ name, count });
  }

  console.log('\n  Koleksi yang akan disalin:');
  plans.forEach((p) => {
    console.log(`    - ${p.name.padEnd(16)} ${String(p.count).padStart(6)} dokumen`);
  });

  if (args.drop) {
    console.log('\n  ⚠️  Mode --drop: koleksi di target akan DIKOSONGKAN dulu.');
  }
  if (args.dryRun) {
    console.log('\n  Mode --dry-run: tidak ada data yang diubah.\n');
    await sourceClient.close();
    await targetClient.close();
    return;
  }

  if (!args.yes) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await confirm('\n  Lanjutkan migrasi? (y/n): ');
    if (!ok) {
      console.log('  Dibatalkan.\n');
      await sourceClient.close();
      await targetClient.close();
      return;
    }
  }

  const results = [];
  for (const name of names) {
    process.stdout.write(`  → ${name} ...\n`);
    // eslint-disable-next-line no-await-in-loop
    const result = await copyCollection(sourceDb, targetDb, name, args);
    results.push(result);
    process.stdout.write(
      `    selesai: ${result.copied} dokumen, ${result.indexes} index, ${humanSize(result.bytes)}, ${result.ms} ms\n`
    );
  }

  const totalDocs = results.reduce((sum, r) => sum + r.copied, 0);
  const totalBytes = results.reduce((sum, r) => sum + r.bytes, 0);

  console.log('\n=== Migrasi selesai ===');
  console.log(`  Total dokumen : ${totalDocs}`);
  console.log(`  Total ukuran  : ${humanSize(totalBytes)}`);
  console.log(`  Durasi        : ${results.reduce((s, r) => s + r.ms, 0)} ms`);
  console.log(`  Target        : ${maskUri(targetUri)} / ${targetDbName}\n`);
  console.log('  Tips: aplikasi harus dalam keadaan STOP saat migrasi,');
  console.log('  supaya tidak ada data yang masuk saat proses copy.\n');

  await sourceClient.close();
  await targetClient.close();
}

module.exports = { copyCollection, listCollectionNames, maskUri, parseArgs };

if (require.main === module) {
  main().catch((err) => {
    console.error('\n[ERROR] Migrasi gagal:', err.message, '\n');
    process.exit(1);
  });
}
