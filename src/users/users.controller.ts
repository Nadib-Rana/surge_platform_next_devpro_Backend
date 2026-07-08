import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../modules/auth/guards/jwt-auth.guard";
import { GetUser } from "../modules/auth/decorators/get-user.decorator";
import { UsersService } from "./users.service";
import { UpdateCurrentUserDto } from "./dto/update-current-user.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get("me")
  getMe(@GetUser("userId") userId: string) {
    return this.usersService.getMyProfile(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me")
  updateMe(
    @GetUser("userId") userId: string,
    @Body() dto: UpdateCurrentUserDto,
  ) {
    return this.usersService.updateMyProfile(userId, dto);
  }
}
