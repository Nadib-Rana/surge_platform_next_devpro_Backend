import { Module } from "@nestjs/common";
import { MailtrapService } from "./mailtrap.service";

@Module({
  providers: [MailtrapService],
  exports: [MailtrapService],
})
export class MailModule {}
