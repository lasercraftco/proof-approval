'use client';

import { useState } from 'react';

type ProofFile = {
  id: string;
  preview_path: string;
  filename: string;
  mime_type: string | null;
};

type ProofVersion = {
  id: string;
  version_number: number;
  staff_note: string | null;
  proof_files: ProofFile[];
};

type Order = {
  id: string;
  order_number: string;
  customer_name: string | null;
  product_name?: string | null;
  status: string;
  proof_versions: ProofVersion[];
};

type Props = {
  order: Order;
  settings: { company_name?: string; logo_data_url?: string; accent_color?: string } | null;
  token: string;
};

export default function ProofPortalClient({ order, settings, token }: Props) {
  const [decision, setDecision] = useState<'approved' | 'approved_with_notes' | 'changes_requested' | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const accentColor = settings?.accent_color || '#1d3161';
  
  // Sort versions by number descending, get latest
  const sortedVersions = [...order.proof_versions].sort((a, b) => b.version_number - a.version_number);
  const latestVersion = sortedVersions[0];

  const alreadyDecided = ['approved', 'approved_with_notes', 'changes_requested'].includes(order.status);

  const handleSubmit = async () => {
    if (!decision) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/actions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          decision,
          note: note.trim() || null,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to submit');
      }
    } catch (error) {
      alert('Error submitting');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: accentColor + '10' }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          {settings?.logo_data_url && (
            <img src={settings.logo_data_url} alt="" className="h-12 mx-auto mb-6" />
          )}
          <div className="text-6xl mb-4">
            {decision === 'changes_requested' ? '✏️' : '✅'}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {decision === 'changes_requested' ? 'Changes Requested' : 'Proof Approved!'}
          </h1>
          <p className="text-gray-600">
            {decision === 'changes_requested' 
              ? "We've received your feedback and will send an updated proof soon."
              : "Thank you! We'll begin production shortly."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: accentColor + '08' }}>
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {settings?.logo_data_url ? (
            <img src={settings.logo_data_url} alt={settings.company_name} className="h-10" />
          ) : (
            <span className="text-xl font-bold" style={{ color: accentColor }}>
              {settings?.company_name || 'Proof Review'}
            </span>
          )}
          <div className="text-sm text-gray-500">
            Order #{order.order_number}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* Product Info */}
        <div className="bg-white rounded-2xl border p-6 mb-6">
          <h1 className="text-xl font-semibold text-gray-900">
            {order.product_name || `Order #${order.order_number}`}
          </h1>
          {order.customer_name && (
            <p className="text-gray-600">For {order.customer_name}</p>
          )}
        </div>

        {/* Already Decided Message */}
        {alreadyDecided && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 mb-6">
            <div className="text-yellow-800 font-medium">
              You&apos;ve already submitted your decision for this proof.
            </div>
          </div>
        )}

        {/* Proof Display */}
        {latestVersion && (
          <div className="bg-white rounded-2xl border overflow-hidden mb-6">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-900">
                Your Proof {sortedVersions.length > 1 ? `(Version ${latestVersion.version_number})` : ''}
              </h2>
              {latestVersion.staff_note && (
                <p className="text-sm text-gray-600 mt-1">{latestVersion.staff_note}</p>
              )}
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {latestVersion.proof_files.map(file => (
                  <div 
                    key={file.id} 
                    className="border rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedImage(file.preview_path)}
                  >
                    {file.mime_type?.startsWith('image/') ? (
                      <img 
                        src={file.preview_path} 
                        alt={file.filename}
                        className="w-full"
                      />
                    ) : (
                      <div className="p-8 bg-gray-50 text-center">
                        <span className="text-4xl">📄</span>
                        <div className="mt-2 text-sm text-gray-600">{file.filename}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Decision Form */}
        {!alreadyDecided && (
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Your Decision</h2>
            
            <div className="space-y-3 mb-6">
              <button
                onClick={() => setDecision('approved')}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  decision === 'approved' 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">✅ Approve Proof</div>
                <div className="text-sm text-gray-500">The proof looks perfect, proceed to production</div>
              </button>

              <button
                onClick={() => setDecision('approved_with_notes')}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  decision === 'approved_with_notes' 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">✅ Approve with Notes</div>
                <div className="text-sm text-gray-500">Approve but add a note for production</div>
              </button>

              <button
                onClick={() => setDecision('changes_requested')}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  decision === 'changes_requested' 
                    ? 'border-orange-500 bg-orange-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">✏️ Request Changes</div>
                <div className="text-sm text-gray-500">I need revisions before approving</div>
              </button>
            </div>

            {decision && (
              <div className="space-y-4">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={decision === 'changes_requested' 
                    ? "Please describe what changes you'd like..." 
                    : "Add a note (optional)..."
                  }
                  className="w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:border-gray-400"
                  rows={4}
                  required={decision === 'changes_requested'}
                />

                <button
                  onClick={handleSubmit}
                  disabled={submitting || (decision === 'changes_requested' && !note.trim())}
                  className="w-full py-4 rounded-xl text-white font-medium disabled:opacity-50"
                  style={{ backgroundColor: accentColor }}
                >
                  {submitting ? 'Submitting...' : 'Submit Decision'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Image Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img 
            src={selectedImage} 
            alt="" 
            className="max-w-full max-h-full object-contain"
          />
          <button 
            className="absolute top-4 right-4 text-white text-2xl"
            onClick={() => setSelectedImage(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
