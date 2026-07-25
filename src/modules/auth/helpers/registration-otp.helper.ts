import { randomInt } from "crypto";
import * as bcrypt from "bcryptjs";
import { MailtrapService } from "../../../mail/mailtrap.service";

export function generateOTP(): string {
  return "" + randomInt(100000, 999999);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function findMatchingVerificationToken(
  prisma: any,
  token: string,
) {
  const candidates = await prisma.verificationToken.findMany({
    where: {
      type: "email_verification",
      used: false,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  for (const cand of candidates) {
    const match = await bcrypt.compare(token, cand.tokenHash);
    if (match) return cand;
  }
  return null;
}

export async function sendOtpEmailWithRetry(
  mailtrapService: MailtrapService,
  params: {
    email: string;
    otp: string;
    userName?: string;
  },
): Promise<boolean> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await mailtrapService.sendOtpEmail({
        to: params.email,
        otp: params.otp,
        userName: params.userName,
      });

      if (result) {
        return true;
      }

      if (attempt === maxAttempts) {
        console.warn(
          `=== [LOCAL TESTING OTP FALLBACK] Code for ${params.email} is: ${params.otp} ===`,
        );
        return false;
      }
    } catch (error) {
      const lastError = getErrorMessage(error);

      if (attempt === maxAttempts) {
        console.warn(
          `=== [LOCAL TESTING OTP FALLBACK] Code for ${params.email} is: ${params.otp} ===`,
        );
        console.error(
          "OTP email delivery failed after retries:",
          lastError,
          error instanceof Error ? error.stack : undefined,
        );
        return false;
      }
    }
  }

  return false;
}
