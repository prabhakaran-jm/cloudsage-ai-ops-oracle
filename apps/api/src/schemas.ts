import { z } from 'zod';

export const authSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
});

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

export const ingestBodySchema = z.object({
  projectId: z.string().min(1).optional(),
  logs: z.union([z.string().min(1), z.array(z.any()).min(1)]),
  metadata: z.record(z.any()).optional(),
});

export const forecastQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const ingestQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).max(5000).optional(),
});

// Shared types for client/server
export type AuthInput = z.infer<typeof authSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type IngestBodyInput = z.infer<typeof ingestBodySchema>;
export type ForecastQueryInput = z.infer<typeof forecastQuerySchema>;
export type HistoryQueryInput = z.infer<typeof historyQuerySchema>;
export type IngestQueryInput = z.infer<typeof ingestQuerySchema>;

