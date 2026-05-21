import { BadRequestException } from "../common/exceptions/http.exceptions";
import { PrismaService } from "../common/context/prisma.service";
import * as bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { MailtrapService } from "../mail/mailtrap.service";
import { Injectable } from "@nestjs/common";

@Injectable()
export class PasswordResetService {
  constructor(
    private prisma: PrismaService,
    private mailtrapService: MailtrapService,
  ) {}

  // Helper: generate 6-digit numeric OTP
  private generateOTP(): string {
    return "" + randomInt(100000, 999999);
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async sendOtpEmailWithRetry(params: {
    email: string;
    otp: string;
    userName?: string;
  }): Promise<void> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.mailtrapService.sendPasswordResetEmail({
          to: params.email,
          otp: params.otp,
          userName: params.userName,
        });

        return;
      } catch (error) {
        const lastError = this.getErrorMessage(error);

        if (attempt === maxAttempts) {
          console.error(
            "Password reset email failed after retries:",
            lastError,
            error instanceof Error ? error.stack : undefined,
          );
          throw new Error(
            `Password reset email failed after ${maxAttempts} attempts: ${lastError}`,
          );
        }
      }
    }
  }

  // Password reset request
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException("User not found");

    const token = this.generateOTP();
    const verification = await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        token,
        type: "password_reset",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await this.sendOtpEmailWithRetry({
      email,
      otp: token,
      userName: user.fullName || undefined,
    });

    return { message: "Password reset OTP sent." };
  }

  // Reset password
  async resetPassword(token: string, newPassword: string) {
    const verification = await this.prisma.verificationToken.findFirst({
      where: { token, used: false },
    });

    if (!verification || verification.type !== "password_reset")
      throw new BadRequestException("Invalid OTP");

    if (verification.expiresAt < new Date())
      throw new BadRequestException("OTP expired");

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: verification.userId },
      data: { password: hashedPassword },
    });

    await this.prisma.verificationToken.update({
      where: { id: verification.id },
      data: { used: true },
    });

    return { message: "Password reset successfully." };
  }
}
