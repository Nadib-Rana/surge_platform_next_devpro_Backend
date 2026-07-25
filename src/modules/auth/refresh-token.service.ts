import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";
import { PrismaService } from "../../common/context/prisma.service";

@Injectable()
export class RefreshTokenService {
  private readonly REFRESH_TOKEN_EXPIRY_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async generateRefreshToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.verificationToken.create({
      data: {
        userId,
        tokenHash,
        type: "login_otp",
        expiresAt,
      },
    });

    return rawToken;
  }

  async refreshTokens(refreshToken: string) {
    if (!refreshToken || typeof refreshToken !== "string") {
      throw new UnauthorizedException("Refresh token is required");
    }

    const tokenHash = this.hashToken(refreshToken);

    const record = await this.prisma.verificationToken.findFirst({
      where: {
        tokenHash,
        used: false,
      },
      include: { user: true },
    });

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const user = record.user;

    // Check if user changed password after refresh token creation
    if (
      user.passwordChangedAt &&
      record.createdAt.getTime() < user.passwordChangedAt.getTime()
    ) {
      throw new UnauthorizedException(
        "Password changed recently. Please login again.",
      );
    }

    // Invalidate old token (Rotation)
    await this.prisma.verificationToken.update({
      where: { id: record.id },
      data: { used: true },
    });

    const newAccessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    });
    const newRefreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async revokeUserTokens(userId: string): Promise<void> {
    await this.prisma.verificationToken.updateMany({
      where: { userId, type: "login_otp", used: false },
      data: { used: true },
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token.trim()).digest("hex");
  }
}
