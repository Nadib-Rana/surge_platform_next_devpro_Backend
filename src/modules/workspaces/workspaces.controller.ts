import { Controller, Patch, Param, Body } from "@nestjs/common";
import { WorkspacesService } from "./workspaces.service";
import { QueueConfigDto } from "./dto/queue-config.dto";
import { RssSchedulerService } from "./rss-scheduler.service";

@Controller("workspaces")
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly scheduler: RssSchedulerService,
  ) {}

  @Patch(":workspaceId/queue-config")
  async updateQueueConfig(@Param("workspaceId") workspaceId: string, @Body() dto: QueueConfigDto) {
    const updated = await this.workspacesService.updateQueueConfig(workspaceId, dto);
    // notify scheduler to reschedule repeatable jobs
    await this.scheduler.onWorkspaceConfigChange(workspaceId);
    return updated;
  }
}
