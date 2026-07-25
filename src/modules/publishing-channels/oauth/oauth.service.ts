import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../common/context/prisma.service";
import { EncryptionService } from "../../../common/security/encryption.service";
import {
  exchangeFacebookCode,
  exchangeLinkedInCode,
  exchangeWordPressCode,
} from "./oauth-exchange.helper";

@Injectable()
export class OAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  getAuthorizeUrl(platform: string, workspaceId: string): { url: string } {
    const p = platform.toLowerCase();
    const state = Buffer.from(
      JSON.stringify({ workspaceId, platform: p }),
    ).toString("base64url");

    if (p === "linkedin") {
      const clientId = this.config.get<string>("LINKEDIN_CLIENT_ID") || "";
      const redirectUri = this.getRedirectUri("linkedin");
      const scope = encodeURIComponent("r_liteprofile w_member_social");
      const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scope}`;
      return { url };
    }

    if (p === "facebook") {
      const appId = this.config.get<string>("FACEBOOK_APP_ID") || "";
      const redirectUri = this.getRedirectUri("facebook");
      const scope = encodeURIComponent("pages_show_list,pages_manage_posts");
      const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scope}`;
      return { url };
    }

    if (p === "wordpress") {
      const clientId = this.config.get<string>("WORDPRESS_CLIENT_ID") || "";
      const redirectUri = this.getRedirectUri("wordpress");
      const url = `https://public-api.wordpress.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;
      return { url };
    }

    throw new BadRequestException(`Unsupported OAuth platform: ${platform}`);
  }

  async handleCallback(platform: string, code: string, workspaceId: string) {
    const p = platform.toLowerCase();
    let credentials: Record<string, any> = {};

    if (p === "linkedin") {
      credentials = await exchangeLinkedInCode(
        code,
        this.config.get<string>("LINKEDIN_CLIENT_ID") || "",
        this.config.get<string>("LINKEDIN_CLIENT_SECRET") || "",
        this.getRedirectUri("linkedin"),
      );
    } else if (p === "facebook") {
      credentials = await exchangeFacebookCode(
        code,
        this.config.get<string>("FACEBOOK_APP_ID") || "",
        this.config.get<string>("FACEBOOK_APP_SECRET") || "",
        this.getRedirectUri("facebook"),
      );
    } else if (p === "wordpress") {
      credentials = await exchangeWordPressCode(
        code,
        this.config.get<string>("WORDPRESS_CLIENT_ID") || "",
        this.config.get<string>("WORDPRESS_CLIENT_SECRET") || "",
        this.getRedirectUri("wordpress"),
      );
    } else {
      throw new BadRequestException(`Unsupported platform ${platform}`);
    }

    const encryptedCredentials = this.encryptionService.encrypt(credentials);

    const existing = await this.prisma.publishingChannel.findFirst({
      where: { workspaceId, platform: p },
    });

    if (existing) {
      return this.prisma.publishingChannel.update({
        where: { id: existing.id },
        data: { encryptedCredentials, isActive: true },
      });
    }

    return this.prisma.publishingChannel.create({
      data: {
        workspaceId,
        platform: p,
        encryptedCredentials,
        isActive: true,
      },
    });
  }

  private getRedirectUri(platform: string): string {
    const baseUrl =
      this.config.get<string>("APP_BASE_URL") || "http://localhost:3000";
    return `${baseUrl}/publishing-channels/oauth/${platform}/callback`;
  }
}
