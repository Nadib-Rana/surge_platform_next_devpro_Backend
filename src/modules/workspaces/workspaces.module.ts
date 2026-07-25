import { Module } from "@nestjs/common";
import { WorkspacesService } from "./workspaces.service";
import { WorkspacesController } from "./workspaces.controller";
import { RssSourcesController } from "./rss-sources.controller";
import { RssSourcesService } from "./rss-sources.service";
import { RssSchedulerService } from "./rss-scheduler.service";
import { AutopilotModule } from "../autopilot/autopilot.module";
import { WorkspaceAnalyticsController } from "./analytics/workspace-analytics.controller";
import { WorkspaceAnalyticsService } from "./analytics/workspace-analytics.service";

@Module({
  imports: [AutopilotModule],
  controllers: [
    WorkspacesController,
    RssSourcesController,
    WorkspaceAnalyticsController,
  ],
  providers: [
    WorkspacesService,
    RssSourcesService,
    RssSchedulerService,
    WorkspaceAnalyticsService,
  ],
  exports: [WorkspacesService, WorkspaceAnalyticsService],
})
export class WorkspacesModule {}
