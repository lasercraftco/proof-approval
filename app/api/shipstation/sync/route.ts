import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

// Force Node.js runtime (required for Buffer and crypto operations)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ShipStation API configuration
const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY;
const SHIPSTATION_API_SECRET = process.env.SHIPSTATION_API_SECRET;
const SHIPSTATION_API_URL = 'https://ssapi.shipstation.com';

type ShipStationOrder = {
  orderId: number;
  orderNumber: string;
  orderKey: string;
  orderDate: string;
  createDate: string;
  modifyDate: string;
  orderStatus: string;
  customerEmail: string;
  billTo: { name: string; company: string | null };
  shipTo: { name: string; company: string | null };
  items: Array<{
    orderItemId: number;
    lineItemKey: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    imageUrl: string | null;
    options: Array<{ name: string; value: string }>;
  }>;
  orderTotal: number;
  shippingAmount: number;
};

type SyncType = 'incremental' | '24h' | '7d' | '30d' | 'full';

// Structured logging helper (redacts secrets)
function logSync(level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const safeData = data ? {
    ...data,
    // Redact any sensitive fields that might slip through
    apiKey: data.apiKey ? '[REDACTED]' : undefined,
    apiSecret: data.apiSecret ? '[REDACTED]' : undefined,
    auth: data.auth ? '[REDACTED]' : undefined,
  } : {};
  
  const logEntry = {
    timestamp,
    level,
    service: 'shipstation-sync',
    message,
    ...safeData,
  };
  
  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

function getModifiedAfterDate(syncType: SyncType, lastSync: string | null): string {
  const now = Date.now();
  switch (syncType) {
    case '24h': return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    case '7d': return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d': return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    case 'full': return new Date('2020-01-01').toISOString();
    case 'incremental':
    default: return lastSync || new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}

async function fetchShipStationOrders(modifiedAfter: string): Promise<ShipStationOrder[]> {
  if (!SHIPSTATION_API_KEY || !SHIPSTATION_API_SECRET) {
    throw new Error('SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET are required');
  }

  const auth = Buffer.from(`${SHIPSTATION_API_KEY}:${SHIPSTATION_API_SECRET}`).toString('base64');
  const allOrders: ShipStationOrder[] = [];
  let page = 1;
  let hasMore = true;
  const maxPages = 50;

  logSync('info', 'Starting ShipStation order fetch', {
    modifiedAfter,
    hasApiKey: !!SHIPSTATION_API_KEY,
    hasApiSecret: !!SHIPSTATION_API_SECRET,
  });

  while (hasMore && page <= maxPages) {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '100',
      sortBy: 'ModifyDate',
      sortDir: 'DESC',
    });
    if (modifiedAfter) {
      params.append('modifyDateStart', modifiedAfter);
    }

    const url = `${SHIPSTATION_API_URL}/orders?${params}`;
    logSync('info', 'Fetching ShipStation page', { page, url: url.replace(/\?.+$/, '?[params]') });

    let response: Response;
    let retryCount = 0;
    const maxRetries = 3;

    // Retry logic with exponential backoff for rate limits
    while (retryCount < maxRetries) {
      try {
        response = await fetch(url, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 429) {
          retryCount++;
          const waitTime = Math.pow(2, retryCount) * 30000; // 30s, 60s, 120s
          logSync('warn', 'Rate limited, waiting before retry', { 
            retryCount, 
            waitMs: waitTime,
            retryAfter: response.headers.get('Retry-After'),
          });
          if (retryCount >= maxRetries) {
            throw new Error('ShipStation rate limit reached after retries. Try again later.');
          }
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }
        break;
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.message.includes('rate limit')) {
          throw fetchError;
        }
        retryCount++;
        if (retryCount >= maxRetries) {
          throw new Error(`Network error fetching orders: ${fetchError instanceof Error ? fetchError.message : 'Unknown'}`);
        }
        logSync('warn', 'Fetch error, retrying', { retryCount, error: String(fetchError) });
        await new Promise(r => setTimeout(r, 5000 * retryCount));
      }
    }

    if (response!.status === 401) {
      logSync('error', 'ShipStation authentication failed', { status: 401 });
      throw new Error('Invalid ShipStation API credentials. Check SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET.');
    }

    if (!response!.ok) {
      const text = await response!.text();
      logSync('error', 'ShipStation API error', { 
        status: response!.status,
        statusText: response!.statusText,
        bodySnippet: text.slice(0, 200),
      });
      throw new Error(`ShipStation API error ${response!.status}: ${text.slice(0, 200)}`);
    }

    const data = await response!.json();
    const ordersOnPage = data.orders || [];
    allOrders.push(...ordersOnPage);
    
    logSync('info', 'Fetched page successfully', { 
      page, 
      ordersOnPage: ordersOnPage.length,
      totalPages: data.pages,
      totalOrders: allOrders.length,
    });

    hasMore = data.page < data.pages;
    page++;

    // Rate limit: 40 requests/minute, so 1.5s delay
    if (hasMore) await new Promise(r => setTimeout(r, 1500));
  }

  logSync('info', 'Completed order fetch', { totalOrders: allOrders.length });
  return allOrders;
}

