import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { VerifyTokenDto } from "./dto/verify-token.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { RequestPasswordResetDto } from "./dto/request-Password-Reset.dto";
import { ResendOtpDto } from "./dto/resend-otp.dto";
import { ResponseMessage } from "src/common/decorators/response-message.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { GetUser } from "./decorators/get-user.decorator";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @ResponseMessage("User is Registed successful")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("verify-email")
  @ResponseMessage("Email varifyed successful")
  verifyEmail(@Body() dto: VerifyTokenDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post("resend-otp")
  @ResponseMessage("OTP resent successful")
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.email);
  }

  @Post("login")
  @ResponseMessage("login successful")
  login(@Body() dto: LoginDto) {
    // choose email or phone; validation ensures at least one is present
    const identifier = dto.email ?? dto.phone;
    return this.authService.login(identifier, dto.password);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ResponseMessage("logout successful")
  logout(@GetUser("userId") userId: string) {
    return this.authService.logout(userId);
  }

  @Post("request-password-reset")
  @ResponseMessage("Password reset request send successful")
  requestReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post("reset-password")
  @ResponseMessage("Password reset successful")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
