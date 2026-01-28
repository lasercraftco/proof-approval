import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

// POST /api/job-costing/[orderId]/calculate - Recalculate costs
export async function POST(
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
    // Call the database function
    const { data, error } = await supabaseAdmin.rpc('calculate_order_costs', {
      p_order_id: params.orderId,
    });

    if (error) {
      console.error('Calculate costs error:', error);
      return NextResponse.json({ error: 'Failed to calculate costs' }, { status: 500 });
    }

    return NextResponse.json({ costs: data });
  } catch (error) {
    console.error('Job costing calculate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
