import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createSessionToken } from '@/lib/auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const SESSION_COOKIE_NAME = 'admin_session';
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: NextRequest) {
  // Rate limit login attempts
  const rateLimitResponse = rateLimit(request, 'login', RATE_LIMITS.login);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    if (!verifyPassword(password)) {
      // Use generic error message to avoid leaking info
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create session
    const token = createSessionToken();
    
    // Create response and set cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
