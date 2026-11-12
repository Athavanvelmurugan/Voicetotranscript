import React, { useState, useEffect } from 'react';
import { DocumentTabs } from './DocumentTabs';
import { DocumentEditor } from './DocumentEditor';
import { ApprovalActions } from './ApprovalActions';
import { VersionHistoryModal } from './VersionHistoryModal';
import { Sparkles, AlertCircle, CheckCircle, FileText, Loader2, Lock } from 'lucide-react';

export function DocumentsPanel({
  documents,
  onRefreshDocuments,
  consultationId,
  onTriggerGenerate,
  onCompleteConsultation,
  consultationStatus,
  isGenerating,
  activeDoctorId = 1,
}) {
  const [activeTab, setActiveTab] = useState('summary');
  const [formData, setFormData] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState(null);

  const activeDoc = documents.find((d) => d.doc_type === activeTab);

  useEffect(() => {
    if (activeDoc) {
      setFormData(JSON.parse(JSON.stringify(activeDoc.content)));
      setIsDirty(false);
      setActionError(null);
    } else {
      setFormData(null);
    }
  }, [activeDoc, activeTab]);

  const handleChangeField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!activeDoc) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/documents/${activeDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: formData,
          doctorNotes: 'Doctor updated document draft via clinical editor',
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setIsDirty(false);
      if (onRefreshDocuments) onRefreshDocuments();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!activeDoc) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/documents/${activeDoc.id}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      if (onRefreshDocuments) onRefreshDocuments();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!activeDoc || !rejectReason.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/documents/${activeDoc.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setShowRejectModal(false);
      setRejectReason('');
      if (onRefreshDocuments) onRefreshDocuments();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="documents-panel">
      <DocumentTabs
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        documents={documents}
      />

      <div className="doc-content-container">
        {actionError && (
          <div className="doc-error-banner">
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </div>
        )}

        {documents.length === 0 ? (
          <div className="doc-empty-synthesis">
            <div className="doc-empty-icon-box">
              <Sparkles size={28} />
            </div>
            <h3 className="doc-empty-title">
              Consultation Transcribed — Awaiting Synthesis
            </h3>
            <p className="doc-empty-desc">
              Audio dialogue has been transcribed via Whisper Large V3. Click below to synthesize the clinical summary, prescription orders, and laboratory investigations for veterinarian review and sign-off.
            </p>
            <button
              type="button"
              className="btn btn-primary doc-empty-cta"
              disabled={isGenerating}
              onClick={onTriggerGenerate}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="spin-animate" />
                  <span>Synthesizing Clinical Insights...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Generate & Review Clinical Insights</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="doc-top-bar">
              <div className="doc-header-row">
                <div className="doc-title-box">
                  <h2>{activeDoc ? activeDoc.content?.title || activeTab.toUpperCase() : 'Document Draft'}</h2>
                  <div className="doc-title-meta">
                    <span>
                      Status: <strong className="doc-title-status-strong">{activeDoc?.status.toUpperCase()}</strong>
                    </span>
                    <span>•</span>
                    <span className="doc-title-version">
                      Version #{activeDoc?.current_version || 1}
                    </span>
                  </div>
                </div>

                {activeDoc?.status === 'approved' && (
                  <div className="badge badge-success doc-seal-badge">
                    <Lock size={13} /> Approved & Cryptographically Sealed
                  </div>
                )}
              </div>

              <div className="doc-action-toolbar">
                <button
                  type="button"
                  className="btn btn-outline doc-action-btn"
                  onClick={onTriggerGenerate}
                  disabled={isGenerating}
                  title="Re-run clinical extraction from consultation transcripts to update all 5 templates"
                >
                  <Sparkles size={13} className="icon-primary" />
                  <span>{isGenerating ? 'Extracting...' : 'Re-generate with AI'}</span>
                </button>

                <ApprovalActions
                  document={activeDoc}
                  isDirty={isDirty}
                  onSave={handleSave}
                  onApprove={handleApprove}
                  onOpenRejectModal={() => setShowRejectModal(true)}
                  onOpenHistory={() => setShowHistoryModal(true)}
                  isSubmitting={isSubmitting}
                />
              </div>
            </div>

            <DocumentEditor
              document={activeDoc}
              formData={formData}
              onChangeField={handleChangeField}
              isApproved={activeDoc?.status === 'approved'}
            />

            {/* Bottom Finalize & Complete Banner */}
            {documents.length > 0 && consultationStatus !== 'completed' && onCompleteConsultation && (
              <div className="doc-finalize-banner">
                <div>
                  <div className="doc-finalize-title">Ready to Finalize Consultation?</div>
                  <div className="doc-finalize-sub">All clinical documents have been drafted by AI scribe. You can review, sign, and complete.</div>
                </div>
                <button
                  type="button"
                  className="btn btn-success doc-finalize-btn"
                  onClick={onCompleteConsultation}
                >
                  <CheckCircle size={15} /> Finalize & Complete Consultation
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Version History Modal */}
      {activeDoc && (
        <VersionHistoryModal
          documentId={activeDoc.id}
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content consult-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="doc-reject-title">Reject Clinical Document Draft</h3>
            </div>
            <div className="modal-body">
              <p className="doc-reject-desc">
                Please provide a formal clinical reason for rejecting this document draft. This will be preserved in the legal audit log.
              </p>
              <textarea
                className="form-control"
                placeholder="E.g. Owner requested alternative oral suspension instead of tablets; dosage adjustment required."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={!rejectReason.trim() || isSubmitting}
                onClick={handleReject}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
