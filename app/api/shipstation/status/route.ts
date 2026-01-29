import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

// Force Node.js runtime for consistency
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY;
const SHIPSTATION_API_SECRET = process.env.SHIPSTATION_API_SECRET;

export async function GET(request: NextRequest) {
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const isConfigured = !!(SHIPSTATION_API_KEY && SHIPSTATION_API_SECRET);
    
    // Get settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('app_settings')
      .select('last_shipstation_sync, last_shipstation_sync_attempt, last_shipstation_sync_error')
      .eq('id', 'default')
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine for new installations
      console.error('[ShipStation Status] Settings fetch error:', settingsError.message);
    }

    // Get recent sync runs
    const { data: syncRuns, error: runsError } = await supabaseAdmin
      .from('shipstation_sync_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (runsError) {
      console.error('[ShipStation Status] Sync runs fetch error:', runsError.message);
    }

    // Get ShipStation order count
    const { count: orderCount, error: countError } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('platform', 'shipstation');

    if (countError) {
      console.error('[ShipStation Status] Order count error:', countError.message);
    }

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
        fetched: run.fetched_count || 0,
        inserted: run.inserted_count || 0,
        updated: run.updated_count || 0,
        skipped: run.skipped_count || 0,
        errors: run.error_count || 0,
        errorSummary: run.error_summary,
      })),
    });
  } catch (error) {
    console.error('[ShipStation Status] Unexpected error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ 
      error: 'Failed to fetch status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
