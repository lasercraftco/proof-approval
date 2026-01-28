import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

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

    const response = await fetch(`${SHIPSTATION_API_URL}/orders?${params}`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 429) {
      throw new Error('ShipStation rate limit reached. Try again in a few minutes.');
    }
    if (response.status === 401) {
      throw new Error('Invalid ShipStation API credentials. Check SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET.');
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ShipStation API error ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    allOrders.push(...(data.orders || []));
    hasMore = data.page < data.pages;
    page++;

    // Rate limit: 40 requests/minute, so 1.5s delay
    if (hasMore) await new Promise(r => setTimeout(r, 1500));
  }

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

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && cronSecret.length >= 16 && authHeader === `Bearer ${cronSecret}`;
  
  if (!isCronAuth) {
    const authError = requireAdmin(request);
    if (authError) return authError;
  }

  // Check configuration
  if (!SHIPSTATION_API_KEY || !SHIPSTATION_API_SECRET) {
    return NextResponse.json({
      success: false,
      configured: false,
      error: 'ShipStation not configured',
      missingEnvVars: [
        !SHIPSTATION_API_KEY && 'SHIPSTATION_API_KEY',
        !SHIPSTATION_API_SECRET && 'SHIPSTATION_API_SECRET',
      ].filter(Boolean),
    }, { status: 400 });
  }

  // Parse sync type from body
  let syncType: SyncType = 'incremental';
  try {
    const body = await request.json();
    if (body.syncType && ['incremental', '24h', '7d', '30d', 'full'].includes(body.syncType)) {
      syncType = body.syncType;
    }
  } catch { /* use default */ }

  // Create sync run record
  const { data: syncRun, error: createError } = await supabaseAdmin
    .from('shipstation_sync_runs')
    .insert({
      status: 'running',
      sync_type: syncType,
      triggered_by: isCronAuth ? 'cron' : 'manual',
    })
    .select('id')
    .single();

  if (createError || !syncRun) {
    console.error('Failed to create sync run:', createError);
    return NextResponse.json({ success: false, error: 'Failed to start sync' }, { status: 500 });
  }

  const runId = syncRun.id;

  try {
    // Get last sync time
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('last_shipstation_sync')
      .eq('id', 'default')
      .single();

    const modifiedAfter = getModifiedAfterDate(syncType, settings?.last_shipstation_sync);

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
          // Skip if already processed
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
        errors.push(`Order ${ssOrder.orderNumber}: ${err instanceof Error ? err.message : 'Unknown'}`);
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

    return NextResponse.json({
      success: true,
      configured: true,
      runId,
      stats: {
        fetched: orders.length,
        inserted,
        updated,
        skipped,
        errors: errorCount,
      },
      message: `Synced ${orders.length} orders: ${inserted} new, ${updated} updated, ${skipped} skipped`,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown sync error';
    
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

    console.error('ShipStation sync error:', error);
    return NextResponse.json({
      success: false,
      configured: true,
      runId,
      error: errorMsg,
    }, { status: 500 });
  }
}

// GET for cron jobs
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || cronSecret.length < 16 || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return POST(request);
}
