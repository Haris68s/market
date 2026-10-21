/**
 * Controller pesanan (publik + penjual).
 */
'use strict';

const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { Order } = require('../models');
const orderService = require('../services/order.service');
const { logActivity } = require('../services/activity.service');
const { getQuery } = require('../middleware/validate');

/**
 * POST /api/orders
 * Membuat permintaan pesanan & menyiapkan pesan WhatsApp.
 *
 * CATATAN: endpoint ini TIDAK menandai pesanan sebagai "berhasil".
 * Statusnya "pending" (menunggu konfirmasi penjual).
 */
const createOrder = asyncHandler(async (req, res) => {
  const { productId, qty, buyerName, buyerContact, note } = req.body;

  const result = await orderService.createOrder({
    productId,
    qty,
    buyerId: req.user ? req.user._id : null,
    buyerName: buyerName || (req.user ? req.user.name : ''),
    buyerContact: buyerContact || (req.user ? req.user.whatsapp : ''),
    note,
  });

  await logActivity(req, 'order.create', {
    entityType: 'order',
    entityId: result.order._id,
    meta: { orderCode: result.order.orderCode, productId },
  });

  res.status(201).json({
    success: true,
    message: 'Permintaan pesanan dicatat. Lanjutkan konfirmasi lewat WhatsApp.',
    data: {
      order: {
        id: result.order._id,
        orderCode: result.order.orderCode,
        productName: result.order.productNameSnapshot,
        qty: result.order.qty,
        price: result.order.priceSnapshot,
        subtotal: result.order.subtotal,
        status: result.order.status,
        createdAt: result.order.createdAt,
      },
      waLink: result.waLink,
      waMessage: result.waMessage,
      stockWarning: result.stockWarning,
      notice:
        'Membuka WhatsApp belum berarti pesanan terkonfirmasi atau pembayaran berhasil. Penjual akan mengonfirmasi melalui WhatsApp.',
    },
  });
});

/**
 * GET /api/seller/orders  (daftar pesanan toko saya)
 */
const listSellerOrders = asyncHandler(async (req, res) => {
  const query = getQuery(req);
  const filter = { storeId: req.user.storeId };

  if (query.status && query.status !== 'all') filter.status = query.status;

  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);

  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      items,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

/**
 * GET /api/seller/orders/:id
 */
const getSellerOrder = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const order = await Order.findOne({ _id: id, storeId: req.user.storeId }).lean();

  if (!order) {
    throw AppError.notFound('Pesanan tidak ditemukan atau bukan milik toko Anda.');
  }

  res.json({ success: true, data: { order } });
});

/**
 * PATCH /api/seller/orders/:id/status
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const { status, reason } = req.body;

  const order = await orderService.updateOrderStatus({
    orderId: id,
    storeId: req.user.storeId,
    status,
    reason,
  });

  await logActivity(req, 'order.update_status', {
    entityType: 'order',
    entityId: order._id,
    meta: { status },
  });

  const label = {
    confirmed: 'Pesanan dikonfirmasi.',
    completed: 'Pesanan ditandai selesai.',
    cancelled: 'Pesanan dibatalkan.',
  };

  res.json({ success: true, message: label[status] || 'Status pesanan diperbarui.', data: { order } });
});

/**
 * POST /api/seller/orders/:id/record-income
 */
const recordIncome = asyncHandler(async (req, res) => {
  const { id } = req.validatedParams || req.params;
  const { amount, category, description, date } = req.body;

  const transaction = await orderService.recordIncomeFromOrder({
    orderId: id,
    storeId: req.user.storeId,
    amount,
    category,
    description,
    date,
  });

  await logActivity(req, 'order.record_income', {
    entityType: 'order',
    entityId: id,
    meta: { amount: transaction.amount },
  });

  res.status(201).json({
    success: true,
    message: 'Pemasukan dari pesanan berhasil dicatat.',
    data: { transaction },
  });
});

module.exports = { createOrder, listSellerOrders, getSellerOrder, updateOrderStatus, recordIncome };
