'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Result = {
  type: 'order' | 'customer';
  id: string;
  title: string;
  subtitle?: string;
};

export default function GlobalSearch({ accentColor = '#1d3161' }: { accentColor?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setSelected(0);
        }
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (result: Result) => {
    setOpen(false);
    setQuery('');
    if (result.type === 'order') router.push(`/admin/orders/${result.id}`);
    else if (result.type === 'customer') router.push(`/admin/customers/${result.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && results[selected]) {
      handleSelect(results[selected]);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <span className="hidden sm:block">Search</span>
        <kbd className="hidden sm:block text-[10px] px-1.5 py-0.5 bg-white border rounded text-gray-400">⌘K</kbd>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setOpen(false)} />
          <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg bg-white rounded-lg shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search orders, customers..."
                className="flex-1 text-sm outline-none"
              />
              {loading && <div className="spinner" />}
            </div>

            {results.length > 0 && (
              <div className="max-h-64 overflow-y-auto py-2">
                {results.map((r, i) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => handleSelect(r)}
                    className={`w-full px-4 py-2 text-left flex items-center gap-3 ${
                      i === selected ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 uppercase">
                      {r.type === 'order' ? 'ORD' : 'CUS'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{r.title}</div>
                      {r.subtitle && <div className="text-xs text-gray-500 truncate">{r.subtitle}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {query && !loading && results.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-500">No results found</div>
            )}

            <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-400 flex items-center gap-3">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>ESC Close</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
