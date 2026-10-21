/**
 * Seed data contoh untuk pengembangan.
 *
 * Jalankan: npm run seed
 *
 * Data contoh dibuat di database Development. Hapus collection "products",
 * "stores", dan "users" secara manual bila ingin memulai dari nol.
 */
'use strict';

require('dotenv').config();

const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../src/config/db');
const { Category, User, Store, Product, Review, Order } = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const { normalizeWhatsapp } = require('../src/utils/whatsapp');
const { slugify, randomSuffix } = require('../src/utils/format');

const CATEGORIES = [
  { name: 'Makanan & Minuman', icon: 'utensils', description: 'Jajan, kue, dan minuman buatan teman.' },
  { name: 'Fashion', icon: 'shirt', description: 'Baju, sepatu, aksesori.' },
  { name: 'Elektronik', icon: 'smartphone', description: 'Aksesori & Gadget.' },
  { name: 'Buku & Alat Tulis', icon: 'book-open', description: 'Buku, alat tulis, dan perlengkapan sekolah.' },
  { name: 'Jasa', icon: 'wrench', description: 'Jasa lukis, jahit, editing, dan lainnya.' },
  { name: 'Kriya', icon: 'palette', description: 'Karya tangan handmade.' },
];

const SELLERS = [
  {
    name: 'Budi Santoso',
    storeName: 'Kedai Budi',
    whatsapp: '081234567890',
    category: 'makanan-minuman',
    city: 'Bandung',
    description: 'Jajanan Passive menerima pesanan tiap jam istirahat. Cocok buat kelas dan event sekolah.',
    products: [
      { name: 'Kopi Susu Gula Aren', price: 12000, stock: 20, description: 'Kopi susu aren handmade, kadar gula aren 30%.' },
      { name: 'Roti Bakar Cokelat', price: 8000, stock: 15, description: 'Rotianggang lembut dengan cokelat Belgium.' },
      { name: 'Es Teh Manis', price: 5000, stock: 30, description: 'Teh xl dengan gula aren, ukuran reguler.' },
    ],
  },
  {
    name: 'Siti Nurhaliza',
    storeName: 'Roncesyee',
    whatsapp: '081298765432',
    category: 'fashion',
    city: 'Bandung',
    description: 'Jaket unisex, size S sampai XL. Bisa request bordir nama (biaya tambahan).',
    products: [
      { name: 'Hoodie Katun Premium', price: 120000, stock: 8, description: 'Hoodie cotton combed 30s, sablon plastisol.' },
      { name: 'Tote Bag Kanvas', price: 35000, stock: 12, description: 'Tote bag kanvas 12 oz, muat laptop 14 inch.' },
      { name: 'Keychain Rajut', price: 12000, stock: 40, description: 'Keychain rajut handmade, bisa custom warna.' },
    ],
  },
  {
    name: 'Andi Saputra',
    storeName: 'Jasa Andi',
    whatsapp: '081377788899',
    category: 'jasa',
    city: 'Bandung',
    description: 'Edit video, desain poster, dan bantu tugasPresentasi.',
    products: [
      { name: 'Edit Video 1 Menit', price: 50000, stock: 10, description: 'Edit 1 menit video termasuk musik & transisi.' },
      { name: 'Desain Poster 1 Lembar', price: 35000, stock: 15, description: 'Poster school event, file JPG & PNG.' },
      { name: 'Bantu Tugas Presentasi', price: 25000, stock: 20, description: 'Bantu merapikan & mendesain slide presentasi.' },
    ],
  },
];

