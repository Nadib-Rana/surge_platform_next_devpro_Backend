import { Controller, Get, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { OAuthService } from "./oauth.service";

@Controller("publishing-channels/oauth")
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Get(":platform/authorize")
  getAuthorizeUrl(
    @Param("platform") platform: string,
    @Query("workspaceId") workspaceId: string,
    @Res() res: Response,
  ) {
    const authData = this.oauthService.getAuthorizeUrl(platform, workspaceId);
    return res.redirect(authData.url);
  }

  @Get(":platform/callback")
  async handleCallback(
    @Param("platform") platform: string,
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() res: Response,
  ) {
    let workspaceId = "";
    if (state) {
      try {
        const decoded = JSON.parse(
          Buffer.from(state, "base64url").toString("utf8"),
        );
        workspaceId = decoded.workspaceId || "";
      } catch {
        // Fallback state parse
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    try {
      await this.oauthService.handleCallback(platform, code, workspaceId);
      return res.redirect(
        `${frontendUrl}/dashboard/settings?connected=${platform}`,
      );
    } catch (err: any) {
      return res.redirect(
        `${frontendUrl}/dashboard/settings?error=${encodeURIComponent(
          err.message || "OAuth failed",
        )}`,
      );
    }
  }
}
