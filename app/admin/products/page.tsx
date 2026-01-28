export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import ProductsClient from './ProductsClient';

async function getProducts() {
  const { data } = await supabaseAdmin
    .from('products')
    .select('*')
    .order('name');
  return data || [];
}

export default async function ProductsPage() {
  const products = await getProducts();
  return <ProductsClient products={products} />;
}
