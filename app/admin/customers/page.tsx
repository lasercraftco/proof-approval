export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';

async function getCustomers() {
  try {
    const { data } = await supabaseAdmin
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    return data || [];
  } catch {
    // Table may not exist
    return [];
  }
}

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">{customers.length} customers</p>
        </div>
        <Link href="/admin/customers/new" className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Customer
        </Link>
      </div>

      {customers.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Company</th>
                <th>Orders</th>
                <th>Lifetime Value</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="table-row-clickable">
                  <td>
                    <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                        {(c.name || c.primary_email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{c.name || '—'}</div>
                        <div className="text-xs text-gray-500">{c.primary_email}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="text-gray-700">{c.company || '—'}</td>
                  <td>
                    <span className="font-medium tabular-nums">{c.lifetime_order_count || 0}</span>
                  </td>
                  <td className="font-medium tabular-nums">
                    {c.lifetime_value ? `$${c.lifetime_value.toLocaleString()}` : '—'}
                  </td>
                  <td className="text-gray-500 text-sm tabular-nums">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <div className="empty-state-title text-base">No customers yet</div>
            <div className="empty-state-description mt-1 max-w-xs mx-auto">
              Customers are automatically created when orders come in, or you can add them manually.
            </div>
            <div className="mt-6">
              <Link href="/admin/customers/new" className="btn-primary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Customer
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
