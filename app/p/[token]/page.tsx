export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import ProofPortal from './ProofPortal';
import crypto from 'crypto';

async function getOrderByToken(token: string) {
  // Hash the token to compare with stored hash
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Get magic link using the hash
  const { data: link } = await supabaseAdmin
    .from('magic_links')
    .select('order_id, expires_at')
    .eq('token_hash', tokenHash)
    .single();

  if (!link) return null;

  // Check expiry
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { expired: true };
  }

  // Get order with proofs
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', link.order_id)
    .single();

  if (!order) return null;

  const { data: versions } = await supabaseAdmin
    .from('proof_versions')
    .select('*, proof_files(*)')
    .eq('order_id', link.order_id)
    .order('version_number', { ascending: false });

  // Get settings
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('company_name, accent_color, logo_data_url')
    .eq('id', 'default')
    .single();

  // Update last viewed timestamp
  await supabaseAdmin
    .from('orders')
    .update({ customer_last_viewed_at: new Date().toISOString() })
    .eq('id', order.id);

  return {
    order: { ...order, versions: versions || [] },
    settings,
    token,
  };
}

export default async function PortalPage({ params }: { params: { token: string } }) {
  // Basic token format validation
  if (!params.token || params.token.length !== 64 || !/^[a-f0-9]+$/.test(params.token)) {
    notFound();
  }

  const data = await getOrderByToken(params.token);

  if (!data) notFound();

  if ('expired' in data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-semibold text-gray-900">Link Expired</h1>
          <p className="text-gray-500 mt-2">This proof link has expired. Please contact us for a new proof link.</p>
        </div>
      </div>
    );
  }

  return <ProofPortal order={data.order} settings={data.settings} token={data.token} />;
}
