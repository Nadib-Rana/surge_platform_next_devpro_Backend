import { Test, TestingModule } from "@nestjs/testing";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

describe("OrderController", () => {
  let controller: OrderController;
  let service: jest.Mocked<OrderService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: {
            handleSquarePaymentWebhook: jest.fn(),
            checkout: jest.fn(),
            listMyOrders: jest.fn(),
            listOrdersForAdmin: jest.fn(),
            confirmCodOrder: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);
    service = module.get(OrderService);
  });

  it("should route square webhook payload to service", async () => {
    const payload = {
      eventType: "PAYMENT_SUCCEEDED",
      squareTransactionId: "txn-1",
    };
    service.handleSquarePaymentWebhook.mockResolvedValue({ id: "o1" } as never);

    await controller.handleSquareWebhook(payload);
    expect(service.handleSquarePaymentWebhook).toHaveBeenCalledWith(payload);
  });

  it("should call checkout and myOrders with user id", async () => {
    service.checkout.mockResolvedValue({ id: "o1" } as never);
    service.listMyOrders.mockResolvedValue([] as never);

    await controller.checkout("u1", {
      paymentMethod: "COD",
    });
    await controller.myOrders("u1");

    expect(service.checkout).toHaveBeenCalledWith("u1", {
      paymentMethod: "COD",
    });
    expect(service.listMyOrders).toHaveBeenCalledWith("u1");
  });

  it("should call confirmCodOrder with route param", async () => {
    service.confirmCodOrder.mockResolvedValue({ id: "o1" } as never);

    await controller.confirmCod("o1");
    expect(service.confirmCodOrder).toHaveBeenCalledWith("o1");
  });

  it("should call listOrdersForAdmin", async () => {
    service.listOrdersForAdmin.mockResolvedValue([] as never);

    await controller.listOrdersForAdmin();
    expect(service.listOrdersForAdmin).toHaveBeenCalledTimes(1);
  });
});
