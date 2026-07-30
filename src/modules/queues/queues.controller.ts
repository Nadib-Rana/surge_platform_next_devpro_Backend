import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseGuards,
} from "@nestjs/common";
import { QueuesService } from "./queues.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

@ApiTags("Queue Monitoring")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("queues")
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Get("stats")
  @Roles("admin")
  @ApiOperation({ summary: "Get BullMQ job status count stats (Admin Only)" })
  @ApiOkResponse({ description: "Queue stats returned successfully" })
  getStats() {
    return this.queuesService.getStats();
  }

  @Get("failed")
  @Roles("admin")
  @ApiOperation({ summary: "List failed jobs in content-generation-queue (Admin Only)" })
  @ApiOkResponse({ description: "Failed jobs returned successfully" })
  getFailedJobs() {
    return this.queuesService.getFailedJobs();
  }

  @Post("retry/:jobId")
  @Roles("admin")
  @ApiOperation({ summary: "Retry a specific failed job in queue (Admin Only)" })
  @ApiOkResponse({ description: "Job retry execution started" })
  retryJob(@Param("jobId") jobId: string) {
    return this.queuesService.retryJob(jobId);
  }

  @Delete("clean")
  @Roles("admin")
  @ApiOperation({ summary: "Clean completed and failed job histories (Admin Only)" })
  @ApiOkResponse({ description: "Queue history cleaned successfully" })
  cleanHistory() {
    return this.queuesService.cleanHistory();
  }
}
