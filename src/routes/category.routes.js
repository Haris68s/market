/**
 * Route kategori (publik).
 */
'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/catalog.controller');

router.get('/', asyncHandler(controller.listCategories));

module.exports = router;
