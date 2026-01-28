'use client';

import { useState, useRef } from 'react';

type ProofFile = { id: string; preview_path: string; filename: string; mime_type: string | null };
type ProofVersion = { id: string; version_number: number; staff_note: string | null; proof_files: ProofFile[] };
type Order = {
  id: string;
  order_number: string;
  customer_name: string | null;
  product_name?: string | null;
  sku: string | null;
  status: string;
  product_image_url?: string | null;
  versions: ProofVersion[];
};
type Settings = { company_name: string; accent_color: string; logo_data_url?: string | null } | null;

export default function ProofPortal({ order, settings, token }: { order: Order; settings: Settings; token: string }) {
  const [decision, setDecision] = useState<'approved' | 'approved_with_notes' | 'changes_requested' | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const submitAttempted = useRef(false);

  const accentColor = settings?.accent_color || '#1d3161';
  const companyName = settings?.company_name || 'ProofFlow';
  const latestVersion = order.versions[0];
  const alreadyDecided = ['approved', 'approved_with_notes', 'changes_requested'].includes(order.status);

  const handleSubmit = async () => {
    // Prevent double submission
    if (submitAttempted.current || submitting) return;
    if (!decision || (decision === 'changes_requested' && !notes.trim())) return;
    
    submitAttempted.current = true;
    setSubmitting(true);
    setError(null);
    
    try {
      const res = await fetch('/api/actions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, decision, note: notes }),
      });
      
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to submit. Please try again.');
        submitAttempted.current = false; // Allow retry on error
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      submitAttempted.current = false; // Allow retry on error
    } finally {
      setSubmitting(false);
    }
  };

  // Success/Already decided screen
  if (submitted || alreadyDecided) {
    const isApproved = submitted ? decision?.includes('approved') : order.status.includes('approved');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: isApproved ? '#10b981' : accentColor }}>
            <span className="text-white text-2xl">{isApproved ? '✓' : '📝'}</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            {isApproved ? 'Proof Approved!' : 'Changes Requested'}
          </h1>
          <p className="text-gray-500 mt-2">
            {isApproved 
              ? 'Thank you! Your approval has been recorded and production will begin shortly.' 
              : 'Thank you for your feedback. We\'ll send a revised proof soon.'}
          </p>
          {!submitted && (
            <p className="text-sm text-gray-400 mt-4">
              You have already submitted your decision for this proof.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
            onClick={() => setLightbox(null)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img src={lightbox} alt="Proof" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {settings?.logo_data_url ? (
              <img src={settings.logo_data_url} alt={companyName} className="h-8" />
            ) : (
              <div className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: accentColor }}>
                {companyName.charAt(0)}
              </div>
            )}
            <span className="font-semibold text-gray-900 hidden sm:block">{companyName}</span>
          </div>
          <div className="text-sm text-gray-500">Order #{order.order_number}</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Product Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {order.product_image_url ? (
                <img src={order.product_image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">📦</span>
              )}
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">{order.product_name || order.sku || 'Your Order'}</h1>
              <p className="text-sm text-gray-500">Please review your proof below</p>
            </div>
          </div>
        </div>

        {/* Proof Images */}
        {latestVersion ? (
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            {latestVersion.staff_note && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                <span className="font-medium">Note from our team:</span> {latestVersion.staff_note}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {latestVersion.proof_files.map(file => (
                <div
                  key={file.id}
                  className="aspect-square bg-gray-50 rounded-lg overflow-hidden cursor-pointer border border-gray-200 hover:border-gray-300 transition-colors"
                  onClick={() => file.mime_type?.startsWith('image/') && setLightbox(file.preview_path)}
                >
                  {file.mime_type?.startsWith('image/') ? (
                    <img src={file.preview_path} alt={file.filename} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <span className="text-4xl mb-2">📄</span>
                      <span className="text-sm text-gray-500">{file.filename}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">Click image to enlarge</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center mb-6">
            <div className="text-4xl mb-2">⏳</div>
            <p className="text-gray-600 font-medium">Your proof is being prepared</p>
            <p className="text-sm text-gray-500 mt-1">We&apos;ll send you an email when it&apos;s ready for review.</p>
          </div>
        )}

        {/* Decision Section */}
        {latestVersion && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-4">Your Decision</h2>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <button
                onClick={() => setDecision('approved')}
                disabled={submitting}
                className={`p-4 rounded-lg border-2 text-left transition-all disabled:opacity-50 ${
                  decision === 'approved' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">✅</div>
                <div className="font-medium text-gray-900">Approve</div>
                <div className="text-xs text-gray-500">Looks great, proceed</div>
              </button>

              <button
                onClick={() => setDecision('approved_with_notes')}
                disabled={submitting}
                className={`p-4 rounded-lg border-2 text-left transition-all disabled:opacity-50 ${
                  decision === 'approved_with_notes' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">📝</div>
                <div className="font-medium text-gray-900">Approve with Notes</div>
                <div className="text-xs text-gray-500">Minor feedback for future</div>
              </button>

              <button
                onClick={() => setDecision('changes_requested')}
                disabled={submitting}
                className={`p-4 rounded-lg border-2 text-left transition-all disabled:opacity-50 ${
                  decision === 'changes_requested' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">🔄</div>
                <div className="font-medium text-gray-900">Request Changes</div>
                <div className="text-xs text-gray-500">Need revisions</div>
              </button>
            </div>

            {(decision === 'approved_with_notes' || decision === 'changes_requested') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {decision === 'changes_requested' ? 'What changes do you need?' : 'Any notes for our team?'}
                  {decision === 'changes_requested' && <span className="text-red-500"> *</span>}
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  disabled={submitting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder={decision === 'changes_requested' ? 'Please describe the changes needed...' : 'Optional notes...'}
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!decision || submitting || (decision === 'changes_requested' && !notes.trim())}
              className="w-full py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: accentColor }}
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                'Submit Decision'
              )}
            </button>
            
            <p className="text-xs text-gray-400 text-center mt-3">
              This action cannot be undone. Please review carefully before submitting.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-gray-400">
        Powered by {companyName}
      </footer>
    </div>
  );
}
