import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { bulkActionsSchema, formatZodErrors } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  // Rate limit
  const rateLimitResponse = rateLimit(request, 'bulk-actions', RATE_LIMITS.adminApi);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();

    // Validate input
    const result = bulkActionsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(result.error) },
        { status: 400 }
      );
    }

    const { action, orderIds } = result.data;
    let processed = 0;
    let error = null;

    switch (action) {
      case 'send_reminders':
        // Note: This would send actual reminder emails in production
        // For now, just mark that reminders were "sent"
        processed = orderIds.length;
        break;

      case 'mark_open':
        const { error: openError } = await supabaseAdmin
          .from('orders')
          .update({ status: 'open' })
          .in('id', orderIds);
        if (openError) {
          error = openError;
        } else {
          processed = orderIds.length;
        }
        break;

      case 'mark_approved':
        const { error: approvedError } = await supabaseAdmin
          .from('orders')
          .update({ 
            status: 'approved',
            customer_decision_at: new Date().toISOString(),
          })
          .in('id', orderIds);
        if (approvedError) {
          error = approvedError;
        } else {
          processed = orderIds.length;
        }
        break;

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    if (error) {
      console.error('Bulk action error:', error);
      return NextResponse.json({ error: 'Failed to process bulk action' }, { status: 500 });
    }

    // Log audit event
    await supabaseAdmin
      .from('audit_events')
      .insert({
        actor_type: 'staff',
        event_type: `bulk_${action}`,
        metadata: { order_count: orderIds.length },
      });

    return NextResponse.json({ processed });
  } catch (error) {
    console.error('Bulk actions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
