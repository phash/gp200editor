import { z } from 'zod';

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, 'Comment cannot be empty')
  .max(1000, 'Comment exceeds 1000 character limit');

export const adminDeleteReasonSchema = z
  .string()
  .trim()
  .min(5, 'Reason too short')
  .max(200, 'Reason exceeds 200 character limit');
