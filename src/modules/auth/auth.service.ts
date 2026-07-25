import { PrismaService } from "../../common/context/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { Injectable } from "@nestjs/common";
import { RegistrationService } from "./registration.service";
import { LoginService } from "./login.service";
import { PasswordResetService } from "./password-reset.service";
import { RefreshTokenService } from "./refresh-token.service";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private registrationService: RegistrationService,
    private loginService: LoginService,
    private passwordResetService: PasswordResetService,
    private refreshTokenService: RefreshTokenService,
  ) {}

  async register(data: RegisterDto) {
    return this.registrationService.register(data);
  }

  async verifyEmail(token: string) {
    return this.registrationService.verifyEmail(token);
  }

  async login(
    identifier: string | undefined,
    password: string,
  ) {
    return this.loginService.login(identifier, password);
  }

  async refreshTokens(refreshToken: string) {
    return this.refreshTokenService.refreshTokens(refreshToken);
  }

  async requestPasswordReset(email: string) {
    return this.passwordResetService.requestPasswordReset(email);
  }

  async resetPassword(token: string, newPassword: string) {
    const result = await this.passwordResetService.resetPassword(
      token,
      newPassword,
    );
    return result;
  }

  async resendOtp(email: string) {
    return this.registrationService.resendOtp(email);
  }

  async logout(userId: string) {
    await this.refreshTokenService.revokeUserTokens(userId);
    return { message: "Logged out successfully", userId };
  }
}
