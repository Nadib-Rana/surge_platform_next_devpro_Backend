import { OrderService } from "./order.service";
import {
  BadRequestException,
  NotFoundException,
} from "../common/exceptions/http.exceptions";

describe("OrderService", () => {
  const createService = () => {
    const prisma = {
      order: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
      orderItem: {
        findMany: jest.fn(),
      },
      product: {
        update: jest.fn(),
      },
    } as any;

    const service = new OrderService(prisma);
    return { service, prisma };
  };

  it("should reject webhook without identifiers", async () => {
    const { service } = createService();

    await expect(
      service.handleSquarePaymentWebhook({
        eventType: "PAYMENT_SUCCEEDED",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("should throw not found if order does not exist", async () => {
    const { service, prisma } = createService();
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      service.handleSquarePaymentWebhook({
        eventType: "PAYMENT_SUCCEEDED",
        squareTransactionId: "txn_1",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("should be idempotent for already paid square orders", async () => {
    const { service, prisma } = createService();
    prisma.order.findFirst.mockResolvedValue({
      id: "order-1",
      paymentMethod: "SQUARE",
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
    });

    const result = await service.handleSquarePaymentWebhook({
      eventType: "PAYMENT_SUCCEEDED",
      squareTransactionId: "txn_1",
    });

    expect(result).toEqual({
      id: "order-1",
      paymentMethod: "SQUARE",
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
