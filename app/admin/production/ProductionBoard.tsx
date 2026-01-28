'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Order = {
  id: string;
  order_number: string;
  customer_name: string | null;
  product_name?: string | null;
  sku: string | null;
  quantity: number | null;
  production_status?: string | null;
  created_at: string;
};

const columns = [
  { id: 'ready', title: 'Ready', color: 'bg-blue-500' },
  { id: 'in_production', title: 'In Production', color: 'bg-amber-500' },
  { id: 'quality_check', title: 'QC', color: 'bg-purple-500' },
  { id: 'ready_to_ship', title: 'Ship', color: 'bg-emerald-500' },
];

export default function ProductionBoard({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const byStatus = (status: string) => orders.filter(o => (o.production_status || 'ready') === status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Production</h1>
          <p className="text-sm text-gray-500">{orders.length} orders in queue</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${view === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Board
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${view === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {view === 'kanban' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map(col => {
            const items = byStatus(col.id);
            return (
              <div key={col.id} className="bg-gray-100 rounded-lg p-3 min-h-[300px]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.color}`} />
                    <span className="text-sm font-semibold text-gray-700">{col.title}</span>
                  </div>
                  <span className="text-xs text-gray-500 bg-white px-1.5 py-0.5 rounded">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map(order => (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="block bg-white rounded-lg border border-gray-200 p-3 hover:border-gray-300 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-gray-900 text-sm">#{order.order_number}</span>
                        {order.quantity && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 flex-shrink-0">
                            ×{order.quantity}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 truncate">{order.customer_name || '—'}</div>
                      <div className="text-xs text-gray-700 mt-0.5 truncate">{order.product_name || order.sku || '—'}</div>
                    </Link>
                  ))}
                  {items.length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-400">Empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Order</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Qty</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(order => (
                <tr 
                  key={order.id} 
                  className="hover:bg-gray-50 cursor-pointer transition-colors" 
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">#{order.order_number}</td>
                  <td className="px-4 py-3 text-gray-700">{order.customer_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{order.product_name || order.sku || '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{order.quantity || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      {order.production_status || 'ready'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="text-4xl mb-3 grayscale opacity-40">🏭</div>
              <div className="text-sm font-medium text-gray-900">No orders in production</div>
              <div className="text-xs text-gray-500 mt-1">Approved orders will appear here</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
