import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

// Force Node.js runtime (required for Buffer)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY;
const SHIPSTATION_API_SECRET = process.env.SHIPSTATION_API_SECRET;
const SHIPSTATION_API_URL = 'https://ssapi.shipstation.com';

export async function POST(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  const requestId = crypto.randomUUID();

  if (!SHIPSTATION_API_KEY || !SHIPSTATION_API_SECRET) {
    console.log(`[ShipStation Test ${requestId}] Not configured - missing env vars`);
    return NextResponse.json({
      success: false,
      requestId,
      error: 'Not configured',
      message: 'Set SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET environment variables',
      missingEnvVars: [
        !SHIPSTATION_API_KEY && 'SHIPSTATION_API_KEY',
        !SHIPSTATION_API_SECRET && 'SHIPSTATION_API_SECRET',
      ].filter(Boolean),
    }, { status: 400 });
  }

  try {
    console.log(`[ShipStation Test ${requestId}] Testing connection...`);
    
    const auth = Buffer.from(`${SHIPSTATION_API_KEY}:${SHIPSTATION_API_SECRET}`).toString('base64');
    
    const response = await fetch(`${SHIPSTATION_API_URL}/stores`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    const rateLimitRemaining = response.headers.get('X-Rate-Limit-Remaining');
    const rateLimitReset = response.headers.get('X-Rate-Limit-Reset');

    console.log(`[ShipStation Test ${requestId}] Response status: ${response.status}, rate limit remaining: ${rateLimitRemaining}`);

    if (response.status === 401) {
      return NextResponse.json({
        success: false,
        requestId,
        error: 'Invalid credentials',
        message: 'API key or secret is incorrect. Verify your credentials in ShipStation → Settings → Account → API Settings.',
        httpStatus: 401,
      }, { status: 401 });
    }

    if (response.status === 429) {
      return NextResponse.json({
        success: false,
        requestId,
        error: 'Rate limited',
        message: 'Too many requests. ShipStation allows 40 requests per minute. Try again in a few minutes.',
        rateLimitReset,
        httpStatus: 429,
      }, { status: 429 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ShipStation Test ${requestId}] API error: ${response.status} - ${errorText.slice(0, 200)}`);
      return NextResponse.json({
        success: false,
        requestId,
        error: `API error ${response.status}`,
        message: errorText.slice(0, 200) || response.statusText,
        httpStatus: response.status,
      }, { status: response.status });
    }

    const stores = await response.json();
    
    console.log(`[ShipStation Test ${requestId}] Success - found ${stores.length} stores`);

    return NextResponse.json({
      success: true,
      requestId,
      message: `Connection successful! Found ${stores.length} store(s).`,
      stores: stores.map((s: { storeId: number; storeName: string; marketplaceName: string }) => ({
        id: s.storeId,
        name: s.storeName,
        marketplace: s.marketplaceName,
      })),
      rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ShipStation Test ${requestId}] Connection failed:`, errorMessage);
    
    // Provide more specific error messages for common issues
    let userMessage = errorMessage;
    if (errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED')) {
      userMessage = 'Unable to reach ShipStation API. Check your network connection.';
    } else if (errorMessage.includes('timeout')) {
      userMessage = 'Connection timed out. ShipStation may be experiencing issues.';
    }
    
    return NextResponse.json({
      success: false,
      requestId,
      error: 'Connection failed',
      message: userMessage,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
