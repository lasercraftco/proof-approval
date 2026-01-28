import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Ensure this module only runs on server
if (typeof window !== 'undefined') {
  throw new Error('lib/auth.ts cannot be imported on client side');
}

const SESSION_COOKIE_NAME = 'admin_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters');
  }
  return secret;
}

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be set and at least 8 characters');
  }
  return password;
}

/**
 * Create HMAC signature for session data
 */
function signSession(data: string): string {
  const secret = getSessionSecret();
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify HMAC signature
 */
function verifySignature(data: string, signature: string): boolean {
  const expected = signSession(data);
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Create a signed session token
 */
export function createSessionToken(): string {
  const payload = {
    authenticated: true,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = signSession(data);
  return `${data}.${signature}`;
}

/**
 * Verify and decode a session token
 */
export function verifySessionToken(token: string): { valid: boolean; expired?: boolean } {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false };

    const [data, signature] = parts;
    
    if (!verifySignature(data, signature)) {
      return { valid: false };
    }

    const payload = JSON.parse(Buffer.from(data, 'base64').toString());
    
    if (!payload.authenticated || !payload.expiresAt) {
      return { valid: false };
    }

    if (Date.now() > payload.expiresAt) {
      return { valid: false, expired: true };
    }

    return { valid: true };
  } catch {
    return { valid: false };
  }
}

/**
 * Verify admin password
 */
export function verifyPassword(password: string): boolean {
  const adminPassword = getAdminPassword();
  // Constant-time comparison
  if (password.length !== adminPassword.length) {
    // Still do a comparison to prevent timing attacks
    crypto.timingSafeEqual(
      Buffer.from(password.padEnd(adminPassword.length, '\0')),
      Buffer.from(adminPassword)
    );
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(adminPassword));
}

/**
 * Set session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get current session from cookies (for server components)
 */
export async function getSession(): Promise<{ authenticated: boolean }> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    
    if (!sessionCookie?.value) {
      return { authenticated: false };
    }

    const result = verifySessionToken(sessionCookie.value);
    return { authenticated: result.valid };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Check if request is authenticated (for API routes)
 */
export function isAuthenticated(request: NextRequest): boolean {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  
  if (!sessionCookie?.value) {
    return false;
  }

  const result = verifySessionToken(sessionCookie.value);
  return result.valid;
}

/**
 * Middleware to require admin authentication for API routes
 * Returns null if authenticated, or a 401 response if not
 */
export function requireAdmin(request: NextRequest): NextResponse | null {
  if (!isAuthenticated(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Please log in.' },
      { status: 401 }
    );
  }
  return null;
}

/**
 * Verify cron secret for protected cron endpoints
 */
export function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || cronSecret.length < 16) {
    console.error('CRON_SECRET not configured or too short');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) return false;

  // Constant-time comparison
  if (token.length !== cronSecret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
}

/**
 * Middleware to require cron secret
 */
export function requireCronAuth(request: NextRequest): NextResponse | null {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Invalid or missing CRON_SECRET.' },
      { status: 401 }
    );
  }
  return null;
}
