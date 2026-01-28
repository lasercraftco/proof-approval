'use client';

import { useState, useEffect } from 'react';

type ConnectionTestResult = {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  stores?: Array<{ id: number; name: string; marketplace: string }>;
  rateLimit?: { remaining: number | null; resetsAt: string | null };
  missingEnvVars?: string[];
};

type SyncStatus = {
  configured: boolean;
  missingEnvVars: string[];
  lastSuccessfulSync: string | null;
  lastSyncAttempt: string | null;
  lastSyncError: string | null;
  lastSyncStats: {
    fetched: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    syncRange?: string;
    syncedAt?: string;
  } | null;
  totalShipStationOrders: number;
};

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString();
}

export default function ShipStationIntegrationCard() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
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
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/shipstation/test', {
        method: 'POST',
      });
      const data = await res.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({
        success: false,
        error: 'Network error',
        details: error instanceof Error ? error.message : 'Failed to connect',
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            ShipStation Integration
          </h3>
        </div>
        <div className="p-4 flex items-center justify-center">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
          ShipStation Integration
        </h3>
        <div className="flex items-center gap-2">
          {status?.configured ? (
            <span className="badge-green">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1" />
              Connected
            </span>
          ) : (
            <span className="badge-yellow">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1" />
              Not Configured
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Configuration Status */}
        {!status?.configured && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <div className="font-medium text-amber-800">Configuration Required</div>
                <p className="text-sm text-amber-700 mt-1">
                  Set the following environment variables to enable ShipStation sync:
                </p>
                <ul className="mt-2 space-y-1">
                  {status?.missingEnvVars?.map(envVar => (
                    <li key={envVar} className="flex items-center gap-2 text-sm">
                      <code className="px-1.5 py-0.5 bg-amber-100 rounded font-mono text-xs">{envVar}</code>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-600 mt-3">
                  Get your API credentials from ShipStation → Settings → Account → API Settings
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Connection Test */}
        {status?.configured && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Connection Status</span>
              <button
                onClick={testConnection}
                disabled={testing}
                className="btn-secondary btn-sm"
              >
                {testing ? (
                  <>
                    <div className="spinner" />
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
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg ${testResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-start gap-2">
                  {testResult.success ? (
                    <svg className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  )}
                  <div>
                    <div className={`font-medium ${testResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                      {testResult.success ? 'Connection Successful' : testResult.error || 'Connection Failed'}
                    </div>
                    {testResult.details && (
                      <p className="text-sm text-gray-600 mt-1">{testResult.details}</p>
                    )}
                    {testResult.stores && testResult.stores.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm text-emerald-700">Connected stores:</div>
                        <ul className="mt-1 space-y-1">
                          {testResult.stores.map(store => (
                            <li key={store.id} className="text-sm text-gray-600 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              {store.name} ({store.marketplace})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {testResult.rateLimit && testResult.rateLimit.remaining !== null && (
                      <div className="text-xs text-gray-500 mt-2">
                        API Rate Limit: {testResult.rateLimit.remaining} requests remaining
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sync Statistics */}
        {status?.configured && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div className="text-sm font-medium text-gray-700">Sync Statistics</div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-500">Total Orders</div>
                <div className="font-semibold text-gray-900">{status.totalShipStationOrders}</div>
              </div>
              <div>
                <div className="text-gray-500">Last Successful Sync</div>
                <div className="font-semibold text-gray-900">
                  {status.lastSuccessfulSync 
                    ? formatDateTime(status.lastSuccessfulSync)
                    : 'Never'}
                </div>
              </div>
            </div>

            {status.lastSyncStats && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-2">Last Sync Results</div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">{status.lastSyncStats.fetched}</div>
                    <div className="text-xs text-gray-500">Fetched</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-emerald-600">+{status.lastSyncStats.created}</div>
                    <div className="text-xs text-gray-500">Created</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-blue-600">{status.lastSyncStats.updated}</div>
                    <div className="text-xs text-gray-500">Updated</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-500">{status.lastSyncStats.skipped}</div>
                    <div className="text-xs text-gray-500">Skipped</div>
                  </div>
                </div>
              </div>
            )}

            {status.lastSyncError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-red-800">Last Sync Error</div>
                    <div className="text-xs text-red-700 mt-1 font-mono">{status.lastSyncError}</div>
                    {status.lastSyncAttempt && (
                      <div className="text-xs text-red-600 mt-1">
                        {formatDateTime(status.lastSyncAttempt)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Help Link */}
        <div className="border-t border-gray-100 pt-4">
          <a 
            href="https://help.shipstation.com/hc/en-us/articles/360025856212-ShipStation-API" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            ShipStation API Documentation
          </a>
        </div>
      </div>
    </div>
  );
}
