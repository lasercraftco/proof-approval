export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import BulkClient from './BulkClient';

async function getOrders() {
  const { data } = await supabaseAdmin
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  return data || [];
}

export default async function BulkPage() {
  const orders = await getOrders();
  return <BulkClient orders={orders} />;
}
