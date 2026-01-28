'use client';

import { useState } from 'react';
import Link from 'next/link';

type SyncRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  sync_type: string;
  triggered_by: string;
  fetched_count: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  error_summary: string | null;
  error_details: { errors?: string[] } | null;
  modified_after: string | null;
};

type Props = {
  settings: {
    last_shipstation_sync?: string;
    last_shipstation_sync_attempt?: string;
    last_shipstation_sync_error?: string;
  };
  syncRuns: SyncRun[];
  platformCounts: Record<string, number>;
  totalOrders: number;
};

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'Running...';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export default function IntegrationsClient({ settings, syncRuns, platformCounts, totalOrders }: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; stores?: Array<{ name: string; marketplace: string }> } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const isConfigured = !!(process.env.NEXT_PUBLIC_SHIPSTATION_CONFIGURED === 'true' || 
    (typeof window !== 'undefined' && document.querySelector('[data-shipstation-configured]')));

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/shipstation/test', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async (syncType: string) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/shipstation/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType }),
      });
      const data = await res.json();
      setSyncResult(data);
      if (data.success) {
        // Reload page to get updated data
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      setSyncResult({ success: false, error: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Integrations</h1>
          <p className="text-sm text-gray-500">Manage external service connections</p>
        </div>
        <Link href="/admin/orders" className="btn-secondary">
          ← Back to Orders
        </Link>
      </div>

      {/* ShipStation Card */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">ShipStation</h2>
              <p className="text-sm text-gray-500">Order sync integration</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="btn-secondary btn-sm"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Test Result */}
          {testResult && (
            <div className={`p-4 rounded-lg ${testResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                )}
                <span className={`font-medium ${testResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                  {testResult.message}
                </span>
              </div>
              {testResult.stores && (
                <div className="mt-2 text-sm text-emerald-700">
                  Connected stores: {testResult.stores.map(s => `${s.name} (${s.marketplace})`).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Sync Result */}
          {syncResult && (
            <div className={`p-4 rounded-lg ${syncResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              <span className={`font-medium ${syncResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                {syncResult.success ? syncResult.message || 'Sync complete!' : syncResult.error || 'Sync failed'}
              </span>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{platformCounts.shipstation || 0}</div>
              <div className="text-sm text-gray-500">ShipStation Orders</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{platformCounts.manual || 0}</div>
              <div className="text-sm text-gray-500">Manual Orders</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{totalOrders}</div>
              <div className="text-sm text-gray-500">Total Orders</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{syncRuns.length}</div>
              <div className="text-sm text-gray-500">Sync Runs</div>
            </div>
          </div>

          {/* Sync Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Successful Sync</div>
              <div className="mt-1 text-sm font-medium text-gray-900">{formatDateTime(settings.last_shipstation_sync)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Attempt</div>
              <div className="mt-1 text-sm font-medium text-gray-900">{formatDateTime(settings.last_shipstation_sync_attempt)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Error</div>
              <div className="mt-1 text-sm font-medium text-red-600 truncate" title={settings.last_shipstation_sync_error || ''}>
                {settings.last_shipstation_sync_error || '—'}
              </div>
            </div>
          </div>

          {/* Sync Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleSync('incremental')}
              disabled={syncing}
              className="btn-primary"
            >
              {syncing ? 'Syncing...' : 'Sync Now (Incremental)'}
            </button>
            <button
              onClick={() => handleSync('24h')}
              disabled={syncing}
              className="btn-secondary"
            >
              Last 24h
            </button>
            <button
              onClick={() => handleSync('7d')}
              disabled={syncing}
              className="btn-secondary"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => handleSync('30d')}
              disabled={syncing}
              className="btn-secondary"
            >
              Last 30 Days
            </button>
          </div>
        </div>
      </div>

      {/* Sync History */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Sync History</h3>
          <p className="text-sm text-gray-500">Last 20 sync runs</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fetched</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">New</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Updated</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {syncRuns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No sync runs recorded yet. Run a sync to see history.
                  </td>
                </tr>
              ) : (
                syncRuns.map(run => (
                  <>
                    <tr key={run.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                        {formatDateTime(run.started_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          run.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                          run.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{run.sync_type}</td>
                      <td className="px-4 py-3 text-gray-600">{run.triggered_by}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{run.fetched_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">+{run.inserted_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-blue-600">{run.updated_count}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                        {formatDuration(run.started_at, run.finished_at)}
                      </td>
                      <td className="px-4 py-3">
                        {run.error_summary ? (
                          <button
                            onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                            className="text-red-600 hover:underline text-left truncate max-w-[200px] block"
                            title={run.error_summary}
                          >
                            {run.error_summary.slice(0, 50)}...
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                    {expandedRun === run.id && run.error_details && (
                      <tr>
                        <td colSpan={9} className="px-4 py-3 bg-red-50">
                          <div className="text-xs font-mono text-red-700 space-y-1">
                            <div><strong>Error Summary:</strong> {run.error_summary}</div>
                            {run.error_details.errors && (
                              <div>
                                <strong>Details:</strong>
                                <ul className="mt-1 list-disc list-inside">
                                  {run.error_details.errors.slice(0, 5).map((e, i) => (
                                    <li key={i}>{e}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Environment Variables Help */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-amber-800">Required Environment Variables</h4>
        <p className="mt-1 text-sm text-amber-700">
          To enable ShipStation sync, set these in your Vercel dashboard (Settings → Environment Variables):
        </p>
        <ul className="mt-2 space-y-1 text-sm font-mono text-amber-800">
          <li>• <code className="bg-amber-100 px-1 rounded">SHIPSTATION_API_KEY</code></li>
          <li>• <code className="bg-amber-100 px-1 rounded">SHIPSTATION_API_SECRET</code></li>
          <li>• <code className="bg-amber-100 px-1 rounded">CRON_SECRET</code> (for automated syncs, min 16 chars)</li>
        </ul>
        <p className="mt-2 text-xs text-amber-600">
          Get your API credentials from ShipStation → Settings → Account → API Settings
        </p>
      </div>
    </div>
  );
}
