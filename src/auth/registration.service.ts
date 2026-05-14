import {
  //   UnauthorizedException,
  BadRequestException,
} from "../common/exceptions/http.exceptions";
import { PrismaService } from "../common/context/prisma.service";
import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { randomInt } from "crypto";
import { RegisterDto } from "./dto/register.dto";
import { MailerService } from "@nestjs-modules/mailer";
import { Injectable } from "@nestjs/common";

@Injectable()
export class RegistrationService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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
          console.error("OTP email delivery failed after retries:", lastError);
        }
      }
    }
  }

  // Register user
  async register(data: RegisterDto) {
    const {
      fullName,
      email,
      phoneNumber,
      password,
      role,
      avatarKey,
      age,
      gender,
    } = data;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException("Email already exists");

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        fullName,
        email,
        phoneNumber,
        password: hashedPassword,
        role,
        avatarKey,
        age,
        gender,
      },
    });

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
      subject: "Welcome to Teams11!",
      template: "./verification",
      context: {
        name: fullName,
        otp: token,
      },
      tokenId: verification.id,
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
      subject: "Email Verification OTP - Teams11",
      template: "./verification",
      context: {
        name: user.fullName,
        otp: token,
      },
      tokenId: verification.id,
    });

    return { message: "OTP resent. Check your email." };
  }
}
