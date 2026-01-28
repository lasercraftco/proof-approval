export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';

async function getAssets() {
  const { data } = await supabaseAdmin
    .from('assets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  return data || [];
}

export default async function AssetsPage() {
  const assets = await getAssets();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Assets</h1>
          <p className="text-sm text-gray-500">{assets.length} design files</p>
        </div>
        <button className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          Upload
        </button>
      </div>

      {assets.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {assets.map(a => (
            <div key={a.id} className="group bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 hover:shadow-sm cursor-pointer transition-all">
              <div className="aspect-square bg-gray-50 flex items-center justify-center">
                {a.thumbnail_url ? (
                  <img src={a.thumbnail_url} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl grayscale opacity-50">🎨</span>
                )}
              </div>
              <div className="p-2 border-t border-gray-100">
                <div className="text-sm font-medium text-gray-900 truncate">{a.name}</div>
                <div className="text-xs text-gray-500 truncate">{a.original_filename}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🎨</div>
            <div className="empty-state-title">No assets yet</div>
            <div className="empty-state-description">Upload design files to build your asset library</div>
          </div>
        </div>
      )}
    </div>
  );
}
