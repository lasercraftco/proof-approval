export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import SettingsForm from './SettingsForm';
import Link from 'next/link';

async function getSettings() {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('*')
    .eq('id', 'default')
    .single();
  return data;
}

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Configure your proof approval system</p>
      </div>

      {/* Settings Navigation */}
      <div className="flex gap-4 border-b border-gray-200">
        <Link href="/admin/settings" className="tab tab-active">General</Link>
        <Link href="/admin/users" className="tab">Users & Roles</Link>
        <Link href="/admin/audit" className="tab">Audit Trail</Link>
      </div>

      <SettingsForm settings={settings} />
    </div>
  );
}
