import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from "@nestjs/common";

import { CompaniesService } from "./companies.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { GetUser } from "../auth/decorators/get-user.decorator";

interface AuthenticatedUser {
  userId: string;
  role: string;
}

@Controller("companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  findAll(@GetUser() user: AuthenticatedUser) {
    return this.companiesService.findAll(user);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  findOne(@Param("id") id: string, @GetUser() user: AuthenticatedUser) {
    return this.companiesService.findOne(id, user);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  update(
    @Param("id") id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @GetUser() user: AuthenticatedUser,
  ) {
    return this.companiesService.update(id, updateCompanyDto, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.companiesService.remove(+id);
  }
}
