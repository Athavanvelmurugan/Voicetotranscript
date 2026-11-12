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
        <span className="tab-status-chip--awaiting">
          Awaiting
        </span>
      );
    }

    switch (doc.status) {
      case 'approved':
        return (
          <span className="badge badge-success badge-compact">
            <CheckCircle2 size={10} /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="badge badge-danger badge-compact">
            <XCircle size={10} /> Rejected
          </span>
        );
      case 'needs_review':
        return (
          <span className="badge badge-warning badge-compact">
            <AlertTriangle size={10} /> Edited
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="badge badge-info badge-compact">
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
