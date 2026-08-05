import { BadRequestException } from "../../common/exceptions/http.exceptions";
import { PrismaService } from "../../common/context/prisma.service";
import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { RegisterDto } from "./dto/register.dto";
import { MailtrapService } from "../../mail/mailtrap.service";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import {
  generateOTP,
  findMatchingVerificationToken,
  sendOtpEmailWithRetry,
} from "./helpers/registration-otp.helper";
import { provisionVerifiedUserAccount } from "./helpers/registration-provisioner.helper";

@Injectable()
export class RegistrationService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailtrapService: MailtrapService,
    private configService: ConfigService,
  ) {}

  async register(data: RegisterDto) {
    const { email, password, fullName, name } = data;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException("Email already exists");

    const hashedPassword = await bcrypt.hash(password, 10);
    const userFullName = fullName || name || undefined;
    const createData: Prisma.UserCreateInput = {
      email,
      password: hashedPassword,
      fullName: userFullName,
    };

    const user = await this.prisma.user.create({ data: createData });

    const token = generateOTP();
    const tokenHash = await bcrypt.hash(token, 10);
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: "email_verification",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await sendOtpEmailWithRetry(this.mailtrapService, {
      email,
      otp: token,
      userName: email,
    });

    return {
      message: "User registered. Check your email for OTP.",
      otpFallback: true,
    };
  }

  async verifyEmail(token: string) {
    const verification = await findMatchingVerificationToken(
      this.prisma,
      token,
    );

    if (!verification || verification.type !== "email_verification")
      throw new BadRequestException("Invalid OTP");

    if (verification.expiresAt < new Date())
      throw new BadRequestException("OTP expired");

    const user = await this.prisma.user.findUnique({
      where: { id: verification.userId },
    });

    if (!user) throw new BadRequestException("User not found");

    const { company, workspace } = await this.prisma.$transaction(
      async (tx) =>
        provisionVerifiedUserAccount(tx, user.id, verification.id),
    );

    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: "Email verified successfully",
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
      company,
      workspace,
    };
  }

  async resendOtp(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException("User not found");

    if (user.isVerified)
      throw new BadRequestException("Email already verified");

    await this.prisma.verificationToken.updateMany({
      where: {
        userId: user.id,
        type: "email_verification",
        used: false,
      },
      data: { used: true },
    });

    const token = generateOTP();
    const tokenHash = await bcrypt.hash(token, 10);
    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        type: "email_verification",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    await sendOtpEmailWithRetry(this.mailtrapService, {
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
