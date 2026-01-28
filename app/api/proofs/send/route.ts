import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { sendProofSchema, formatZodErrors } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import crypto from 'crypto';

// Magic link expiration: 30 days
const MAGIC_LINK_EXPIRATION_DAYS = 30;

export async function POST(request: NextRequest) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  // Rate limit
  const rateLimitResponse = rateLimit(request, 'proofs-send', RATE_LIMITS.adminApi);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();

    // Validate input
    const result = sendProofSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(result.error) },
        { status: 400 }
      );
    }

    const { orderId } = result.data;

    // Get order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if there's a proof
    const { data: versions } = await supabaseAdmin
      .from('proof_versions')
      .select('id')
      .eq('order_id', orderId)
      .limit(1);

    if (!versions || versions.length === 0) {
      return NextResponse.json({ error: 'No proof uploaded yet' }, { status: 400 });
    }

    // Generate magic link token
    // Token is the raw value that goes in the URL
    // Token hash is what we store in the database (SHA-256)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + MAGIC_LINK_EXPIRATION_DAYS);

    // Create or update magic link (store the HASH, not the token)
    const { error: linkError } = await supabaseAdmin
      .from('magic_links')
      .upsert({
        order_id: orderId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'order_id'
      });

    if (linkError) {
      console.error('Error creating magic link:', linkError);
      return NextResponse.json({ error: 'Failed to create proof link' }, { status: 500 });
    }

    // Update order status
    await supabaseAdmin
      .from('orders')
      .update({ status: 'proof_sent' })
      .eq('id', orderId);

    // Get settings
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    const baseUrl = process.env.APP_PUBLIC_BASE_URL || 'http://localhost:3000';
    // URL uses the raw token (not the hash)
    const proofLink = `${baseUrl}/p/${token}`;

    // Send email (if Resend is configured)
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: `${settings?.email_from_name || 'Proofs'} <${settings?.email_from_email || 'proofs@example.com'}>`,
          to: order.customer_email,
          subject: `Your proof is ready - Order #${order.order_number}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Your proof is ready for review!</h2>
              <p>Hi ${order.customer_name || 'there'},</p>
              <p>Your proof for order #${order.order_number} is ready for your review.</p>
              <p style="margin: 24px 0;">
                <a href="${proofLink}" style="background: #1d3161; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                  Review Your Proof
                </a>
              </p>
              <p>If the button doesn't work, copy and paste this link:<br>
              <a href="${proofLink}">${proofLink}</a></p>
              <p style="color: #666; font-size: 12px; margin-top: 24px;">
                This link will expire in ${MAGIC_LINK_EXPIRATION_DAYS} days.
              </p>
              <p>Thank you,<br>${settings?.company_name || 'The Team'}</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
        // Don't fail the request if email fails - link is still valid
      }
    }

    // Log audit event (don't log the raw token)
    await supabaseAdmin
      .from('audit_events')
      .insert({
        order_id: orderId,
        actor_type: 'staff',
        event_type: 'proof_sent',
        metadata: { expires_at: expiresAt.toISOString() },
      });

    return NextResponse.json({
      success: true,
      proofLink,
    });
  } catch (error) {
    console.error('Send proof error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
