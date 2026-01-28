export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';
import DashboardTable from './DashboardTable';
import SyncButton from './SyncButton';

async function getDashboardData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, customer_name, customer_email, status, created_at, order_total, product_name, sku')
    .order('created_at', { ascending: false })
    .limit(500);

  const all = orders || [];
  const recent = all.filter(o => new Date(o.created_at) >= thirtyDaysAgo);
  const thisWeek = all.filter(o => new Date(o.created_at) >= sevenDaysAgo);

  // Status counts
  const byStatus: Record<string, number> = {};
  all.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });

  // Approval rate
  const reviewed = all.filter(o => ['approved', 'approved_with_notes', 'changes_requested'].includes(o.status));
  const approved = all.filter(o => ['approved', 'approved_with_notes'].includes(o.status));
  const approvalRate = reviewed.length > 0 ? Math.round((approved.length / reviewed.length) * 100) : 0;

  // Revenue (last 30 days)
  const revenue = recent.reduce((sum, o) => sum + (o.order_total || 0), 0);

  // Needs attention: proof_sent > 3 days
  const needsAttention = all.filter(o => 
    o.status === 'proof_sent' && new Date(o.created_at) < threeDaysAgo
  ).slice(0, 5);

  // Recent orders
  const recentOrders = all.slice(0, 8);

  // Get last sync time
  const { data: settings } = await supabaseAdmin
    .from('app_settings')
    .select('last_shipstation_sync')
    .eq('id', 'default')
    .single();

  return {
    stats: {
      total: all.length,
      thisMonth: recent.length,
      thisWeek: thisWeek.length,
      revenue,
      approvalRate,
      pending: byStatus['proof_sent'] || 0,
      approved: (byStatus['approved'] || 0) + (byStatus['approved_with_notes'] || 0),
      changesRequested: byStatus['changes_requested'] || 0,
      open: byStatus['open'] || 0,
    },
    needsAttention,
    recentOrders,
    byStatus,
    lastSync: settings?.last_shipstation_sync,
  };
}

const statusConfig: Record<string, { label: string; class: string; dot: string }> = {
  draft: { label: 'Draft', class: 'badge-gray', dot: 'bg-gray-400' },
  open: { label: 'Open', class: 'badge-blue', dot: 'bg-blue-500' },
  proof_sent: { label: 'Proof Sent', class: 'badge-yellow', dot: 'bg-amber-500' },
  approved: { label: 'Approved', class: 'badge-green', dot: 'bg-emerald-500' },
  approved_with_notes: { label: 'Approved', class: 'badge-green', dot: 'bg-emerald-500' },
  changes_requested: { label: 'Changes', class: 'badge-red', dot: 'bg-red-500' },
};

function formatLastSync(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default async function DashboardPage() {
  const { stats, needsAttention, recentOrders, byStatus, lastSync } = await getDashboardData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Overview of your proof approval workflow</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            Last sync: {formatLastSync(lastSync)}
          </div>
          <SyncButton />
          <Link href="/admin/orders/new" className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Order
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link href="/admin/orders" className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Orders</div>
        </Link>
        <Link href="/admin/orders" className="stat-card">
          <div className="stat-value">{stats.thisWeek}</div>
          <div className="stat-label">This Week</div>
        </Link>
        <Link href="/admin/orders?status=proof_sent" className="stat-card">
          <div className="stat-value text-amber-600">{stats.pending}</div>
          <div className="stat-label">Awaiting Response</div>
        </Link>
        <Link href="/admin/orders?status=approved" className="stat-card">
          <div className="stat-value text-emerald-600">{stats.approved}</div>
          <div className="stat-label">Approved</div>
        </Link>
        <div className="stat-card">
          <div className="stat-value text-emerald-600">{stats.approvalRate}%</div>
          <div className="stat-label">Approval Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${stats.revenue.toLocaleString()}</div>
          <div className="stat-label">Revenue (30d)</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders - Takes 2 columns */}
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <h2 className="card-title">Recent Orders</h2>
            <Link href="/admin/orders" className="text-xs font-medium text-blue-600 hover:text-blue-700">
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <DashboardTable orders={recentOrders} />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Needs Attention */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                Needs Attention
              </h2>
              <span className="badge-yellow">{needsAttention.length}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {needsAttention.length > 0 ? (
                needsAttention.map(order => {
                  const daysAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <Link
                      key={order.id}
                      href={`/admin/orders/${order.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 text-sm">#{order.order_number}</div>
                        <div className="text-xs text-gray-500 truncate">{order.customer_name || order.customer_email}</div>
                      </div>
                      <span className="text-xs text-red-600 font-medium whitespace-nowrap ml-2">{daysAgo}d waiting</span>
                    </Link>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-center">
                  <div className="text-2xl mb-2">✓</div>
                  <div className="text-sm text-gray-500">All caught up!</div>
                </div>
              )}
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">By Status</h2>
            </div>
            <div className="p-2">
              {Object.entries(byStatus).map(([status, count]) => {
                const config = statusConfig[status] || statusConfig.draft;
                return (
                  <Link
                    key={status}
                    href={`/admin/orders?status=${status}`}
                    className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
                      <span className="text-sm text-gray-700">{config.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 tabular-nums">{count}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-4 space-y-2">
            <Link href="/admin/orders/new" className="btn-secondary w-full justify-start">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Order
            </Link>
            <Link href="/admin/bulk" className="btn-secondary w-full justify-start">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" />
              </svg>
              Bulk Actions
            </Link>
            <Link href="/admin/reports" className="btn-secondary w-full justify-start">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              View Reports
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
