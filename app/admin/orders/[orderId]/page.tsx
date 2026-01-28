export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import OrderDetail from './OrderDetail';

async function getOrder(id: string) {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();

  if (!order) return null;

  const { data: versions } = await supabaseAdmin
    .from('proof_versions')
    .select('*, proof_files(*)')
    .eq('order_id', id)
    .order('version_number', { ascending: false });

  const { data: magicLink } = await supabaseAdmin
    .from('magic_links')
    .select('token_hash')
    .eq('order_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return { ...order, versions: versions || [], magicLink };
}

export default async function OrderPage({ params }: { params: { orderId: string } }) {
  const order = await getOrder(params.orderId);
  if (!order) notFound();

  const baseUrl = process.env.APP_PUBLIC_BASE_URL || 'http://localhost:3000';
  const proofLink = order.magicLink ? `${baseUrl}/p/${order.magicLink.token_hash}` : null;

  return <OrderDetail order={order} proofLink={proofLink} />;
}
