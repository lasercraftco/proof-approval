'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type SyncStatus = {
  configured: boolean;
  missingEnvVars: string[];
  lastSuccessfulSync: string | null;
};

type SyncResult = {
  success: boolean;
  message: string;
  configured: boolean;
  stats?: {
    fetched: number;
    created: number;
    updated: number;
    skipped: number;
    errors?: string[];
  };
  error?: string;
};

export default function SyncButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    // Fetch configuration status on mount
    fetch('/api/shipstation/status')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setStatus(data);
      })
      .catch(() => {});
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    setShowResult(false);

    try {
      const res = await fetch('/api/shipstation/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: 'incremental' }),
      });

      const data = await res.json();
      
      setResult(data);
      setShowResult(true);

      if (data.success) {
        // Refresh the page data after successful sync
        router.refresh();

        // Auto-hide success message after 5 seconds
        setTimeout(() => setShowResult(false), 5000);
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Sync failed',
        configured: status?.configured ?? false,
        error: error instanceof Error ? error.message : 'Network error',
      });
      setShowResult(true);
    } finally {
      setSyncing(false);
    }
  };

  // Not configured state
  const isConfigured = status?.configured ?? true; // Default to true to avoid flash

  return (
    <div className="relative">
      <button
        onClick={handleSync}
        disabled={syncing || !isConfigured}
        className={`btn-secondary flex items-center gap-2 ${!isConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isConfigured ? 'Sync orders from ShipStation' : 'ShipStation not configured. Set API credentials in environment variables.'}
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

      {/* Result toast */}
      {showResult && result && (
        <div 
          className={`absolute top-full right-0 mt-2 p-3 rounded-lg shadow-lg text-sm z-50 min-w-[250px] ${
            result.success 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium flex items-center gap-2">
                {result.success ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Sync Complete
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    Sync Failed
                  </>
                )}
              </div>
              {result.stats && (
                <div className="mt-1 text-xs space-y-0.5">
                  <div>Fetched: {result.stats.fetched}</div>
                  <div>Created: {result.stats.created}</div>
                  <div>Updated: {result.stats.updated}</div>
                  {result.stats.skipped > 0 && <div>Skipped: {result.stats.skipped}</div>}
                </div>
              )}
              {result.error && (
                <div className="mt-1 text-xs">{result.error}</div>
              )}
            </div>
            <button 
              onClick={() => setShowResult(false)}
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
