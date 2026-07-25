import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { WorkspaceAnalyticsService } from "./workspace-analytics.service";

@Controller("workspaces")
@UseGuards(JwtAuthGuard)
export class WorkspaceAnalyticsController {
  constructor(
    private readonly analyticsService: WorkspaceAnalyticsService,
  ) {}

  @Get(":workspaceId/analytics")
  getAnalytics(@Param("workspaceId") workspaceId: string) {
    return this.analyticsService.getWorkspaceAnalytics(workspaceId);
  }
}
