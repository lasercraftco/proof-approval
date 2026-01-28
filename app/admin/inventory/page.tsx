export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';

async function getMaterials() {
  const { data } = await supabaseAdmin
    .from('materials')
    .select('*')
    .order('name');
  return data || [];
}

export default async function InventoryPage() {
  const materials = await getMaterials();
  const lowStock = materials.filter(m => m.current_stock <= (m.reorder_point || 0));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500">{materials.length} materials tracked</p>
        </div>
        <button className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Material
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <span className="text-amber-600">⚠️</span>
          <span className="text-sm text-amber-800">
            <strong>{lowStock.length}</strong> items are low on stock
          </span>
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Material</th>
              <th>SKU</th>
              <th className="text-right">In Stock</th>
              <th className="text-right">Reorder Point</th>
              <th className="text-right">Unit Cost</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {materials.map(m => {
              const isLow = m.current_stock <= (m.reorder_point || 0);
              return (
                <tr key={m.id} className="table-row-clickable">
                  <td className="font-medium text-gray-900">{m.name}</td>
                  <td className="text-gray-500 font-mono text-sm">{m.sku || '—'}</td>
                  <td className={`text-right tabular-nums font-medium ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                    {m.current_stock || 0} {m.unit || ''}
                  </td>
                  <td className="text-right tabular-nums text-gray-500">{m.reorder_point || '—'}</td>
                  <td className="text-right tabular-nums text-gray-700">
                    {m.unit_cost ? `$${m.unit_cost.toFixed(2)}` : '—'}
                  </td>
                  <td>
                    {isLow ? (
                      <span className="badge-red">Low Stock</span>
                    ) : (
                      <span className="badge-green">In Stock</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {materials.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-title">No materials tracked</div>
            <div className="empty-state-description">Add materials to track inventory levels</div>
          </div>
        )}
      </div>
    </div>
  );
}
