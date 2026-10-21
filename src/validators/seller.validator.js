/**
 * Skema validasi endpoint dashboard penjual.
 */
'use strict';

const { z } = require('zod');
const { paginationQuery, dateString } = require('./common.validator');

const productStatusSchema = z.enum(['draft', 'active', 'out_of_stock', 'hidden']);

const productBodySchema = z.object({
  name: z.string().trim().min(3, 'Nama produk minimal 3 karakter.').max(140),
  category: z.string().trim().min(2, 'Kategori wajib dipilih.').max(60),
  price: z.coerce.number().int().min(0, 'Harga tidak boleh negatif.').max(1000000000),
  description: z.string().trim().max(5000).optional().default(''),
  stock: z.coerce.number().int().min(0, 'Stok tidak boleh negatif.').max(100000),
  status: productStatusSchema.optional().default('draft'),
});

const productUpdateSchema = productBodySchema.partial();

const sellerProductQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(60).optional(),
  status: z.union([productStatusSchema, z.literal('all')]).optional(),
  sort: z.enum(['newest', 'oldest']).optional().default('newest'),
  ...paginationQuery,
});

const orderStatusSchema = z.enum(['pending', 'confirmed', 'completed', 'cancelled']);

const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
  reason: z.string().trim().max(300).optional().default(''),
});

const recordIncomeSchema = z.object({
  amount: z.coerce.number().int().min(1).optional(),
  category: z.string().trim().max(40).optional().default('penjualan'),
  description: z.string().trim().max(300).optional().default(''),
  date: dateString.optional(),
});

const transactionTypeSchema = z.enum(['income', 'expense']);

const transactionBodySchema = z.object({
  type: transactionTypeSchema,
  category: z.string().trim().min(2, 'Kategori transaksi wajib diisi.').max(40),
  amount: z.coerce.number().int().min(1, 'Nominal harus lebih besar dari 0.').max(1000000000),
  description: z.string().trim().max(300).optional().default(''),
  date: dateString.optional(),
});

const transactionUpdateSchema = transactionBodySchema.partial();

const transactionQuerySchema = z.object({
  type: z.union([transactionTypeSchema, z.literal('all')]).optional().default('all'),
  category: z.string().trim().max(40).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const periodQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly', 'custom', 'all']).default('monthly'),
  from: dateString.optional(),
  to: dateString.optional(),
});

const storeProfileSchema = z.object({
  name: z.string().trim().min(3, 'Nama toko minimal 3 karakter.').max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  whatsapp: z
    .string()
    .trim()
    .min(8)
    .max(20)
    .optional(),
  location: z
    .object({
      address: z.string().trim().max(300).optional(),
      city: z.string().trim().max(100).optional(),
      showAddress: z.boolean().optional(),
      showExactAddress: z.boolean().optional(),
    })
    .optional(),
});

module.exports = {
  productBodySchema,
  productUpdateSchema,
  sellerProductQuerySchema,
  updateOrderStatusSchema,
  recordIncomeSchema,
  transactionBodySchema,
  transactionUpdateSchema,
  transactionQuerySchema,
  periodQuerySchema,
  storeProfileSchema,
  orderStatusSchema,
  productStatusSchema,
};
