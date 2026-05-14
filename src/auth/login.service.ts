import {
  UnauthorizedException,
  BadRequestException,
} from "../common/exceptions/http.exceptions";
import { PrismaService } from "../common/context/prisma.service";
import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { Injectable } from "@nestjs/common";

@Injectable()
export class LoginService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // Login (accept email or phone as identifier; staff bypass verification)
  async login(
    identifier: string | undefined,
    password: string,
  ): Promise<{
    accessToken: string;
    isVerified: boolean;
    user: {
      id: string;
      email: string;
      role: string;
    };
  }> {
    if (!identifier) {
      // কাস্টম BadRequestException (message, code)
      throw new BadRequestException(
        "Email or phone must be provided",
        "MISSING_IDENTIFIER",
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phoneNumber: identifier }],
      },
    });

    // ১. ইউজার না থাকলে
    if (!user)
      throw new UnauthorizedException(
        "Invalid credentials",
        false,
        "INVALID_CREDENTIALS",
      );

    // ২. ইমেইল ভেরিফাইড না থাকলে
    if (user.role !== "staff" && !user.isVerified) {
      // এখানে অবজেক্টের বদলে সরাসরি আর্গুমেন্ট পাস করুন
      throw new UnauthorizedException(
        "Email not verified", // 1. message
        user.isVerified, // 2. isVerified (boolean)
        "EMAIL_NOT_VERIFIED", // 3. code
        undefined, // 4. errors
        "PLEASE_VERIFY_EMAIL", // 5. instruction
      );
    }

    // ৩. পাসওয়ার্ড চেক
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      throw new UnauthorizedException(
        "Invalid credentials",
        user.isVerified,
        "INVALID_PASSWORD",
      );

    const payload = { sub: user.id, role: user.role };
    const token = this.jwtService.sign(payload);

    // Success response
    return {
      accessToken: token,
      isVerified: user.isVerified,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
