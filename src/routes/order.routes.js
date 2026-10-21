/**
 * Route pesanan.
 */
'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/order.controller');
const { validate } = require('../middleware/validate');
const { optionalAuth } = require('../middleware/auth');
const { orderLimiter } = require('../middleware/rateLimit');
const { orderSchema } = require('../validators/catalog.validator');
const { objectIdParam } = require('../validators/common.validator');

router.post('/', optionalAuth, orderLimiter, validate({ body: orderSchema }), asyncHandler(controller.createOrder));

module.exports = router;
