import { z } from 'zod';

// Note: `email` deliberately excluded — letting an admin overwrite a user's
// email and then trigger a password-reset to the new address is a takeover
// vector. Email changes must go through the user's own self-service flow
// (or a DB-direct admin intervention with a separate audit trail).
export const adminPatchUserSchema = z.object({
  suspended: z.boolean().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  bio: z.string().max(500).nullable().optional(),
});

export const adminWarnUserSchema = z.object({
  reason: z.string().min(1).max(100),
  message: z.string().max(1000).optional(),
});

export const adminPatchPresetSchema = z.object({
  flagged: z.boolean().optional(),
  public: z.boolean().optional(),
  name: z.string().min(1).max(32).optional(),
  description: z.string().max(500).nullable().optional(),
  tags: z.string().regex(/^[a-zA-Z0-9 -]+$/).max(30).array().max(10).optional(),
  style: z.string().max(50).nullable().optional(),
});

export const adminUsersQuerySchema = z.object({
  q: z.string().max(100).optional(),
  page: z.string().optional().transform((v) => Math.max(1, parseInt(v ?? '1', 10) || 1)),
  limit: z.string().optional().transform((v) => Math.min(50, Math.max(1, parseInt(v ?? '20', 10) || 20))),
});

export const adminPresetsQuerySchema = z.object({
  q: z.string().max(100).optional(),
  flagged: z.string().optional().transform((v) => v === 'true'),
  userId: z.string().optional(),
  page: z.string().optional().transform((v) => Math.max(1, parseInt(v ?? '1', 10) || 1)),
  limit: z.string().optional().transform((v) => Math.min(50, Math.max(1, parseInt(v ?? '20', 10) || 20))),
});

export const adminErrorsQuerySchema = z.object({
  q: z.string().max(100).optional(),
  severity: z.enum(['critical', 'error', 'warning', 'info']).optional(),
  category: z.enum(['api', 'client', 'auth', 'db', 's3', 'external', 'validation', 'rate_limit', 'legacy']).optional(),
  resolved: z.enum(['true', 'false']).optional(),
  page: z.string().optional().transform((v) => Math.max(1, parseInt(v ?? '1', 10) || 1)),
  limit: z.string().optional().transform((v) => Math.min(50, Math.max(1, parseInt(v ?? '20', 10) || 20))),
});

export const adminErrorsPatchSchema = z.object({
  fingerprint: z.string().min(8).max(64).optional(),
  ids: z.string().min(1).array().max(100).optional(),
  resolved: z.boolean(),
}).refine((v) => v.fingerprint || (v.ids && v.ids.length > 0), {
  message: 'Either fingerprint or ids[] is required',
});

export const adminActionsQuerySchema = z.object({
  page: z.string().optional().transform((v) => Math.max(1, parseInt(v ?? '1', 10) || 1)),
  limit: z.string().optional().transform((v) => Math.min(50, Math.max(1, parseInt(v ?? '20', 10) || 20))),
});

export type AdminPatchUserInput = z.infer<typeof adminPatchUserSchema>;
export type AdminWarnUserInput = z.infer<typeof adminWarnUserSchema>;
export type AdminPatchPresetInput = z.infer<typeof adminPatchPresetSchema>;
