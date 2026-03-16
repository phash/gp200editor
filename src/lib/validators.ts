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
  website: z.string().url('Invalid URL').nullable().optional(),
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
});

export const patchPresetSchema = z.object({
  name: z.string().min(1).max(32).optional(),
  description: z.string().max(500).nullable().optional(),
  tags: tagSchema.array().max(10, 'At most 10 tags allowed').optional(),
});

export type UploadPresetInput = z.infer<typeof uploadPresetSchema>;
export type PatchPresetInput = z.infer<typeof patchPresetSchema>;
