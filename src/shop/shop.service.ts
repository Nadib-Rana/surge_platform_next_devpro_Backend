import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "../common/exceptions/http.exceptions";
import { PrismaService } from "../common/context/prisma.service";
import { AddToCartDto } from "./dto/add-to-cart.dto";
import { UpdateCartItemDto } from "./dto/update-cart-item.dto";
import { ListProductsQueryDto } from "./dto/list-products-query.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ShopService {
  constructor(private readonly prisma: PrismaService) {}

  private formatProduct<
    T extends {
      regularPrice: Prisma.Decimal;
      discountPrice?: Prisma.Decimal | null;
    },
  >(product: T) {
    return {
      ...product,
      regularPrice: Number(product.regularPrice),
      discountPrice:
        product.discountPrice === null || product.discountPrice === undefined
          ? null
          : Number(product.discountPrice),
    };
  }

  async listCategoriesForAdmin() {
    return this.prisma.category.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  async createCategoryForAdmin(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findFirst({
      where: {
        name: {
          equals: dto.name,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        "Category with this name already exists",
        "CATEGORY_EXISTS",
      );
    }

    return this.prisma.category.create({
      data: { name: dto.name.trim() },
    });
  }

  async updateCategoryForAdmin(categoryId: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException("Category");
    }

    if (!dto.name) {
      throw new BadRequestException(
        "At least one field is required for update",
        "CATEGORY_UPDATE_EMPTY",
      );
    }

    const existing = await this.prisma.category.findFirst({
      where: {
        id: { not: categoryId },
        name: {
          equals: dto.name,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        "Category with this name already exists",
        "CATEGORY_EXISTS",
      );
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: { name: dto.name.trim() },
    });
  }

  async deleteCategoryForAdmin(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException("Category");
    }

    if (category._count.products > 0) {
      throw new BadRequestException(
        "Category cannot be deleted while products exist",
        "CATEGORY_HAS_PRODUCTS",
      );
    }

    await this.prisma.category.delete({ where: { id: categoryId } });
    return { id: categoryId };
  }

  async listProductsForAdmin(query: ListProductsQueryDto) {
    const products = await this.prisma.product.findMany({
      where: {
        categoryId: query.categoryId,
        title: query.search
          ? { contains: query.search, mode: "insensitive" }
          : undefined,
        isActive:
          query.onlyActive === undefined
            ? undefined
            : query.onlyActive.toLowerCase() === "true",
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    return products.map((product) => this.formatProduct(product));
  }

  async createProductForAdmin(dto: CreateProductDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException("Category");
    }

    if (
      dto.discountPrice !== undefined &&
      dto.discountPrice > dto.regularPrice
    ) {
      throw new BadRequestException(
        "Discount price cannot exceed regular price",
        "INVALID_DISCOUNT_PRICE",
      );
    }

    const product = await this.prisma.product.create({
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description as string | null | undefined,
        regularPrice: dto.regularPrice,
        discountPrice: dto.discountPrice,
        stockQuantity: dto.stockQuantity,
        imageKey: dto.imageKey,
        isActive: dto.isActive ?? true,
      },
    });

    return this.formatProduct(product);
  }

  async updateProductForAdmin(productId: string, dto: UpdateProductDto) {
    const existingProduct = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, regularPrice: true, categoryId: true },
    });

    if (!existingProduct) {
      throw new NotFoundException("Product");
    }

    const hasAnyField = [
      dto.categoryId,
      dto.title,
      dto.description,
      dto.regularPrice,
      dto.discountPrice,
      dto.stockQuantity,
      dto.imageKey,
      dto.isActive,
    ].some((value) => value !== undefined);

    if (!hasAnyField) {
      throw new BadRequestException(
        "At least one field is required for update",
        "PRODUCT_UPDATE_EMPTY",
      );
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });
      if (!category) {
        throw new NotFoundException("Category");
      }
    }

    const resolvedRegularPrice =
      dto.regularPrice ?? Number(existingProduct.regularPrice);
    const resolvedDiscountPrice =
      dto.discountPrice === undefined ? undefined : dto.discountPrice;

    if (
      resolvedDiscountPrice !== undefined &&
      resolvedDiscountPrice > resolvedRegularPrice
    ) {
      throw new BadRequestException(
        "Discount price cannot exceed regular price",
        "INVALID_DISCOUNT_PRICE",
      );
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id: productId },
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description as string | null | undefined,
        regularPrice: dto.regularPrice,
        discountPrice: dto.discountPrice,
        stockQuantity: dto.stockQuantity,
        imageKey: dto.imageKey,
        isActive: dto.isActive,
      },
    });

    return this.formatProduct(updatedProduct);
  }

  async deleteProductForAdmin(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException("Product");
    }

    await this.prisma.product.delete({ where: { id: productId } });
    return { id: productId };
  }

  async listCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: "asc" },
    });
  }

  async listProducts(query: ListProductsQueryDto) {
    const products = await this.prisma.product.findMany({
      where: {
        categoryId: query.categoryId,
        isActive:
          query.onlyActive === undefined
            ? true
            : query.onlyActive.toLowerCase() === "true",
        title: query.search
          ? { contains: query.search, mode: "insensitive" }
          : undefined,
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    return products.map((product) => this.formatProduct(product));
  }

  async getProduct(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException("Product");
    }

    return this.formatProduct(product);
  }

  async getCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const subtotal = items.reduce((sum, item) => {
      const unitPrice = item.product.discountPrice ?? item.product.regularPrice;
      return sum + Number(unitPrice) * item.quantity;
    }, 0);

    return {
      items: items.map((item) => ({
        ...item,
        product: this.formatProduct(item.product),
      })),
      subtotal,
    };
  }

  async addToCart(userId: string, dto: AddToCartDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, isActive: true, stockQuantity: true },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException("Product");
    }

    if (dto.quantity > product.stockQuantity) {
      throw new BadRequestException(
        "Requested quantity exceeds available stock",
        "INSUFFICIENT_STOCK",
      );
    }

    const item = await this.prisma.cartItem.upsert({
      where: {
        userId_productId: {
          userId,
          productId: dto.productId,
        },
      },
      update: {
        quantity: dto.quantity,
        updatedAt: new Date(),
      },
      create: {
        userId,
        productId: dto.productId,
        quantity: dto.quantity,
      },
    });

    return item;
  }

  async updateCartItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const cartItem = await this.prisma.cartItem.findFirst({
      where: { id: itemId, userId },
      include: {
        product: {
          select: { stockQuantity: true, isActive: true },
        },
      },
    });

    if (!cartItem || !cartItem.product.isActive) {
      throw new NotFoundException("Cart item");
    }

    if (dto.quantity > cartItem.product.stockQuantity) {
      throw new BadRequestException(
        "Requested quantity exceeds available stock",
        "INSUFFICIENT_STOCK",
      );
    }

    return this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity,
        updatedAt: new Date(),
      },
    });
  }

  async removeCartItem(userId: string, itemId: string) {
    const existing = await this.prisma.cartItem.findFirst({
      where: { id: itemId, userId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("Cart item");
    }

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return { id: itemId };
  }
}
