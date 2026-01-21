/**
 * Zod Validation Schemas
 * Centralized validation schemas for all API routes
 */

import { z } from 'zod';
import { AGENT, PAYMENT, CREDIT_TRANSACTION } from './constants';

// ============================================
// PAYMENT & RAZORPAY SCHEMAS
// ============================================

export const createOrderSchema = z.object({
  packageId: z.string().min(1, 'Package ID is required'),
  amount: z.number()
    .positive('Amount must be positive')
    .max(1000000, 'Amount exceeds maximum limit'),
  credits: z.number()
    .int('Credits must be an integer')
    .positive('Credits must be positive')
    .max(100000, 'Credits exceed maximum limit'),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'Order ID is required'),
  razorpay_payment_id: z.string().min(1, 'Payment ID is required'),
  razorpay_signature: z.string().min(1, 'Signature is required'),
  packageId: z.string().min(1, 'Package ID is required'),
  amount: z.number().positive('Amount must be positive'),
  credits: z.number().int().positive('Credits must be positive'),
});

export const webhookPayloadSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string(),
        order_id: z.string(),
        amount: z.number(),
        status: z.string(),
      }),
    }),
  }),
});

// ============================================
// WORKFLOW EXECUTION SCHEMAS
// ============================================

export const runWorkflowSchema = z.object({
  agentId: z.string().uuid('Invalid agent ID format'),
  inputs: z.record(z.unknown()).optional(),
});

export const executionProgressSchema = z.object({
  executionId: z.string().uuid('Invalid execution ID format'),
});

// ============================================
// AGENT MANAGEMENT SCHEMAS
// ============================================

export const createAgentSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must not exceed 100 characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description must not exceed 1000 characters'),
  category: z.enum(AGENT.CATEGORIES, {
    errorMap: () => ({ message: 'Invalid category' }),
  }),
  webhook_url: z.string()
    .url('Invalid webhook URL format')
    .startsWith('https://', 'Webhook URL must use HTTPS'),
  credit_cost: z.number()
    .int('Credit cost must be an integer')
    .positive('Credit cost must be positive')
    .max(10000, 'Credit cost exceeds maximum'),
  is_active: z.boolean().default(true),
  input_schema: z.array(z.object({
    name: z.string().min(1, 'Field name is required'),
    type: z.enum(['text', 'textarea', 'select', 'checkbox', 'radio', 'number', 'email', 'url', 'upload']),
    label: z.string().min(1, 'Field label is required'),
    required: z.boolean().default(false),
    placeholder: z.string().optional(),
    options: z.array(z.string()).optional(),
    acceptedFileTypes: z.array(z.string()).optional(),
    maxFileSize: z.number().positive().optional(),
    multiple: z.boolean().optional(),
  })).optional(),
  pricing_config: z.object({
    basePrice: z.number()
      .positive('Base price must be positive')
      .max(100000, 'Base price exceeds maximum'),
    customPrices: z.record(z.string(), z.number().positive()).optional(),
  }).optional(),
});

export const updateAgentSchema = createAgentSchema.partial().extend({
  id: z.string().uuid('Invalid agent ID'),
});

// ============================================
// CREDIT TRANSACTION SCHEMAS
// ============================================

export const creditTransactionSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  type: z.enum([
    CREDIT_TRANSACTION.TYPE.PURCHASE,
    CREDIT_TRANSACTION.TYPE.USAGE,
    CREDIT_TRANSACTION.TYPE.REFUND,
    CREDIT_TRANSACTION.TYPE.BONUS,
    CREDIT_TRANSACTION.TYPE.ADJUSTMENT,
  ]),
  amount: z.number().int('Amount must be an integer'),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================
// AUTHENTICATION SCHEMAS
// ============================================

export const signUpSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email too long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must not exceed 72 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long')
    .optional(),
});

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const updatePasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must not exceed 72 characters'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .max(72, 'New password must not exceed 72 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
});

// ============================================
// USER PROFILE SCHEMAS
// ============================================

export const updateProfileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name too long')
    .optional(),
  avatar_url: z.string().url('Invalid avatar URL').optional(),
});

// ============================================
// FILE UPLOAD SCHEMAS
// ============================================

export const fileUploadSchema = z.object({
  file: z.instanceof(File),
  maxSize: z.number().positive().optional(),
  allowedTypes: z.array(z.string()).optional(),
});

// ============================================
// PAGINATION SCHEMAS
// ============================================

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================
// QUERY PARAMETER SCHEMAS
// ============================================

export const agentQuerySchema = z.object({
  category: z.enum(AGENT.CATEGORIES).optional(),
  is_active: z.boolean().optional(),
  search: z.string().max(100).optional(),
}).merge(paginationSchema);

export const executionQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  agent_id: z.string().uuid().optional(),
  status: z.string().optional(),
}).merge(paginationSchema);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validates request body against a schema
 * Throws ValidationError if validation fails
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw error; // Will be handled by error handler
    }
    throw new Error('Invalid JSON in request body');
  }
}

/**
 * Validates query parameters against a schema
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): T {
  const params = Object.fromEntries(searchParams.entries());

  // Convert string boolean values
  Object.keys(params).forEach((key) => {
    if (params[key] === 'true') params[key] = true as any;
    if (params[key] === 'false') params[key] = false as any;
  });

  return schema.parse(params);
}

/**
 * Validates URL path parameters
 */
export function validatePathParam(
  param: string | undefined,
  fieldName: string
): string {
  if (!param || param.trim() === '') {
    throw new Error(`${fieldName} is required`);
  }
  return param;
}

/**
 * Validates UUID format
 */
export function validateUUID(value: string, fieldName: string): string {
  const uuidSchema = z.string().uuid(`Invalid ${fieldName} format`);
  return uuidSchema.parse(value);
}

/**
 * Sanitizes string input (removes potentially dangerous characters)
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove HTML tags
    .slice(0, 10000); // Limit length
}

/**
 * Validates and sanitizes HTML content
 */
export function sanitizeHtml(html: string): string {
  // TODO: Use a proper HTML sanitizer library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, ''); // Remove event handlers
}

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type RunWorkflowInput = z.infer<typeof runWorkflowSchema>;
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type AgentQueryInput = z.infer<typeof agentQuerySchema>;
