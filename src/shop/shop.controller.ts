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
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { ShopService } from "./shop.service";
import { ListProductsQueryDto } from "./dto/list-products-query.dto";
import { AddToCartDto } from "./dto/add-to-cart.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Controller("shop")
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get("admin/categories")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Admin categories fetched successfully")
  listCategoriesForAdmin() {
    return this.shopService.listCategoriesForAdmin();
  }

  @Post("admin/categories")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Category created successfully")
  createCategoryForAdmin(@Body() dto: CreateCategoryDto) {
    return this.shopService.createCategoryForAdmin(dto);
  }

  @Patch("admin/categories/:categoryId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Category updated successfully")
  updateCategoryForAdmin(
    @Param("categoryId") categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.shopService.updateCategoryForAdmin(categoryId, dto);
  }

  @Delete("admin/categories/:categoryId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Category deleted successfully")
  deleteCategoryForAdmin(@Param("categoryId") categoryId: string) {
    return this.shopService.deleteCategoryForAdmin(categoryId);
  }

  @Get("admin/products")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Admin products fetched successfully")
  listProductsForAdmin(@Query() query: ListProductsQueryDto) {
    return this.shopService.listProductsForAdmin(query);
  }

  @Post("admin/products")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Product created successfully")
  createProductForAdmin(@Body() dto: CreateProductDto) {
    return this.shopService.createProductForAdmin(dto);
  }

  @Patch("admin/products/:productId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Product updated successfully")
  updateProductForAdmin(
    @Param("productId") productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.shopService.updateProductForAdmin(productId, dto);
  }

  @Delete("admin/products/:productId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Product deleted successfully")
  deleteProductForAdmin(@Param("productId") productId: string) {
    return this.shopService.deleteProductForAdmin(productId);
  }

  @Get("categories")
  @ResponseMessage("Shop categories fetched successfully")
  listCategories() {
    return this.shopService.listCategories();
  }

  @Get("products")
  @ResponseMessage("Products fetched successfully")
  listProducts(@Query() query: ListProductsQueryDto) {
    return this.shopService.listProducts(query);
  }

  @Get("products/:productId")
  @ResponseMessage("Product fetched successfully")
  getProduct(@Param("productId") productId: string) {
    return this.shopService.getProduct(productId);
  }

  @Get("cart")
  @UseGuards(JwtAuthGuard)
  @ResponseMessage("Cart fetched successfully")
  getCart(@GetUser("userId") userId: string) {
    return this.shopService.getCart(userId);
  }

  @Post("cart")
  @UseGuards(JwtAuthGuard)
  @ResponseMessage("Cart item added successfully")
  addToCart(@GetUser("userId") userId: string, @Body() dto: AddToCartDto) {
    return this.shopService.addToCart(userId, dto);
  }

  @Patch("cart/:itemId")
  @UseGuards(JwtAuthGuard)
  @ResponseMessage("Cart item updated successfully")
  updateCartItem(
    @GetUser("userId") userId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.shopService.updateCartItem(userId, itemId, dto);
  }

  @Delete("cart/:itemId")
  @UseGuards(JwtAuthGuard)
  @ResponseMessage("Cart item removed successfully")
  removeCartItem(
    @GetUser("userId") userId: string,
    @Param("itemId") itemId: string,
  ) {
    return this.shopService.removeCartItem(userId, itemId);
  }
}
