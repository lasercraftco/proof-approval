import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { productionUpdateSchema, formatZodErrors } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  // Rate limit
  const rateLimitResponse = rateLimit(request, 'production-update', RATE_LIMITS.adminApi);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();

    // Validate input
    const result = productionUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(result.error) },
        { status: 400 }
      );
    }

    const { orderId, ...updates } = result.data;

    // Build update data from validated fields only
    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'production_status',
      'production_print_process',
      'production_batch_group',
      'production_material',
      'production_machine',
      'production_assigned_to',
      'production_priority',
      'production_notes',
      'production_estimated_hours',
    ] as const;

    for (const field of allowedFields) {
      if (field in updates && updates[field as keyof typeof updates] !== undefined) {
        updateData[field] = updates[field as keyof typeof updates];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Production update error:', error);
      return NextResponse.json({ error: 'Failed to update production status' }, { status: 500 });
    }

    return NextResponse.json({ order: data });
  } catch (error) {
    console.error('Production update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
