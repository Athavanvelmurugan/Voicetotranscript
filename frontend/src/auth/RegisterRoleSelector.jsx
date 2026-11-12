import React from 'react';
import { Building2, Stethoscope, Heart, ArrowRight } from 'lucide-react';

const ACCOUNT_OPTIONS = [
  {
    key: 'hospital',
    title: 'Register as Hospital',
    description: 'Create a veterinary hospital workspace, submit accreditation details for approval, and invite doctors & staff.',
    icon: Building2,
  },
  {
    key: 'doctor',
    title: 'Register as Doctor',
    description: 'Practice independently with your own workspace, or request to join an accredited veterinary hospital.',
    icon: Stethoscope,
  },
  {
    key: 'pet_owner',
    title: 'Register as Pet Owner',
    description: 'Create pet profiles, discover registered hospitals & independent doctors, and book appointments anywhere.',
    icon: Heart,
  },
];

export function RegisterRoleSelector({ onSelectRole, onSwitchToLogin }) {
  return (
    <div className="auth-clean-form">
      <div className="auth-role-grid" role="list" aria-label="Choose your account type">
        {ACCOUNT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              type="button"
              className="auth-role-card"
              onClick={() => onSelectRole(opt.key)}
              data-testid={`role-option-${opt.key}`}
            >
              <span className="auth-role-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <span className="auth-role-body">
                <span className="auth-role-title">{opt.title}</span>
                <span className="auth-role-desc">{opt.description}</span>
              </span>
              <ArrowRight size={18} className="auth-input-lead-icon" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="auth-bottom-switch">
        <span>Already have a PetCare AI account? </span>
        <button
          type="button"
          className="auth-link-btn"
          onClick={onSwitchToLogin}
        >
          Sign In Here
        </button>
      </div>
    </div>
  );
}

