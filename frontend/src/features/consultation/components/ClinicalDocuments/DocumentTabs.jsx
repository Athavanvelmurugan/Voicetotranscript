import React from 'react';
import { Pill, FlaskConical, FileText, CalendarCheck, ClipboardList, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';

const TABS = [
  { key: 'summary', label: 'Summary', icon: ClipboardList },
  { key: 'prescription', label: 'Prescription', icon: Pill },
  { key: 'lab_tests', label: 'Lab Tests', icon: FlaskConical },
];

export function DocumentTabs({ activeTab, onSelectTab, documents }) {
  const getDocStatusBadge = (docType) => {
    const doc = documents.find((d) => d.doc_type === docType);
    if (!doc) {
      return (
        <span style={{ fontSize: '0.68rem', color: '#94a3b8', background: '#f1f5f9', padding: '1px 6px', borderRadius: '9999px', fontWeight: 600 }}>
          Awaiting
        </span>
      );
    }

    switch (doc.status) {
      case 'approved':
        return (
          <span className="badge badge-success" style={{ padding: '2px 7px', fontSize: '0.65rem' }}>
            <CheckCircle2 size={10} /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="badge badge-danger" style={{ padding: '2px 7px', fontSize: '0.65rem' }}>
            <XCircle size={10} /> Rejected
          </span>
        );
      case 'needs_review':
        return (
          <span className="badge badge-warning" style={{ padding: '2px 7px', fontSize: '0.65rem' }}>
            <AlertTriangle size={10} /> Edited
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="badge badge-info" style={{ padding: '2px 7px', fontSize: '0.65rem' }}>
            <Clock size={10} /> Draft
          </span>
        );
    }
  };

  return (
    <div className="tabs-header">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            className={`tab-button ${isActive ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.key)}
          >
            <Icon size={15} />
            <span>{tab.label}</span>
            {getDocStatusBadge(tab.key)}
          </button>
        );
      })}
    </div>
  );
}
