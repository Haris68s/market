/**
 * Route laporan penyalahgunaan (ulasan / produk / pengguna).
 */
'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/review.controller');
const { validate } = require('../middleware/validate');
const { optionalAuth } = require('../middleware/auth');
const { reportSchema } = require('../validators/catalog.validator');

router.post('/', optionalAuth, validate({ body: reportSchema }), asyncHandler(controller.createReport));

module.exports = router;
