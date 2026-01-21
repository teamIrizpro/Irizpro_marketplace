/**
 * Rate Limiting Middleware
 * Protects API routes from abuse using sliding window algorithm
 *
 * Production Note: Replace in-memory store with Redis for distributed systems
 */

import { NextRequest, NextResponse } from 'next/server';
import { API, HTTP_STATUS, ERROR_MESSAGES } from './constants';
import { RateLimitError } from './error-handler';

// ============================================
// TYPES
// ============================================

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
  requests: number[]; // Timestamps of requests
}

// ============================================
// IN-MEMORY STORE
// ============================================

/**
 * In-memory rate limit store
 * TODO: Replace with Redis in production for distributed rate limiting
 */
class RateLimitStore {
  private store = new Map<string, RateLimitInfo>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get(key: string): RateLimitInfo | undefined {
    return this.store.get(key);
  }

  set(key: string, value: RateLimitInfo): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, info] of this.store.entries()) {
      if (info.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global store instance
const store = new RateLimitStore();

// ============================================
// RATE LIMITER FUNCTION
// ============================================

/**
 * Rate limiter using sliding window algorithm
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    maxRequests,
    windowMs,
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = config;

  return async (req: NextRequest): Promise<RateLimitResult> => {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get current rate limit info
    let info = store.get(key);

    if (!info) {
      // First request from this key
      info = {
        count: 0,
        resetTime: now + windowMs,
        requests: [],
      };
    }

    // Remove requests outside the current window (sliding window)
    info.requests = info.requests.filter((timestamp) => timestamp > windowStart);

    // Check if limit exceeded
    if (info.requests.length >= maxRequests) {
      const oldestRequest = Math.min(...info.requests);
      const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);

      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        reset: new Date(oldestRequest + windowMs),
        retryAfter,
      };
    }

    // Add current request
    info.requests.push(now);
    info.count = info.requests.length;
    info.resetTime = now + windowMs;

    // Update store
    store.set(key, info);

    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - info.requests.length,
      reset: new Date(info.resetTime),
    };
  };
}

// ============================================
// RATE LIMIT RESULT
// ============================================

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

// ============================================
// KEY GENERATORS
// ============================================

/**
 * Default key generator using IP address
 */
function defaultKeyGenerator(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0].trim() || realIp || 'unknown';
  return `ip:${ip}`;
}

/**
 * Key generator using user ID (for authenticated routes)
 */
export function userKeyGenerator(req: NextRequest, userId: string): string {
  return `user:${userId}`;
}

/**
 * Key generator combining IP and route
 */
export function routeKeyGenerator(req: NextRequest): string {
  const ip = defaultKeyGenerator(req);
  const pathname = new URL(req.url).pathname;
  return `${ip}:${pathname}`;
}

// ============================================
// PRESET RATE LIMITERS
// ============================================

/**
 * General API rate limiter (100 requests/minute)
 */
export const defaultRateLimiter = rateLimit({
  maxRequests: API.RATE_LIMIT.DEFAULT_MAX,
  windowMs: API.RATE_LIMIT.DEFAULT_WINDOW_MS,
});

/**
 * Payment endpoint rate limiter (10 requests/minute)
 */
export const paymentRateLimiter = rateLimit({
  maxRequests: API.RATE_LIMIT.PAYMENT_MAX,
  windowMs: API.RATE_LIMIT.PAYMENT_WINDOW_MS,
  keyGenerator: routeKeyGenerator,
});

/**
 * Workflow execution rate limiter (30 requests/minute)
 */
export const workflowRateLimiter = rateLimit({
  maxRequests: API.RATE_LIMIT.WORKFLOW_MAX,
  windowMs: API.RATE_LIMIT.WORKFLOW_WINDOW_MS,
});

/**
 * Authentication rate limiter (5 requests/minute)
 */
export const authRateLimiter = rateLimit({
  maxRequests: API.RATE_LIMIT.AUTH_MAX,
  windowMs: API.RATE_LIMIT.AUTH_WINDOW_MS,
  keyGenerator: routeKeyGenerator,
});

// ============================================
// MIDDLEWARE HELPER
// ============================================

/**
 * Wraps an API route handler with rate limiting
 *
 * @example
 * export const POST = withRateLimit(paymentRateLimiter, async (req) => {
 *   // Your handler code
 * });
 */
export function withRateLimit(
  limiter: (req: NextRequest) => Promise<RateLimitResult>,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const result = await limiter(req);

    // Add rate limit headers to response
    const headers = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.reset.toISOString(),
    };

    if (!result.success) {
      // Rate limit exceeded
      return NextResponse.json(
        {
          error: ERROR_MESSAGES.RATE_LIMIT.EXCEEDED,
          retryAfter: result.retryAfter,
        },
        {
          status: HTTP_STATUS.TOO_MANY_REQUESTS,
          headers: {
            ...headers,
            'Retry-After': result.retryAfter?.toString() || '60',
          },
        }
      );
    }

    // Continue to handler
    const response = await handler(req);

    // Add rate limit headers to successful response
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

/**
 * Checks rate limit without consuming a request
 * Useful for preflight checks
 */
export async function checkRateLimit(
  req: NextRequest,
  limiter: (req: NextRequest) => Promise<RateLimitResult>
): Promise<RateLimitResult> {
  return await limiter(req);
}

// ============================================
// MANUAL RATE LIMIT CHECK
// ============================================

/**
 * Manually check and consume rate limit
 * Throws RateLimitError if limit exceeded
 */
export async function enforceRateLimit(
  req: NextRequest,
  config?: Partial<RateLimitConfig>
): Promise<void> {
  const limiter = config
    ? rateLimit({
        maxRequests: config.maxRequests || API.RATE_LIMIT.DEFAULT_MAX,
        windowMs: config.windowMs || API.RATE_LIMIT.DEFAULT_WINDOW_MS,
        ...config,
      })
    : defaultRateLimiter;

  const result = await limiter(req);

  if (!result.success) {
    throw new RateLimitError(
      `${ERROR_MESSAGES.RATE_LIMIT.EXCEEDED}. Retry after ${result.retryAfter} seconds.`
    );
  }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Resets rate limit for a specific key
 * Useful for admin operations or whitelisting
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Gets current rate limit info for a key
 */
export function getRateLimitInfo(key: string): RateLimitInfo | undefined {
  return store.get(key);
}

/**
 * Clears all rate limit data
 * Use with caution - only for testing or emergency
 */
export function clearAllRateLimits(): void {
  store.destroy();
}

// ============================================
// REDIS ADAPTER (for production)
// ============================================

/**
 * Redis-based rate limiter for distributed systems
 * TODO: Implement when scaling to multiple servers
 *
 * @example
 * import Redis from 'ioredis';
 * const redis = new Redis(process.env.REDIS_URL);
 * const limiter = createRedisRateLimiter(redis, { maxRequests: 100, windowMs: 60000 });
 */
export interface RedisRateLimiterConfig extends RateLimitConfig {
  redis: any; // Redis client instance
  keyPrefix?: string;
}

// Placeholder for Redis implementation
export function createRedisRateLimiter(config: RedisRateLimiterConfig) {
  // TODO: Implement Redis-based rate limiting
  // This would use Redis sorted sets for distributed rate limiting
  throw new Error('Redis rate limiter not implemented yet');
}
