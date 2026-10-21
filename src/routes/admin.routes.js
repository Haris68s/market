/**
 * Route super admin.
 *
 * WAJIB dijaga middleware requireRole('superadmin') di level router,
 * bukan hanya dengan menyembunyikan tombol di frontend.
 */
'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/admin.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { objectIdParam } = require('../validators/common.validator');
const { z } = require('zod');
const {
  updateUserStatusSchema,
  productVisibilitySchema,
  categoryBodySchema,
  categoryUpdateSchema,
  reviewModerationSchema,
  reportResolutionSchema,
  adminUserQuerySchema,
  adminOrderQuerySchema,
  settingsSchema,
} = require('../validators/admin.validator');

const adminOrderQuery = z.object({
  status: z.union([z.enum(['pending', 'confirmed', 'completed', 'cancelled']), z.literal('all')])
    .optional()
    .default('all'),
  ...adminOrderQuerySchema.shape,
});

const adminProductQuery = z.object({
  status: z.union([z.enum(['draft', 'active', 'out_of_stock', 'hidden']), z.literal('all')])
    .optional()
    .default('all'),
  category: z.string().trim().max(60).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Semua route di bawah ini HANYA untuk super admin.
router.use(requireAuth, requireRole('superadmin'));

router.get('/overview', asyncHandler(controller.overview));

/* Pengguna & toko */
router.get('/users', validate({ query: adminUserQuerySchema }), asyncHandler(controller.listUsers));
router.get('/users/:id', validate({ params: objectIdParam }), asyncHandler(controller.getUser));
router.patch(
  '/users/:id/status',
  validate({ params: objectIdParam, body: updateUserStatusSchema }),
  asyncHandler(controller.updateUserStatus)
);
router.post('/users/:id/reset-token', validate({ params: objectIdParam }), asyncHandler(controller.issueResetToken));

router.get('/stores', validate({ query: adminUserQuerySchema }), asyncHandler(controller.listStores));
router.patch(
  '/stores/:id/status',
  validate({ params: objectIdParam, body: updateUserStatusSchema }),
  asyncHandler(controller.updateStoreStatus)
);

/* Produk */
router.get('/products', validate({ query: adminProductQuery }), asyncHandler(controller.listProducts));
router.patch(
  '/products/:id/status',
  validate({ params: objectIdParam, body: productVisibilitySchema }),
  asyncHandler(controller.updateProductStatus)
);

/* Kategori */
router.get('/categories', asyncHandler(controller.listCategories));
router.post('/categories', validate({ body: categoryBodySchema }), asyncHandler(controller.createCategory));
router.patch(
  '/categories/:id',
  validate({ params: objectIdParam, body: categoryUpdateSchema }),
  asyncHandler(controller.updateCategory)
);
router.delete('/categories/:id', validate({ params: objectIdParam }), asyncHandler(controller.deleteCategory));

/* Ulasan & laporan */
router.get('/reviews', validate({ query: adminOrderQuery }), asyncHandler(controller.listReviews));
router.patch(
  '/reviews/:id',
  validate({ params: objectIdParam, body: reviewModerationSchema }),
  asyncHandler(controller.moderateReview)
);
router.get('/reports', validate({ query: adminOrderQuery }), asyncHandler(controller.listReports));
router.patch(
  '/reports/:id',
  validate({ params: objectIdParam, body: reportResolutionSchema }),
  asyncHandler(controller.resolveReport)
);

/* Pesanan */
router.get('/orders', validate({ query: adminOrderQuery }), asyncHandler(controller.listOrders));

/* Log & pengaturan */
router.get('/logs', validate({ query: adminOrderQuery }), asyncHandler(controller.listLogs));
router.get('/settings', asyncHandler(controller.getSettings));
router.patch('/settings', validate({ body: settingsSchema }), asyncHandler(controller.updateSettings));

module.exports = router;
