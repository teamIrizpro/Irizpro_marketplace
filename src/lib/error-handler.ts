/**
 * Centralized Error Handling Utilities
 * Provides consistent error responses and logging across the application
 */

import { NextResponse } from 'next/server';
import { HTTP_STATUS, ERROR_MESSAGES } from './constants';

// ============================================
// ERROR TYPES
// ============================================

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = ERROR_MESSAGES.AUTH.UNAUTHORIZED) {
    super(HTTP_STATUS.UNAUTHORIZED, message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = ERROR_MESSAGES.AUTH.ADMIN_REQUIRED) {
    super(HTTP_STATUS.FORBIDDEN, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(HTTP_STATUS.BAD_REQUEST, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class PaymentError extends AppError {
  constructor(message: string, code?: string) {
    super(HTTP_STATUS.PAYMENT_REQUIRED, message, code || 'PAYMENT_ERROR');
    this.name = 'PaymentError';
  }
}

export class ResourceNotFoundError extends AppError {
  constructor(resource: string) {
    super(HTTP_STATUS.NOT_FOUND, `${resource} not found`, 'NOT_FOUND');
    this.name = 'ResourceNotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = ERROR_MESSAGES.RATE_LIMIT.EXCEEDED) {
    super(HTTP_STATUS.TOO_MANY_REQUESTS, message, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

export class DuplicateResourceError extends AppError {
  constructor(resource: string) {
    super(HTTP_STATUS.CONFLICT, `${resource} already exists`, 'DUPLICATE_RESOURCE');
    this.name = 'DuplicateResourceError';
  }
}

// ============================================
// ERROR RESPONSE FORMATTER
// ============================================

interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
  timestamp: string;
  path?: string;
}

export function formatErrorResponse(
  error: Error | AppError,
  path?: string
): ErrorResponse {
  const response: ErrorResponse = {
    error: error.message || ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
    timestamp: new Date().toISOString(),
  };

  if (error instanceof AppError) {
    response.code = error.code;
    response.details = error.details;
  }

  if (path) {
    response.path = path;
  }

  return response;
}

// ============================================
// NEXT.JS RESPONSE HANDLERS
// ============================================

export function handleError(error: unknown, path?: string): NextResponse {
  // Log error for monitoring
  logError(error, path);

  // Handle known error types
  if (error instanceof AppError) {
    return NextResponse.json(
      formatErrorResponse(error, path),
      { status: error.statusCode }
    );
  }

  // Handle Supabase errors
  if (isSupabaseError(error)) {
    return handleSupabaseError(error, path);
  }

  // Handle validation errors (Zod)
  if (isZodError(error)) {
    return handleZodError(error, path);
  }

  // Handle generic errors
  if (error instanceof Error) {
    return NextResponse.json(
      formatErrorResponse(error, path),
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }

  // Unknown error type
  return NextResponse.json(
    {
      error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR,
      timestamp: new Date().toISOString(),
    },
    { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
  );
}

// ============================================
// ERROR TYPE CHECKERS
// ============================================

function isSupabaseError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

function isZodError(error: unknown): error is { issues: Array<{ path: string[]; message: string }> } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'issues' in error &&
    Array.isArray((error as any).issues)
  );
}

// ============================================
// SPECIFIC ERROR HANDLERS
// ============================================

function handleSupabaseError(
  error: { code: string; message: string },
  path?: string
): NextResponse {
  let statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = error.message;

  // Map Supabase error codes to HTTP status codes
  switch (error.code) {
    case 'PGRST116': // Not found
      statusCode = HTTP_STATUS.NOT_FOUND;
      message = ERROR_MESSAGES.GENERIC.NOT_FOUND;
      break;
    case '23505': // Unique violation
      statusCode = HTTP_STATUS.CONFLICT;
      message = 'Resource already exists';
      break;
    case '23503': // Foreign key violation
      statusCode = HTTP_STATUS.BAD_REQUEST;
      message = 'Invalid reference';
      break;
    case '42P01': // Undefined table
      statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      message = 'Database configuration error';
      break;
    default:
      statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  }

  return NextResponse.json(
    {
      error: message,
      code: error.code,
      timestamp: new Date().toISOString(),
      path,
    },
    { status: statusCode }
  );
}

function handleZodError(
  error: { issues: Array<{ path: string[]; message: string }> },
  path?: string
): NextResponse {
  const validationErrors = error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

  return NextResponse.json(
    {
      error: ERROR_MESSAGES.VALIDATION.INVALID_FORMAT,
      code: 'VALIDATION_ERROR',
      details: validationErrors,
      timestamp: new Date().toISOString(),
      path,
    },
    { status: HTTP_STATUS.BAD_REQUEST }
  );
}

// ============================================
// ERROR LOGGING
// ============================================

function logError(error: unknown, path?: string): void {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    path,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
  };

  // Log to console (in production, send to monitoring service)
  console.error('[ERROR]', JSON.stringify(errorInfo, null, 2));

  // TODO: Send to monitoring service (Sentry, DataDog, etc.)
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(error, { extra: errorInfo });
  // }
}

// ============================================
// SUCCESS RESPONSE HELPER
// ============================================

export function successResponse<T>(
  data: T,
  statusCode: number = HTTP_STATUS.OK
): NextResponse {
  return NextResponse.json(data, { status: statusCode });
}

// ============================================
// ASYNC ERROR WRAPPER
// ============================================

/**
 * Wraps async route handlers to catch and handle errors consistently
 *
 * @example
 * export const POST = asyncHandler(async (req: NextRequest) => {
 *   // Your code here
 *   return successResponse({ message: 'Success' });
 * });
 */
export function asyncHandler(
  handler: (req: Request) => Promise<NextResponse>
) {
  return async (req: Request): Promise<NextResponse> => {
    try {
      return await handler(req);
    } catch (error) {
      return handleError(error, req.url);
    }
  };
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validates required fields in request body
 */
export function validateRequiredFields(
  data: Record<string, unknown>,
  requiredFields: string[]
): void {
  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missingFields.join(', ')}`,
      { missingFields }
    );
  }
}

/**
 * Validates numeric range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): void {
  if (value < min || value > max) {
    throw new ValidationError(
      `${fieldName} must be between ${min} and ${max}`,
      { value, min, max }
    );
  }
}

/**
 * Validates email format
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_EMAIL);
  }
}

/**
 * Validates URL format
 */
export function validateUrl(url: string): void {
  try {
    new URL(url);
  } catch {
    throw new ValidationError(ERROR_MESSAGES.VALIDATION.INVALID_URL);
  }
}
