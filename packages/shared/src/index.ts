import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
export const paginationSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const changeRequestPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const changeRequestStatuses = [
  'DRAFT', 'SUBMITTED', 'AWAITING_ESTIMATE', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED',
  'NEEDS_CLARIFICATION', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'COMPLETED', 'CANCELLED',
] as const;
export type ChangeRequestPriority = (typeof changeRequestPriorities)[number];
export type ChangeRequestStatus = (typeof changeRequestStatuses)[number];

export const createChangeRequestSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(160),
    description: z.string().trim().min(10, 'Description must be at least 10 characters.').max(10000),
    priority: z.enum(changeRequestPriorities).default('NORMAL'),
    requestedCompletionDate: isoDateSchema.nullable().optional(),
  })
  .strict();
export type CreateChangeRequestInput = z.infer<typeof createChangeRequestSchema>;

export const authenticatedUserSchema = z.object({ userId: uuidSchema, email: z.string().email() });
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;

export const changeRequestDtoSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  submittedByUserId: uuidSchema,
  title: z.string(),
  description: z.string(),
  priority: z.enum(changeRequestPriorities),
  status: z.enum(changeRequestStatuses),
  requestedCompletionDate: isoDateSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ChangeRequestDto = z.infer<typeof changeRequestDtoSchema>;

export type ErrorDetail = { path: string; message: string };
export type SuccessEnvelope<T> = { data: T; meta: Record<string, unknown> };
export type ErrorEnvelope = { error: { code: string; message: string; details: ErrorDetail[]; requestId?: string } };

export interface AttachmentStorage {
  createUploadTarget(input: { changeRequestId: string; filename: string; mimeType: string }): Promise<{ storageKey: string; url: string }>;
  createDownloadTarget(input: { storageKey: string }): Promise<{ url: string }>;
  deleteObject(storageKey: string): Promise<void>;
}
