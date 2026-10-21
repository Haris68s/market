/**
 * Route produk (katalog publik).
 */
'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/catalog.controller');
const { validate } = require('../middleware/validate');
const { optionalAuth } = require('../middleware/auth');
const { catalogQuerySchema, productSlugSchema } = require('../validators/catalog.validator');

router.get('/featured', asyncHandler(controller.featuredProducts));
router.get('/', validate({ query: catalogQuerySchema }), asyncHandler(controller.listProducts));
router.get(
  '/:slug',
  optionalAuth,
  validate({ params: productSlugSchema }),
  asyncHandler(controller.getProduct)
);

module.exports = router;
