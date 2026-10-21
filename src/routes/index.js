/**
 * Pusat routing API.
 *
 * Semua endpoint diawali /api.
 */
'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { csrfTokenHandler } = require('../middleware/csrf');
const { isDatabaseConnected } = require('../config/db');

/* Health check: memastikan server & database hidup. */
router.get('/health', (req, res) => {
  const dbReady = isDatabaseConnected();
  res.status(dbReady ? 200 : 503).json({
    success: dbReady,
    data: {
      status: dbReady ? 'ok' : 'degraded',
      database: dbReady ? 'connected' : 'disconnected',
      uptime: Math.round(process.uptime()),
      mongoState: mongoose.connection.readyState,
    },
    message: dbReady ? 'Server dan database siap.' : 'Database belum terhubung.',
  });
});

/* Token CSRF untuk frontend. */
router.get('/csrf', csrfTokenHandler);

router.use('/auth', require('./auth.routes'));
router.use('/products', require('./product.routes'));
router.use('/categories', require('./category.routes'));
router.use('/stores', require('./store.routes'));
router.use('/orders', require('./order.routes'));
router.use('/reviews', require('./review.routes'));
router.use('/reports', require('./report.routes'));
router.use('/seller', require('./seller.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/uploads', require('./upload.routes'));

module.exports = router;
