import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { LmsService } from "./lms.service";
import { ListClassesQueryDto } from "./dto/list-classes-query.dto";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CreateClassCategoryDto } from "./dto/create-class-category.dto";
import { UpdateClassCategoryDto } from "./dto/update-class-category.dto";
import { CreateClassDto } from "./dto/create-class.dto";
import { UpdateClassDto } from "./dto/update-class.dto";

@Controller("lms")
@UseGuards(JwtAuthGuard)
export class LmsController {
  constructor(private readonly lmsService: LmsService) {}

  @Get("categories")
  @ResponseMessage("Accessible categories fetched successfully")
  getCategories(
    @GetUser("userId") userId: string,
    @GetUser("role") role: string,
  ) {
    if (role === "vendor") {
      return this.lmsService.listCategoriesForAdmin();
    }

    return this.lmsService.listAccessibleCategories(userId);
  }

  @Post("categories")
  @UseGuards(RolesGuard)
  @Roles("vendor")
  @ResponseMessage("LMS category created successfully")
  createCategory(@Body() dto: CreateClassCategoryDto) {
    return this.lmsService.createCategoryForAdmin(dto);
  }

  @Get("categories/:categoryId")
  @UseGuards(RolesGuard)
  @Roles("vendor")
  @ResponseMessage("LMS category fetched successfully")
  getCategoryById(@Param("categoryId") categoryId: string) {
    return this.lmsService.getCategoryByIdForAdmin(categoryId);
  }

  @Patch("categories/:categoryId")
  @UseGuards(RolesGuard)
  @Roles("vendor")
  @ResponseMessage("LMS category updated successfully")
  updateCategory(
    @Param("categoryId") categoryId: string,
    @Body() dto: UpdateClassCategoryDto,
  ) {
    return this.lmsService.updateCategoryForAdmin(categoryId, dto);
  }

  @Delete("categories/:categoryId")
  @UseGuards(RolesGuard)
  @Roles("vendor")
  @ResponseMessage("LMS category deleted successfully")
  deleteCategory(@Param("categoryId") categoryId: string) {
    return this.lmsService.deleteCategoryForAdmin(categoryId);
  }

  @Get("categories/:categoryId/classes")
  @UseGuards(RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Category classes fetched successfully")
  listClassesByCategoryForAdmin(@Param("categoryId") categoryId: string) {
    return this.lmsService.listCategoryClassesForAdmin(categoryId);
  }

  @Post("categories/:categoryId/classes")
  @UseGuards(RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Class created successfully")
  createClassForAdmin(
    @Param("categoryId") categoryId: string,
    @Body() dto: CreateClassDto,
  ) {
    return this.lmsService.createClassForAdmin(categoryId, dto);
  }

  @Get("categories/:categoryId/classes/:classId")
  @UseGuards(RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Class fetched successfully")
  getClassByIdForAdmin(
    @Param("categoryId") categoryId: string,
    @Param("classId") classId: string,
  ) {
    return this.lmsService.getClassByIdForAdmin(categoryId, classId);
  }

  @Patch("categories/:categoryId/classes/:classId")
  @UseGuards(RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Class updated successfully")
  updateClassForAdmin(
    @Param("categoryId") categoryId: string,
    @Param("classId") classId: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.lmsService.updateClassForAdmin(categoryId, classId, dto);
  }

  @Delete("categories/:categoryId/classes/:classId")
  @UseGuards(RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Class deleted successfully")
  deleteClassForAdmin(
    @Param("categoryId") categoryId: string,
    @Param("classId") classId: string,
  ) {
    return this.lmsService.deleteClassForAdmin(categoryId, classId);
  }

  @Get("classes")
  @ResponseMessage("Category classes fetched successfully")
  getCategoryClasses(
    @GetUser("userId") userId: string,
    @Query() query: ListClassesQueryDto,
  ) {
    return this.lmsService.listCategoryClasses(userId, query.categoryId);
  }
}
