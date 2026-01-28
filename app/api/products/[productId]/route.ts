import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { createProductSchema } from '@/lib/validation';

// Validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// GET /api/products/[productId]
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (!isValidUUID(params.productId)) {
    return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*, product_pricing(*)')
      .eq('id', params.productId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product: data });
  } catch (error) {
    console.error('Product GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/products/[productId]
export async function PUT(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (!isValidUUID(params.productId)) {
    return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    
    // Partial validation - use partial schema for updates
    const partialSchema = createProductSchema.partial();
    const result = partialSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const validatedData = result.data;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const allowedFields = [
      'sku', 'name', 'description', 'category', 'tags', 'base_price',
      'estimated_design_time', 'estimated_production_time', 'estimated_total_time',
      'default_materials', 'image_url'
    ] as const;

    for (const field of allowedFields) {
      if (validatedData[field] !== undefined) {
        updates[field] = validatedData[field];
      }
    }

    // Also allow is_active and sort_order
    if (body.is_active !== undefined) updates.is_active = !!body.is_active;
    if (typeof body.sort_order === 'number') updates.sort_order = body.sort_order;

    // Auto-calculate total time if design or production time changed
    if (updates.estimated_design_time !== undefined || updates.estimated_production_time !== undefined) {
      const designTime = (updates.estimated_design_time as number) ?? 0;
      const productionTime = (updates.estimated_production_time as number) ?? 0;
      updates.estimated_total_time = (designTime + productionTime) || null;
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .update(updates)
      .eq('id', params.productId)
      .select()
      .single();

    if (error) {
      console.error('Product update error:', error);
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }

    return NextResponse.json({ product: data });
  } catch (error) {
    console.error('Product PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/products/[productId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  if (!isValidUUID(params.productId)) {
    return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
  }

  try {
    // Soft delete by setting is_active to false
    const { error } = await supabaseAdmin
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', params.productId);

    if (error) {
      console.error('Product delete error:', error);
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Product DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