async function upsertCategories() {
  const result = [];
  for (const [index, item] of CATEGORIES.entries()) {
    const slug = slugify(item.name);
    // eslint-disable-next-line no-await-in-loop
    const category = await Category.findOneAndUpdate(
      { slug },
      { ...item, slug, order: index + 1, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    result.push(category);
  }
  // eslint-disable-next-line no-console
  console.log(`  Kategori  : ${result.length} kategori siap`);
  return result;
}

async function upsertSeller(sellerData) {
  const whatsapp = normalizeWhatsapp(sellerData.whatsapp);
  let user = await User.findOne({ whatsapp });

  if (!user) {
    // eslint-disable-next-line no-await-in-loop
    user = await User.create({
      role: 'seller',
      name: sellerData.name,
      whatsapp,
      passwordHash: await hashPassword('Siswa12345'),
      status: 'active',
      email: null,
    });
  }

  let store = await Store.findOne({ ownerId: user._id });
  if (!store) {
    const base = slugify(sellerData.storeName);
    // eslint-disable-next-line no-await-in-loop
    store = await Store.create({
      ownerId: user._id,
      name: sellerData.storeName,
      slug: (await Store.exists({ slug: base })) ? `${base}-${randomSuffix(4)}` : base,
      description: sellerData.description,
      category: sellerData.category,
      whatsapp,
      location: {
        address: '',
        city: sellerData.city,
        showAddress: true,
        showExactAddress: false,
      },
      status: 'active',
      isFeatured: true,
    });
    // eslint-disable-next-line no-await-in-loop
    await User.updateOne({ _id: user._id }, { $set: { storeId: store._id } });
  }

  const productIds = [];
  for (const productData of sellerData.products) {
    const base = slugify(productData.name);
    // eslint-disable-next-line no-await-in-loop
    let product = await Product.findOne({ storeId: store._id, name: productData.name });
    if (!product) {
      // eslint-disable-next-line no-await-in-loop
      product = await Product.create({
        storeId: store._id,
        sellerId: user._id,
        name: productData.name,
        slug: (await Product.exists({ slug: base })) ? `${base}-${randomSuffix(4)}` : base,
        category: sellerData.category,
        price: productData.price,
        description: productData.description,
        stock: productData.stock,
        status: 'active',
        images: [],
        soldCount: 0,
      });
    }
    productIds.push(product._id);
  }

  return { user, store, productIds };
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('\n=== Seed data KantinSiswa ===\n');

  await connectDatabase();
  await upsertCategories();

  let productTotal = 0;
  for (const seller of SELLERS) {
    // eslint-disable-next-line no-await-in-loop
    const result = await upsertSeller(seller);
    productTotal += result.productIds.length;
    // eslint-disable-next-line no-console
    console.log(`  Toko       : ${result.store.name} (${result.productIds.length} produk)`);
  }

  // Pesanan & ulasan contoh (agar "terlaris" dan "rating tertinggi" punya data nyata).
  const orders = await Order.find({}).limit(1);
  if (orders.length === 0) {
    const firstStore = await Store.findOne({});
    const products = await Product.find({ storeId: firstStore._id });

    // Akun pembeli demo: pakai yang sudah ada kalau pernah di-seed sebelumnya,
    // supaya `npm run seed` bisa dijalankan berulang tanpa error.
    const buyerWa = normalizeWhatsapp('081399988877');
    let buyer = await User.findOne({ whatsapp: buyerWa });
    if (!buyer) {
      buyer = await User.create({
        role: 'seller',
        name: 'Pembeli Demo',
        whatsapp: buyerWa,
        passwordHash: await hashPassword('Siswa12345'),
        status: 'active',
      });
    }

    const sampleOrders = [];
    for (let i = 0; i < products.length; i += 1) {
      const product = products[i];
      const qty = (i % 3) + 1;
      // eslint-disable-next-line no-await-in-loop
      const order = await Order.create({
        orderCode: `KS-DEMO${String(i + 1).padStart(3, '0')}`,
        productId: product._id,
        storeId: firstStore._id,
        sellerId: firstStore.ownerId,
        buyerId: buyer._id,
        buyerName: buyer.name,
        buyerContact: buyer.whatsapp,
        qty,
        priceSnapshot: product.price,
        productNameSnapshot: product.name,
        subtotal: product.price * qty,
        status: 'completed',
        waMessage: 'Pesanan demo',
        waLink: 'https://wa.me/6281234567890',
        completedAt: new Date(),
      });
      sampleOrders.push({ order, product });

      // eslint-disable-next-line no-await-in-loop
      await Review.create({
        productId: product._id,
        storeId: firstStore._id,
        sellerId: firstStore.ownerId,
        orderId: order._id,
        buyerId: buyer._id,
        rating: 5,
        comment: 'Barang sesuai deskripsi, pengirimannya cepat. Recommended!',
        status: 'published',
      });

      // eslint-disable-next-line no-await-in-loop
      await Product.updateOne({ _id: product._id }, { $inc: { soldCount: qty } });

      // Perbarui cache rating produk & toko (dikerjakan service saat ulasan
      // dibuat lewat aplikasi, jadi di seed harus dipanggil manual).
      // eslint-disable-next-line global-require
      const productService = require('../src/services/product.service');
      // eslint-disable-next-line no-await-in-loop
      await productService.refreshProductRating(product._id);
      // eslint-disable-next-line no-await-in-loop
      await productService.refreshStoreRating(firstStore._id);
    }

    await Store.updateOne({ _id: firstStore._id }, { $set: { totalSold: sampleOrders.length } });
    // eslint-disable-next-line no-console
    console.log(`  Pesanan    : ${sampleOrders.length} pesanan selesai (demo)`);
  }

  // eslint-disable-next-line no-console
  console.log(`\n  Total produk: ${productTotal}`);
  // eslint-disable-next-line no-console
  console.log('\nAkun demo (password: Siswa12345):');
  SELLERS.forEach((seller) => {
    // eslint-disable-next-line no-console
    console.log(`  - ${seller.name} / ${seller.whatsapp} / toko "${seller.storeName}"`);
  });
  // eslint-disable-next-line no-console
  console.log('\nSelesai.\n');

  await disconnectDatabase();
  await mongoose.connection.close();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('Seed gagal:', err);
  await mongoose.connection.close();
  process.exit(1);
});
