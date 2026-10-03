import { describe, it, expect } from 'vitest';
import { extractVerificationCode } from '../src/utils/regex.js';

describe('extractVerificationCode', () => {
  it('extracts Chinese verification codes', () => {
    expect(extractVerificationCode('您的验证码是 849201，请在 10 分钟内完成验证。', '账号安全通知')).toBe('849201');
    expect(extractVerificationCode('登录校验码：592837', '')).toBe('592837');
    expect(extractVerificationCode('本次动态码为 4920，切勿泄露给他人。', '')).toBe('4920');
  });

  it('extracts English verification codes', () => {
    expect(extractVerificationCode('Your verification code is: 739102. It expires in 15 minutes.', 'Verify your email')).toBe('739102');
    expect(extractVerificationCode('Use security code 928341 to sign in to your GitHub account.', '[GitHub] Please verify your device')).toBe('928341');
    expect(extractVerificationCode('Your confirmation code is 849210.', '')).toBe('849210');
  });

  it('extracts OTP and passcodes', () => {
    expect(extractVerificationCode('Your one-time passcode is 392817.', 'Login')).toBe('392817');
    expect(extractVerificationCode('Your OTP: 123456', '')).toBe('123456');
  });

  it('handles alphanumeric codes', () => {
    expect(extractVerificationCode('Your access code is AB829C.', '')).toBe('AB829C');
  });

  it('returns empty string when no code is present', () => {
    expect(extractVerificationCode('Hello, welcome to our newsletter! Have a great day.', 'Weekly Digest')).toBe('');
    expect(extractVerificationCode('', '')).toBe('');
  });
});
