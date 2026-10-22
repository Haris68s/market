/**
 * Route dashboard penjual (butuh login sebagai seller).
 */
'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/seller.controller');
const orderController = require('../controllers/order.controller');
const reviewController = require('../controllers/review.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireSeller } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimit');
const { singleImage } = require('../middleware/upload');
const { objectIdParam } = require('../validators/common.validator');
const {
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
} = require('../validators/seller.validator');
const { z } = require('zod');

const imageParamSchema = z.object({
  id: z.string().trim().regex(/^[a-f\d]{24}$/i, 'ID produk tidak valid.'),
  imageId: z.string().trim().min(1, 'ID gambar tidak valid.'),
});

// Semua route di bawah ini wajib login sebagai penjual.
router.use(requireAuth, requireSeller);

/* Produk */
router.get('/products', validate({ query: sellerProductQuerySchema }), asyncHandler(controller.listProducts));
router.post('/products', validate({ body: productBodySchema }), asyncHandler(controller.createProduct));
router.get('/products/:id', validate({ params: objectIdParam }), asyncHandler(controller.getProduct));
router.patch('/products/:id', validate({ params: objectIdParam, body: productUpdateSchema }), asyncHandler(controller.updateProduct));
router.delete('/products/:id', validate({ params: objectIdParam }), asyncHandler(controller.deleteProduct));
router.post(
  '/products/:id/images',
  uploadLimiter,
  validate({ params: objectIdParam }),
  singleImage,
  asyncHandler(controller.uploadProductImage)
);
router.delete(
  '/products/:id/images/:imageId',
  validate({ params: imageParamSchema }),
  asyncHandler(controller.deleteProductImage)
);

/* Pesanan */
router.get('/orders', asyncHandler(orderController.listSellerOrders));
router.get('/orders/:id', validate({ params: objectIdParam }), asyncHandler(orderController.getSellerOrder));
router.patch(
  '/orders/:id/status',
  validate({ params: objectIdParam, body: updateOrderStatusSchema }),
  asyncHandler(orderController.updateOrderStatus)
);
router.post(
  '/orders/:id/record-income',
  validate({ params: objectIdParam, body: recordIncomeSchema }),
  asyncHandler(orderController.recordIncome)
);

/* Keuangan */
router.get('/transactions', validate({ query: transactionQuerySchema }), asyncHandler(controller.listTransactions));
router.post('/transactions', validate({ body: transactionBodySchema }), asyncHandler(controller.createTransaction));
router.get('/transactions/summary', validate({ query: periodQuerySchema }), asyncHandler(controller.financeSummary));
router.get('/transactions/export', validate({ query: transactionQuerySchema }), asyncHandler(controller.exportTransactions));
router.patch(
  '/transactions/:id',
  validate({ params: objectIdParam, body: transactionUpdateSchema }),
  asyncHandler(controller.updateTransaction)
);
router.delete('/transactions/:id', validate({ params: objectIdParam }), asyncHandler(controller.deleteTransaction));

/* Ringkasan & profil */
router.get('/dashboard', validate({ query: periodQuerySchema }), asyncHandler(controller.dashboard));
router.get('/reviews', asyncHandler(reviewController.listSellerReviews));
router.get('/profile', asyncHandler(controller.getProfile));
router.patch('/profile', validate({ body: storeProfileSchema }), asyncHandler(controller.updateProfile));

module.exports = router;
