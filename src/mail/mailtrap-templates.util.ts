export function buildOtpEmailContent(params: {
  to: string;
  otp: string;
  userName?: string;
}) {
  const name = params.userName || params.to;
  const html = `
      <h1>Email Verification</h1>
      <p>Hello ${name},</p>
      <p>Your OTP code is: <strong>${params.otp}</strong></p>
      <p>This code will expire in 5 minutes.</p>
    `;

  const text = `Your OTP code is: ${params.otp}. This code will expire in 5 minutes.`;

  return { html, text };
}

export function buildPasswordResetEmailContent(params: {
  to: string;
  otp: string;
  userName?: string;
}) {
  const name = params.userName || params.to;
  const html = `
      <h1>Password Reset Request</h1>
      <p>Hello ${name},</p>
      <p>Your password reset OTP code is: <strong>${params.otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `;

  const text = `Your password reset OTP code is: ${params.otp}. This code will expire in 10 minutes.`;

  return { html, text };
}

export function extractOtpFromText(value: string): string {
  const match = value.match(/\b\d{6}\b/);
  return match ? match[0] : "unknown";
}
