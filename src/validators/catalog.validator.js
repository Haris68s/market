/**
 * Skema validasi endpoint publik (katalog, toko, pesanan, ulasan).
 */
'use strict';

const { z } = require('zod');
const { paginationQuery, whatsappField } = require('./common.validator');

const SORT_OPTIONS = ['newest', 'oldest', 'price_asc', 'price_desc', 'popular', 'rating'];

const catalogQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    category: z.string().trim().max(60).optional(),
    minPrice: z.coerce.number().int().min(0).max(1000000000).optional(),
    maxPrice: z.coerce.number().int().min(0).max(1000000000).optional(),
    sort: z.enum(SORT_OPTIONS).default('newest'),
    store: z.string().trim().max(80).optional(),
    ...paginationQuery,
  })
  .refine((data) => data.minPrice === undefined || data.maxPrice === undefined || data.minPrice <= data.maxPrice, {
    message: 'Harga minimum tidak boleh lebih besar dari harga maksimum.',
    path: ['minPrice'],
  });

const productSlugSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

const storeSlugSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

const storeQuerySchema = z.object({
  sort: z.enum(['newest', 'popular', 'rating']).default('newest'),
  ...paginationQuery,
});

const orderSchema = z.object({
  productId: z.string().trim().regex(/^[a-f\d]{24}$/i, 'ID produk tidak valid.'),
  qty: z.coerce.number().int().min(1).max(99),
  buyerName: z.string().trim().max(120).optional().default(''),
  buyerContact: whatsappField.optional().or(z.literal('')),
  note: z.string().trim().max(500).optional().default(''),
});

const reviewSchema = z.object({
  productId: z.string().trim().regex(/^[a-f\d]{24}$/i, 'ID produk tidak valid.'),
  orderId: z.string().trim().regex(/^[a-f\d]{24}$/i, 'ID pesanan tidak valid.'),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(5, 'Ulasan minimal 5 karakter.').max(1000),
});

const reportSchema = z.object({
  targetType: z.enum(['review', 'product', 'user', 'store']),
  targetId: z.string().trim().regex(/^[a-f\d]{24}$/i, 'ID target tidak valid.'),
  reason: z.string().trim().min(3, 'Alasan wajib diisi.').max(100),
  description: z.string().trim().max(1000).optional().default(''),
});

module.exports = {
  catalogQuerySchema,
  productSlugSchema,
  storeSlugSchema,
  storeQuerySchema,
  orderSchema,
  reviewSchema,
  reportSchema,
  SORT_OPTIONS,
};
