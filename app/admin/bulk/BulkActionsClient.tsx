'use client';

import { useState } from 'react';

type Order = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string;
  status: string;
  created_at: string;
};

type Props = {
  orders: Order[];
};

export default function BulkActionsClient({ orders }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const toggleAll = () => {
    if (selected.size === orders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map(o => o.id)));
    }
  };

  const toggleOrder = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const handleAction = async () => {
    if (!action || selected.size === 0) return;

    setProcessing(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/bulk-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          orderIds: Array.from(selected),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(`Successfully processed ${data.processed} orders`);
        setSelected(new Set());
        setAction('');
      } else {
        const err = await response.json();
        setMessage(err.error || 'Failed to process');
      }
    } catch (error) {
      setMessage('Error processing bulk action');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center gap-4 p-4 bg-white rounded-xl border">
        <span className="text-sm text-gray-600">
          {selected.size} selected
        </span>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="px-4 py-2 border-2 rounded-lg focus:outline-none"
          disabled={selected.size === 0}
        >
          <option value="">Select Action...</option>
          <option value="send_reminders">Send Reminders</option>
          <option value="mark_open">Mark as Open</option>
          <option value="mark_approved">Mark as Approved</option>
        </select>
        <button
          onClick={handleAction}
          disabled={!action || selected.size === 0 || processing}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {processing ? 'Processing...' : 'Apply'}
        </button>
        {message && (
          <span className={message.includes('Successfully') ? 'text-green-600' : 'text-red-600'}>
            {message}
          </span>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-gray-500 border-b">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === orders.length && orders.length > 0}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 font-medium">Order #</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map(order => (
              <tr key={order.id} className={selected.has(order.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(order.id)}
                    onChange={() => toggleOrder(order.id)}
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-3 font-medium">#{order.order_number}</td>
                <td className="px-4 py-3">
                  <div>{order.customer_name || '—'}</div>
                  <div className="text-sm text-gray-500">{order.customer_email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-gray-100 rounded-full text-sm">{order.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(order.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
