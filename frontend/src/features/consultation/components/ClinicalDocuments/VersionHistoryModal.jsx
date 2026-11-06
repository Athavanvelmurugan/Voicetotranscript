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
        return <CheckCircle size={14} color="#10b981" />;
      case 'rejected':
        return <XCircle size={14} color="#ef4444" />;
      case 'doctor_edit':
        return <Edit3 size={14} color="#0284c7" />;
      default:
        return <Sparkles size={14} color="#8b5cf6" />;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
            <History size={18} color="#0284c7" />
            <span>Document Audit Version History</span>
          </div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {loading && <p style={{ color: '#64748b' }}>Loading version trail...</p>}
          {!loading && versions.length === 0 && <p style={{ color: '#64748b' }}>No version history available.</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {versions.map((ver) => (
              <div
                key={ver.id || ver.version_number}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  background: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.875rem' }}>
                    {getIcon(ver.change_type)}
                    Version #{ver.version_number}
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                      ({ver.change_type})
                    </span>
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {new Date(ver.created_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                  {ver.change_summary || 'Document state snapshot'}
                </div>
                <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '4px' }}>
                  Author: <strong>{ver.changed_by_name || 'System / Attending Doctor'}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

