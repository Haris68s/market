/**
 * Route upload gambar.
 */
'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/upload.controller');
const { requireAuth, requireSeller } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimit');
const { singleImage } = require('../middleware/upload');

router.get('/status', asyncHandler(controller.status));
router.post('/image', requireAuth, requireSeller, uploadLimiter, singleImage, asyncHandler(controller.uploadImage));

module.exports = router;
