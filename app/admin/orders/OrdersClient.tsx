'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

// ============================================================================
// TYPES
// ============================================================================

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
  order_total?: number | null;
  platform?: string | null;
};

type SyncRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'success' | 'failed';
  syncType: string;
  triggeredBy: string;
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  errorSummary: string | null;
};

type ShipStationStatus = {
  configured: boolean;
  missingEnvVars: string[];
  lastSuccessfulSync: string | null;
  lastSyncAttempt: string | null;
  lastSyncError: string | null;
  totalOrders: number;
  recentRuns: SyncRun[];
};

type SyncResult = {
  success: boolean;
  configured: boolean;
  requestId?: string;
  runId?: string;
  stats?: {
    fetched: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  message?: string;
  error?: string;
  missingEnvVars?: string[];
  timestamp?: string;
  httpStatus?: number;
};

type TestResult = {
  success: boolean;
  requestId?: string;
  message: string;
  error?: string;
  stores?: Array<{ id: number; name: string; marketplace: string }>;
  rateLimitRemaining?: number | null;
  httpStatus?: number;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatRelativeTime(dateStr: string | null): string {
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
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

// Generate debug info for support (no secrets)
function generateDebugInfo(result: SyncResult | TestResult | null, action: string): string {
  if (!result) return '';
  return JSON.stringify({
    action,
    timestamp: new Date().toISOString(),
    requestId: result.requestId || 'N/A',
    success: result.success,
    error: result.error || null,
    message: result.message || null,
    httpStatus: result.httpStatus || null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
  }, null, 2);
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

const statusConfig: Record<string, { label: string; class: string }> = {
  draft: { label: 'Draft', class: 'badge-gray' },
  open: { label: 'Open', class: 'badge-blue' },
  proof_sent: { label: 'Proof Sent', class: 'badge-yellow' },
  approved: { label: 'Approved', class: 'badge-green' },
  approved_with_notes: { label: 'Approved', class: 'badge-green' },
  changes_requested: { label: 'Changes', class: 'badge-red' },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function OrdersClient({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || '';

  // Table state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [platformFilter, setPlatformFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ShipStation state
  const [ssStatus, setSSStatus] = useState<ShipStationStatus | null>(null);
  const [ssLoading, setSSLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showSyncLog, setShowSyncLog] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [copiedDebug, setCopiedDebug] = useState(false);

  // Fetch ShipStation status on mount
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/shipstation/status');
      if (res.ok) {
        const data = await res.json();
        setSSStatus(data);
      } else {
        console.error('Failed to fetch ShipStation status:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Failed to fetch ShipStation status:', err);
    } finally {
      setSSLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Sync handler with improved error handling
  const handleSync = async (syncType: string = 'incremental') => {
    setSyncing(true);
    setSyncResult(null);
    setShowErrorDetails(false);
    setCopiedDebug(false);

    try {
      const res = await fetch('/api/shipstation/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType }),
      });
      
      const data: SyncResult = await res.json();
      
      // Attach HTTP status for debug purposes
      if (!res.ok && !data.httpStatus) {
        data.httpStatus = res.status;
      }
      
      setSyncResult(data);

      if (data.success) {
        await fetchStatus();
        router.refresh();
        // Keep success message visible longer
        setTimeout(() => setSyncResult(null), 15000);
      }
    } catch (err) {
      const errorResult: SyncResult = {
        success: false,
        configured: ssStatus?.configured ?? false,
        error: err instanceof Error ? err.message : 'Network error - check your connection',
        timestamp: new Date().toISOString(),
      };
      setSyncResult(errorResult);
    } finally {
      setSyncing(false);
    }
  };

  // Test connection handler with improved feedback
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    setCopiedDebug(false);

    try {
      const res = await fetch('/api/shipstation/test', { method: 'POST' });
      const data: TestResult = await res.json();
      
      if (!res.ok && !data.httpStatus) {
        data.httpStatus = res.status;
      }
      
      setTestResult(data);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed - network error',
        error: 'network_error',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Copy debug info to clipboard
  const handleCopyDebugInfo = async (result: SyncResult | TestResult | null, action: string) => {
    const debugInfo = generateDebugInfo(result, action);
    try {
      await navigator.clipboard.writeText(debugInfo);
      setCopiedDebug(true);
      setTimeout(() => setCopiedDebug(false), 3000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = debugInfo;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedDebug(true);
      setTimeout(() => setCopiedDebug(false), 3000);
    }
  };

  // Get actionable error message
  const getActionableError = (result: SyncResult | TestResult): { message: string; action: string } => {
    const error = result.error || '';
    const httpStatus = result.httpStatus;
    
    if (httpStatus === 401 || error.includes('credentials') || error.includes('Invalid')) {
      return {
        message: 'Invalid API credentials',
        action: 'Go to ShipStation → Settings → Account → API Settings and verify your API Key and Secret are correct.',
      };
    }
    if (httpStatus === 429 || error.includes('rate limit')) {
      return {
        message: 'Rate limit exceeded',
        action: 'ShipStation allows 40 requests per minute. Wait a few minutes and try again.',
      };
    }
    if (error.includes('not configured') || error.includes('missing')) {
      return {
        message: 'ShipStation not configured',
        action: 'Set SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET in your Vercel environment variables.',
      };
    }
    if (error.includes('network') || error.includes('fetch') || error.includes('ECONNREFUSED')) {
      return {
        message: 'Network connection error',
        action: 'Check your internet connection and try again. If the problem persists, ShipStation may be experiencing issues.',
      };
    }
    if (error.includes('Database') || error.includes('supabase')) {
      return {
        message: 'Database error',
        action: 'There was a problem saving sync results. Check your Supabase connection and try again.',
      };
    }
    
    return {
      message: result.message || error || 'Unknown error',
      action: 'Try again. If the problem persists, copy the debug info below and contact support.',
    };
  };

  // Filtered orders
  const filtered = useMemo(() => {
    return orders.filter(o => {
      const matchesSearch = !search || 
        o.order_number.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_email.toLowerCase().includes(search.toLowerCase()) ||
        o.product_name?.toLowerCase().includes(search.toLowerCase()) ||
        o.sku?.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !statusFilter || o.status === statusFilter;
      const matchesPlatform = !platformFilter || 
        (platformFilter === 'manual' ? !o.platform : o.platform === platformFilter);
      return matchesSearch && matchesStatus && matchesPlatform;
    });
  }, [orders, search, statusFilter, platformFilter]);

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(o => o.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return counts;
  }, [orders]);

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = { manual: 0, shipstation: 0 };
    orders.forEach(o => { 
      const p = o.platform || 'manual';
      counts[p] = (counts[p] || 0) + 1;
    });
    return counts;
  }, [orders]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* ================================================================== */}
      {/* SHIPSTATION SYNC PANEL - PROMINENTLY DISPLAYED AT TOP             */}
      {/* ================================================================== */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Status Info */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">ShipStation:</span>
              {ssLoading ? (
                <span className="text-sm text-gray-500">Loading...</span>
              ) : ssStatus?.configured ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                  <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                  Not Configured
                </span>
              )}
            </div>

            {ssStatus?.configured && (
              <>
                <div className="text-sm text-gray-600">
                  <span className="text-gray-500">Last sync:</span>{' '}
                  <span className="font-medium">{formatRelativeTime(ssStatus.lastSuccessfulSync)}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="text-gray-500">Orders:</span>{' '}
                  <span className="font-medium">{ssStatus.totalOrders}</span>
                </div>
              </>
            )}

            {!ssLoading && !ssStatus?.configured && ssStatus?.missingEnvVars && (
              <div className="text-xs text-amber-600">
                Missing: {ssStatus.missingEnvVars.join(', ')}
              </div>
            )}
          </div>

          {/* Right: Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Test Connection Button */}
            <button
              onClick={handleTestConnection}
              disabled={testingConnection || !ssStatus?.configured}
              className="btn-secondary btn-sm"
              title={!ssStatus?.configured ? 'Configure ShipStation first' : 'Test API connection'}
            >
              {testingConnection ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Testing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Test Connection
                </>
              )}
            </button>

            {/* Sync Log Button */}
            <button
              onClick={() => setShowSyncLog(!showSyncLog)}
              className={`btn-secondary btn-sm ${showSyncLog ? 'bg-gray-100' : ''}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sync Log
            </button>

            {/* MAIN SYNC BUTTON - PROMINENT */}
            <button
              onClick={() => handleSync('incremental')}
              disabled={syncing || !ssStatus?.configured}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                ssStatus?.configured
                  ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              title={!ssStatus?.configured ? 'Configure ShipStation first' : 'Sync orders from ShipStation'}
            >
              <svg 
                className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              {syncing ? 'Syncing...' : 'Sync Orders'}
            </button>
          </div>
        </div>

        {/* Test Connection Result */}
        {testResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2 flex-1">
                {testResult.success ? (
                  <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                )}
                <div className="flex-1">
                  <span className={testResult.success ? 'text-emerald-800 font-medium' : 'text-red-800 font-medium'}>
                    {testResult.success ? testResult.message : getActionableError(testResult).message}
                  </span>
                  {!testResult.success && (
                    <p className="text-red-700 text-xs mt-1">{getActionableError(testResult).action}</p>
                  )}
                  {testResult.stores && testResult.stores.length > 0 && (
                    <div className="mt-2 text-xs text-emerald-700">
                      Connected stores: {testResult.stores.map(s => `${s.name} (${s.marketplace})`).join(', ')}
                    </div>
                  )}
                  {testResult.rateLimitRemaining !== null && testResult.rateLimitRemaining !== undefined && (
                    <div className="mt-1 text-xs text-gray-500">
                      API requests remaining: {testResult.rateLimitRemaining}
                    </div>
                  )}
                  {!testResult.success && (
                    <button 
                      onClick={() => handleCopyDebugInfo(testResult, 'test_connection')}
                      className="mt-2 text-xs text-red-600 underline hover:no-underline"
                    >
                      {copiedDebug ? '✓ Copied!' : 'Copy debug info'}
                    </button>
                  )}
                </div>
              </div>
              <button onClick={() => setTestResult(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Sync Result Toast */}
        {syncResult && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${syncResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {syncResult.success ? (
                    <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  )}
                  <span className={`font-medium ${syncResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                    {syncResult.success ? 'Sync Complete!' : getActionableError(syncResult).message}
                  </span>
                </div>
                {syncResult.stats && (
                  <div className="mt-2 flex flex-wrap gap-4 text-xs">
                    <span className="text-gray-600">Fetched: <strong>{syncResult.stats.fetched}</strong></span>
                    <span className="text-emerald-600">New: <strong>+{syncResult.stats.inserted}</strong></span>
                    <span className="text-blue-600">Updated: <strong>{syncResult.stats.updated}</strong></span>
                    <span className="text-gray-500">Skipped: <strong>{syncResult.stats.skipped}</strong></span>
                    {syncResult.stats.errors > 0 && (
                      <span className="text-red-600">Errors: <strong>{syncResult.stats.errors}</strong></span>
                    )}
                  </div>
                )}
                {!syncResult.success && (
                  <div className="mt-2">
                    <p className="text-red-700 text-xs">{getActionableError(syncResult).action}</p>
                    <button 
                      onClick={() => setShowErrorDetails(!showErrorDetails)}
                      className="mt-2 text-xs text-red-600 underline hover:no-underline"
                    >
                      {showErrorDetails ? 'Hide details' : 'Show error details'}
                    </button>
                    {showErrorDetails && (
                      <div className="mt-2 p-2 bg-white rounded border border-red-200 text-xs font-mono text-red-700 break-words">
                        {syncResult.error}
                        {syncResult.requestId && (
                          <div className="mt-1 text-gray-500">Request ID: {syncResult.requestId}</div>
                        )}
                      </div>
                    )}
                    <button 
                      onClick={() => handleCopyDebugInfo(syncResult, 'sync_orders')}
                      className="mt-2 ml-2 text-xs text-red-600 underline hover:no-underline"
                    >
                      {copiedDebug ? '✓ Copied!' : 'Copy debug info'}
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setSyncResult(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Last Error Display (when no active result) */}
        {!syncResult && ssStatus?.lastSyncError && (
          <div className="mt-3 p-3 rounded-lg text-sm bg-red-50 border border-red-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-red-800">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span className="font-medium">Last sync failed</span>
                  <span className="text-xs text-red-600">({formatRelativeTime(ssStatus.lastSyncAttempt)})</span>
                </div>
                <button 
                  onClick={() => setShowErrorDetails(!showErrorDetails)}
                  className="mt-1 text-xs text-red-600 underline hover:no-underline"
                >
                  {showErrorDetails ? 'Hide details' : 'View details'}
                </button>
                {showErrorDetails && (
                  <div className="mt-2 p-2 bg-white rounded border border-red-200 text-xs font-mono text-red-700 break-words">
                    {ssStatus.lastSyncError}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Sync Log Panel */}
        {showSyncLog && ssStatus?.recentRuns && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Sync Runs (Last 10)</h4>
            {ssStatus.recentRuns.length === 0 ? (
              <p className="text-sm text-gray-500">No sync runs yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="pb-2 pr-4">Time</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4 text-right">Fetched</th>
                      <th className="pb-2 pr-4 text-right">New</th>
                      <th className="pb-2 pr-4 text-right">Updated</th>
                      <th className="pb-2 pr-4 text-right">Skipped</th>
                      <th className="pb-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ssStatus.recentRuns.map((run) => (
                      <tr key={run.id} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">
                          {formatDateTime(run.startedAt)}
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                            run.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                            run.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {run.status === 'running' && (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                              </svg>
                            )}
                            {run.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-gray-600">{run.syncType}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{run.fetched}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">+{run.inserted}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-blue-600">{run.updated}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-gray-500">{run.skipped}</td>
                        <td className="py-2 text-red-600 max-w-[200px] truncate" title={run.errorSummary || ''}>
                          {run.errorSummary || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* HEADER WITH NEW ORDER BUTTON                                       */}
      {/* ================================================================== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[var(--foreground)]">Orders</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{filtered.length} of {orders.length} orders</p>
        </div>
        <Link href="/admin/orders/new" className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Order
        </Link>
      </div>

      {/* ================================================================== */}
      {/* FILTERS BAR                                                        */}
      {/* ================================================================== */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search orders..."
            className="input pl-9"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="select w-40"
        >
          <option value="">All Status</option>
          <option value="open">Open ({statusCounts.open || 0})</option>
          <option value="proof_sent">Proof Sent ({statusCounts.proof_sent || 0})</option>
          <option value="approved">Approved ({(statusCounts.approved || 0) + (statusCounts.approved_with_notes || 0)})</option>
          <option value="changes_requested">Changes ({statusCounts.changes_requested || 0})</option>
        </select>

        {/* Platform Filter */}
        <select
          value={platformFilter}
          onChange={e => setPlatformFilter(e.target.value)}
          className="select w-40"
        >
          <option value="">All Sources</option>
          <option value="shipstation">ShipStation ({platformCounts.shipstation || 0})</option>
          <option value="manual">Manual ({platformCounts.manual || 0})</option>
        </select>

        {/* Selection Actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-[var(--muted-foreground)]">{selected.size} selected</span>
            <button className="btn-secondary btn-sm">Send Reminders</button>
            <button className="btn-secondary btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'All', value: '' },
          { label: 'Open', value: 'open' },
          { label: 'Proof Sent', value: 'proof_sent' },
          { label: 'Approved', value: 'approved' },
          { label: 'Changes Requested', value: 'changes_requested' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              statusFilter === f.value 
                ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]' 
                : 'bg-[var(--card)] text-[var(--muted-foreground)] border-[var(--border)] hover:border-gray-400 dark:hover:border-slate-500'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ================================================================== */}
      {/* ORDERS TABLE                                                       */}
      {/* ================================================================== */}
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
              <th>Product</th>
              <th>Status</th>
              <th className="text-right">Total</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(order => {
              const config = statusConfig[order.status] || statusConfig.draft;
              const isSelected = selected.has(order.id);
              return (
                <tr 
                  key={order.id} 
                  className={`table-row-clickable ${isSelected ? 'table-row-selected' : ''}`}
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                >
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(order.id)}
                      className="rounded border-[var(--border)] bg-[var(--input)]"
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--foreground)]">#{order.order_number}</span>
                      {order.platform && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)] rounded uppercase">
                          {order.platform}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="max-w-[180px]">
                      <div className="text-[var(--foreground)] truncate">{order.customer_name || '—'}</div>
                      <div className="text-xs text-[var(--muted-foreground)] truncate">{order.customer_email}</div>
                    </div>
                  </td>
                  <td>
                    <div className="max-w-[180px]">
                      <div className="text-[var(--card-foreground)] truncate">{order.product_name || order.sku || '—'}</div>
                      {order.quantity && <div className="text-xs text-[var(--muted-foreground)]">Qty: {order.quantity}</div>}
                    </div>
                  </td>
                  <td>
                    <span className={config.class}>{config.label}</span>
                  </td>
                  <td className="text-right font-medium tabular-nums text-[var(--foreground)]">
                    {order.order_total ? `$${order.order_total.toFixed(2)}` : '—'}
                  </td>
                  <td className="text-[var(--muted-foreground)] text-sm tabular-nums">
                    {new Date(order.created_at).toLocaleDateString()}
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
            <div className="empty-state-description">Try adjusting your search or filters</div>
          </div>
        )}
      </div>
    </div>
  );
}
