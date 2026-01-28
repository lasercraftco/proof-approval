import { z } from 'zod';

/**
 * Order creation schema
 */
export const createOrderSchema = z.object({
  order_number: z.string().min(1, 'Order number is required').max(100, 'Order number too long'),
  customer_email: z.string().email('Invalid email address'),
  customer_name: z.string().max(200).optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  product_name: z.string().max(500).optional().nullable(),
  quantity: z.number().int().positive().optional().nullable(),
  order_total: z.number().nonnegative().optional().nullable(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * Customer decision submission schema
 */
export const submitDecisionSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  decision: z.enum(['approved', 'approved_with_notes', 'changes_requested'], {
    errorMap: () => ({ message: 'Invalid decision value' }),
  }),
  note: z.string().max(5000).optional().nullable(),
});

export type SubmitDecisionInput = z.infer<typeof submitDecisionSchema>;

/**
 * Settings update schema
 */
export const updateSettingsSchema = z.object({
  company_name: z.string().min(1).max(200).optional(),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  logo_data_url: z.string().max(500000).optional().nullable(), // Allow large base64 logos
  email_from_name: z.string().min(1).max(200).optional(),
  email_from_email: z.string().email().optional(),
  staff_notify_email: z.string().email().optional(),
  reminder_config: z.object({
    enabled: z.boolean(),
    first_reminder_days: z.number().int().positive().max(30),
    second_reminder_days: z.number().int().positive().max(60),
    max_reminders: z.number().int().positive().max(10),
  }).optional(),
  templates: z.record(z.any()).optional(),
}).strict(); // Reject unknown fields

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/**
 * Send proof schema
 */
export const sendProofSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
});

export type SendProofInput = z.infer<typeof sendProofSchema>;

/**
 * Proof upload validation (for metadata)
 */
export const proofUploadMetaSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  staffNote: z.string().max(2000).optional().nullable(),
});

export type ProofUploadMetaInput = z.infer<typeof proofUploadMetaSchema>;

/**
 * Bulk actions schema
 */
export const bulkActionsSchema = z.object({
  action: z.enum(['send_reminders', 'mark_open', 'mark_approved']),
  orderIds: z.array(z.string().uuid()).min(1, 'At least one order ID required').max(100, 'Too many orders'),
});

export type BulkActionsInput = z.infer<typeof bulkActionsSchema>;

/**
 * Product creation schema
 */
export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(500),
  sku: z.string().max(100).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  base_price: z.number().nonnegative().optional().nullable(),
  estimated_design_time: z.number().int().nonnegative().optional().nullable(),
  estimated_production_time: z.number().int().nonnegative().optional().nullable(),
  estimated_total_time: z.number().int().nonnegative().optional().nullable(),
  default_materials: z.array(z.any()).optional(),
  image_url: z.string().url().max(2000).optional().nullable(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Production update schema
 */
export const productionUpdateSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  production_status: z.string().max(50).optional(),
  production_print_process: z.string().max(100).optional(),
  production_batch_group: z.string().max(100).optional(),
  production_material: z.string().max(100).optional(),
  production_machine: z.string().max(100).optional(),
  production_assigned_to: z.string().max(200).optional(),
  production_priority: z.number().int().optional(),
  production_notes: z.string().max(5000).optional(),
  production_estimated_hours: z.number().nonnegative().optional(),
});

export type ProductionUpdateInput = z.infer<typeof productionUpdateSchema>;

/**
 * Search query schema
 */
export const searchQuerySchema = z.object({
  q: z.string().min(2, 'Query too short').max(200, 'Query too long'),
});

/**
 * Helper to format Zod errors for API responses
 */
export function formatZodErrors(error: z.ZodError): { field: string; message: string }[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

/**
 * Allowed file types for proof uploads
 */
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp',
  'application/pdf',
];

/**
 * Max file size (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Max files per upload
 */
export const MAX_FILES_PER_UPLOAD = 20;

/**
 * Validate uploaded file
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return { 
      valid: false, 
      error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, GIF, WebP, PDF` 
    };
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File too large: ${file.name} (${Math.round(file.size / 1024 / 1024)}MB). Max: 10MB` 
    };
  }
  
  return { valid: true };
}
