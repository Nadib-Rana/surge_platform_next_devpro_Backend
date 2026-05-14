import { Injectable } from "@nestjs/common";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../common/exceptions/http.exceptions";
import { PrismaService } from "../common/context/prisma.service";
import { CheckoutDto } from "./dto/checkout.dto";
import { SquareWebhookDto } from "./dto/square-webhook.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  private async deductStock(tx: PrismaService, orderId: string) {
    const orderItems = await tx.orderItem.findMany({
      where: { orderId },
      include: {
        product: true,
      },
    });

    for (const item of orderItems) {
      if (item.quantity > item.product.stockQuantity) {
        throw new ForbiddenException(
          `Insufficient stock for '${item.product.title}'`,
          "INSUFFICIENT_STOCK",
        );
      }
    }

    for (const item of orderItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: {
            decrement: item.quantity,
          },
        },
      });
    }
  }

  private async buildCartSnapshot(userId: string) {
    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (cartItems.length === 0) {
      throw new BadRequestException("Cart is empty", "EMPTY_CART");
    }

    for (const item of cartItems) {
      if (!item.product.isActive) {
        throw new BadRequestException(
          `Product '${item.product.title}' is not active`,
          "PRODUCT_INACTIVE",
        );
      }
      if (item.quantity > item.product.stockQuantity) {
        throw new BadRequestException(
          `Insufficient stock for '${item.product.title}'`,
          "INSUFFICIENT_STOCK",
        );
      }
    }

    const totalAmount = cartItems.reduce((sum, item) => {
      const unitPrice = item.product.discountPrice ?? item.product.regularPrice;
      return sum + Number(unitPrice) * item.quantity;
    }, 0);

    return { cartItems, totalAmount };
  }

  async checkout(userId: string, dto: CheckoutDto) {
    if (dto.paymentMethod === "SQUARE" && !dto.squareTransactionId) {
      throw new BadRequestException(
        "Square transaction id is required for SQUARE payment",
        "SQUARE_TRANSACTION_REQUIRED",
      );
    }

    const { cartItems, totalAmount } = await this.buildCartSnapshot(userId);

    const shouldMarkPaid = dto.paymentMethod === "SQUARE";
    const paymentStatus = shouldMarkPaid ? "PAID" : "UNPAID";
    const orderStatus = shouldMarkPaid ? "CONFIRMED" : "PLACED";

    return this.prisma.$transaction(async (tx) => {
      if (shouldMarkPaid) {
        for (const item of cartItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: {
                decrement: item.quantity,
              },
            },
          });
        }
      }

      const order = await tx.order.create({
        data: {
          userId,
          totalAmount,
          paymentMethod: dto.paymentMethod,
          paymentStatus,
          orderStatus,
          squareTransactionId: dto.squareTransactionId,
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              priceAtPurchase:
                item.product.discountPrice ?? item.product.regularPrice,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, title: true, imageKey: true },
              },
            },
          },
        },
      });

      await tx.cartItem.deleteMany({ where: { userId } });
      return order;
    });
  }

  async listMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, title: true, imageKey: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listOrdersForAdmin() {
    return this.prisma.order.findMany({
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
        items: {
          include: {
            product: {
              select: { id: true, title: true, imageKey: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async confirmCodOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Order");
    }

    if (order.paymentMethod !== "COD") {
      throw new BadRequestException(
        "Order is not COD",
        "INVALID_PAYMENT_METHOD",
      );
    }

    if (order.paymentStatus === "PAID") {
      throw new BadRequestException("Order is already paid", "ALREADY_PAID");
    }

    for (const item of order.items) {
      if (item.quantity > item.product.stockQuantity) {
        throw new ForbiddenException(
          `Insufficient stock for '${item.product.title}'`,
          "INSUFFICIENT_STOCK",
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "PAID",
          orderStatus: "CONFIRMED",
        },
      });
    });
  }

  async handleSquarePaymentWebhook(dto: SquareWebhookDto) {
    if (!dto.squareTransactionId && !dto.orderId) {
      throw new BadRequestException(
        "Either squareTransactionId or orderId is required",
        "WEBHOOK_IDENTIFIER_REQUIRED",
      );
    }

    const orConditions: Prisma.OrderWhereInput[] = [];
    if (dto.squareTransactionId) {
      orConditions.push({ squareTransactionId: dto.squareTransactionId });
    }
    if (dto.orderId) {
      orConditions.push({ id: dto.orderId });
    }

    const order = await this.prisma.order.findFirst({
      where: {
        OR: orConditions,
      },
    });

    if (!order) {
      throw new NotFoundException("Order");
    }

    if (order.paymentMethod !== "SQUARE") {
      throw new BadRequestException(
        "Webhook order is not a SQUARE payment",
        "INVALID_PAYMENT_METHOD",
      );
    }

    if (dto.eventType === "PAYMENT_SUCCEEDED") {
      if (order.paymentStatus === "PAID") {
        return order;
      }

      return this.prisma.$transaction(async (tx) => {
        await this.deductStock(tx as unknown as PrismaService, order.id);
        return tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "PAID",
            orderStatus: "CONFIRMED",
          },
        });
      });
    }

    if (dto.eventType === "PAYMENT_FAILED") {
      return this.prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PENDING",
          orderStatus: "PLACED",
        },
      });
    }

    return this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "PENDING",
        orderStatus: "CANCELLED",
      },
    });
  }
}
