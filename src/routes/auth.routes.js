/**
 * Route autentikasi.
 */
'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  requestResetSchema,
  resetPasswordSchema,
} = require('../validators/auth.validator');

router.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(controller.register));
router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(controller.login));
router.post('/logout', asyncHandler(controller.logout));
router.get('/me', asyncHandler(controller.me));
router.patch(
  '/profile',
  requireAuth,
  validate({ body: updateProfileSchema }),
  asyncHandler(controller.updateProfile)
);
router.patch(
  '/password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  asyncHandler(controller.changePassword)
);
router.post(
  '/request-reset',
  authLimiter,
  validate({ body: requestResetSchema }),
  asyncHandler(controller.requestReset)
);
router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(controller.resetPassword)
);

module.exports = router;
