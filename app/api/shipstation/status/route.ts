import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY;
const SHIPSTATION_API_SECRET = process.env.SHIPSTATION_API_SECRET;

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const isConfigured = !!(SHIPSTATION_API_KEY && SHIPSTATION_API_SECRET);
    
    // Get settings
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('last_shipstation_sync, last_shipstation_sync_attempt, last_shipstation_sync_error')
      .eq('id', 'default')
      .single();

    // Get recent sync runs
    const { data: syncRuns } = await supabaseAdmin
      .from('shipstation_sync_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get ShipStation order count
    const { count: orderCount } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('platform', 'shipstation');

    const missingEnvVars: string[] = [];
    if (!SHIPSTATION_API_KEY) missingEnvVars.push('SHIPSTATION_API_KEY');
    if (!SHIPSTATION_API_SECRET) missingEnvVars.push('SHIPSTATION_API_SECRET');

    return NextResponse.json({
      configured: isConfigured,
      missingEnvVars,
      lastSuccessfulSync: settings?.last_shipstation_sync || null,
      lastSyncAttempt: settings?.last_shipstation_sync_attempt || null,
      lastSyncError: settings?.last_shipstation_sync_error || null,
      totalOrders: orderCount || 0,
      recentRuns: (syncRuns || []).map(run => ({
        id: run.id,
        startedAt: run.started_at,
        finishedAt: run.finished_at,
        status: run.status,
        syncType: run.sync_type,
        triggeredBy: run.triggered_by,
        fetched: run.fetched_count,
        inserted: run.inserted_count,
        updated: run.updated_count,
        skipped: run.skipped_count,
        errors: run.error_count,
        errorSummary: run.error_summary,
      })),
    });
  } catch (error) {
    console.error('Status fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
