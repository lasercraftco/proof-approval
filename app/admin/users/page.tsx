export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';

async function getUsers() {
  const { data } = await supabaseAdmin.from('users').select('*').order('created_at', { ascending: false });
  return data || [];
}

const roleColors: Record<string, string> = {
  admin: 'badge-purple',
  manager: 'badge-blue',
  operator: 'badge-green',
  viewer: 'badge-gray',
};

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Manage team access</p>
      </div>

      <div className="flex gap-4 border-b border-gray-200">
        <Link href="/admin/settings" className="tab">General</Link>
        <Link href="/admin/users" className="tab tab-active">Users & Roles</Link>
        <Link href="/admin/audit" className="tab">Audit Trail</Link>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{users.length} team members</p>
        <button className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Invite User
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="table-row-clickable">
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                      {(u.name || u.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{u.name || '—'}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={roleColors[u.role] || 'badge-gray'}>{u.role}</span>
                </td>
                <td>
                  {u.is_active ? <span className="badge-green">Active</span> : <span className="badge-gray">Inactive</span>}
                </td>
                <td className="text-sm text-gray-500 tabular-nums">
                  {u.last_active_at ? new Date(u.last_active_at).toLocaleDateString() : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No team members</div>
            <div className="empty-state-description">Invite your team to collaborate</div>
          </div>
        )}
      </div>
    </div>
  );
}
