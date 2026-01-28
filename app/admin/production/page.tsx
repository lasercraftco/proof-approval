export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import ProductionBoard from './ProductionBoard';

async function getProductionOrders() {
  const { data } = await supabaseAdmin
    .from('orders')
    .select('*')
    .in('status', ['approved', 'approved_with_notes'])
    .order('created_at', { ascending: true });
  return data || [];
}

export default async function ProductionPage() {
  const orders = await getProductionOrders();
  return <ProductionBoard orders={orders} />;
}
