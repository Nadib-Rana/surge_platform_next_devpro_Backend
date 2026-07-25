import {
  UnauthorizedException,
  BadRequestException,
} from "../../common/exceptions/http.exceptions";
import { PrismaService } from "../../common/context/prisma.service";
import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { Injectable } from "@nestjs/common";
import { RefreshTokenService } from "./refresh-token.service";

@Injectable()
export class LoginService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private refreshTokenService: RefreshTokenService,
  ) {}

  async login(
    identifier: string | undefined,
    password: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    isVerified: boolean;
    user: {
      id: string;
      email: string;
      role: string;
    };
  }> {
    if (!identifier) {
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

    if (!user) {
      throw new UnauthorizedException(
        "Invalid credentials",
        false,
        "INVALID_CREDENTIALS",
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException(
        "Invalid credentials",
        user.isVerified,
        "INVALID_PASSWORD",
      );
    }

    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken =
      await this.refreshTokenService.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      isVerified: user.isVerified,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
