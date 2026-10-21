/**
 * Membuat akun super admin.
 *
 * ⚠️ Akun super admin TIDAK bisa dibuat dari halaman pendaftaran.
 *    Semua akun admin dibuat lewat skrip ini (proses setup backend yang aman).
 *
 * Cara pakai:
 *   1. Isi BOOTSTRAP_ADMIN_* di .env, lalu:  npm run create-admin
 *   2. ATAU jalankan langsung dan isi datanya secara interaktif:
 *        npm run create-admin
 *
 * Setelah akun dibuat, kosongkan / hapus variabel BOOTSTRAP_ADMIN_* dari .env.
 */
'use strict';

require('dotenv').config();

const readline = require('readline');
const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../src/config/db');
const { User } = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const { normalizeWhatsapp } = require('../src/utils/whatsapp');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const env = require('../src/config/env');

  let name = env.bootstrapAdmin.name;
  let whatsapp = env.bootstrapAdmin.whatsapp;
  let password = env.bootstrapAdmin.password;
  let email = env.bootstrapAdmin.email;

  if (!name || !whatsapp || !password) {
    // eslint-disable-next-line no-console
    console.log('\n=== Buat Akun Super Admin ===');
    // eslint-disable-next-line no-console
    console.log('Isi data di bawah (tekan Enter untuk memakai nilai dari .env)\n');
    name = name || (await ask('Nama lengkap            : '));
    whatsapp = whatsapp || (await ask('Nomor WhatsApp (08...)   : '));
    password = password || (await ask('Password (min 8 karakter): '));
    email = email || (await ask('Email (opsional)         : '));
  }

  if (!name || !whatsapp || !password) {
    // eslint-disable-next-line no-console
    console.error('\nData belum lengkap. Isi nama, WhatsApp, dan password.\n');
    process.exit(1);
  }

  if (password.length < 8) {
    // eslint-disable-next-line no-console
    console.error('\nPassword terlalu pendek (minimal 8 karakter).\n');
    process.exit(1);
  }

  const normalizedWa = normalizeWhatsapp(whatsapp);

  await connectDatabase();

  const existing = await User.findOne({ whatsapp: normalizedWa });
  if (existing) {
    if (existing.role === 'superadmin') {
      // eslint-disable-next-line no-console
      console.log('\nAkun ini sudah berperan super admin.\n');
    } else {
      // eslint-disable-next-line no-console
      console.log('\nNomor ini sudah dipakai akun penjual. Memperbarui role & password...\n');
      existing.role = 'superadmin';
      existing.passwordHash = await hashPassword(password);
      existing.status = 'active';
      await existing.save();
    }
    await disconnectDatabase();
    return;
  }

  const user = await User.create({
    role: 'superadmin',
    name,
    whatsapp: normalizedWa,
    email: email || null,
    passwordHash: await hashPassword(password),
    status: 'active',
  });

  // eslint-disable-next-line no-console
  console.log('\n✅ Akun super admin berhasil dibuat.');
  // eslint-disable-next-line no-console
  console.log(`   Nama     : ${user.name}`);
  // eslint-disable-next-line no-console
  console.log(`   WhatsApp : ${user.whatsapp}`);
  // eslint-disable-next-line no-console
  console.log('   Hapus variabel BOOTSTRAP_ADMIN_* dari .env demi keamanan.\n');

  await disconnectDatabase();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('\nGagal membuat akun super admin:', err.message, '\n');
  await mongoose.connection.close();
  process.exit(1);
});
