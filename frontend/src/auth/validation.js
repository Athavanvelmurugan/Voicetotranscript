/**
 * Mandatory Frontend Input Validation Library
 * Provides synchronous validation with user-friendly error messages.
 */

// Email RFC standard validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

// Mobile phone number regex (10-digit standard or E.164 international)
const PHONE_10_DIGIT_REGEX = /^[6-9]\d{9}$/;
const PHONE_INTERNATIONAL_REGEX = /^\+?[1-9]\d{8,14}$/;

// Clinic slug regex: lowercase alphanumeric + hyphens, no consecutive hyphens
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateEmail(email) {
  if (!email || !email.trim()) {
    return { isValid: false, error: 'Email address is required.' };
  }
  const clean = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(clean)) {
    return { isValid: false, error: 'Please enter a valid email address (e.g. doctor@vetclinic.com).' };
  }
  return { isValid: true, error: '' };
}

export function validatePhone(phone) {
  if (!phone || !phone.trim()) {
    return { isValid: false, error: 'Phone number is required.' };
  }
  // Remove spaces, hyphens, and parentheses
  const clean = phone.replace(/[\s\-\(\)]/g, '');
  if (!PHONE_10_DIGIT_REGEX.test(clean) && !PHONE_INTERNATIONAL_REGEX.test(clean)) {
    return { isValid: false, error: 'Please enter a valid 10-digit mobile number.' };
  }
  return { isValid: true, error: '' };
}

export function validatePassword(password) {
  if (!password) {
    return { isValid: false, error: 'Password is required.' };
  }
  if (password.length < 10) {
    return { isValid: false, error: 'Password must be at least 10 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one number or special character.' };
  }
  return { isValid: true, error: '' };
}

export function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) {
    return { isValid: false, error: 'Please confirm your password.' };
  }
  if (password !== confirmPassword) {
    return { isValid: false, error: 'Passwords do not match.' };
  }
  return { isValid: true, error: '' };
}

export function validateClinicName(name) {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Clinic name is required.' };
  }
  if (name.trim().length < 3 || name.trim().length > 100) {
    return { isValid: false, error: 'Clinic name must be between 3 and 100 characters.' };
  }
  return { isValid: true, error: '' };
}

export function generateSlug(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

export function validateClinicSlug(slug) {
  if (!slug || !slug.trim()) {
    return { isValid: false, error: 'Clinic URL slug is required.' };
  }
  const clean = slug.trim();
  if (clean.length < 3 || clean.length > 50) {
    return { isValid: false, error: 'Slug must be between 3 and 50 characters.' };
  }
  if (!SLUG_REGEX.test(clean)) {
    return { isValid: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens (e.g. central-valley).' };
  }
  return { isValid: true, error: '' };
}

export function validateLicenseNumber(license) {
  if (!license || !license.trim()) {
    return { isValid: false, error: 'Veterinary license number is required.' };
  }
  const clean = license.trim();
  if (clean.length < 3 || clean.length > 50) {
    return { isValid: false, error: 'License number must be between 3 and 50 characters.' };
  }
  return { isValid: true, error: '' };
}

export function validateOtp(otp) {
  if (!otp) {
    return { isValid: false, error: 'Verification code is required.' };
  }
  // Sanitize spaces, dashes, commas
  const clean = String(otp).replace(/[\s,-]/g, '');
  if (!/^\d{6}$/.test(clean)) {
    return { isValid: false, error: 'Please enter a valid 6-digit code (e.g. 123456).' };
  }
  return { isValid: true, error: '' };
}
