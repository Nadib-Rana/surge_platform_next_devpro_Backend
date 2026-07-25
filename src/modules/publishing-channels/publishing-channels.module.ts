import { Module } from "@nestjs/common";
import { PublishingChannelsService } from "./publishing-channels.service";
import { PublishingChannelsController } from "./publishing-channels.controller";
import { OAuthService } from "./oauth/oauth.service";
import { OAuthController } from "./oauth/oauth.controller";

@Module({
  controllers: [PublishingChannelsController, OAuthController],
  providers: [PublishingChannelsService, OAuthService],
  exports: [PublishingChannelsService, OAuthService],
})
export class PublishingChannelsModule {}
