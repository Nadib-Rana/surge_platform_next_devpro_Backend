import { Controller, Get, Param, Query } from "@nestjs/common";
import { OAuthService } from "./oauth.service";

@Controller("publishing-channels/oauth")
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Get(":platform/authorize")
  getAuthorizeUrl(
    @Param("platform") platform: string,
    @Query("workspaceId") workspaceId: string,
  ) {
    return this.oauthService.getAuthorizeUrl(platform, workspaceId);
  }

  @Get(":platform/callback")
  handleCallback(
    @Param("platform") platform: string,
    @Query("code") code: string,
    @Query("state") state?: string,
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

    return this.oauthService.handleCallback(platform, code, workspaceId);
  }
}
