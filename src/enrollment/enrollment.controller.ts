import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { EnrollmentService } from "./enrollment.service";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";
import { UpdateClassProgressDto } from "./dto/update-class-progress.dto";
import { ResponseMessage } from "../common/decorators/response-message.decorator";

@Controller("enrollments")
@UseGuards(JwtAuthGuard)
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  @Post()
  @ResponseMessage("Enrollment created successfully")
  create(@GetUser("userId") userId: string, @Body() dto: CreateEnrollmentDto) {
    return this.enrollmentService.createEnrollment(userId, dto);
  }

  @Get("active")
  @ResponseMessage("Active enrollment fetched successfully")
  getActive(@GetUser("userId") userId: string) {
    return this.enrollmentService.getActiveEnrollment(userId);
  }

  @Patch(":enrollmentId/classes/:classId/progress")
  @ResponseMessage("Class progress updated successfully")
  updateClassProgress(
    @GetUser("userId") userId: string,
    @Param("enrollmentId") enrollmentId: string,
    @Param("classId") classId: string,
    @Body() dto: UpdateClassProgressDto,
  ) {
    return this.enrollmentService.updateClassProgress(
      userId,
      enrollmentId,
      classId,
      dto,
    );
  }
}
