/**
 * Cek koneksi ke MongoDB Atlas.
 *
 * Jalankan: npm run check-db
 *
 * Berguna untuk memastikan:
 * - Connection string benar (host & username)
 * - Password sudah diganti (bukan placeholder)
 * - IP Address sudah diizinkan di Atlas > Network Access
 * - Database & koleksinya bisa ditulis
 */
'use strict';

require('dotenv').config();

const { MongoClient } = require('mongodb');

/** Sembunyikan password saat ditampilkan. */
function maskUri(uri) {
  return String(uri).replace(/\/\/([^:]+):([^@]*)@/, '//$1:********@');
}

function beriKode(berhasil, label) {
  console.log(`  ${berhasil ? '✔' : '✘'} ${label}`);
}

async function main() {
  const uri = process.env.MONGODB_URI || '';
  const dbName = process.env.MONGODB_DB_NAME || 'kantinsiswa';

  console.log('\n=== Cek Koneksi MongoDB Atlas ===\n');

  if (!uri) {
    console.error('  ✘ MONGODB_URI belum diisi di .env\n');
    process.exit(1);
  }

  console.log(`  URI      : ${maskUri(uri)}`);
  console.log(`  Database : ${dbName}`);

  if (uri.includes('<db_password>')) {
    console.error('\n  ✘ Password masih placeholder "<db_password>".');
    console.error('    Ganti dengan password Atlas asli (Database Access > Database Users).');
    console.error('    Password tidak bisa dibaca ulang dari Atlas — kalau lupa, buat user baru.\n');
    process.exit(1);
  }

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
  });

  try {
    await client.connect();
  } catch (err) {
    console.error(`\n  ✘ Gagal terhubung: ${err.message}\n`);
    if (/auth/i.test(err.message)) {
      console.error('    Penyebab yang paling sering:');
      console.error('    - Username atau password salah');
      console.error('    - Password mengandung karakter khusus yang belum di-encode');
      console.error('      (contoh: "rahasia@123" -> "rahasia%40123")\n');
    } else if (/timed out|timeout/i.test(err.message)) {
      console.error('    Penyebab yang paling sering:');
      console.error('    - IP Address belum diizinkan di Atlas > Network Access');
      console.error('      Tambahkan 0.0.0.0/0 (Allow access from anywhere)\n');
    } else {
      console.error('    Cek juga hostname cluster & koneksi internetmu.\n');
    }
    await client.close().catch(() => {});
    process.exit(1);
  }

  console.log('\n  Koneksi BERHASIL\n');

  const db = client.db(dbName);

  try {
    await db.collection('__cek_koneksi').insertOne({ cek: true, pada: new Date() });
    await db.collection('__cek_koneksi').drop(); // hapus collection-nya, jangan hanya dokumennya
    beriKode(true, 'Database bisa ditulis (read & write)');
  } catch (err) {
    beriKode(false, `Tidak bisa menulis ke database: ${err.message}`);
  }

  try {
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const nama = collections.map((c) => c.name).filter((n) => !n.startsWith('system.'));
    beriKode(true, `Koleksi yang ada: ${nama.length ? nama.join(', ') : '(belum ada, normal untuk database baru)'}`);
  } catch (err) {
    beriKode(false, `Gagal membaca daftar koleksi: ${err.message}`);
  }

  const info = await db.admin().serverInfo().catch(() => null);
  if (info && info.version) {
    beriKode(true, `Versi server MongoDB: ${info.version}`);
  }

  // Cek apakah sudah ada akun super admin di database ini.
  // Ini penyebab paling umum "gak bisa masuk ke super admin":
  // akunnya dibuat di database lain (mis. lokal) lalu database-nya diganti.
  try {
    const admins = await db.collection('users').countDocuments({ role: 'superadmin' });
    if (admins > 0) {
      beriKode(true, `Akun super admin tersedia: ${admins}`);
    } else {
      beriKode(false, 'BELUM ada akun super admin di database ini.');
      console.error('    Jalankan: npm run create-admin');
      console.error('    (isi BOOTSTRAP_ADMIN_* di .env lebih dulu, lalu kosongkan lagi)\n');
    }
  } catch (err) {
    console.error(`    (tidak bisa mengecek super admin: ${err.message})`);
  }

  const totalUser = await db.collection('users').countDocuments().catch(() => 0);
  console.log(`\n  Total akun penjual di database ini: ${totalUser}`);

  console.log('\n  Semua siap. Jalankan: npm run seed (kalau database masih kosong)\n');

  await client.close();
}

main().catch((err) => {
  console.error('\n[ERROR]', err.message, '\n');
  process.exit(1);
});
