import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireCronAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  // Require cron authentication
  const authError = requireCronAuth(request);
  if (authError) return authError;

  try {
    // Get settings
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('reminder_config, email_from_name, email_from_email, company_name')
      .eq('id', 'default')
      .single();

    const config = settings?.reminder_config || {
      enabled: true,
      first_reminder_days: 3,
      second_reminder_days: 7,
      max_reminders: 2,
    };

    if (!config.enabled) {
      return NextResponse.json({ message: 'Reminders disabled', sent: 0 });
    }

    const now = new Date();
    const firstReminderDate = new Date(now.getTime() - config.first_reminder_days * 24 * 60 * 60 * 1000);

    // Get orders that need reminders
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('status', 'proof_sent')
      .lt('created_at', firstReminderDate.toISOString())
      .lt('reminder_count', config.max_reminders);

    if (ordersError) {
      console.error('Error fetching orders for reminders:', ordersError);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ message: 'No reminders needed', sent: 0 });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const order of orders) {
      try {
        // Get magic link for this order
        const { data: magicLink } = await supabaseAdmin
          .from('magic_links')
          .select('token_hash, expires_at')
          .eq('order_id', order.id)
          .single();

        // Skip if no magic link or expired
        if (!magicLink || (magicLink.expires_at && new Date(magicLink.expires_at) < now)) {
          continue;
        }

        // Send reminder email if Resend is configured
        if (process.env.RESEND_API_KEY) {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          const baseUrl = process.env.APP_PUBLIC_BASE_URL || 'http://localhost:3000';
          
          // Note: We can't reconstruct the original token from the hash
          // This is intentional for security - we need to generate a new link
          // For now, we'll skip sending the link in reminders
          // In production, you'd want to either:
          // 1. Store encrypted token (not hash) for reminders
          // 2. Generate new magic link on reminder

          await resend.emails.send({
            from: `${settings?.email_from_name || 'Proofs'} <${settings?.email_from_email || 'proofs@example.com'}>`,
            to: order.customer_email,
            subject: `Reminder: Your proof is waiting - Order #${order.order_number}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Reminder: Your proof is ready for review</h2>
                <p>Hi ${order.customer_name || 'there'},</p>
                <p>We're still waiting for your approval on order #${order.order_number}.</p>
                <p>Please check your original email for the proof review link, or contact us if you need a new link.</p>
                <p>Thank you,<br>${settings?.company_name || 'The Team'}</p>
              </div>
            `,
          });
        }

        // Update reminder count
        const { error: updateError } = await supabaseAdmin
          .from('orders')
          .update({
            reminder_count: (order.reminder_count || 0) + 1,
            last_reminder_sent_at: now.toISOString(),
          })
          .eq('id', order.id);

        if (updateError) {
          errors.push(`Failed to update order ${order.id}: ${updateError.message}`);
          continue;
        }

        // Log audit event
        await supabaseAdmin
          .from('audit_events')
          .insert({
            order_id: order.id,
            actor_type: 'system',
            event_type: 'reminder_sent',
            metadata: { reminder_number: (order.reminder_count || 0) + 1 },
          });

        sent++;
      } catch (orderError) {
        console.error(`Error processing reminder for order ${order.id}:`, orderError);
        errors.push(`Order ${order.id}: ${orderError instanceof Error ? orderError.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({ 
      message: `Sent ${sent} reminders`, 
      sent,
      total: orders.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Cron reminders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
