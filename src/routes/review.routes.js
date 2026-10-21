/**
 * Route ulasan.
 */
'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/review.controller');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { reviewSchema } = require('../validators/catalog.validator');

router.post('/', requireAuth, validate({ body: reviewSchema }), asyncHandler(controller.createReview));

module.exports = router;
