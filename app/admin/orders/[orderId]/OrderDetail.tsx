'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type ProofFile = { id: string; preview_path: string; filename: string; mime_type: string | null };
type ProofVersion = { id: string; version_number: number; staff_note: string | null; created_at: string; proof_files: ProofFile[] };
type Order = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string;
  sku: string | null;
  product_name?: string | null;
  quantity: number | null;
  status: string;
  created_at: string;
  order_total?: number | null;
  product_image_url?: string | null;
  customization_options?: Record<string, string> | null;
  versions: ProofVersion[];
};

const statusConfig: Record<string, { label: string; class: string; bg: string }> = {
  draft: { label: 'Draft', class: 'badge-gray', bg: 'bg-gray-50' },
  open: { label: 'Open', class: 'badge-blue', bg: 'bg-blue-50' },
  proof_sent: { label: 'Proof Sent', class: 'badge-yellow', bg: 'bg-amber-50' },
  approved: { label: 'Approved', class: 'badge-green', bg: 'bg-emerald-50' },
  approved_with_notes: { label: 'Approved (Notes)', class: 'badge-green', bg: 'bg-emerald-50' },
  changes_requested: { label: 'Changes Requested', class: 'badge-red', bg: 'bg-red-50' },
};

export default function OrderDetail({ order, proofLink }: { order: Order; proofLink: string | null }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [staffNote, setStaffNote] = useState('');
  const [toast, setToast] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const latestVersion = order.versions[0];
  const config = statusConfig[order.status] || statusConfig.draft;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('orderId', order.id);
    formData.append('staffNote', staffNote);
    Array.from(files).forEach(f => formData.append('files', f));

    try {
      const res = await fetch('/api/proofs/upload', { method: 'POST', body: formData });
      if (res.ok) {
        setStaffNote('');
        router.refresh();
      } else {
        showToast('Upload failed');
      }
    } catch {
      showToast('Upload error');
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!latestVersion) return showToast('Upload a proof first');
    setSending(true);
    try {
      const res = await fetch('/api/proofs/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      if (res.ok) {
        showToast('Proof sent!');
        router.refresh();
      } else {
        showToast('Failed to send');
      }
    } catch {
      showToast('Send error');
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    if (proofLink) {
      navigator.clipboard.writeText(proofLink);
      showToast('Link copied!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg animate-in fade-in">
          {toast}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img src={lightbox} alt="Proof" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">#{order.order_number}</h1>
              <span className={config.class}>{config.label}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{order.customer_name || order.customer_email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {proofLink && (
            <button onClick={copyLink} className="btn-ghost btn-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              Copy Link
            </button>
          )}
          <button onClick={handleSend} disabled={sending || !latestVersion} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
            {sending ? 'Sending...' : 'Send to Customer'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Card */}
          <div className={`rounded-lg border ${config.bg} border-gray-200`}>
            <div className="p-4 flex gap-4">
              <div className="w-16 h-16 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {order.product_image_url ? (
                  <img src={order.product_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">📦</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-medium text-gray-900">{order.product_name || order.sku || 'No product'}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-gray-600">
                  {order.sku && <span>SKU: {order.sku}</span>}
                  {order.quantity && <span>Qty: {order.quantity}</span>}
                  {order.order_total && <span className="font-semibold">${order.order_total.toFixed(2)}</span>}
                </div>
                {order.customization_options && Object.keys(order.customization_options).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(order.customization_options).map(([k, v]) => (
                      <span key={k} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs">
                        <span className="text-gray-500">{k}:</span> <span className="text-gray-900">{v}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Proof Section */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Proof Files</h3>
              {latestVersion && <span className="badge-gray">v{latestVersion.version_number}</span>}
            </div>
            <div className="p-4">
              {latestVersion ? (
                <div className="space-y-4">
                  {latestVersion.staff_note && (
                    <div className="text-sm p-3 bg-blue-50 text-blue-800 rounded-md border border-blue-100">
                      <span className="font-medium">Note:</span> {latestVersion.staff_note}
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {latestVersion.proof_files.map(file => (
                      <div
                        key={file.id}
                        className="group relative aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors"
                        onClick={() => file.mime_type?.startsWith('image/') && setLightbox(file.preview_path)}
                      >
                        {file.mime_type?.startsWith('image/') ? (
                          <img src={file.preview_path} alt={file.filename} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-2xl mb-1">📄</span>
                            <span className="text-[10px] text-gray-500 truncate w-full">{file.filename}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2 grayscale opacity-50">🖼️</div>
                  <p className="text-sm text-gray-500">No proofs uploaded yet</p>
                </div>
              )}

              {/* Upload */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={staffNote}
                    onChange={e => setStaffNote(e.target.value)}
                    placeholder="Add note for this version (optional)"
                    className="input flex-1"
                  />
                  <input ref={fileRef} type="file" multiple accept="image/*,.pdf" onChange={handleUpload} className="hidden" />
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary whitespace-nowrap">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    {uploading ? 'Uploading...' : 'Upload Proof'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Version History */}
          {order.versions.length > 1 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Version History</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {order.versions.slice(1).map(v => (
                  <div key={v.id} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="badge-gray">v{v.version_number}</span>
                      {v.staff_note && <span className="text-gray-600 truncate">{v.staff_note}</span>}
                    </div>
                    <span className="text-gray-400 text-xs">{new Date(v.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Customer Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Customer</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Name</div>
                <div className="text-sm font-medium text-gray-900">{order.customer_name || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Email</div>
                <a href={`mailto:${order.customer_email}`} className="text-sm text-blue-600 hover:text-blue-700">
                  {order.customer_email}
                </a>
              </div>
            </div>
          </div>

          {/* Order Info */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Order Details</h3>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Order #</span>
                <span className="font-medium text-gray-900">{order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={config.class}>{config.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900">{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
              {order.order_total && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Total</span>
                  <span className="font-semibold text-gray-900">${order.order_total.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Proof Link */}
          {proofLink && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Customer Proof Link</h3>
              </div>
              <div className="p-4">
                <div className="p-2 bg-gray-50 rounded border text-xs text-gray-600 break-all font-mono">
                  {proofLink}
                </div>
                <button onClick={copyLink} className="btn-secondary btn-sm w-full mt-3">
                  Copy Link
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="card p-4 space-y-2">
            <button className="btn-ghost w-full justify-start text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Edit Order
            </button>
            <button className="btn-ghost w-full justify-start text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              Send Reminder
            </button>
            <button className="btn-ghost w-full justify-start text-sm text-red-600 hover:text-red-700 hover:bg-red-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
