/**
 * Route toko (publik).
 */
'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/catalog.controller');
const { validate } = require('../middleware/validate');
const { storeSlugSchema, storeQuerySchema } = require('../validators/catalog.validator');

router.get('/', asyncHandler(controller.listStores));
router.get(
  '/:slug',
  validate({ params: storeSlugSchema, query: storeQuerySchema }),
  asyncHandler(controller.getStore)
);

module.exports = router;
