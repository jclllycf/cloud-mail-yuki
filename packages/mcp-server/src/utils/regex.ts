/**
 * Lightweight deterministic verification code extractor for email text.
 * Used as a zero-cost fallback when D1 email.code is empty.
 */
export function extractVerificationCode(text: string, subject: string = ''): string {
  const combined = `${subject}\n\n${text}`;
  if (!combined.trim()) return '';

  const patterns = [
    // Chinese patterns: 验证码是 123456 / 动态验证码：1234
    /(?:验证码|校验码|动态码|确认码)[^\w\d\n]{0,10}(?:是|为|:)?\s*([0-9A-Za-z]{4,8})\b/i,
    // English patterns: verification code: 123456 / Your code is 123456
    /(?:verification|security|confirmation|validation|login|access)\s*code[^\w\d\n]{0,10}(?:is|:)?\s*([0-9A-Za-z]{4,8})\b/i,
    // OTP / Passcode: OTP is 123456 / One-time code: 123456
    /(?:one-time\s*(?:passcode|password|code)|otp|passcode)[^\w\d\n]{0,10}(?:is|:)?\s*([0-9A-Za-z]{4,8})\b/i,
    // Enter the following code: 123456
    /(?:enter|use)\s+(?:the\s+)?(?:code|passcode)[^\w\d\n]{0,10}(?:is|:)?\s*([0-9A-Za-z]{4,8})\b/i,
  ];

  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Avoid false positives like "http", "2026", "October"
      if (!/^(https?|year|date|time)$/i.test(candidate)) {
        return candidate;
      }
    }
  }

  // Fallback: If text explicitly talks about verification code and has an isolated 6-digit number
  if (/(?:code|验证码|校验码|otp)/i.test(combined)) {
    const digitMatch = combined.match(/\b([0-9]{6})\b/);
    if (digitMatch && digitMatch[1]) {
      return digitMatch[1];
    }
  }

  return '';
}
