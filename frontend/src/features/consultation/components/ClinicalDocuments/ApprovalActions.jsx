import React from 'react';
import { Check, X, Save, History, Lock } from 'lucide-react';

export function ApprovalActions({
  document,
  isDirty,
  onSave,
  onApprove,
  onOpenRejectModal,
  onOpenHistory,
  isSubmitting,
}) {
  if (!document) return null;

  const isApproved = document.status === 'approved';

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button
        className="btn btn-outline"
        style={{ fontSize: '0.8rem' }}
        onClick={onOpenHistory}
        title="View audit version history"
      >
        <History size={14} /> v{document.current_version} History
      </button>

      {isApproved ? (
        <div className="badge badge-success" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
          <Lock size={14} /> Document Approved & Locked
        </div>
      ) : (
        <>
          <button
            className="btn btn-outline"
            disabled={!isDirty || isSubmitting}
            onClick={onSave}
          >
            <Save size={14} /> Save Draft
          </button>

          <button
            className="btn btn-danger"
            style={{ padding: '8px 12px' }}
            disabled={isSubmitting}
            onClick={onOpenRejectModal}
          >
            <X size={14} /> Reject
          </button>

          <button
            className="btn btn-primary"
            disabled={isSubmitting}
            onClick={onApprove}
          >
            <Check size={14} /> Approve & Sign
          </button>
        </>
      )}
    </div>
  );
}

