import {
  //   UnauthorizedException,
  BadRequestException,
} from "../common/exceptions/http.exceptions";
import { PrismaService } from "../common/context/prisma.service";
import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { randomInt } from "crypto";
import { RegisterDto } from "./dto/register.dto";
import { MailtrapService } from "../mail/mailtrap.service";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

@Injectable()
export class RegistrationService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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
        await this.mailtrapService.sendOtpEmail({
          to: params.email,
          otp: params.otp,
          userName: params.userName,
        });

        return;
      } catch (error) {
        const lastError = this.getErrorMessage(error);

        if (attempt === maxAttempts) {
          console.error(
            "OTP email delivery failed after retries:",
            lastError,
            error instanceof Error ? error.stack : undefined,
          );
          throw new Error(
            `Email delivery failed after ${maxAttempts} attempts: ${lastError}`,
          );
        }
      }
    }
  }

  // Register user
  async register(data: RegisterDto) {
    const { email, password } = data;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException("Email already exists");

    const hashedPassword = await bcrypt.hash(password, 10);

    const createData: Prisma.UserCreateInput = {
      email,
      password: hashedPassword,
    };

    const user = await this.prisma.user.create({ data: createData });

    const token = this.generateOTP();
    const verification = await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        token,
        type: "email_verification",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await this.sendOtpEmailWithRetry({
      email,
      otp: token,
      userName: email,
    });

    return { message: "User registered. Check your email for OTP." };
  }

  // Verify email
  async verifyEmail(token: string) {
    const verification = await this.prisma.verificationToken.findFirst({
      where: { token, used: false },
    });

    if (!verification || verification.type !== "email_verification")
      throw new BadRequestException("Invalid OTP");

    if (verification.expiresAt < new Date())
      throw new BadRequestException("OTP expired");

    // ✅ Get user first
    const user = await this.prisma.user.findUnique({
      where: { id: verification.userId },
    });

    if (!user) throw new BadRequestException("User not found");

    // ✅ Mark verified
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });

    // ✅ Mark token used
    await this.prisma.verificationToken.update({
      where: { id: verification.id },
      data: { used: true },
    });

    // ✅ Generate JWT token (AUTO LOGIN)
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: "Email verified successfully",
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  // Resend OTP for email verification
  async resendOtp(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException("User not found");

    if (user.isVerified)
      throw new BadRequestException("Email already verified");

    // Invalidate existing unused email verification tokens
    await this.prisma.verificationToken.updateMany({
      where: {
        userId: user.id,
        type: "email_verification",
        used: false,
      },
      data: { used: true },
    });

    // Generate new OTP
    const token = this.generateOTP();
    const verification = await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        token,
        type: "email_verification",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // OTP 5 min valid
      },
    });

    await this.sendOtpEmailWithRetry({
      email,
      otp: token,
      userName: user.fullName || undefined,
    });

    return { message: "OTP resent. Check your email." };
  }
}
