import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/context/prisma.service";
import { UnauthorizedException } from "../../common/exceptions/http.exceptions";

interface JwtPayload {
  sub: string;
  role: string;
  isVerified?: boolean;
  email?: string;
  fullName?: string | null;
  avatarKey?: string | null;
  iat?: number; // issued-at (seconds since epoch)
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = configService.get<string>("JWT_SECRET");
        if (!secret) {
          throw new Error("JWT_SECRET environment variable is required");
        }
        return secret;
      })(),
    });
  }

  validate(payload: JwtPayload) {
    // Optional: check if user's password was changed after token issuance
    // payload.iat is seconds since epoch (JWT standard)
    return (async () => {
      if (payload.iat) {
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, role: true, isVerified: true, email: true, fullName: true, avatarKey: true, passwordChangedAt: true },
        });

        if (user && user.passwordChangedAt) {
          const pwdChangedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
          if (pwdChangedAtSec > payload.iat) {
            throw new UnauthorizedException("Token invalidated after password change");
          }
        }

        return {
          userId: payload.sub,
          role: payload.role,
          isVerified: payload.isVerified,
          email: payload.email,
          fullName: payload.fullName,
          avatarKey: payload.avatarKey,
        };
      }

      return {
        userId: payload.sub,
        role: payload.role,
        isVerified: payload.isVerified,
        email: payload.email,
        fullName: payload.fullName,
        avatarKey: payload.avatarKey,
      };
    })();
  }
}
