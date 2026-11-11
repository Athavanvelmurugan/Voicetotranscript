import React from 'react';
import { AuthPage } from './AuthPage';

export function SignupClinicPage({ onNavigateLogin }) {
  return (
    <AuthPage
      initialView="register"
      onViewChange={(view) => {
        if (view === 'login' && onNavigateLogin) {
          onNavigateLogin();
        }
      }}
    />
  );
}
