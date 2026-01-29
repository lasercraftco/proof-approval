/**
 * ShipStation Integration Utilities
 * 
 * Server-side utilities for ShipStation API integration.
 * This module provides credential verification and helper functions.
 */

// Force this to be server-only
if (typeof window !== 'undefined') {
  throw new Error('lib/shipstation.ts cannot be imported on client side');
}

const SHIPSTATION_API_URL = 'https://ssapi.shipstation.com';

export type CredentialVerificationResult = {
  valid: boolean;
  error?: string;
  errorCode?: 'missing_credentials' | 'invalid_credentials' | 'rate_limited' | 'api_error' | 'network_error';
  rateLimitRemaining?: number;
  stores?: Array<{ id: number; name: string; marketplace: string }>;
};

/**
 * Verify ShipStation credentials by making a lightweight API call
 * This is a non-destructive check that can be called before sync operations
 */
export async function verifyCredentials(
  apiKey: string | undefined,
  apiSecret: string | undefined
): Promise<CredentialVerificationResult> {
  // Check if credentials are provided
  if (!apiKey || !apiSecret) {
    return {
      valid: false,
      error: 'Missing API credentials',
      errorCode: 'missing_credentials',
    };
  }

  try {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    // Use /stores endpoint as it's lightweight and confirms authentication
    const response = await fetch(`${SHIPSTATION_API_URL}/stores`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    const rateLimitRemaining = response.headers.get('X-Rate-Limit-Remaining');

    if (response.status === 401) {
      return {
        valid: false,
        error: 'Invalid API credentials',
        errorCode: 'invalid_credentials',
      };
    }

    if (response.status === 429) {
      return {
        valid: false,
        error: 'Rate limit exceeded',
        errorCode: 'rate_limited',
        rateLimitRemaining: 0,
      };
    }

    if (!response.ok) {
      const text = await response.text();
      return {
        valid: false,
        error: `API error: ${response.status} ${text.slice(0, 100)}`,
        errorCode: 'api_error',
      };
    }

    const stores = await response.json();
    
    return {
      valid: true,
      rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
      stores: stores.map((s: { storeId: number; storeName: string; marketplaceName: string }) => ({
        id: s.storeId,
        name: s.storeName,
        marketplace: s.marketplaceName,
      })),
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Network error',
      errorCode: 'network_error',
    };
  }
}

/**
 * Check if ShipStation is configured (env vars present)
 */
export function isConfigured(): boolean {
  return !!(process.env.SHIPSTATION_API_KEY && process.env.SHIPSTATION_API_SECRET);
}

/**
 * Get list of missing environment variables
 */
export function getMissingEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.SHIPSTATION_API_KEY) missing.push('SHIPSTATION_API_KEY');
  if (!process.env.SHIPSTATION_API_SECRET) missing.push('SHIPSTATION_API_SECRET');
  return missing;
}

/**
 * Build Basic Auth header value for ShipStation API
 * Returns null if credentials are missing
 */
export function buildAuthHeader(): string | null {
  const apiKey = process.env.SHIPSTATION_API_KEY;
  const apiSecret = process.env.SHIPSTATION_API_SECRET;
  
  if (!apiKey || !apiSecret) {
    return null;
  }
  
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
}

/**
 * Map ShipStation order status to internal status
 */
export function mapOrderStatus(shipstationStatus: string): string {
  const statusMap: Record<string, string> = {
    'awaiting_payment': 'draft',
    'awaiting_shipment': 'open',
    'pending_fulfillment': 'open',
    'shipped': 'approved',
    'on_hold': 'draft',
    'cancelled': 'draft',
  };
  return statusMap[shipstationStatus] || 'open';
}
