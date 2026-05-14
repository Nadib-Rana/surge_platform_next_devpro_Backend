import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { OrderService } from "./order.service";
import { CheckoutDto } from "./dto/checkout.dto";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { SquareWebhookDto } from "./dto/square-webhook.dto";

@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post("webhooks/square")
  @ResponseMessage("Square webhook processed successfully")
  handleSquareWebhook(@Body() dto: SquareWebhookDto) {
    return this.orderService.handleSquarePaymentWebhook(dto);
  }

  @Post("checkout")
  @UseGuards(JwtAuthGuard)
  @ResponseMessage("Order placed successfully")
  checkout(@GetUser("userId") userId: string, @Body() dto: CheckoutDto) {
    return this.orderService.checkout(userId, dto);
  }

  @Get("my")
  @UseGuards(JwtAuthGuard)
  @ResponseMessage("Orders fetched successfully")
  myOrders(@GetUser("userId") userId: string) {
    return this.orderService.listMyOrders(userId);
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("vendor")
  @ResponseMessage("Admin orders fetched successfully")
  listOrdersForAdmin() {
    return this.orderService.listOrdersForAdmin();
  }

  @Patch(":orderId/cod-confirm")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("staff", "vendor")
  @ResponseMessage("COD order confirmed and marked paid")
  confirmCod(@Param("orderId") orderId: string) {
    return this.orderService.confirmCodOrder(orderId);
  }
}
