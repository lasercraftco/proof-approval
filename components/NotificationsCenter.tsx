'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsCenter({ accentColor = '#1d3161' }: { accentColor?: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=10');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  };

  const typeConfig: Record<string, { icon: string; color: string }> = {
    approval: { icon: '✅', color: 'bg-emerald-100' },
    changes: { icon: '🔄', color: 'bg-amber-100' },
    reminder: { icon: '⏰', color: 'bg-blue-100' },
    default: { icon: '📬', color: 'bg-gray-100' },
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] font-bold text-white rounded-full flex items-center justify-center" style={{ backgroundColor: accentColor }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-900 text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="spinner" />
              </div>
            ) : notifications.length > 0 ? (
              notifications.map(n => {
                const config = typeConfig[n.type] || typeConfig.default;
                return (
                  <Link
                    key={n.id}
                    href={n.order_id ? `/admin/orders/${n.order_id}` : '#'}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      !n.is_read ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${config.color}`}>
                        {config.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">{n.title}</div>
                        {n.message && <div className="text-xs text-gray-500 truncate">{n.message}</div>}
                        <div className="text-[10px] text-gray-400 mt-1">
                          {new Date(n.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: accentColor }} />
                      )}
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="py-8 text-center text-sm text-gray-500">No notifications</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
