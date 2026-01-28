import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

type SearchResult = {
  type: 'order' | 'customer' | 'asset';
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export async function GET(request: NextRequest) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  // Rate limit
  const rateLimitResponse = rateLimit(request, 'search', RATE_LIMITS.search);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();

    if (!query || query.length < 2 || query.length > 200) {
      return NextResponse.json({ results: [] });
    }

    const results: SearchResult[] = [];
    
    // Sanitize query - remove SQL wildcards from user input
    const sanitizedQuery = query.replace(/[%_\\]/g, '');
    if (sanitizedQuery.length < 2) {
      return NextResponse.json({ results: [] });
    }
    
    const searchTerm = `%${sanitizedQuery}%`;

    // Search orders
    try {
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('id, order_number, customer_name, customer_email, product_name, sku, status')
        .or(`order_number.ilike.${searchTerm},customer_name.ilike.${searchTerm},customer_email.ilike.${searchTerm},product_name.ilike.${searchTerm},sku.ilike.${searchTerm}`)
        .limit(5);

      if (orders) {
        for (const order of orders) {
          results.push({
            type: 'order',
            id: order.id,
            title: `#${order.order_number}`,
            subtitle: `${order.customer_name || order.customer_email || 'No name'} • ${order.product_name || order.sku || 'No product'}`,
            href: `/admin/orders/${order.id}`,
          });
        }
      }
    } catch {
      // Orders table should exist, but don't crash if query fails
    }

    // Search customers (table may not exist)
    try {
      const { data: customers } = await supabaseAdmin
        .from('customers')
        .select('id, name, primary_email, company, lifetime_order_count')
        .or(`name.ilike.${searchTerm},primary_email.ilike.${searchTerm},company.ilike.${searchTerm}`)
        .limit(5);

      if (customers) {
        for (const customer of customers) {
          results.push({
            type: 'customer',
            id: customer.id,
            title: customer.name || customer.primary_email,
            subtitle: `${customer.company || 'No company'} • ${customer.lifetime_order_count || 0} orders`,
            href: `/admin/customers/${customer.id}`,
          });
        }
      }
    } catch {
      // Customers table may not exist - skip silently
    }

    // Search assets (table may not exist)
    try {
      const { data: assets } = await supabaseAdmin
        .from('assets')
        .select('id, name, original_filename, tags')
        .or(`name.ilike.${searchTerm},original_filename.ilike.${searchTerm}`)
        .limit(5);

      if (assets) {
        for (const asset of assets) {
          results.push({
            type: 'asset',
            id: asset.id,
            title: asset.name,
            subtitle: asset.original_filename,
            href: `/admin/assets/${asset.id}`,
          });
        }
      }
    } catch {
      // Assets table may not exist - skip silently
    }

    // Sort results: exact matches first, then by type
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase().includes(sanitizedQuery.toLowerCase()) ? 0 : 1;
      const bExact = b.title.toLowerCase().includes(sanitizedQuery.toLowerCase()) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      
      // Then by type priority: orders > customers > assets
      const typePriority = { order: 0, customer: 1, asset: 2 };
      return typePriority[a.type] - typePriority[b.type];
    });

    return NextResponse.json({ results: results.slice(0, 10) });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