function mapStatus(ssStatus: string): string {
  const map: Record<string, string> = {
    'awaiting_payment': 'draft',
    'awaiting_shipment': 'open',
    'pending_fulfillment': 'open',
    'shipped': 'approved',
    'on_hold': 'draft',
    'cancelled': 'draft',
  };
  return map[ssStatus] || 'open';
}

// Core sync logic - extracted to be reusable by both GET and POST
async function performSync(syncType: SyncType, triggeredBy: string): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  
  logSync('info', 'Sync request started', { 
    requestId,
    syncType, 
    triggeredBy,
    hasApiKey: !!SHIPSTATION_API_KEY,
    hasApiSecret: !!SHIPSTATION_API_SECRET,
  });

  // Check configuration
  if (!SHIPSTATION_API_KEY || !SHIPSTATION_API_SECRET) {
    logSync('warn', 'ShipStation not configured', { 
      requestId,
      missingKey: !SHIPSTATION_API_KEY,
      missingSecret: !SHIPSTATION_API_SECRET,
    });
    return NextResponse.json({
      success: false,
      configured: false,
      requestId,
      error: 'ShipStation not configured',
      missingEnvVars: [
        !SHIPSTATION_API_KEY && 'SHIPSTATION_API_KEY',
        !SHIPSTATION_API_SECRET && 'SHIPSTATION_API_SECRET',
      ].filter(Boolean),
    }, { status: 400 });
  }

  // Create sync run record
  const { data: syncRun, error: createError } = await supabaseAdmin
    .from('shipstation_sync_runs')
    .insert({
      status: 'running',
      sync_type: syncType,
      triggered_by: triggeredBy,
    })
    .select('id')
    .single();

  if (createError || !syncRun) {
    logSync('error', 'Failed to create sync run record', { 
      requestId,
      error: createError?.message,
      code: createError?.code,
    });
    return NextResponse.json({ 
      success: false, 
      configured: true,
      requestId,
      error: 'Failed to start sync: Database error',
      details: createError?.message,
    }, { status: 500 });
  }

  const runId = syncRun.id;
  logSync('info', 'Sync run created', { requestId, runId });

  try {
    // Get last sync time
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('last_shipstation_sync')
      .eq('id', 'default')
      .single();

    const modifiedAfter = getModifiedAfterDate(syncType, settings?.last_shipstation_sync);
    
    logSync('info', 'Fetching orders', { 
      requestId,
      runId, 
      syncType,
      modifiedAfter,
      lastSync: settings?.last_shipstation_sync,
    });

    // Update sync run with modified_after
    await supabaseAdmin
      .from('shipstation_sync_runs')
      .update({ modified_after: modifiedAfter })
      .eq('id', runId);

    // Fetch orders
    const orders = await fetchShipStationOrders(modifiedAfter);

    let inserted = 0, updated = 0, skipped = 0, errorCount = 0;
    const errors: string[] = [];

    for (const ssOrder of orders) {
      try {
        const { data: existing } = await supabaseAdmin
          .from('orders')
          .select('id, status')
          .eq('external_id', ssOrder.orderId.toString())
          .eq('platform', 'shipstation')
          .single();

        const orderData = {
          external_id: ssOrder.orderId.toString(),
          order_number: ssOrder.orderNumber,
          platform: 'shipstation',
          customer_email: ssOrder.customerEmail || 'unknown@shipstation.com',
          customer_name: ssOrder.shipTo?.name || ssOrder.billTo?.name || null,
          status: mapStatus(ssOrder.orderStatus),
          order_total: ssOrder.orderTotal || 0,
          sku: ssOrder.items?.[0]?.sku || null,
          product_name: ssOrder.items?.[0]?.name || null,
          quantity: ssOrder.items?.reduce((sum, i) => sum + i.quantity, 0) || 1,
          product_image_url: ssOrder.items?.[0]?.imageUrl || null,
          customization_options: ssOrder.items?.[0]?.options?.reduce((acc, opt) => {
            acc[opt.name] = opt.value;
            return acc;
          }, {} as Record<string, string>) || null,
          raw_data: ssOrder,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          // Skip if already processed (approved, proof sent, etc.)
          if (['approved', 'approved_with_notes', 'changes_requested', 'proof_sent'].includes(existing.status)) {
            skipped++;
            continue;
          }
          const { error } = await supabaseAdmin.from('orders').update(orderData).eq('id', existing.id);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabaseAdmin.from('orders').insert({
            ...orderData,
            created_at: ssOrder.orderDate || ssOrder.createDate,
          });
          if (error) throw error;
          inserted++;
        }
      } catch (err) {
        errorCount++;
        const errorMsg = `Order ${ssOrder.orderNumber}: ${err instanceof Error ? err.message : 'Unknown'}`;
        errors.push(errorMsg);
        logSync('warn', 'Order processing error', { 
          requestId,
          runId,
          orderNumber: ssOrder.orderNumber,
          error: errorMsg,
        });
      }
    }

    // Update sync run as success
    await supabaseAdmin
      .from('shipstation_sync_runs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        fetched_count: orders.length,
        inserted_count: inserted,
        updated_count: updated,
        skipped_count: skipped,
        error_count: errorCount,
        error_details: errors.length > 0 ? { errors: errors.slice(0, 10) } : null,
      })
      .eq('id', runId);

    // Update app settings
    await supabaseAdmin
      .from('app_settings')
      .upsert({
        id: 'default',
        last_shipstation_sync: new Date().toISOString(),
        last_shipstation_sync_attempt: new Date().toISOString(),
        last_shipstation_sync_error: null,
      }, { onConflict: 'id' });

    const message = `Synced ${orders.length} orders: ${inserted} new, ${updated} updated, ${skipped} skipped`;
    logSync('info', 'Sync completed successfully', {
      requestId,
      runId,
      fetched: orders.length,
      inserted,
      updated,
      skipped,
      errors: errorCount,
    });

    return NextResponse.json({
      success: true,
      configured: true,
      requestId,
      runId,
      stats: {
        fetched: orders.length,
        inserted,
        updated,
        skipped,
        errors: errorCount,
      },
      message,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown sync error';
    
    logSync('error', 'Sync failed', {
      requestId,
      runId,
      error: errorMsg,
      stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined,
    });

    // Update sync run as failed
    await supabaseAdmin
      .from('shipstation_sync_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_summary: errorMsg.slice(0, 500),
      })
      .eq('id', runId);

    // Update app settings with error
    await supabaseAdmin
      .from('app_settings')
      .upsert({
        id: 'default',
        last_shipstation_sync_attempt: new Date().toISOString(),
        last_shipstation_sync_error: errorMsg.slice(0, 500),
      }, { onConflict: 'id' });

    return NextResponse.json({
      success: false,
      configured: true,
      requestId,
      runId,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Auth check - allow cron or admin session
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && cronSecret.length >= 16 && authHeader === `Bearer ${cronSecret}`;
  
  if (!isCronAuth) {
    const authError = requireAdmin(request);
    if (authError) {
      logSync('warn', 'Unauthorized sync attempt', { 
        hasCronAuth: !!authHeader,
        hasSession: !!request.cookies.get('admin_session'),
      });
      return authError;
    }
  }

  // Parse sync type from body
  let syncType: SyncType = 'incremental';
  try {
    const body = await request.json();
    if (body.syncType && ['incremental', '24h', '7d', '30d', 'full'].includes(body.syncType)) {
      syncType = body.syncType;
    }
  } catch { 
    // Use default syncType if no body or parse error
  }

  return performSync(syncType, isCronAuth ? 'cron' : 'manual');
}

// GET handler for cron jobs - no JSON body needed
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || cronSecret.length < 16 || authHeader !== `Bearer ${cronSecret}`) {
    logSync('warn', 'Unauthorized GET sync attempt (cron)', {
      hasAuthHeader: !!authHeader,
      hasCronSecret: !!cronSecret,
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Cron jobs use incremental sync by default
  return performSync('incremental', 'cron');
}
