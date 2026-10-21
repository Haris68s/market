/**
 * Controller ulasan & laporan.
 */
'use strict';

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { Review, ReviewReport, Product } = require('../models');
const reviewService = require('../services/review.service');
const { logActivity } = require('../services/activity.service');
const { toObjectId } = require('../services/product.service');

/**
 * POST /api/reviews
 */
const createReview = asyncHandler(async (req, res) => {
  const { productId, orderId, rating, comment } = req.body;

  const result = await reviewService.createReview({
    productId,
    orderId,
    buyerId: req.user._id,
    buyerName: req.user.name,
    rating,
    comment,
  });

  await logActivity(req, 'review.create', {
    entityType: 'review',
    entityId: result.review._id,
    meta: { productId, rating },
  });

  res.status(201).json({
    success: true,
    message: 'Terima kasih! Ulasan Anda sudah tersimpan.',
    data: {
      review: {
        _id: result.review._id,
        rating: result.review.rating,
        comment: result.review.comment,
        status: result.review.status,
        isVerifiedPurchase: result.review.isVerifiedPurchase,
        createdAt: result.review.createdAt,
      },
      notice: 'Ulasan ini ditandai "belum terverifikasi" karena konfirmasi pembayaran dilakukan di WhatsApp.',
    },
  });
});

/**
 * GET /api/seller/reviews  (ulasan produk toko saya)
 */
const listSellerReviews = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = 20;

  const [items, total, stats] = await Promise.all([
    Review.find({ storeId: req.user.storeId })
      .populate('productId', 'name slug')
      .populate('buyerId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Review.countDocuments({ storeId: req.user.storeId }),
    Review.aggregate([
      { $match: { storeId: toObjectId(req.user.storeId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avg: { $avg: '$rating' },
        },
      },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      items,
      stats,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

/**
 * POST /api/reports  (laporkan ulasan / produk / pengguna)
 */
const createReport = asyncHandler(async (req, res) => {
  const { targetType, targetId, reason, description } = req.body;

  // Pastikan target benar-benar ada.
  const models = { review: Review, product: Product };
  const Model = models[targetType];
  if (Model) {
    const exists = await Model.exists({ _id: toObjectId(targetId) });
    if (!exists) throw AppError.notFound('Data yang dilaporkan tidak ditemukan.');
  }

  const report = await ReviewReport.create({
    targetType,
    targetId: toObjectId(targetId),
    reason,
    description,
    reporterId: req.user ? req.user._id : null,
    reporterContact: req.user ? req.user.whatsapp : null,
  });

  await logActivity(req, 'report.create', {
    entityType: 'report',
    entityId: report._id,
    meta: { targetType },
  });

  res.status(201).json({
    success: true,
    message: 'Laporan terkirim. Admin akan meninjaunya.',
    data: { report: { id: report._id, status: report.status, createdAt: report.createdAt } },
  });
});

module.exports = { createReview, listSellerReviews, createReport };
