/**
 * Cek kebocoran kredensial sebelum commit.
 *
 * Jalankan: npm run check-secrets
 *
 * Memeriksa apakah password/secret yang ada di .env ikut bocor ke file lain
 * (terutama .env.example yang ikut ter-commit ke GitHub).
 */
'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

/** File yang memang boleh berisi kredensial (tidak ikut ter-commit). */
const BOLEH_ADA = new Set(['.env']);

/**
 * Password demo/bawaan yang memang sengaja ditulis di kode (dipakai test & seed).
 * Nilainya bukan rahasia, jadi tidak dianggap bocor.
 */
const PASSWORD_DEMO = new Set([
  'Siswa12345',
  'Admin12345',
  'Pembeli123',
  'Rahasia123',
  'PasswordKuat123',
]);

/** Direktori yang tidak perlu diperiksa. */
const LEWATI_DIR = new Set(['node_modules', '.git', 'coverage', 'uploads', 'dist', 'build']);

function daftarFile(dir, hasil = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith('.') && item.name !== '.env.example') continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (LEWATI_DIR.has(item.name)) continue;
      daftarFile(full, hasil);
    } else {
      hasil.push(full);
    }
  }
  return hasil;
}

/** Ambil nilai sensitif dari .env */
function ambilSecret() {
  const secrets = [];
  if (!fs.existsSync(path.join(root, '.env'))) return secrets;

  const isi = fs.readFileSync(path.join(root, '.env'), 'utf8');
  isi.split('\n').forEach((baris) => {
    const match = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
    if (!match) return;
    const [, key, value] = match;
    if (!value || value.startsWith('<') || value.length < 6) return;
    if (!/(PASSWORD|SECRET|KEY|TOKEN|URI)/i.test(key)) return;
    if (PASSWORD_DEMO.has(value)) return;
    secrets.push({ key, value });

    // Untuk connection string, password di dalamnya juga harus dicek terpisah.
    // Password bisa bocor tanpa bagian URI lengkap ikut terbawa.
    const mongodb = value.match(/^mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/);
    if (mongodb) {
      const password = mongodb[3];
      if (password && !password.startsWith('<') && !PASSWORD_DEMO.has(password)) {
        secrets.push({ key: `${key} (password di dalamnya)`, value: password });
      }
    }
  });
  return secrets;
}

function main() {
  console.log('\n=== Cek Kebocoran Kredensial ===\n');

  const secrets = ambilSecret();
  if (!secrets.length) {
    console.log('  ✔ Tidak ada kredensial di .env yang perlu diperiksa.\n');
    return;
  }

  console.log(`  Memeriksa ${secrets.length} nilai sensitif dari .env ...\n`);

  // Kumpulkan file yang akan ikut ter-commit
  let tracked = [];
  try {
    const output = execSync('git ls-files', { cwd: root, encoding: 'utf8' });
    tracked = output.split('\n').filter(Boolean);
  } catch (err) {
    tracked = daftarFile(root).map((f) => path.relative(root, f));
  }

  const masalah = [];

  tracked.forEach((rel) => {
    if (BOLEH_ADA.has(rel)) return;
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) return;
    if (fs.statSync(full).size > 2 * 1024 * 1024) return;

    let isi = '';
    try {
      isi = fs.readFileSync(full, 'utf8');
    } catch (err) {
      return;
    }

    secrets.forEach(({ key, value }) => {
      if (isi.includes(value)) {
        masalah.push({ file: rel, key });
      }
    });
  });

  if (!masalah.length) {
    console.log('  ✔ Tidak ada kredensial yang bocor ke file yang ter-commit.\n');
    return;
  }

  console.error('  ✘ KREDENSIAL BOCOR ke file berikut:\n');
  masalah.forEach((m) => {
    console.error(`    - ${m.file}  (memuat nilai ${m.key} dari .env)`);
  });
  console.error('\n  Perbaiki: ganti nilai kredensial di file tersebut dengan placeholder.');
  console.error('  Contoh untuk .env.example:');
  console.error('    MONGODB_URI=mongodb+srv://<username>:<db_password>@cluster0.mongodb.net/\n');
  process.exitCode = 1;
}

main();
