import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';
import { createProductSchema, formatZodErrors } from '@/lib/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// GET /api/products - List all products
export async function GET(request: NextRequest) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const active = searchParams.get('active') !== 'false';

    let query = supabaseAdmin
      .from('products')
      .select('*, product_pricing(*)')
      .order('sort_order')
      .order('name');

    if (active) {
      query = query.eq('is_active', true);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Products fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    return NextResponse.json({ products: data || [] });
  } catch (error) {
    console.error('Products GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/products - Create a new product
export async function POST(request: NextRequest) {
  // Require admin authentication
  const authError = requireAdmin(request);
  if (authError) return authError;

  // Rate limit
  const rateLimitResponse = rateLimit(request, 'products-create', RATE_LIMITS.adminApi);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();

    // Validate input
    const result = createProductSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(result.error) },
        { status: 400 }
      );
    }

    const { 
      sku, name, description, category, tags, base_price,
      estimated_design_time, estimated_production_time, estimated_total_time,
      default_materials, image_url
    } = result.data;

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        sku: sku || null,
        name,
        description: description || null,
        category: category || null,
        tags: tags || null,
        base_price: base_price || null,
        estimated_design_time: estimated_design_time || null,
        estimated_production_time: estimated_production_time || null,
        estimated_total_time: estimated_total_time || 
          ((estimated_design_time || 0) + (estimated_production_time || 0)) || null,
        default_materials: default_materials || [],
        image_url: image_url || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A product with this SKU already exists' }, { status: 409 });
      }
      console.error('Product creation error:', error);
      return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
    }

    return NextResponse.json({ product: data }, { status: 201 });
  } catch (error) {
    console.error('Products POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
