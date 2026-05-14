import { PrismaService } from "../common/context/prisma.service";
import { ShopService } from "./shop.service";
import {
  BadRequestException,
  NotFoundException,
} from "../common/exceptions/http.exceptions";

type PrismaMock = {
  category: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  product: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  cartItem: {
    findMany: jest.Mock;
    upsert: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

describe("ShopService", () => {
  const createService = () => {
    const prisma: PrismaMock = {
      category: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      cartItem: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const service = new ShopService(prisma as unknown as PrismaService);
    return { service, prisma };
  };

  it("should compute cart subtotal using discount price when available", async () => {
    const { service, prisma } = createService();

    prisma.cartItem.findMany.mockResolvedValue([
      {
        quantity: 2,
        product: { regularPrice: 100, discountPrice: 80, category: {} },
      },
      {
        quantity: 1,
        product: { regularPrice: 50, discountPrice: null, category: {} },
      },
    ]);

    const result = await service.getCart("user-1");
    expect(result.subtotal).toBe(210);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].product.regularPrice).toBe(100);
    expect(result.items[0].product.discountPrice).toBe(80);
  });

  it("should return product prices as numbers", async () => {
    const { service, prisma } = createService();

    prisma.product.findMany.mockResolvedValue([
      {
        id: "p1",
        title: "Bands",
        regularPrice: { valueOf: () => 19.99 },
        discountPrice: { valueOf: () => 15.99 },
        category: { id: "c1", name: "Supplements" },
      },
    ]);

    const result = await service.listProducts({});

    expect(result[0].regularPrice).toBe(19.99);
    expect(result[0].discountPrice).toBe(15.99);
  });

  it("should return a single active product", async () => {
    const { service, prisma } = createService();

    prisma.product.findFirst.mockResolvedValue({
      id: "p1",
      title: "Bands",
      description: "Premium latex band",
      regularPrice: { valueOf: () => 19.99 },
      discountPrice: { valueOf: () => 15.99 },
      category: { id: "c1", name: "Supplements" },
    });

    const result = await service.getProduct("p1");

    expect(result.id).toBe("p1");
    expect(result.regularPrice).toBe(19.99);
    expect(result.discountPrice).toBe(15.99);
  });

  it("should reject getProduct when product is missing or inactive", async () => {
    const { service, prisma } = createService();
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.getProduct("p1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("should reject addToCart when product not found", async () => {
    const { service, prisma } = createService();
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service.addToCart("user-1", { productId: "p1", quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("should reject addToCart when quantity exceeds stock", async () => {
    const { service, prisma } = createService();
    prisma.product.findUnique.mockResolvedValue({
      id: "p1",
      isActive: true,
      stockQuantity: 1,
    });

    await expect(
      service.addToCart("user-1", { productId: "p1", quantity: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
