import {
  //   UnauthorizedException,
  BadRequestException,
} from "../../common/exceptions/http.exceptions";
import { PrismaService } from "../../common/context/prisma.service";
import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { randomInt } from "crypto";
import { RegisterDto } from "./dto/register.dto";
import { MailtrapService } from "../../mail/mailtrap.service";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";

@Injectable()
export class RegistrationService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailtrapService: MailtrapService,
    private configService: ConfigService,
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
  }): Promise<boolean> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await this.mailtrapService.sendOtpEmail({
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
        const lastError = this.getErrorMessage(error);

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
    const tokenHash = await bcrypt.hash(token, 10);
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: "email_verification",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await this.sendOtpEmailWithRetry({
      email,
      otp: token,
      userName: email,
    });

    return {
      message: "User registered. Check your email for OTP.",
      otpFallback: true,
    };
  }

  // Verify email
  async verifyEmail(token: string) {
    // Since tokenHash is stored, we cannot query by plaintext token.
    // Fetch recent unused tokens for 'email_verification' and compare hashes.
    const candidates = await this.prisma.verificationToken.findMany({
      where: {
        type: "email_verification",
        used: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const verification = await (async () => {
      for (const cand of candidates) {
        const tokenHash = cand.tokenHash;
        const match = await bcrypt.compare(token, tokenHash);
        if (match) return cand;
      }
      return null;
    })();

    if (!verification || verification.type !== "email_verification")
      throw new BadRequestException("Invalid OTP");

    if (verification.expiresAt < new Date())
      throw new BadRequestException("OTP expired");

    // ✅ Get user first
    const user = await this.prisma.user.findUnique({
      where: { id: verification.userId },
    });

    if (!user) throw new BadRequestException("User not found");

    const { company, workspace } = await this.prisma.$transaction(
      async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: { isVerified: true },
        });

        await tx.verificationToken.update({
          where: { id: verification.id },
          data: { used: true },
        });

        let companyRecord = await tx.company.findFirst({
          where: { ownerId: updatedUser.id },
        });

        if (!companyRecord) {
          companyRecord = await tx.company.create({
            data: {
              ownerId: updatedUser.id,
              name: updatedUser.email.split("@")[0] || updatedUser.email,
              status: "active",
            },
          });
        }

        let workspaceRecord = await tx.workspace.findFirst({
          where: { companyId: companyRecord.id },
        });

        if (!workspaceRecord) {
          workspaceRecord = await tx.workspace.create({
            data: {
              companyId: companyRecord.id,
              name: "Default Workspace",
              timezone: "UTC",
              queueConfig: {
                fetchFrequencyHours: 24,
                postingTimes: ["09:00"],
              },
            },
          });
        }

        await tx.workspaceMember.create({
          data: {
            workspaceId: workspaceRecord.id,
            userId: updatedUser.id,
            role: "owner",
          },
        });

        return {
          company: companyRecord,
          workspace: workspaceRecord,
        };
      },
    );

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
      company,
      workspace,
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
    const tokenHash = await bcrypt.hash(token, 10);
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: "email_verification",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // OTP 5 min valid
      },
    });

    await this.sendOtpEmailWithRetry({
      email,
      otp: token,
      userName: user.fullName || undefined,
    });

    return {
      message: "OTP resent. Check your email.",
      otpFallback: true,
    };
  }
}
