import { PrismaService } from "../common/context/prisma.service";
// import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
// import { randomInt } from "crypto";
import { RegisterDto } from "./dto/register.dto";
import { MailerService } from "@nestjs-modules/mailer";
import { Injectable } from "@nestjs/common";
import { RegistrationService } from "./registration.service";
import { LoginService } from "./login.service";
import { PasswordResetService } from "./password-reset.service";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailerService: MailerService,
    private registrationService: RegistrationService,
    private loginService: LoginService,
    private passwordResetService: PasswordResetService,
  ) {}

  // Register user
  async register(data: RegisterDto) {
    return this.registrationService.register(data);
  }

  // Verify email
  async verifyEmail(token: string) {
    return this.registrationService.verifyEmail(token);
  }

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
    return this.loginService.login(identifier, password);
  }

  // Password reset request
  async requestPasswordReset(email: string) {
    return this.passwordResetService.requestPasswordReset(email);
  }

  // Reset password
  async resetPassword(token: string, newPassword: string) {
    return this.passwordResetService.resetPassword(token, newPassword);
  }

  // Resend OTP for email verification
  async resendOtp(email: string) {
    return this.registrationService.resendOtp(email);
  }

  // Logout
  logout(userId: string) {
    return { message: "Logged out successfully", userId };
  }
}
