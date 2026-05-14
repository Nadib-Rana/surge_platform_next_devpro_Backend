import { Module } from "@nestjs/common";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentService } from "./enrollment.service";
import { EnrollmentExpiryNotifierService } from "./enrollment-expiry-notifier.service";

@Module({
  controllers: [EnrollmentController],
  providers: [EnrollmentService, EnrollmentExpiryNotifierService],
  exports: [EnrollmentService],
})
export class EnrollmentModule {}
