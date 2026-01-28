import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { submitDecisionSchema, formatZodErrors } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  // Rate limit customer submissions
  const rateLimitResponse = rateLimit(request, 'customer-submit', RATE_LIMITS.customerSubmit);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();

    // Validate input
    const result = submitDecisionSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(result.error) },
        { status: 400 }
      );
    }

    const { token, decision, note } = result.data;

    // Hash the token to look up in database
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find magic link using the hash
    const { data: magicLink, error: linkError } = await supabaseAdmin
      .from('magic_links')
      .select('order_id, expires_at')
      .eq('token_hash', tokenHash)
      .single();

    if (linkError || !magicLink) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
    }

    // Check if link has expired
    if (magicLink.expires_at && new Date(magicLink.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
    }

    // Get order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', magicLink.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if already decided
    if (['approved', 'approved_with_notes', 'changes_requested'].includes(order.status)) {
      return NextResponse.json({ error: 'Decision already submitted' }, { status: 400 });
    }

    // Update order status
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: decision,
        customer_decision_at: new Date().toISOString(),
        customer_last_activity_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return NextResponse.json({ error: 'Failed to save decision' }, { status: 500 });
    }

    // Add message to thread if note provided
    if (note && note.trim()) {
      // Get or create thread
      let { data: thread } = await supabaseAdmin
        .from('threads')
        .select('id')
        .eq('order_id', order.id)
        .single();

      if (!thread) {
        const { data: newThread, error: threadError } = await supabaseAdmin
          .from('threads')
          .insert({ order_id: order.id })
          .select()
          .single();
        
        if (threadError) {
          console.error('Error creating thread:', threadError);
        } else {
          thread = newThread;
        }
      }

      if (thread) {
        await supabaseAdmin
          .from('messages')
          .insert({
            thread_id: thread.id,
            author_type: 'customer',
            author_name: order.customer_name || 'Customer',
            body: note.trim(),
          });
      }
    }

    // Log audit event (don't log the raw token)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await supabaseAdmin
      .from('audit_events')
      .insert({
        order_id: order.id,
        actor_type: 'customer',
        event_type: decision,
        metadata: { has_note: !!(note && note.trim()) },
        ip,
        user_agent: userAgent.substring(0, 500), // Limit length
      });

    // Notify staff (if Resend configured)
    if (process.env.RESEND_API_KEY) {
      try {
        const { data: settings } = await supabaseAdmin
          .from('app_settings')
          .select('staff_notify_email, email_from_name, email_from_email')
          .eq('id', 'default')
          .single();

        if (settings?.staff_notify_email) {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);

          const decisionText = decision === 'changes_requested' 
            ? '❌ Changes Requested' 
            : '✅ Approved';

          await resend.emails.send({
            from: `${settings.email_from_name || 'Proofs'} <${settings.email_from_email || 'proofs@example.com'}>`,
            to: settings.staff_notify_email,
            subject: `${decisionText} - Order #${order.order_number}`,
            html: `
              <h2>${decisionText}</h2>
              <p>Order #${order.order_number} has been ${decision.replace(/_/g, ' ')}.</p>
              ${note && note.trim() ? `<p><strong>Customer note:</strong> ${note}</p>` : ''}
              <p><a href="${process.env.APP_PUBLIC_BASE_URL}/admin/orders/${order.id}">View Order</a></p>
            `,
          });
        }
      } catch (emailError) {
        console.error('Staff notification email error:', emailError);
        // Don't fail - decision was saved successfully
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Submit decision error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
