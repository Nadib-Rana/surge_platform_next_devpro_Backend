import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { RegistrationService } from "./registration.service";
import { LoginService } from "./login.service";
import { PasswordResetService } from "./password-reset.service";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { ContextModule } from "../common/context/context.module";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy";
import { jwtConstants } from "./constants";
import { RolesGuard } from "./guards/roles.guard";
// import { Roles } from "./decorators/roles.decorator";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET") || jwtConstants.secret,
      }),
    }),
    ContextModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RegistrationService,
    LoginService,
    PasswordResetService,
    JwtStrategy,
    RolesGuard,
  ],
  exports: [JwtStrategy, RolesGuard],
})
export class AuthModule {}
