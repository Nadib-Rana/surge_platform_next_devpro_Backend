import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { VerifyTokenDto } from "./dto/verify-token.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { RequestPasswordResetDto } from "./dto/request-Password-Reset.dto";
import { ResendOtpDto } from "./dto/resend-otp.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ResponseMessage } from "../../common/decorators/response-message.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { GetUser } from "./decorators/get-user.decorator";
import { RateLimiterGuard } from "../../common/guards/rate-limiter.guard";
import { Throttle } from "../../common/decorators/throttle.decorator";

@Controller("auth")
@UseGuards(RateLimiterGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @Throttle(5, 60000)
  @ResponseMessage("User registered successfully")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("verify-email")
  @Throttle(5, 60000)
  @ResponseMessage("Email verified successfully")
  verifyEmail(@Body() dto: VerifyTokenDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post("resend-otp")
  @Throttle(3, 60000)
  @ResponseMessage("OTP resent successfully")
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.email);
  }

  @Post("login")
  @Throttle(5, 60000)
  @ResponseMessage("Login successful")
  login(@Body() dto: LoginDto) {
    const identifier = dto.email ?? dto.phone;
    return this.authService.login(identifier, dto.password);
  }

  @Post("refresh")
  @Throttle(10, 60000)
  @ResponseMessage("Token refreshed successfully")
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ResponseMessage("Logout successful")
  logout(@GetUser("userId") userId: string) {
    return this.authService.logout(userId);
  }

  @Post("request-password-reset")
  @Throttle(3, 60000)
  @ResponseMessage("Password reset email sent successfully")
  requestReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post("reset-password")
  @Throttle(5, 60000)
  @ResponseMessage("Password reset successfully")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
