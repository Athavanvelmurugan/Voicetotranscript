import React, { useState, useEffect } from 'react';
import { DocumentTabs } from './DocumentTabs';
import { DocumentEditor } from './DocumentEditor';
import { ApprovalActions } from './ApprovalActions';
import { VersionHistoryModal } from './VersionHistoryModal';
import { Sparkles, AlertCircle, CheckCircle, FileText, Loader2 } from 'lucide-react';

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
        headers: { 'Content-Type': 'application/json', 'x-doctor-id': String(activeDoctorId) },
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
        headers: { 'x-doctor-id': String(activeDoctorId) },
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
        headers: { 'Content-Type': 'application/json', 'x-doctor-id': String(activeDoctorId) },
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
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem' }}>
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </div>
        )}

        {documents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '70px 20px', maxWidth: '480px', margin: '0 auto' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: '#f0f9ff', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px auto' }}>
              <Sparkles size={28} color="#0284c7" />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 750, color: '#0f172a', marginBottom: '8px' }}>
              Consultation Transcribed — Awaiting Synthesis
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.86rem', lineHeight: 1.55, marginBottom: '22px' }}>
              Audio dialogue has been transcribed via Whisper Large V3. Click below to synthesize the clinical summary, prescription orders, and laboratory investigations for veterinarian review and sign-off.
            </p>
            <button
              className="btn btn-primary"
              disabled={isGenerating}
              onClick={onTriggerGenerate}
              style={{ padding: '9px 20px', fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
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
              <div className="doc-title-box">
                <h2>{activeDoc ? activeDoc.content?.title || activeTab.toUpperCase() : 'Document Draft'}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Status: <strong style={{ color: '#0f172a' }}>{activeDoc?.status.toUpperCase()}</strong>
                  </span>
                  <span>•</span>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'ui-monospace, monospace' }}>
                    Version #{activeDoc?.current_version || 1}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onTriggerGenerate}
                  disabled={isGenerating}
                  style={{ fontSize: '0.80rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  title="Re-run clinical extraction from consultation transcripts to update all 5 templates"
                >
                  <Sparkles size={13} color="#0284c7" />
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
              <div style={{ marginTop: '24px', padding: '16px 20px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontWeight: 750, color: '#065f46', fontSize: '0.92rem' }}>Ready to Finalize Consultation?</div>
                  <div style={{ fontSize: '0.82rem', color: '#047857', marginTop: '2px' }}>All clinical documents have been drafted by AI scribe. You can review, sign, and complete.</div>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ background: '#059669', borderColor: '#059669', padding: '7px 16px', fontSize: '0.84rem' }}
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Reject Clinical Document Draft</h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '14px', lineHeight: 1.5 }}>
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
              <button className="btn btn-outline" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button
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
