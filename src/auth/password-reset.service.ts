import { BadRequestException } from "../common/exceptions/http.exceptions";
import { PrismaService } from "../common/context/prisma.service";
import * as bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { MailerService } from "@nestjs-modules/mailer";
import { Injectable } from "@nestjs/common";

@Injectable()
export class PasswordResetService {
  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
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
    subject: string;
    template: string;
    context: Record<string, unknown>;
    tokenId: string;
  }): Promise<void> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.mailerService.sendMail({
          to: params.email,
          subject: params.subject,
          template: params.template,
          context: params.context,
        });

        return;
      } catch (error) {
        const lastError = this.getErrorMessage(error);

        if (attempt === maxAttempts) {
          console.error(
            "Password reset email failed after retries:",
            lastError,
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
      subject: "Password Reset OTP",
      template: "./verification",
      context: {
        name: user.fullName,
        otp: token,
      },
      tokenId: verification.id,
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
