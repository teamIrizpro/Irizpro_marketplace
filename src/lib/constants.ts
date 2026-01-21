/**
 * Application Constants
 * Centralized location for all magic strings, numbers, and configuration values
 */

// ============================================
// PAYMENT & CURRENCY
// ============================================

export const PAYMENT = {
  // Razorpay amount conversion (INR to paise)
  PAISE_MULTIPLIER: 100,

  // Payment status
  STATUS: {
    PENDING: 'pending',
    PAID: 'paid',
    FAILED: 'failed',
    REFUNDED: 'refunded',
  } as const,

  // Currency codes
  CURRENCY: {
    INR: 'INR',
    USD: 'USD',
    AED: 'AED',
    EUR: 'EUR',
  } as const,

  // Default currency
  DEFAULT_CURRENCY: 'INR' as const,
} as const;

// ============================================
// CREDIT TRANSACTIONS
// ============================================

export const CREDIT_TRANSACTION = {
  TYPE: {
    PURCHASE: 'purchase',
    SPEND: 'spend',
    REFUND: 'refund',
    BONUS: 'bonus',
    ADMIN_ADJUSTMENT: 'admin_adjustment',
  } as const,

  // Default transaction amounts
  MIN_PURCHASE: 10,
  MAX_PURCHASE: 100000,
} as const;

// ============================================
// AGENT & WORKFLOW
// ============================================

export const AGENT = {
  // Status
  STATUS: {
    ACTIVE: true,
    INACTIVE: false,
  } as const,

  // Package ID prefix for agent purchases
  PACKAGE_PREFIX: 'agent_',

  // Default package name
  DEFAULT_PACKAGE_NAME: 'Agent Purchase Credits',
  DEFAULT_PACKAGE_DESCRIPTION: 'Credits for individual agent purchases',

  // Categories
  CATEGORIES: [
    'SEO',
    'Content',
    'Social Media',
    'Analytics',
    'Marketing',
    'Development',
    'Design',
    'Business',
    'Other',
  ] as const,
} as const;

// ============================================
// EXECUTION STATUS
// ============================================

export const EXECUTION = {
  STATUS: {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCESS: 'success',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
  } as const,
} as const;

// ============================================
// USER & AUTHENTICATION
// ============================================

export const USER = {
  // Admin configuration
  ADMIN: {
    EMAIL: 'team@irizpro.com',
    ROLE: 'admin',
  } as const,

  // User roles
  ROLES: {
    USER: 'user',
    ADMIN: 'admin',
    MODERATOR: 'moderator',
  } as const,

  // Default credit balance for new users
  DEFAULT_CREDITS: 0,
} as const;

// ============================================
// API & RATE LIMITING
// ============================================

export const API = {
  // Rate limiting (requests per window)
  RATE_LIMIT: {
    // General API endpoints
    DEFAULT_MAX: 100,
    DEFAULT_WINDOW_MS: 60000, // 1 minute

    // Payment endpoints (stricter)
    PAYMENT_MAX: 10,
    PAYMENT_WINDOW_MS: 60000, // 1 minute

    // Workflow execution (moderate)
    WORKFLOW_MAX: 30,
    WORKFLOW_WINDOW_MS: 60000, // 1 minute

    // Authentication endpoints
    AUTH_MAX: 5,
    AUTH_WINDOW_MS: 60000, // 1 minute
  } as const,

  // Timeout values (milliseconds)
  TIMEOUT: {
    N8N_REQUEST: 300000, // 5 minutes for n8n workflows
    RAZORPAY_REQUEST: 30000, // 30 seconds for Razorpay API
    EXCHANGE_RATE: 10000, // 10 seconds for exchange rate API
  } as const,

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    BACKOFF_MS: 1000,
    BACKOFF_MULTIPLIER: 2,
  } as const,
} as const;

// ============================================
// HTTP STATUS CODES
// ============================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============================================
// ERROR MESSAGES
// ============================================

