'use client';

import { useState } from 'react';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  base_price: number | null;
  is_active: boolean;
  image_url?: string | null;
};

export default function ProductsClient({ products }: { products: Product[] }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const filtered = products.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">{products.length} products</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Product
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="input pl-9"
          />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th className="text-right">Base Price</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="table-row-clickable">
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg">📦</span>
                      )}
                    </div>
                    <span className="font-medium text-gray-900">{p.name}</span>
                  </div>
                </td>
                <td className="text-gray-500 font-mono text-sm">{p.sku || '—'}</td>
                <td className="text-gray-700">{p.category || '—'}</td>
                <td className="text-right font-medium tabular-nums">
                  {p.base_price ? `$${p.base_price.toFixed(2)}` : '—'}
                </td>
                <td>
                  {p.is_active ? (
                    <span className="badge-green">Active</span>
                  ) : (
                    <span className="badge-gray">Inactive</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🏷️</div>
            <div className="empty-state-title">No products found</div>
            <div className="empty-state-description">Add products to track pricing and materials</div>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {showModal && (
        <>
          <div className="modal-backdrop" onClick={() => setShowModal(false)} />
          <div className="modal">
            <div className="modal-header">
              <h3 className="font-semibold text-gray-900">Add Product</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body space-y-4">
              <div>
                <label className="label">Product Name</label>
                <input type="text" className="input" placeholder="Custom Wood Sign" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">SKU</label>
                  <input type="text" className="input" placeholder="WOOD-SIGN-001" />
                </div>
                <div>
                  <label className="label">Base Price</label>
                  <input type="number" className="input" placeholder="49.99" />
                </div>
              </div>
              <div>
                <label className="label">Category</label>
                <input type="text" className="input" placeholder="Signs" />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button className="btn-primary">Add Product</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
