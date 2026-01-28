'use client';

import { useState, useMemo } from 'react';

type Order = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string;
  status: string;
  created_at: string;
};

const statusConfig: Record<string, { label: string; class: string }> = {
  draft: { label: 'Draft', class: 'badge-gray' },
  open: { label: 'Open', class: 'badge-blue' },
  proof_sent: { label: 'Proof Sent', class: 'badge-yellow' },
  approved: { label: 'Approved', class: 'badge-green' },
  approved_with_notes: { label: 'Approved', class: 'badge-green' },
  changes_requested: { label: 'Changes', class: 'badge-red' },
};

export default function BulkClient({ orders }: { orders: Order[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState('');
  const [action, setAction] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState('');

  const filtered = useMemo(() => {
    return orders.filter(o => !statusFilter || o.status === statusFilter);
  }, [orders, statusFilter]);

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(o => o.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleAction = async () => {
    if (!action || selected.size === 0) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/bulk-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, orderIds: Array.from(selected) }),
      });
      if (res.ok) {
        const data = await res.json();
        setToast(`Processed ${data.processed} orders`);
        setSelected(new Set());
        setAction('');
      }
    } catch {
      setToast('Error processing');
    } finally {
      setProcessing(false);
      setTimeout(() => setToast(''), 3000);
    }
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-lg font-semibold text-gray-900">Bulk Actions</h1>
        <p className="text-sm text-gray-500">Select orders and perform batch operations</p>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
        <span className="text-sm text-gray-600 font-medium">{selected.size} selected</span>
        
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="select w-36"
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="proof_sent">Proof Sent</option>
          <option value="approved">Approved</option>
          <option value="changes_requested">Changes</option>
        </select>

        <div className="flex-1" />

        <select
          value={action}
          onChange={e => setAction(e.target.value)}
          disabled={selected.size === 0}
          className="select w-44"
        >
          <option value="">Select action...</option>
          <option value="send_reminders">Send Reminders</option>
          <option value="mark_open">Mark as Open</option>
          <option value="mark_approved">Mark as Approved</option>
        </select>

        <button
          onClick={handleAction}
          disabled={!action || selected.size === 0 || processing}
          className="btn-primary"
        >
          {processing ? 'Processing...' : 'Apply'}
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th>Order</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => {
              const config = statusConfig[o.status] || statusConfig.draft;
              const isSelected = selected.has(o.id);
              return (
                <tr
                  key={o.id}
                  className={`cursor-pointer ${isSelected ? 'table-row-selected' : ''}`}
                  onClick={() => toggle(o.id)}
                >
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(o.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="font-medium text-gray-900">#{o.order_number}</td>
                  <td>
                    <div className="text-gray-900">{o.customer_name || '—'}</div>
                    <div className="text-xs text-gray-500">{o.customer_email}</div>
                  </td>
                  <td>
                    <span className={config.class}>{config.label}</span>
                  </td>
                  <td className="text-sm text-gray-500 tabular-nums">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-title">No orders found</div>
          </div>
        )}
      </div>
    </div>
  );
}
