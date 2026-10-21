/**
 * Service keuangan (pembukuan toko).
 *
 * Rumus dasar:
 *   Total pemasukan = jumlah seluruh transaksi pemasukan pada periode terpilih
 *   Total pengeluaran = jumlah seluruh transaksi pengeluaran pada periode terpilih
 *   Selisih arus kas = total pemasukan - total pengeluaran
 *
 * CATATAN PENTING:
 * - "Keuntungan bersih" di sini berarti SELISIH ARUS KAS, bukan laba akuntansi.
 *   Nilainya hanya akurat bila semua modal & biaya ikut dicatat oleh penjual.
 * - Pesanan yang baru dibuat TIDAK otomatis menjadi pemasukan. Pemasukan dari
 *   pesanan hanya dicatat setelah penjual mengonfirmasi & mencatat pembayaran.
 */
'use strict';

const AppError = require('../utils/AppError');
const { Transaction } = require('../models');
const { toObjectId } = require('./product.service');

/**
 * Hitung rentang tanggal berdasarkan periode.
 * @param {string} period 'daily' | 'weekly' | 'monthly' | 'custom' | 'all'
 */
function getPeriodRange(period = 'monthly', from, to) {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'daily':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'weekly': {
      const start = startOfDay(now);
      start.setDate(start.getDate() - (start.getDay() === 0 ? 6 : start.getDay() - 1));
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start, end: endOfDay(end) };
    }
    case 'monthly': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end: endOfDay(end) };
    }
    case 'custom': {
      if (!from || !to) {
        throw AppError.badRequest('Rentang tanggal custom wajib diisi (from & to).');
      }
      const start = startOfDay(new Date(from));
      const end = endOfDay(new Date(to));
      if (start > end) {
        throw AppError.badRequest('Tanggal awal harus lebih dulu dari tanggal akhir.');
      }
      return { start, end };
    }
    case 'all':
    default:
      return { start: null, end: null };
  }
}

/** Bangun filter transaksi berdasarkan parameter. */
function buildTransactionFilter({ storeId, type, category, from, to }) {
  const filter = { storeId: toObjectId(storeId), deletedAt: null };

  if (type && type !== 'all') filter.type = type;
  if (category && category !== 'all') filter.category = category;

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  return filter;
}

/**
 * Ringkasan keuangan untuk dashboard.
 */
async function summarize({ storeId, from, to }) {
  const filter = buildTransactionFilter({ storeId, from, to });

  const totals = await Transaction.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  const byType = { income: { total: 0, count: 0 }, expense: { total: 0, count: 0 } };
  totals.forEach((row) => {
    if (row._id === 'income' || row._id === 'expense') {
      byType[row._id] = { total: row.total, count: row.count };
    }
  });

  const income = byType.income.total;
  const expense = byType.expense.total;

  const byCategory = await Transaction.aggregate([
    { $match: filter },
    {
      $group: {
        _id: { type: '$type', category: '$category' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);

  // Arus kas per hari (14 hari terakhir) untuk grafik.
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const cashFlow = await Transaction.aggregate([
    { $match: { ...filter, date: { $gte: since } } },
    {
      $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' }, day: { $dayOfMonth: '$date' } },
        income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
        expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
  ]);

  const cashFlowMap = new Map(
    cashFlow.map((row) => [
      `${row._id.year}-${String(row._id.month).padStart(2, '0')}-${String(row._id.day).padStart(2, '0')}`,
      { income: row.income, expense: row.expense },
    ])
  );

  const series = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const value = cashFlowMap.get(key) || { income: 0, expense: 0 };
    series.push({
      date: key,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      income: value.income,
      expense: value.expense,
      net: value.income - value.expense,
    });
  }

  return {
    income,
    expense,
    net: income - expense,
    transactionCount: byType.income.count + byType.expense.count,
    incomeCount: byType.income.count,
    expenseCount: byType.expense.count,
    byCategory: byCategory.map((row) => ({
      type: row._id.type,
      category: row._id.category,
      total: row.total,
      count: row.count,
    })),
    cashFlow: series,
    note:
      'Selisih arus kas = pemasukan - pengeluaran. Angka ini belum tentu sama dengan laba, karena belum tentu semua modal dan biaya dicatat.',
  };
}

/** Daftar transaksi dengan pagination. */
async function listTransactions({ storeId, type, category, from, to, page = 1, limit = 20 }) {
  const filter = buildTransactionFilter({ storeId, type, category, from, to });

  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ date: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Transaction.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Tambah transaksi manual. */
async function createTransaction({ storeId, sellerId, type, category, amount, description, date }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw AppError.badRequest('Nominal harus lebih besar dari 0.', [
      { field: 'amount', message: 'Nominal harus lebih besar dari 0.' },
    ]);
  }

  const transaction = await Transaction.create({
    storeId: toObjectId(storeId),
    sellerId: toObjectId(sellerId),
    type,
    category: String(category || '').toLowerCase(),
    amount: value,
    description: description || '',
    date: date ? new Date(date) : new Date(),
    source: 'manual',
  });

  return transaction;
}

/**
 * Ubah transaksi manual.
 * Transaksi yang berasal dari pesanan (source: 'order') TIDAK boleh diedit/hapus,
 * supaya riwayat pembukuan tetap konsisten dengan pesanan.
 */
async function updateTransaction({ transactionId, storeId, type, category, amount, description, date }) {
  const transaction = await Transaction.findOne({
    _id: toObjectId(transactionId),
    storeId: toObjectId(storeId),
    deletedAt: null,
  }).lean();

  if (!transaction) {
    throw AppError.notFound('Transaksi tidak ditemukan atau bukan milik toko Anda.');
  }
  if (transaction.source === 'order') {
    throw AppError.badRequest(
      'Transaksi yang berasal dari pesanan tidak dapat diedit. Batalkan pesanan atau catat transaksi penyeimbang secara manual.'
    );
  }

  const patch = {};
  if (type) patch.type = type;
  if (category) patch.category = String(category).toLowerCase();
  if (amount !== undefined) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      throw AppError.badRequest('Nominal harus lebih besar dari 0.', [
        { field: 'amount', message: 'Nominal harus lebih besar dari 0.' },
      ]);
    }
    patch.amount = value;
  }
  if (description !== undefined) patch.description = description;
  if (date) patch.date = new Date(date);

  const updated = await Transaction.findOneAndUpdate({ _id: transaction._id }, { $set: patch }, { new: true }).lean();
  return updated;
}

/** Hapus transaksi manual (soft delete, supaya pembukuan tidak "berhilang"). */
async function deleteTransaction({ transactionId, storeId }) {
  const transaction = await Transaction.findOne({
    _id: toObjectId(transactionId),
    storeId: toObjectId(storeId),
    deletedAt: null,
  }).lean();

  if (!transaction) {
    throw AppError.notFound('Transaksi tidak ditemukan atau bukan milik toko Anda.');
  }
  if (transaction.source === 'order') {
    throw AppError.badRequest('Transaksi yang berasal dari pesanan tidak dapat dihapus.');
  }

  const updated = await Transaction.findOneAndUpdate(
    { _id: transaction._id },
    { $set: { deletedAt: new Date() } },
    { new: true }
  ).lean();

  return updated;
}

module.exports = {
  getPeriodRange,
  buildTransactionFilter,
  summarize,
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
