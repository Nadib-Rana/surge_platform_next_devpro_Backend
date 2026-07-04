import { Controller, Patch, Param, Body } from "@nestjs/common";
import { WorkspacesService } from "./workspaces.service";
import { QueueConfigDto } from "./dto/queue-config.dto";
import { RssSchedulerService } from "./rss-scheduler.service";
import { AutopilotSchedulerService } from "../autopilot/autopilot-scheduler.service";

@Controller("workspaces")
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly scheduler: RssSchedulerService,
    private readonly autopilotScheduler: AutopilotSchedulerService,
  ) {}

  @Patch(":workspaceId/queue-config")
  async updateQueueConfig(@Param("workspaceId") workspaceId: string, @Body() dto: QueueConfigDto) {
    const updated = await this.workspacesService.updateQueueConfig(workspaceId, dto);
    // notify scheduler to reschedule repeatable jobs
    await this.scheduler.onWorkspaceConfigChange(workspaceId);
    await this.autopilotScheduler.syncWorkspaceSchedules(workspaceId, dto as any);
    return updated;
  }
}
