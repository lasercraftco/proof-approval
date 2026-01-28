import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// GET /api/notifications - Get notifications for current user
export async function GET(request: NextRequest) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const unreadOnly = searchParams.get('unread') === 'true';

    // For now, get all notifications (in production, filter by user_id)
    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Notifications fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    // Get unread count
    const { count: unread_count } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    return NextResponse.json({ 
      notifications: notifications || [], 
      unread_count: unread_count || 0 
    });
  } catch (error) {
    console.error('Notifications GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/notifications - Create a new notification
export async function POST(request: NextRequest) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  // Rate limit
  const rateLimitResponse = rateLimit(request, 'notifications-create', RATE_LIMITS.adminApi);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { user_id, title, message, type, link_url, entity_type, entity_id } = body;

    if (!title || typeof title !== 'string' || title.length > 500) {
      return NextResponse.json({ error: 'Valid title is required (max 500 chars)' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: user_id || null,
        title,
        message: message || null,
        type: type || 'info',
        link_url: link_url || null,
        entity_type: entity_type || null,
        entity_id: entity_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Notification creation error:', error);
      return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
    }

    return NextResponse.json({ notification: data }, { status: 201 });
  } catch (error) {
    console.error('Notifications POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
