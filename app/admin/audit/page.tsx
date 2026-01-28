export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';

async function getAuditEvents() {
  const { data } = await supabaseAdmin
    .from('audit_events')
    .select('*, orders(order_number)')
    .order('created_at', { ascending: false })
    .limit(100);
  return data || [];
}

const eventConfig: Record<string, { label: string; class: string }> = {
  approved: { label: 'Approved', class: 'badge-green' },
  approved_with_notes: { label: 'Approved', class: 'badge-green' },
  changes_requested: { label: 'Changes', class: 'badge-red' },
  proof_sent: { label: 'Proof Sent', class: 'badge-blue' },
  reminder_sent: { label: 'Reminder', class: 'badge-yellow' },
  order_created: { label: 'Created', class: 'badge-gray' },
};

export default async function AuditPage() {
  const events = await getAuditEvents();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Activity and event history</p>
      </div>

      <div className="flex gap-4 border-b border-gray-200">
        <Link href="/admin/settings" className="tab">General</Link>
        <Link href="/admin/users" className="tab">Users & Roles</Link>
        <Link href="/admin/audit" className="tab tab-active">Audit Trail</Link>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Order</th>
              <th>Actor</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map(e => {
              const config = eventConfig[e.event_type] || { label: e.event_type, class: 'badge-gray' };
              return (
                <tr key={e.id}>
                  <td className="text-sm text-gray-500 tabular-nums whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td>
                    <span className={config.class}>{config.label}</span>
                  </td>
                  <td>
                    {e.order_id && e.orders ? (
                      <Link href={`/admin/orders/${e.order_id}`} className="text-blue-600 hover:text-blue-700 font-medium">
                        #{e.orders.order_number}
                      </Link>
                    ) : '—'}
                  </td>
                  <td>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">{e.actor_type}</span>
                  </td>
                  <td className="text-sm text-gray-500 max-w-xs truncate">
                    {e.metadata?.note || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {events.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No activity yet</div>
            <div className="empty-state-description">Events will appear here as your team works</div>
          </div>
        )}
      </div>
    </div>
  );
}
