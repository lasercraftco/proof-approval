export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';

async function getReportData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, status, created_at, order_total, customer_decision_at')
    .gte('created_at', thirtyDaysAgo.toISOString());

  const all = orders || [];
  const revenue = all.reduce((sum, o) => sum + (o.order_total || 0), 0);
  const approved = all.filter(o => ['approved', 'approved_with_notes'].includes(o.status));
  const reviewed = all.filter(o => ['approved', 'approved_with_notes', 'changes_requested'].includes(o.status));
  const approvalRate = reviewed.length > 0 ? Math.round((approved.length / reviewed.length) * 100) : 0;

  const withDecision = all.filter(o => o.customer_decision_at);
  let avgDays = 0;
  if (withDecision.length > 0) {
    const totalMs = withDecision.reduce((sum, o) => {
      return sum + (new Date(o.customer_decision_at).getTime() - new Date(o.created_at).getTime());
    }, 0);
    avgDays = Math.round((totalMs / withDecision.length) / (1000 * 60 * 60 * 24) * 10) / 10;
  }

  return {
    totalOrders: all.length,
    revenue,
    approved: approved.length,
    changesRequested: all.filter(o => o.status === 'changes_requested').length,
    approvalRate,
    avgDaysToDecision: avgDays,
  };
}

export default async function ReportsPage() {
  const data = await getReportData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500">Last 30 days performance</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="stat-card">
          <div className="stat-value">{data.totalOrders}</div>
          <div className="stat-label">Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${data.revenue.toLocaleString()}</div>
          <div className="stat-label">Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-emerald-600">{data.approvalRate}%</div>
          <div className="stat-label">Approval Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-emerald-600">{data.approved}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-amber-600">{data.changesRequested}</div>
          <div className="stat-label">Changes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.avgDaysToDecision}</div>
          <div className="stat-label">Avg Days</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Order Volume</h3>
          </div>
          <div className="p-8 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <div className="text-sm">Chart coming soon</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Approval Trends</h3>
          </div>
          <div className="p-8 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <div className="text-sm">Chart coming soon</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
