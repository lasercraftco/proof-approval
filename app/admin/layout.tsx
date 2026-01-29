import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import AdminHeader from '@/components/AdminHeader';

async function getSettings() {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('company_name, accent_color, logo_data_url')
    .eq('id', 'default')
    .single();
  return data;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Check authentication
  const session = await getSession();
  
  if (!session.authenticated) {
    redirect('/login');
  }

  const settings = await getSettings();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AdminHeader
        businessName={settings?.company_name || 'ProofFlow'}
        accentColor={settings?.accent_color || '#1d3161'}
        logoUrl={settings?.logo_data_url}
      />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
