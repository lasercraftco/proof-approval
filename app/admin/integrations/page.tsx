export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import IntegrationsClient from './IntegrationsClient';

async function getIntegrationsData() {
  // Get app settings
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
    .limit(20);

  // Get order counts by platform
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('platform');

  const platformCounts: Record<string, number> = { manual: 0, shipstation: 0 };
  (orders || []).forEach(o => {
    const p = o.platform || 'manual';
    platformCounts[p] = (platformCounts[p] || 0) + 1;
  });

  return {
    settings: settings || {},
    syncRuns: syncRuns || [],
    platformCounts,
    totalOrders: orders?.length || 0,
  };
}

export default async function IntegrationsPage() {
  const data = await getIntegrationsData();
  return <IntegrationsClient {...data} />;
}
