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
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

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

@ApiTags("companies")
@Controller("companies")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  @ApiOperation({ summary: "Create a company" })
  @ApiBody({ type: CreateCompanyDto })
  @ApiResponse({ status: 201, description: "Company created successfully" })
  create(
    @Body() createCompanyDto: CreateCompanyDto,
    @GetUser() user: AuthenticatedUser,
  ) {
    return this.companiesService.create(createCompanyDto, user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  @ApiOperation({ summary: "List companies" })
  @ApiResponse({ status: 200, description: "Companies returned successfully" })
  findAll(@GetUser() user: AuthenticatedUser) {
    return this.companiesService.findAll(user);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  @ApiOperation({ summary: "Get a company by id" })
  @ApiParam({ name: "id", description: "Company id" })
  @ApiResponse({ status: 200, description: "Company returned successfully" })
  findOne(@Param("id") id: string, @GetUser() user: AuthenticatedUser) {
    return this.companiesService.findOne(id, user);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  @ApiOperation({ summary: "Update a company" })
  @ApiParam({ name: "id", description: "Company id" })
  @ApiBody({ type: UpdateCompanyDto })
  @ApiResponse({ status: 200, description: "Company updated successfully" })
  update(
    @Param("id") id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @GetUser() user: AuthenticatedUser,
  ) {
    return this.companiesService.update(id, updateCompanyDto, user);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin", "customer")
  @ApiOperation({ summary: "Delete a company" })
  @ApiParam({ name: "id", description: "Company id" })
  @ApiResponse({ status: 200, description: "Company deleted successfully" })
  remove(@Param("id") id: string, @GetUser() user: AuthenticatedUser) {
    return this.companiesService.remove(id, user);
  }
}
