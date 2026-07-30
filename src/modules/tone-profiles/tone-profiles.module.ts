import { Module } from "@nestjs/common";
import { ToneProfilesService } from "./tone-profiles.service";
import { ToneProfilesController } from "./tone-profiles.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [ToneProfilesController],
  providers: [ToneProfilesService],
  exports: [ToneProfilesService],
})
export class ToneProfilesModule {}
