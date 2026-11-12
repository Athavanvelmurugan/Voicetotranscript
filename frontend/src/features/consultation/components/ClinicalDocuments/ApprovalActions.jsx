import React, { useState } from 'react';
import { Check, X, Save, History, Mail, Download, CheckCircle2, Loader2 } from 'lucide-react';

export function ApprovalActions({
  document,
  isDirty,
  onSave,
  onApprove,
  onOpenRejectModal,
  onOpenHistory,
  isSubmitting,
}) {
  const [sendingToOwner, setSendingToOwner] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!document) return null;

  const isApproved = document.status === 'approved';

  const handleSendToOwner = async () => {
    setSendingToOwner(true);
    setSendSuccess(false);
    try {
      const res = await fetch(`/api/v1/documents/${document.id}/send-to-owner`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch document to pet guardian');
      }
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 4000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingToOwner(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/v1/documents/${document.id}/download-pdf`);
      if (!res.ok) throw new Error('Failed to download signed PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `Signed_${document.doc_type}_${document.id}.pdf`;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-outline doc-action-btn"
        onClick={onOpenHistory}
        title="View audit version history"
      >
        <History size={14} /> v{document.current_version} History
      </button>

      {isApproved ? (
        <>
          <button
            type="button"
            className="btn btn-outline doc-action-btn"
            onClick={handleDownloadPdf}
            disabled={downloading}
            title="Download vector PDF with embedded QR verification"
          >
            {downloading ? <Loader2 size={14} className="spin-animate" /> : <Download size={14} />}
            <span>{downloading ? 'Preparing PDF...' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary doc-action-btn"
            onClick={handleSendToOwner}
            disabled={sendingToOwner}
            title="Send signed document link to pet guardian via email"
          >
            {sendingToOwner ? (
              <Loader2 size={14} className="spin-animate" />
            ) : sendSuccess ? (
              <CheckCircle2 size={14} />
            ) : (
              <Mail size={14} />
            )}
            <span>{sendingToOwner ? 'Dispatching...' : sendSuccess ? 'Sent via Email!' : 'Send to Guardian'}</span>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-outline doc-action-btn"
            disabled={!isDirty || isSubmitting}
            onClick={onSave}
          >
            <Save size={14} /> Save Draft
          </button>

          <button
            type="button"
            className="btn btn-danger doc-action-btn"
            disabled={isSubmitting}
            onClick={onOpenRejectModal}
          >
            <X size={14} /> Reject
          </button>

          <button
            type="button"
            className="btn btn-primary doc-action-btn"
            disabled={isSubmitting}
            onClick={onApprove}
          >
            <Check size={14} /> Approve & Sign
          </button>
        </>
      )}
    </>
  );
}