export const ERROR_MESSAGES = {
  // Authentication
  AUTH: {
    UNAUTHORIZED: 'Authentication required',
    INVALID_TOKEN: 'Invalid authentication token',
    SESSION_EXPIRED: 'Session expired, please login again',
    ADMIN_REQUIRED: 'Admin access required',
  },

  // Payment
  PAYMENT: {
    INSUFFICIENT_CREDITS: 'Insufficient credits to execute this workflow',
    INVALID_SIGNATURE: 'Invalid payment signature',
    PAYMENT_FAILED: 'Payment verification failed',
    DUPLICATE_PAYMENT: 'This payment has already been processed',
    INVALID_AMOUNT: 'Invalid payment amount',
    ORDER_NOT_FOUND: 'Payment order not found',
  },

  // Workflow
  WORKFLOW: {
    NOT_FOUND: 'Workflow not found',
    EXECUTION_FAILED: 'Workflow execution failed',
    INVALID_INPUT: 'Invalid workflow input data',
    AGENT_NOT_FOUND: 'Agent not found',
    AGENT_INACTIVE: 'This agent is currently inactive',
  },

  // Validation
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Invalid email address',
    INVALID_URL: 'Invalid URL format',
    INVALID_FORMAT: 'Invalid data format',
    OUT_OF_RANGE: 'Value out of acceptable range',
  },

  // Rate Limiting
  RATE_LIMIT: {
    EXCEEDED: 'Rate limit exceeded, please try again later',
  },

  // Generic
  GENERIC: {
    INTERNAL_ERROR: 'An internal error occurred',
    NOT_FOUND: 'Resource not found',
    BAD_REQUEST: 'Invalid request',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  },
} as const;

// ============================================
// SUCCESS MESSAGES
// ============================================

export const SUCCESS_MESSAGES = {
  PAYMENT: {
    VERIFIED: 'Payment verified successfully',
    REFUNDED: 'Payment refunded successfully',
  },
  CREDIT: {
    PURCHASED: 'Credits purchased successfully',
    ADDED: 'Credits added to your account',
  },
  WORKFLOW: {
    EXECUTED: 'Workflow executed successfully',
  },
  AGENT: {
    CREATED: 'Agent created successfully',
    UPDATED: 'Agent updated successfully',
    DELETED: 'Agent deleted successfully',
  },
} as const;

// ============================================
// DATABASE
// ============================================

export const DATABASE = {
  // Table names
  TABLES: {
    PROFILES: 'profiles',
    AGENTS: 'agents',
    CREDIT_PACKAGES: 'credit_packages',
    CREDIT_PURCHASES: 'credit_purchases',
    CREDIT_TRANSACTIONS: 'credit_transactions',
    USER_AGENTS: 'user_agents',
    EXECUTIONS: 'executions',
    WORKFLOWS: 'workflows',
    AUDIT_LOGS: 'audit_logs',
  } as const,

  // RPC function names
  RPC: {
    DEDUCT_CREDITS_ATOMIC: 'deduct_credits_atomic',
    ADD_CREDITS_ATOMIC: 'add_credits_atomic',
    PROCESS_PAYMENT_ATOMIC: 'process_payment_atomic',
  } as const,
} as const;

// ============================================
// FILE UPLOAD
// ============================================

export const FILE_UPLOAD = {
  // Max file sizes (in MB)
  MAX_SIZE: {
    IMAGE: 10,
    DOCUMENT: 50,
    VIDEO: 500,
  } as const,

  // Allowed MIME types
  MIME_TYPES: {
    IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    SPREADSHEETS: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  } as const,
} as const;

// ============================================
// AUDIT LOG
// ============================================

export const AUDIT_LOG = {
  ACTION: {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    LOGIN: 'login',
    LOGOUT: 'logout',
    PAYMENT: 'payment',
    CREDIT_PURCHASE: 'credit_purchase',
    WORKFLOW_EXECUTION: 'workflow_execution',
    ADMIN_ACTION: 'admin_action',
  } as const,

  RESOURCE: {
    USER: 'user',
    AGENT: 'agent',
    WORKFLOW: 'workflow',
    PAYMENT: 'payment',
    CREDIT: 'credit',
  } as const,
} as const;

// ============================================
// TYPE EXPORTS
// ============================================

// Export types for TypeScript
export type PaymentStatus = typeof PAYMENT.STATUS[keyof typeof PAYMENT.STATUS];
export type CreditTransactionType = typeof CREDIT_TRANSACTION.TYPE[keyof typeof CREDIT_TRANSACTION.TYPE];
export type ExecutionStatus = typeof EXECUTION.STATUS[keyof typeof EXECUTION.STATUS];
export type UserRole = typeof USER.ROLES[keyof typeof USER.ROLES];
export type AgentCategory = typeof AGENT.CATEGORIES[number];
export type AuditAction = typeof AUDIT_LOG.ACTION[keyof typeof AUDIT_LOG.ACTION];
export type AuditResource = typeof AUDIT_LOG.RESOURCE[keyof typeof AUDIT_LOG.RESOURCE];
