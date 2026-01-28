import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';

// Validation schema for costs update
const updateCostsSchema = z.object({
  shipping_cost: z.number().nonnegative().optional(),
  other_cost: z.number().nonnegative().optional(),
});

// GET /api/job-costing/[orderId] - Get costs for an order
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(params.orderId)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
  }

  try {
    const { data: costs, error } = await supabaseAdmin
      .from('order_costs')
      .select('*')
      .eq('order_id', params.orderId)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is ok
      console.error('Job costing fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch costs' }, { status: 500 });
    }

    return NextResponse.json({ costs: costs || null });
  } catch (error) {
    console.error('Job costing GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/job-costing/[orderId] - Update costs manually
export async function PUT(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(params.orderId)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    
    // Validate input
    const result = updateCostsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { shipping_cost, other_cost } = result.data;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (shipping_cost !== undefined) updates.shipping_cost = shipping_cost;
    if (other_cost !== undefined) updates.other_cost = other_cost;

    // Check if record exists
    const { data: existing } = await supabaseAdmin
      .from('order_costs')
      .select('id')
      .eq('order_id', params.orderId)
      .single();

    let data;
    if (existing) {
      const updateResult = await supabaseAdmin
        .from('order_costs')
        .update(updates)
        .eq('order_id', params.orderId)
        .select()
        .single();
      data = updateResult.data;
    } else {
      // Get order revenue
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('order_total')
        .eq('id', params.orderId)
        .single();

      const insertResult = await supabaseAdmin
        .from('order_costs')
        .insert({
          order_id: params.orderId,
          order_revenue: order?.order_total || 0,
          ...updates,
        })
        .select()
        .single();
      data = insertResult.data;
    }

    return NextResponse.json({ costs: data });
  } catch (error) {
    console.error('Job costing PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
