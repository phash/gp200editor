import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  // min(1) not min(8): don't reject a login attempt just because the password
  // is shorter than our current minimum — the user might have an old account
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const patchProfileSchema = z.object({
  bio: z.string().max(500, 'Bio must be at most 500 characters').nullable().optional(),
  website: z.string().max(200).nullable().optional().transform((v) => {
    if (!v) return v;
    // Auto-prepend https:// if no protocol given
    if (!/^https?:\/\//i.test(v)) return `https://${v}`;
    return v;
  }).refine((v) => !v || /^https?:\/\//i.test(v), 'Only http and https URLs are allowed'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type PatchProfileInput = z.infer<typeof patchProfileSchema>;

const tagSchema = z
  .string()
  .regex(/^[a-zA-Z0-9 -]+$/, 'Tags can only contain letters, numbers, spaces and hyphens')
  .max(30, 'Tag must be at most 30 characters');

// Note: `name` is NOT part of this schema — it is extracted from the uploaded
// .prst binary via `new PRSTDecoder(buffer).decode().patchName` in the route handler.
export const uploadPresetSchema = z.object({
  description: z.string().max(500).optional(),
  tags: tagSchema.array().max(10, 'At most 10 tags allowed').optional(),
  author: z.string().max(50).optional(),
  style: z.string().max(50).optional(),
  publish: z.boolean().optional(),
});

export const patchPresetSchema = z.object({
  name: z.string().min(1).max(32).optional(),
  description: z.string().max(500).nullable().optional(),
  tags: tagSchema.array().max(10, 'At most 10 tags allowed').optional(),
  style: z.string().max(50).nullable().optional(),
});

export const galleryQuerySchema = z.object({
  q: z.string().max(100).optional(),
  modules: z.string().optional().transform((v) => v ? v.split(',').filter(Boolean) : undefined),
  effects: z.string().optional().transform((v) => v ? v.split(',').filter(Boolean) : undefined),
  style: z.string().max(50).optional(),
  sort: z.enum(['newest', 'popular', 'top-rated']).default('newest'),
  page: z.string().optional().transform((v) => Math.max(1, parseInt(v ?? '1', 10) || 1)),
  limit: z.string().optional().transform((v) => Math.min(50, Math.max(1, parseInt(v ?? '20', 10) || 20))),
});

export const ratePresetSchema = z.object({
  score: z.number().int().min(1).max(5),
});
export type RatePresetInput = z.infer<typeof ratePresetSchema>;

export type UploadPresetInput = z.infer<typeof uploadPresetSchema>;
export type PatchPresetInput = z.infer<typeof patchPresetSchema>;
export type GalleryQuery = z.infer<typeof galleryQuerySchema>;
