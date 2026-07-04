import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { DispatcherService } from './dispatcher.service';
import { DispatchPayloadDto } from './dto/dispatch-payload.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/dispatcher')
export class DispatcherController {
  constructor(private readonly dispatcher: DispatcherService) {}

  @Post('publish')
  async publish(
    @Param('workspaceId') workspaceId: string,
    @Body() payload: DispatchPayloadDto,
    @GetUser('userId') userId: string,
  ) {
    // attach workspaceId to metadata for strategy use if absent
    payload.metadata = { ...(payload.metadata || {}), workspaceId, requestedBy: userId };
    // invoke dispatcher
    return this.dispatcher.dispatch(payload as any);
  }
}
