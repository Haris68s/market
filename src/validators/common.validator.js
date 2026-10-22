/**
 * Skema validasi yang dipakai bersama banyak endpoint.
 */
'use strict';

const { z } = require('zod');

/** Parameter :id pada URL harus berupa ObjectId 24 hex. */
const objectIdParam = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-f\d]{24}$/i, 'ID data tidak valid.'),
});

/**
 * Parameter halaman.
 *
 * Batas atas (max) dibuat longgar (100) supaya dashboard & admin yang
 * meminta 50 item per halaman tetap bisa. Nilai di service tetap dijepit
 * dengan appConfig.pagination.maxLimit sebagai pengaman kedua.
 */
const paginationQuery = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
};

/** Nomor WhatsApp mentah (dinormalisasi di service). */
const whatsappField = z
  .string()
  .trim()
  .min(8, 'Nomor WhatsApp terlalu pendek.')
  .max(20, 'Nomor WhatsApp terlalu panjang.');

/** Tanggal ISO (YYYY-MM-DD). */
const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.');

module.exports = { objectIdParam, paginationQuery, whatsappField, dateString };
