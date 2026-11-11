import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
  validateClinicName,
  validateClinicSlug,
  validateLicenseNumber,
  validateOtp,
  generateSlug,
} from './validation.js';

describe('Frontend Input Validation Tests (Mandatory Rules)', () => {
  it('validates email addresses properly', () => {
    assert.strictEqual(validateEmail('').isValid, false);
    assert.strictEqual(validateEmail('invalid-email').isValid, false);
    assert.strictEqual(validateEmail('doctor@').isValid, false);
    assert.strictEqual(validateEmail('doctor@vetclinic').isValid, false);
    assert.strictEqual(validateEmail('doctor@vetclinic.com').isValid, true);
    assert.strictEqual(validateEmail('  doctor.maya@hospital.org  ').isValid, true);
  });

  it('validates mobile phone numbers properly', () => {
    assert.strictEqual(validatePhone('').isValid, false);
    assert.strictEqual(validatePhone('123').isValid, false);
    assert.strictEqual(validatePhone('abcdefghij').isValid, false);
    assert.strictEqual(validatePhone('9876543210').isValid, true);
    assert.strictEqual(validatePhone('+91 98765 43210').isValid, true);
    assert.strictEqual(validatePhone('98765-43210').isValid, true);
  });

  it('validates passwords with minimum 10 characters and complexity rules', () => {
    assert.strictEqual(validatePassword('').isValid, false);
    assert.strictEqual(validatePassword('short').isValid, false);
    assert.strictEqual(validatePassword('nouppercase123!').isValid, false);
    assert.strictEqual(validatePassword('NOLOWERCASE123!').isValid, false);
    assert.strictEqual(validatePassword('NoNumberOrSpecial').isValid, false);
    assert.strictEqual(validatePassword('ValidPass123!').isValid, true);
    assert.strictEqual(validatePassword('Password123!').isValid, true);
  });

  it('validates password confirmation match', () => {
    assert.strictEqual(validateConfirmPassword('Pass123456!', '').isValid, false);
    assert.strictEqual(validateConfirmPassword('Pass123456!', 'Different123!').isValid, false);
    assert.strictEqual(validateConfirmPassword('Pass123456!', 'Pass123456!').isValid, true);
  });

  it('validates clinic names and auto-generates slugs', () => {
    assert.strictEqual(validateClinicName('').isValid, false);
    assert.strictEqual(validateClinicName('AB').isValid, false);
    assert.strictEqual(validateClinicName('Central Valley Animal Hospital').isValid, true);

    const slug = generateSlug('Central Valley Animal Hospital');
    assert.strictEqual(slug, 'central-valley-animal-hospital');
    assert.strictEqual(validateClinicSlug(slug).isValid, true);

    assert.strictEqual(validateClinicSlug('UPPERCASE').isValid, false);
    assert.strictEqual(validateClinicSlug('with spaces').isValid, false);
    assert.strictEqual(validateClinicSlug('special$character').isValid, false);
  });

  it('validates veterinary license numbers', () => {
    assert.strictEqual(validateLicenseNumber('').isValid, false);
    assert.strictEqual(validateLicenseNumber('VET-REG-2026-9812').isValid, true);
  });

  it('validates OTP codes including staging formats (123456 and 1,2,3,4,5,6)', () => {
    assert.strictEqual(validateOtp('').isValid, false);
    assert.strictEqual(validateOtp('123').isValid, false);
    assert.strictEqual(validateOtp('123456').isValid, true);
    assert.strictEqual(validateOtp('1,2,3,4,5,6').isValid, true);
    assert.strictEqual(validateOtp('1 2 3 4 5 6').isValid, true);
    assert.strictEqual(validateOtp('1-2-3-4-5-6').isValid, true);
  });
});

