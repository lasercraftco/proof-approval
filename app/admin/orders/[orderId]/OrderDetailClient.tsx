'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type ProofFile = {
  id: string;
  original_path: string;
  preview_path: string;
  filename: string;
  mime_type: string | null;
};

type ProofVersion = {
  id: string;
  version_number: number;
  staff_note: string | null;
  created_at: string;
  proof_files: ProofFile[];
};

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
  versions: ProofVersion[];
  magicLink?: { token_hash: string } | null;
  product_image_url?: string | null;
  customization_options?: Record<string, string> | null;
  order_total?: number | null;
};

type Props = {
  order: Order;
  settings: any;
  baseUrl: string;
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  open: 'bg-blue-100 text-blue-700',
  proof_sent: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  approved_with_notes: 'bg-green-100 text-green-700',
  changes_requested: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  proof_sent: 'Proof Sent',
  approved: 'Approved',
  approved_with_notes: 'Approved (Notes)',
  changes_requested: 'Changes Requested',
};

export default function OrderDetailClient({ order, settings, baseUrl }: Props) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [staffNote, setStaffNote] = useState('');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const latestVersion = order.versions[0];
  const proofLink = order.magicLink 
    ? `${baseUrl}/p/${order.magicLink.token_hash}`
    : null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('orderId', order.id);
      formData.append('staffNote', staffNote);
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      const response = await fetch('/api/proofs/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setStaffNote('');
        router.refresh();
      } else {
        const err = await response.json();
        alert(err.error || 'Upload failed');
      }
    } catch (error) {
      alert('Upload error');
    } finally {
      setUploading(false);
    }
  };

  const handleSendProof = async () => {
    if (!latestVersion) {
      alert('Upload a proof first');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/proofs/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });

      if (response.ok) {
        setMessage('Proof sent successfully!');
        router.refresh();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to send');
      }
    } catch (error) {
      alert('Send error');
    } finally {
      setSending(false);
    }
  };

  const copyProofLink = () => {
    if (proofLink) {
      navigator.clipboard.writeText(proofLink);
      setMessage('Link copied!');
      setTimeout(() => setMessage(''), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Product Card */}
        <div className="bg-white rounded-2xl border p-6">
          <div className="flex gap-4">
            <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
              {order.product_image_url ? (
                <img src={order.product_image_url} alt="" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <span className="text-3xl">📦</span>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">
                {order.product_name || order.sku || 'No product specified'}
              </h2>
              {order.sku && <div className="text-sm text-gray-500">SKU: {order.sku}</div>}
              {order.quantity && <div className="text-sm text-gray-500">Qty: {order.quantity}</div>}
              
              {order.customization_options && Object.keys(order.customization_options).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {Object.entries(order.customization_options).map(([key, value]) => (
                    <span key={key} className="px-2 py-1 bg-gray-100 rounded text-sm">
                      {key}: {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status]}`}>
                {statusLabels[order.status]}
              </span>
            </div>
          </div>
        </div>

        {/* Proof Management */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Proof Management</h3>
          </div>
          <div className="p-6 space-y-6">
            {/* Latest Proof */}
            {latestVersion ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">
                    Latest Proof (v{latestVersion.version_number})
                  </h4>
                  <span className="text-sm text-gray-500">
                    {new Date(latestVersion.created_at).toLocaleString()}
                  </span>
                </div>
                {latestVersion.staff_note && (
                  <div className="text-sm text-gray-600 mb-3 p-3 bg-gray-50 rounded-lg">
                    📝 {latestVersion.staff_note}
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {latestVersion.proof_files.map(file => (
                    <div key={file.id} className="border rounded-lg overflow-hidden">
                      {file.mime_type?.startsWith('image/') ? (
                        <img 
                          src={file.preview_path} 
                          alt={file.filename}
                          className="w-full h-32 object-cover"
                        />
                      ) : (
                        <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                          <span className="text-3xl">📄</span>
                        </div>
                      )}
                      <div className="p-2 text-sm text-gray-600 truncate">
                        {file.filename}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No proofs uploaded yet
              </div>
            )}

            {/* Upload New */}
            <div className="border-t pt-6">
              <h4 className="font-medium text-gray-900 mb-3">Upload New Proof</h4>
              <div className="space-y-3">
                <textarea
                  value={staffNote}
                  onChange={(e) => setStaffNote(e.target.value)}
                  placeholder="Staff note (optional)..."
                  className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500"
                  rows={2}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-3 border-2 border-dashed rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : '📁 Choose Files'}
                </button>
              </div>
            </div>

            {/* Actions */}
            {latestVersion && (
              <div className="border-t pt-6 flex gap-3">
                <button
                  onClick={handleSendProof}
                  disabled={sending}
                  className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : '📧 Send Proof to Customer'}
                </button>
                {proofLink && (
                  <button
                    onClick={copyProofLink}
                    className="px-4 py-3 border-2 rounded-lg hover:bg-gray-50"
                  >
                    🔗 Copy Link
                  </button>
                )}
              </div>
            )}

            {message && (
              <div className="p-3 bg-green-100 text-green-700 rounded-lg text-center">
                {message}
              </div>
            )}
          </div>
        </div>

        {/* Version History */}
        {order.versions.length > 1 && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h3 className="font-semibold text-gray-900">Version History</h3>
            </div>
            <div className="divide-y">
              {order.versions.slice(1).map(version => (
                <div key={version.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Version {version.version_number}</span>
                    <span className="text-sm text-gray-500">
                      {new Date(version.created_at).toLocaleString()}
                    </span>
                  </div>
                  {version.staff_note && (
                    <div className="text-sm text-gray-600 mt-1">{version.staff_note}</div>
                  )}
                  <div className="text-sm text-gray-500 mt-1">
                    {version.proof_files.length} file(s)
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Customer Info */}
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Customer</h3>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-500">Name</div>
              <div className="font-medium">{order.customer_name || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Email</div>
              <div className="font-medium">{order.customer_email}</div>
            </div>
          </div>
        </div>

        {/* Order Info */}
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Order Details</h3>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-500">Order Number</div>
              <div className="font-medium">#{order.order_number}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Created</div>
              <div className="font-medium">
                {new Date(order.created_at).toLocaleString()}
              </div>
            </div>
            {order.order_total && (
              <div>
                <div className="text-sm text-gray-500">Total</div>
                <div className="font-medium">
                  ${order.order_total.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Proof Link */}
        {proofLink && (
          <div className="bg-white rounded-2xl border p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Customer Link</h3>
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 break-all">
              {proofLink}
            </div>
            <button
              onClick={copyProofLink}
              className="mt-3 w-full py-2 border-2 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              📋 Copy Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
