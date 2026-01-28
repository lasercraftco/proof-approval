'use client';

import { useRouter } from 'next/navigation';

type Order = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string;
  status: string;
  product_name?: string | null;
  sku: string | null;
  order_total: number | null;
};

const statusConfig: Record<string, { label: string; class: string }> = {
  draft: { label: 'Draft', class: 'badge-gray' },
  open: { label: 'Open', class: 'badge-blue' },
  proof_sent: { label: 'Proof Sent', class: 'badge-yellow' },
  approved: { label: 'Approved', class: 'badge-green' },
  approved_with_notes: { label: 'Approved', class: 'badge-green' },
  changes_requested: { label: 'Changes', class: 'badge-red' },
};

export default function DashboardTable({ orders }: { orders: Order[] }) {
  const router = useRouter();

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Product</th>
          <th>Status</th>
          <th className="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {orders.map(order => {
          const config = statusConfig[order.status] || statusConfig.draft;
          return (
            <tr 
              key={order.id} 
              className="table-row-clickable" 
              onClick={() => router.push(`/admin/orders/${order.id}`)}
            >
              <td>
                <span className="font-medium text-gray-900">#{order.order_number}</span>
              </td>
              <td>
                <div className="text-gray-900 truncate max-w-[150px]">{order.customer_name || '—'}</div>
                <div className="text-xs text-gray-500 truncate max-w-[150px]">{order.customer_email}</div>
              </td>
              <td>
                <div className="truncate max-w-[150px] text-gray-700">{order.product_name || order.sku || '—'}</div>
              </td>
              <td>
                <span className={config.class}>{config.label}</span>
              </td>
              <td className="text-right font-medium tabular-nums">
                {order.order_total ? `$${order.order_total.toFixed(2)}` : '—'}
              </td>
            </tr>
          );
        })}
        {orders.length === 0 && (
          <tr>
            <td colSpan={5} className="text-center py-8 text-gray-500">
              No orders yet
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
