'use client';

import { useState } from 'react';

type Settings = {
  id: string;
  company_name: string;
  accent_color: string;
  logo_data_url: string | null;
  email_from_name: string;
  email_from_email: string;
  staff_notify_email: string;
  reminder_config: {
    enabled: boolean;
    first_reminder_days: number;
    second_reminder_days: number;
    max_reminders: number;
  };
};

type Props = {
  settings: Settings | null;
};

export default function SettingsClient({ settings }: Props) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    company_name: settings?.company_name || 'The Lasercraft Company',
    accent_color: settings?.accent_color || '#1d3161',
    email_from_name: settings?.email_from_name || 'The Lasercraft Company',
    email_from_email: settings?.email_from_email || 'proofs@thelasercraft.co',
    staff_notify_email: settings?.staff_notify_email || 'proofs@thelasercraft.co',
    reminder_enabled: settings?.reminder_config?.enabled ?? true,
    first_reminder_days: settings?.reminder_config?.first_reminder_days || 3,
    second_reminder_days: settings?.reminder_config?.second_reminder_days || 7,
    max_reminders: settings?.reminder_config?.max_reminders || 2,
  });

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: formData.company_name,
          accent_color: formData.accent_color,
          email_from_name: formData.email_from_name,
          email_from_email: formData.email_from_email,
          staff_notify_email: formData.staff_notify_email,
          reminder_config: {
            enabled: formData.reminder_enabled,
            first_reminder_days: formData.first_reminder_days,
            second_reminder_days: formData.second_reminder_days,
            max_reminders: formData.max_reminders,
          },
        }),
      });

      if (response.ok) {
        setMessage('Settings saved successfully!');
      } else {
        const err = await response.json();
        setMessage(err.error || 'Failed to save');
      }
    } catch (error) {
      setMessage('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Branding */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Branding</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              type="text"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
            <div className="flex gap-3">
              <input
                type="color"
                value={formData.accent_color}
                onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                className="w-12 h-10 border-2 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.accent_color}
                onChange={(e) => setFormData({ ...formData, accent_color: e.target.value })}
                className="flex-1 px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Email */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Email Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
            <input
              type="text"
              value={formData.email_from_name}
              onChange={(e) => setFormData({ ...formData, email_from_name: e.target.value })}
              className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
            <input
              type="email"
              value={formData.email_from_email}
              onChange={(e) => setFormData({ ...formData, email_from_email: e.target.value })}
              className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Staff Notification Email</label>
            <input
              type="email"
              value={formData.staff_notify_email}
              onChange={(e) => setFormData({ ...formData, staff_notify_email: e.target.value })}
              className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Reminders */}
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Automatic Reminders</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={formData.reminder_enabled}
              onChange={(e) => setFormData({ ...formData, reminder_enabled: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <span className="font-medium">Enable automatic reminders</span>
          </label>

          {formData.reminder_enabled && (
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Reminder (days)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.first_reminder_days}
                  onChange={(e) => setFormData({ ...formData, first_reminder_days: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Second Reminder (days)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.second_reminder_days}
                  onChange={(e) => setFormData({ ...formData, second_reminder_days: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Reminders</label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_reminders}
                  onChange={(e) => setFormData({ ...formData, max_reminders: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {message && (
          <span className={message.includes('success') ? 'text-green-600' : 'text-red-600'}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
