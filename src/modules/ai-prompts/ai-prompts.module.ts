import { Module } from "@nestjs/common";
import { AiPromptsService } from "./ai-prompts.service";
import { AiPromptsController } from "./ai-prompts.controller";
import { AiAssetService } from "./ai-asset.service";
import { ConfigModule } from "@nestjs/config";
import { StorageModule } from "../storage/storage.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [ConfigModule, StorageModule, AuthModule],
  controllers: [AiPromptsController],
  providers: [AiPromptsService, AiAssetService],
  exports: [AiPromptsService, AiAssetService],
})
export class AiPromptsModule {}
