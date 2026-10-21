/**
 * Skema validasi endpoint super admin.
 */
'use strict';

const { z } = require('zod');
const { paginationQuery, whatsappField } = require('./common.validator');

const userStatusSchema = z.enum(['active', 'suspended', 'pending']);

const updateUserStatusSchema = z.object({
  status: userStatusSchema,
  reason: z
    .string()
    .trim()
    .min(5, 'Alasan wajib diisi (minimal 5 karakter).')
    .max(300, 'Alasan terlalu panjang.'),
});

const productVisibilitySchema = z.object({
  status: z.enum(['active', 'hidden']),
  reason: z
    .string()
    .trim()
    .min(5, 'Alasan wajib diisi (minimal 5 karakter).')
    .max(300, 'Alasan terlalu panjang.'),
});

const categoryBodySchema = z.object({
  name: z.string().trim().min(2, 'Nama kategori minimal 2 karakter.').max(60),
  icon: z.string().trim().max(40).optional().default('package'),
  description: z.string().trim().max(200).optional().default(''),
  order: z.coerce.number().int().min(0).max(999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const categoryUpdateSchema = categoryBodySchema.partial();

const reviewModerationSchema = z.object({
  action: z.enum(['hide', 'restore']),
  reason: z
    .string()
    .trim()
    .min(5, 'Alasan wajib diisi (minimal 5 karakter).')
    .max(300, 'Alasan terlalu panjang.'),
});

const reportResolutionSchema = z.object({
  status: z.enum(['reviewed', 'resolved', 'rejected']),
  resolutionNote: z.string().trim().max(500).optional().default(''),
});

const adminUserQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  role: z.enum(['seller', 'superadmin', 'all']).optional().default('all'),
  status: z.union([userStatusSchema, z.literal('all')]).optional().default('all'),
  ...paginationQuery,
});

const adminOrderQuerySchema = z.object({
  status: z.union([z.enum(['pending', 'confirmed', 'completed', 'cancelled']), z.literal('all')])
    .optional()
    .default('all'),
  ...paginationQuery,
});

const settingsSchema = z.object({
  'app.name': z.string().trim().min(2).max(60).optional(),
  'app.supportContact': z.string().trim().max(120).optional(),
  'app.allowRegistration': z.boolean().optional(),
  'app.heroTitle': z.string().trim().max(120).optional(),
  'app.heroSubtitle': z.string().trim().max(300).optional(),
  'app.featuredMinReviews': z.coerce.number().int().min(0).max(100).optional(),
  'app.featuredMinRating': z.coerce.number().min(0).max(5).optional(),
});

const resetIssueSchema = z.object({
  userId: z.string().trim().regex(/^[a-f\d]{24}$/i, 'ID pengguna tidak valid.'),
});

const bootstrapAdminSchema = z.object({
  name: z.string().trim().min(3).max(120),
  whatsapp: whatsappField,
  password: z.string().min(8).max(128),
});

module.exports = {
  updateUserStatusSchema,
  productVisibilitySchema,
  categoryBodySchema,
  categoryUpdateSchema,
  reviewModerationSchema,
  reportResolutionSchema,
  adminUserQuerySchema,
  adminOrderQuerySchema,
  settingsSchema,
  resetIssueSchema,
  bootstrapAdminSchema,
};
