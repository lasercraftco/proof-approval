'use client';

import { useState } from 'react';
import ShipStationIntegrationCard from '@/components/ShipStationIntegrationCard';

type Settings = {
  company_name: string;
  accent_color: string;
  email_from_name: string;
  email_from_email: string;
  staff_notify_email: string;
  reminder_config: {
    enabled: boolean;
    first_reminder_days: number;
    second_reminder_days: number;
    max_reminders: number;
  };
} | null;

export default function SettingsForm({ settings }: { settings: Settings }) {
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    company_name: settings?.company_name || 'ProofFlow',
    accent_color: settings?.accent_color || '#1d3161',
    email_from_name: settings?.email_from_name || 'ProofFlow',
    email_from_email: settings?.email_from_email || '',
    staff_notify_email: settings?.staff_notify_email || '',
    reminder_enabled: settings?.reminder_config?.enabled ?? true,
    first_reminder_days: settings?.reminder_config?.first_reminder_days || 3,
    second_reminder_days: settings?.reminder_config?.second_reminder_days || 7,
    max_reminders: settings?.reminder_config?.max_reminders || 2,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: form.company_name,
          accent_color: form.accent_color,
          email_from_name: form.email_from_name,
          email_from_email: form.email_from_email,
          staff_notify_email: form.staff_notify_email,
          reminder_config: {
            enabled: form.reminder_enabled,
            first_reminder_days: form.first_reminder_days,
            second_reminder_days: form.second_reminder_days,
            max_reminders: form.max_reminders,
          },
        }),
      });
      if (res.ok) {
        setToast('Settings saved');
        setTimeout(() => setToast(''), 2000);
      }
    } catch {
      setToast('Error saving');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Branding */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Branding</h3>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="label">Company Name</label>
            <input
              type="text"
              value={form.company_name}
              onChange={e => setForm({ ...form, company_name: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Accent Color</label>
            <div className="flex gap-3">
              <input
                type="color"
                value={form.accent_color}
                onChange={e => setForm({ ...form, accent_color: e.target.value })}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={form.accent_color}
                onChange={e => setForm({ ...form, accent_color: e.target.value })}
                className="input flex-1 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Email */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Email Settings</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">From Name</label>
              <input
                type="text"
                value={form.email_from_name}
                onChange={e => setForm({ ...form, email_from_name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">From Email</label>
              <input
                type="email"
                value={form.email_from_email}
                onChange={e => setForm({ ...form, email_from_email: e.target.value })}
                className="input"
                placeholder="proofs@example.com"
              />
            </div>
          </div>
          <div>
            <label className="label">Staff Notification Email</label>
            <input
              type="email"
              value={form.staff_notify_email}
              onChange={e => setForm({ ...form, staff_notify_email: e.target.value })}
              className="input"
              placeholder="team@example.com"
            />
            <p className="text-xs text-gray-500 mt-1">Receives notifications when customers respond</p>
          </div>
        </div>
      </div>

      {/* Reminders */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Automatic Reminders</h3>
        </div>
        <div className="p-4 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.reminder_enabled}
              onChange={e => setForm({ ...form, reminder_enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-900">Enable automatic reminders</span>
          </label>

          {form.reminder_enabled && (
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <label className="label">First Reminder</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={form.first_reminder_days}
                    onChange={e => setForm({ ...form, first_reminder_days: parseInt(e.target.value) || 3 })}
                    className="input w-20"
                  />
                  <span className="text-sm text-gray-500">days</span>
                </div>
              </div>
              <div>
                <label className="label">Second Reminder</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={form.second_reminder_days}
                    onChange={e => setForm({ ...form, second_reminder_days: parseInt(e.target.value) || 7 })}
                    className="input w-20"
                  />
                  <span className="text-sm text-gray-500">days</span>
                </div>
              </div>
              <div>
                <label className="label">Max Reminders</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={form.max_reminders}
                  onChange={e => setForm({ ...form, max_reminders: parseInt(e.target.value) || 2 })}
                  className="input w-20"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ShipStation Integration */}
      <ShipStationIntegrationCard />

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
