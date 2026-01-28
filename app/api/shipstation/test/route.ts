import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY;
const SHIPSTATION_API_SECRET = process.env.SHIPSTATION_API_SECRET;
const SHIPSTATION_API_URL = 'https://ssapi.shipstation.com';

export async function POST(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (!SHIPSTATION_API_KEY || !SHIPSTATION_API_SECRET) {
    return NextResponse.json({
      success: false,
      error: 'Not configured',
      message: 'Set SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET environment variables',
      missingEnvVars: [
        !SHIPSTATION_API_KEY && 'SHIPSTATION_API_KEY',
        !SHIPSTATION_API_SECRET && 'SHIPSTATION_API_SECRET',
      ].filter(Boolean),
    }, { status: 400 });
  }

  try {
    const auth = Buffer.from(`${SHIPSTATION_API_KEY}:${SHIPSTATION_API_SECRET}`).toString('base64');
    
    const response = await fetch(`${SHIPSTATION_API_URL}/stores`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      return NextResponse.json({
        success: false,
        error: 'Invalid credentials',
        message: 'API key or secret is incorrect',
      }, { status: 401 });
    }

    if (response.status === 429) {
      return NextResponse.json({
        success: false,
        error: 'Rate limited',
        message: 'Too many requests. Try again in a few minutes.',
      }, { status: 429 });
    }

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `API error ${response.status}`,
        message: await response.text(),
      }, { status: response.status });
    }

    const stores = await response.json();
    const rateLimitRemaining = response.headers.get('X-Rate-Limit-Remaining');

    return NextResponse.json({
      success: true,
      message: 'Connection successful!',
      stores: stores.map((s: { storeId: number; storeName: string; marketplaceName: string }) => ({
        id: s.storeId,
        name: s.storeName,
        marketplace: s.marketplaceName,
      })),
      rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : null,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Connection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
