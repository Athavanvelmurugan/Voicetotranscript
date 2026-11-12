import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Check initial session on app mount
  const checkSession = useCallback(async () => {
    try {
      const res = await apiClient('/api/v1/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.user) {
          setUser(data.data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (email, password) => {
    setAuthError(null);
    const res = await apiClient('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok && res.status !== 202) {
      const errorMsg = data.error || 'Login failed. Please check your credentials.';
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    }

    // MFA challenge requested
    if (res.status === 202 && data.mfaRequired) {
      return {
        mfaRequired: true,
        tempToken: data.tempToken,
        user: data.user,
      };
    }

    if (data.data?.user) {
      try {
        localStorage.removeItem('activeConsultationId');
        localStorage.removeItem('activeDoctorId');
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('activeConsultationId')) localStorage.removeItem(k);
        });
        const url = new URL(window.location.href);
        if (url.searchParams.has('consultationId')) {
          url.searchParams.delete('consultationId');
          window.history.replaceState({}, '', url.toString());
        }
      } catch (_) {}
      setUser(data.data.user);
    }
    return { mfaRequired: false, user: data.data.user };
  }, []);

  const verifyMfa = useCallback(async (tempToken, totpCode) => {
    setAuthError(null);
    const res = await apiClient('/api/v1/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ tempToken, totpCode }),
    });
    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.error || 'MFA verification failed. Please try again.';
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    }

    if (data.data?.user) {
      try {
        localStorage.removeItem('activeConsultationId');
        localStorage.removeItem('activeDoctorId');
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('activeConsultationId')) localStorage.removeItem(k);
        });
        const url = new URL(window.location.href);
        if (url.searchParams.has('consultationId')) {
          url.searchParams.delete('consultationId');
          window.history.replaceState({}, '', url.toString());
        }
      } catch (_) {}
      setUser(data.data.user);
    }
    return data.data.user;
  }, []);

  const registerClinic = useCallback(async (formData) => {
    setAuthError(null);
    const res = await apiClient('/api/v1/auth/register-clinic', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.error || 'Clinic registration failed. Please try again.';
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    }

    if (data.data?.user) {
      setUser(data.data.user);
    }
    return data.data.user;
  }, []);

  const postAuthJson = useCallback(async (endpoint, payload, fallbackMsg) => {
    setAuthError(null);
    const res = await apiClient(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      const errorMsg = data.error || fallbackMsg;
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    }
    if (data.data?.user) {
      setUser(data.data.user);
    }
    return data.data;
  }, []);

  const registerHospital = useCallback((formData) => {
    return postAuthJson('/api/v1/auth/register/hospital', formData, 'Hospital registration failed.');
  }, [postAuthJson]);

  const registerDoctor = useCallback((formData) => {
    return postAuthJson('/api/v1/auth/register/doctor', formData, 'Doctor registration failed.');
  }, [postAuthJson]);

  const registerPetOwner = useCallback((formData) => {
    return postAuthJson('/api/v1/auth/register/pet-owner', formData, 'Pet owner registration failed.');
  }, [postAuthJson]);

  const verifyEmail = useCallback((email, code) => {
    return postAuthJson('/api/v1/auth/verify-email', { email, code }, 'Email verification failed.');
  }, [postAuthJson]);

  const verifyMobile = useCallback((mobileNumber, code) => {
    return postAuthJson('/api/v1/auth/verify-mobile', { mobileNumber, code }, 'Mobile verification failed.');
  }, [postAuthJson]);

  const resendVerification = useCallback((channel, identifier) => {
    return postAuthJson('/api/v1/auth/resend-verification', { channel, identifier }, 'Failed to resend code.');
  }, [postAuthJson]);

  const forgotPassword = useCallback((email) => {
    return postAuthJson('/api/v1/auth/forgot-password', { email }, 'Unable to send reset link.');
  }, [postAuthJson]);

  const resetPassword = useCallback((token, newPassword, confirmPassword) => {
    return postAuthJson('/api/v1/auth/reset-password', { token, newPassword, confirmPassword }, 'Failed to reset password.');
  }, [postAuthJson]);

  const switchPractice = useCallback(async (practiceId) => {
    const res = await apiClient('/api/v1/auth/switch-practice', {
      method: 'POST',
      body: JSON.stringify({ practiceId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to switch practice workspace.');
    }
    try {
      localStorage.removeItem('activeConsultationId');
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('activeConsultationId')) localStorage.removeItem(k);
      });
    } catch (_) {}
    if (data.data?.user) {
      setUser(data.data.user);
    }
    return data.data?.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient('/api/v1/auth/logout', { method: 'POST' });
    } catch (_) {}
    try {
      localStorage.removeItem('activeConsultationId');
      localStorage.removeItem('activeDoctorId');
      localStorage.removeItem('petcare_owner_session');
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('activeConsultationId')) localStorage.removeItem(k);
      });
      const url = new URL(window.location.href);
      if (url.searchParams.has('consultationId')) {
        url.searchParams.delete('consultationId');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (_) {}
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    authError,
    login,
    verifyMfa,
    registerClinic,
    registerHospital,
    registerDoctor,
    registerPetOwner,
    verifyEmail,
    verifyMobile,
    resendVerification,
    forgotPassword,
    resetPassword,
    switchPractice,
    logout,
    checkSession,
    isAuthenticated: !!user,
    isDoctor: user?.role === 'doctor' || user?.role === 'veterinarian',
    isAdmin: user?.role === 'clinic_admin' || user?.role === 'super_admin',
    isPetOwner: user?.role === 'pet_owner',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

