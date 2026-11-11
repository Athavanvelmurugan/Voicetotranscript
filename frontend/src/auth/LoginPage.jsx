import React from 'react';
import { AuthPage } from './AuthPage';

export function LoginPage({ onNavigateRegister }) {
  return (
    <AuthPage
      initialView="login"
      onViewChange={(view) => {
        if (view === 'register' && onNavigateRegister) {
          onNavigateRegister();
        }
      }}
    />
  );
}
