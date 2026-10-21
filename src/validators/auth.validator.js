/**
 * Skema validasi endpoint autentikasi.
 */
'use strict';

const { z } = require('zod');
const { whatsappField } = require('./common.validator');

const passwordField = z
  .string()
  .min(8, 'Password minimal 8 karakter.')
  .max(128, 'Password maksimal 128 karakter.');

const registerSchema = z.object({
  name: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.').max(120),
  storeName: z.string().trim().min(3, 'Nama toko minimal 3 karakter.').max(100),
  whatsapp: whatsappField,
  password: passwordField,
  passwordConfirm: z.string(),
  category: z.string().trim().min(2, 'Kategori toko wajib dipilih.').max(60),
  description: z.string().trim().max(1000).optional().default(''),
  address: z.string().trim().max(300).optional().default(''),
  city: z.string().trim().max(100).optional().default(''),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Format email tidak valid.')
    .default(''),
  agreed: z.literal(true, {
    errorMap: () => ({ message: 'Anda harus menyetujui aturan marketplace.' }),
  }),
});

const loginSchema = z.object({
  whatsapp: whatsappField,
  password: z.string().min(1, 'Password wajib diisi.').max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password lama wajib diisi.').max(128),
  newPassword: passwordField,
  newPasswordConfirm: z.string(),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Format email tidak valid.'),
  whatsapp: whatsappField.optional(),
});

const requestResetSchema = z.object({
  whatsapp: whatsappField,
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(10).max(200),
  newPassword: passwordField,
  newPasswordConfirm: z.string(),
});

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateProfileSchema,
  requestResetSchema,
  resetPasswordSchema,
};
