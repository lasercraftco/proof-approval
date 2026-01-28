'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewOrderPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    order_number: '',
    sku: '',
    product_name: '',
    quantity: '',
    order_total: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_email || !form.order_number) return;

    setSaving(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: form.customer_name || null,
          customer_email: form.customer_email,
          order_number: form.order_number,
          sku: form.sku || null,
          product_name: form.product_name || null,
          quantity: form.quantity ? parseInt(form.quantity) : null,
          order_total: form.order_total ? parseFloat(form.order_total) : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/admin/orders/${data.order.id}`);
      }
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/orders" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Create Order</h1>
          <p className="text-sm text-gray-500">Add a new order for proof approval</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Info */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Customer Information</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Customer Name</label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  className="input"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="label">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.customer_email}
                  onChange={e => setForm({ ...form, customer_email: e.target.value })}
                  className="input"
                  placeholder="john@example.com"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Order Details</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">
                  Order Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.order_number}
                  onChange={e => setForm({ ...form, order_number: e.target.value })}
                  className="input"
                  placeholder="ORD-001"
                  required
                />
              </div>
              <div>
                <label className="label">SKU</label>
                <input
                  type="text"
                  value={form.sku}
                  onChange={e => setForm({ ...form, sku: e.target.value })}
                  className="input"
                  placeholder="PROD-001"
                />
              </div>
            </div>
            <div>
              <label className="label">Product Name</label>
              <input
                type="text"
                value={form.product_name}
                onChange={e => setForm({ ...form, product_name: e.target.value })}
                className="input"
                placeholder="Custom Wood Sign"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                  className="input"
                  placeholder="1"
                />
              </div>
              <div>
                <label className="label">Order Total</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.order_total}
                    onChange={e => setForm({ ...form, order_total: e.target.value })}
                    className="input pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/admin/orders" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
