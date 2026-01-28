import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { updateSettingsSchema, formatZodErrors } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function PUT(request: NextRequest) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  // Rate limit
  const rateLimitResponse = rateLimit(request, 'settings-update', RATE_LIMITS.adminApi);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();

    // Validate and whitelist fields
    const result = updateSettingsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(result.error) },
        { status: 400 }
      );
    }

    // Only use validated data (rejects unknown fields due to .strict())
    const validatedData = result.data;

    const { error } = await supabaseAdmin
      .from('app_settings')
      .update({
        ...validatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'default');

    if (error) {
      console.error('Settings update error:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error) {
      console.error('Settings fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    return NextResponse.json({ settings: data });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
