'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Order = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string;
  sku: string | null;
  product_name?: string | null;
  quantity: number | null;
  status: string;
  created_at: string;
  platform?: string | null;
  order_total?: number | null;
};

type Props = {
  orders: Order[];
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-blue-100 text-blue-700',
  proof_sent: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  approved_with_notes: 'bg-green-100 text-green-700',
  changes_requested: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  proof_sent: 'Proof Sent',
  approved: 'Approved',
  approved_with_notes: 'Approved (Notes)',
  changes_requested: 'Changes Requested',
};

export default function OrdersTable({ orders }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchQuery || 
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.sku?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = !statusFilter || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const toggleOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search orders..."
          className="px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-gray-400 w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-gray-400"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="proof_sent">Proof Sent</option>
          <option value="approved">Approved</option>
          <option value="approved_with_notes">Approved (Notes)</option>
          <option value="changes_requested">Changes Requested</option>
        </select>
        {selectedOrders.size > 0 && (
          <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium">
            {selectedOrders.size} selected
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-sm text-gray-500 border-b">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 font-medium">Order #</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrders.map(order => (
                <tr 
                  key={order.id} 
                  className={`hover:bg-gray-50 cursor-pointer ${selectedOrders.has(order.id) ? 'bg-blue-50' : ''}`}
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleOrder(order.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-blue-600 hover:text-blue-800 font-medium">
                      #{order.order_number}
                    </span>
                    {order.platform && (
                      <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                        {order.platform}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{order.customer_name || '—'}</div>
                    <div className="text-sm text-gray-500">{order.customer_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{order.product_name || order.sku || '—'}</div>
                    {order.quantity && (
                      <div className="text-sm text-gray-500">Qty: {order.quantity}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100'}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
