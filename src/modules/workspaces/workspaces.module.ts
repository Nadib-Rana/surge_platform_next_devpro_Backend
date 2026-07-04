import { Module } from "@nestjs/common";
import { WorkspacesService } from "./workspaces.service";
import { WorkspacesController } from "./workspaces.controller";
import { RssSourcesController } from "./rss-sources.controller";
import { RssSourcesService } from "./rss-sources.service";
import { RssSchedulerService } from "./rss-scheduler.service";
import { AutopilotModule } from "../autopilot/autopilot.module";

@Module({
  imports: [AutopilotModule],
  controllers: [WorkspacesController, RssSourcesController],
  providers: [WorkspacesService, RssSourcesService, RssSchedulerService],
})
export class WorkspacesModule {}
