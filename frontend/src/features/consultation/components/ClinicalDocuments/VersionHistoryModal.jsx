import React, { useEffect, useState } from 'react';
import { X, History, CheckCircle, Edit3, Sparkles, XCircle } from 'lucide-react';

export function VersionHistoryModal({ documentId, isOpen, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && documentId) {
      setLoading(true);
      fetch(`/api/v1/documents/${documentId}/versions`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setVersions(data.data);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'approved':
        return <CheckCircle size={14} className="icon-success" />;
      case 'rejected':
        return <XCircle size={14} className="icon-danger" />;
      case 'doctor_edit':
        return <Edit3 size={14} className="icon-primary" />;
      default:
        return <Sparkles size={14} className="icon-secondary" />;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content consult-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <History size={18} className="icon-primary" />
            <span>Document Audit Version History</span>
          </div>
          <button
            type="button"
            className="modal-close-icon-btn"
            onClick={onClose}
            aria-label="Close version history modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {loading && <p className="version-empty-text">Loading version trail...</p>}
          {!loading && versions.length === 0 && <p className="version-empty-text">No version history available.</p>}

          <div className="version-list-stack">
            {versions.map((ver) => (
              <div
                key={ver.id || ver.version_number}
                className="version-card"
              >
                <div className="version-card-header">
                  <span className="version-card-title">
                    {getIcon(ver.change_type)}
                    Version #{ver.version_number}
                    <span className="version-card-type">
                      ({ver.change_type})
                    </span>
                  </span>
                  <span className="version-card-date">
                    {new Date(ver.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="version-card-summary">
                  {ver.change_summary || 'Document state snapshot'}
                </div>
                <div className="version-card-author">
                  Author: <strong>{ver.changed_by_name || 'System / Attending Doctor'}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

