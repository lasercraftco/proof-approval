'use client';

import { useState } from 'react';
import Link from 'next/link';

type Order = {
  id: string;
  order_number: string;
  customer_name: string | null;
  product_name?: string | null;
  sku: string | null;
  quantity: number | null;
  status: string;
  production_status?: string | null;
  created_at: string;
};

type Props = {
  orders: Order[];
};

const columns = [
  { id: 'ready', title: 'Ready to Start', color: 'bg-blue-500' },
  { id: 'in_production', title: 'In Production', color: 'bg-yellow-500' },
  { id: 'quality_check', title: 'Quality Check', color: 'bg-purple-500' },
  { id: 'ready_to_ship', title: 'Ready to Ship', color: 'bg-green-500' },
];

export default function ProductionClient({ orders }: Props) {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const getOrdersByStatus = (status: string) => {
    return orders.filter(o => (o.production_status || 'ready') === status);
  };

  return (
    <div>
      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView('kanban')}
          className={`px-4 py-2 rounded-lg font-medium ${
            view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📋 Kanban
        </button>
        <button
          onClick={() => setView('list')}
          className={`px-4 py-2 rounded-lg font-medium ${
            view === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📃 List
        </button>
      </div>

      {view === 'kanban' ? (
        <div className="grid grid-cols-4 gap-4">
          {columns.map(column => (
            <div key={column.id} className="bg-gray-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-3 h-3 rounded-full ${column.color}`} />
                <h3 className="font-semibold text-gray-900">{column.title}</h3>
                <span className="ml-auto text-sm text-gray-500">
                  {getOrdersByStatus(column.id).length}
                </span>
              </div>
              <div className="space-y-3">
                {getOrdersByStatus(column.id).map(order => (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="block bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="font-medium text-gray-900">#{order.order_number}</div>
                    <div className="text-sm text-gray-500">{order.customer_name || 'No name'}</div>
                    <div className="text-sm text-gray-700 mt-1">
                      {order.product_name || order.sku || 'No product'}
                    </div>
                    {order.quantity && (
                      <div className="text-xs text-gray-500 mt-1">Qty: {order.quantity}</div>
                    )}
                  </Link>
                ))}
                {getOrdersByStatus(column.id).length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    No orders
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm text-gray-500 border-b">
                <th className="px-6 py-3 font-medium">Order #</th>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Product</th>
                <th className="px-6 py-3 font-medium">Qty</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/admin/orders/${order.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                      #{order.order_number}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{order.customer_name || '—'}</td>
                  <td className="px-6 py-4 text-gray-700">{order.product_name || order.sku || '—'}</td>
                  <td className="px-6 py-4 text-gray-700">{order.quantity || '—'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                      {order.production_status || 'ready'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
