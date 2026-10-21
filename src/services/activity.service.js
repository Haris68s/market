/**
 * Service aktivitas (activity log).
 *
 * Hanya mencatat informasi penting. TIDAK PERNAH menyimpan password,
 * hash password, token session, atau API key.
 */
'use strict';

const { ActivityLog } = require('../models');

/**
 * @param {object} req object request Express (untuk mengambil actor & IP)
 * @param {string} action contoh: 'auth.login', 'product.create'
 * @param {object} options { entityType, entityId, meta }
 */
async function logActivity(req, action, options = {}) {
  try {
    const actor = req.user || (req.session && req.session.user) || null;
    await ActivityLog.create({
      actorId: actor ? actor._id : null,
      actorRole: actor ? actor.role : 'visitor',
      actorName: actor ? actor.name : null,
      action,
      entityType: options.entityType || null,
      entityId: options.entityId ? String(options.entityId) : null,
      meta: options.meta || {},
      ip: req.ip || null,
      userAgent: req.get ? req.get('User-Agent') : null,
    });
  } catch (err) {
    // Kegagalan logging tidak boleh menggagalkan operasi utama.
    // eslint-disable-next-line no-console
    console.error('[activity] gagal menyimpan log:', err.message);
  }
}

module.exports = { logActivity };
