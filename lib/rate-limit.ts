import { NextRequest } from 'next/server';

/**
 * Simple in-memory rate limiter
 * For production, use Redis-based solution like @upstash/ratelimit
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (cleared on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

/**
 * Default rate limit configs for different endpoints
 */
export const RATE_LIMITS = {
  // Customer-facing endpoints (more lenient)
  customerSubmit: { windowMs: 60 * 1000, maxRequests: 10 },
  proofView: { windowMs: 60 * 1000, maxRequests: 30 },
  
  // Admin endpoints
  adminApi: { windowMs: 60 * 1000, maxRequests: 60 },
  
  // Sensitive endpoints (stricter)
  login: { windowMs: 15 * 60 * 1000, maxRequests: 5 },  // 5 attempts per 15 min
  search: { windowMs: 60 * 1000, maxRequests: 30 },
  upload: { windowMs: 60 * 1000, maxRequests: 10 },
};

/**
 * Get client IP from request
 */
export function getClientIp(request: NextRequest): string {
  // Check various headers for the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback (won't work in production behind proxy)
  return '127.0.0.1';
}

/**
 * Check rate limit for a given key
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    // Create new entry
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment count
  entry.count++;
  return { 
    allowed: true, 
    remaining: config.maxRequests - entry.count, 
    resetAt: entry.resetAt 
  };
}

/**
 * Rate limit middleware for API routes
 * Returns null if allowed, or a 429 response if rate limited
 */
export function rateLimit(
  request: NextRequest,
  endpoint: string,
  config: RateLimitConfig
): Response | null {
  const ip = getClientIp(request);
  const key = `${endpoint}:${ip}`;
  
  const result = checkRateLimit(key, config);
  
  if (!result.allowed) {
    return new Response(
      JSON.stringify({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
      }),
      { 
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        }
      }
    );
  }
  
  return null;
}
