import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { jwtConstants } from "./constants";

interface JwtPayload {
  sub: string;
  role: string;
  isVerified?: boolean;
  email?: string;
  fullName?: string | null;
  avatarKey?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>("JWT_SECRET") || jwtConstants.secret,
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      role: payload.role,
      isVerified: payload.isVerified,
      email: payload.email,
      fullName: payload.fullName,
      avatarKey: payload.avatarKey,
    };
  }
}
