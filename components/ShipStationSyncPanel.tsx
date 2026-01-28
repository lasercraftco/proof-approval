'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type SyncStats = {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  syncRange?: string;
  syncedAt?: string;
};

type SyncStatus = {
  configured: boolean;
  missingEnvVars: string[];
  lastSuccessfulSync: string | null;
  lastSyncAttempt: string | null;
  lastSyncError: string | null;
  lastSyncStats: SyncStats | null;
  totalShipStationOrders: number;
};

type SyncResult = {
  success: boolean;
  message?: string;
  error?: string;
  configured: boolean;
  stats?: SyncStats & { errors?: string[] };
};

type SyncRange = 'incremental' | '24h' | '7d' | '30d';

const SYNC_RANGE_OPTIONS: { value: SyncRange; label: string; description: string }[] = [
  { value: 'incremental', label: 'Incremental', description: 'Since last sync' },
  { value: '24h', label: 'Last 24h', description: 'Past 24 hours' },
  { value: '7d', label: 'Last 7 days', description: 'Past week' },
  { value: '30d', label: 'Last 30 days', description: 'Past month' },
];

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
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString();
}

export default function ShipStationSyncPanel() {
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [selectedRange, setSelectedRange] = useState<SyncRange>('incremental');
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/shipstation/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch ShipStation status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSync = async (range: SyncRange = selectedRange) => {
    setSyncing(true);
    setSyncResult(null);
    setShowDetails(false);
    setShowRangeDropdown(false);

    try {
      const res = await fetch('/api/shipstation/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range }),
      });

      const data = await res.json();
      setSyncResult(data);

      if (data.success) {
        // Refresh status and table
        await fetchStatus();
        router.refresh();
        
        // Auto-hide success after 8 seconds
        setTimeout(() => {
          setSyncResult(null);
        }, 8000);
      } else {
        setShowDetails(true);
      }
    } catch (error) {
      setSyncResult({
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        configured: status?.configured ?? false,
      });
      setShowDetails(true);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  // Not configured state
  if (!status?.configured) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span className="text-xs font-medium">ShipStation not configured</span>
        </div>
        <button
          disabled
          className="btn-secondary opacity-50 cursor-not-allowed flex items-center gap-2"
          title="Set SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET in environment variables"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Sync Orders
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-3">
      {/* Sync Status Indicator */}
      <div className="flex items-center gap-3 text-sm">
        {/* Connection Status */}
        <div className="flex items-center gap-1.5" title={`${status.totalShipStationOrders} orders from ShipStation`}>
          <span className="w-2 h-2 bg-emerald-500 rounded-full" />
          <span className="text-gray-600">Connected</span>
        </div>
        
        {/* Last Sync */}
        {status.lastSuccessfulSync && (
          <div className="flex items-center gap-1.5 text-gray-500" title={formatDateTime(status.lastSuccessfulSync)}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Synced {formatRelativeTime(status.lastSuccessfulSync)}</span>
          </div>
        )}

        {/* Error indicator */}
        {status.lastSyncError && !syncResult && (
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-red-600 hover:text-red-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span className="text-xs">Error</span>
          </button>
        )}
      </div>

      {/* Sync Button with Range Dropdown */}
      <div className="relative">
        <div className="flex items-center">
          <button
            onClick={() => handleSync()}
            disabled={syncing}
            className="btn-secondary flex items-center gap-2 rounded-r-none border-r-0"
            title="Sync orders from ShipStation"
          >
            <svg 
              className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              strokeWidth={1.5}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" 
              />
            </svg>
            {syncing ? 'Syncing...' : 'Sync Orders'}
          </button>
          <button
            onClick={() => setShowRangeDropdown(!showRangeDropdown)}
            disabled={syncing}
            className="btn-secondary px-2 rounded-l-none"
            title="Select sync range"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Range Dropdown */}
        {showRangeDropdown && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowRangeDropdown(false)} />
            <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
              {SYNC_RANGE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSelectedRange(option.value);
                    handleSync(option.value);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                    selectedRange === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-gray-500">{option.description}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Result Toast */}
      {syncResult && (
        <div 
          className={`absolute top-full right-0 mt-2 p-3 rounded-lg shadow-lg text-sm z-50 min-w-[280px] max-w-[360px] ${
            syncResult.success 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                {syncResult.success ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Sync Complete
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    Sync Failed
                  </>
                )}
              </div>
              
              {syncResult.stats && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fetched:</span>
                    <span className="font-medium">{syncResult.stats.fetched}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created:</span>
                    <span className="font-medium text-emerald-600">+{syncResult.stats.created}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Updated:</span>
                    <span className="font-medium text-blue-600">{syncResult.stats.updated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Skipped:</span>
                    <span className="font-medium text-gray-500">{syncResult.stats.skipped}</span>
                  </div>
                </div>
              )}
              
              {syncResult.error && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-xs underline hover:no-underline"
                  >
                    {showDetails ? 'Hide details' : 'View details'}
                  </button>
                  {showDetails && (
                    <div className="mt-2 p-2 bg-white/50 rounded text-xs font-mono break-words">
                      {syncResult.error}
                    </div>
                  )}
                </div>
              )}
              
              {syncResult.stats?.errors && syncResult.stats.errors.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-xs text-amber-700 underline hover:no-underline"
                  >
                    {syncResult.stats.errors.length} order error(s)
                  </button>
                  {showDetails && (
                    <div className="mt-2 p-2 bg-white/50 rounded text-xs space-y-1 max-h-32 overflow-y-auto">
                      {syncResult.stats.errors.map((err, i) => (
                        <div key={i} className="text-red-700">{err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setSyncResult(null)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Persistent Error Details (when no active sync result) */}
      {showDetails && !syncResult && status.lastSyncError && (
        <div className="absolute top-full right-0 mt-2 p-3 rounded-lg shadow-lg text-sm z-50 min-w-[280px] max-w-[360px] bg-red-50 border border-red-200 text-red-800">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium">Last Sync Error</div>
              <div className="mt-1 text-xs text-gray-600">
                {formatDateTime(status.lastSyncAttempt)}
              </div>
              <div className="mt-2 p-2 bg-white/50 rounded text-xs font-mono break-words">
                {status.lastSyncError}
              </div>
            </div>
            <button 
              onClick={() => setShowDetails(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
