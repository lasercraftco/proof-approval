export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import OrdersClient from './OrdersClient';

async function getOrders() {
  const { data } = await supabaseAdmin
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  return data || [];
}

export default async function OrdersPage() {
  const orders = await getOrders();
  return <OrdersClient orders={orders} />;
}
