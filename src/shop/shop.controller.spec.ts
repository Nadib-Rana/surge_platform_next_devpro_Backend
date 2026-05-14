import { Test, TestingModule } from "@nestjs/testing";
import { ShopController } from "./shop.controller";
import { ShopService } from "./shop.service";

describe("ShopController", () => {
  let controller: ShopController;
  let service: jest.Mocked<ShopService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShopController],
      providers: [
        {
          provide: ShopService,
          useValue: {
            listCategoriesForAdmin: jest.fn(),
            createCategoryForAdmin: jest.fn(),
            updateCategoryForAdmin: jest.fn(),
            deleteCategoryForAdmin: jest.fn(),
            listProductsForAdmin: jest.fn(),
            createProductForAdmin: jest.fn(),
            updateProductForAdmin: jest.fn(),
            deleteProductForAdmin: jest.fn(),
            listCategories: jest.fn(),
            listProducts: jest.fn(),
            getProduct: jest.fn(),
            getCart: jest.fn(),
            addToCart: jest.fn(),
            updateCartItem: jest.fn(),
            removeCartItem: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ShopController>(ShopController);
    service = module.get(ShopService);
  });

  it("should call listCategories", async () => {
    service.listCategories.mockResolvedValue([] as never);
    await controller.listCategories();
    expect(service.listCategories).toHaveBeenCalledTimes(1);
  });

  it("should call listProducts with query dto", async () => {
    const query = { categoryId: "c1", onlyActive: "true", search: "pro" };
    service.listProducts.mockResolvedValue([] as never);

    await controller.listProducts(query);
    expect(service.listProducts).toHaveBeenCalledWith(query);
  });

  it("should call getProduct with product id", async () => {
    service.getProduct.mockResolvedValue({ id: "p1" } as never);

    await controller.getProduct("p1");

    expect(service.getProduct).toHaveBeenCalledWith("p1");
  });

  it("should call vendor admin category methods", async () => {
    service.listCategoriesForAdmin.mockResolvedValue([] as never);
    service.createCategoryForAdmin.mockResolvedValue({ id: "c1" } as never);
    service.updateCategoryForAdmin.mockResolvedValue({ id: "c1" } as never);
    service.deleteCategoryForAdmin.mockResolvedValue({ id: "c1" } as never);

    await controller.listCategoriesForAdmin();
    await controller.createCategoryForAdmin({ name: "Supplements" });
    await controller.updateCategoryForAdmin("c1", { name: "Gear" });
    await controller.deleteCategoryForAdmin("c1");

    expect(service.listCategoriesForAdmin).toHaveBeenCalled();
    expect(service.createCategoryForAdmin).toHaveBeenCalledWith({
      name: "Supplements",
    });
    expect(service.updateCategoryForAdmin).toHaveBeenCalledWith("c1", {
      name: "Gear",
    });
    expect(service.deleteCategoryForAdmin).toHaveBeenCalledWith("c1");
  });

  it("should call vendor admin product methods", async () => {
    const query = { onlyActive: "false" };

    service.listProductsForAdmin.mockResolvedValue([] as never);
    service.createProductForAdmin.mockResolvedValue({ id: "p1" } as never);
    service.updateProductForAdmin.mockResolvedValue({ id: "p1" } as never);
    service.deleteProductForAdmin.mockResolvedValue({ id: "p1" } as never);

    await controller.listProductsForAdmin(query);
    await controller.createProductForAdmin({
      categoryId: "11111111-1111-1111-1111-111111111111",
      title: "Bands",
      regularPrice: 19.99,
      stockQuantity: 20,
      isActive: true,
    });
    await controller.updateProductForAdmin("p1", { stockQuantity: 12 });
    await controller.deleteProductForAdmin("p1");

    expect(service.listProductsForAdmin).toHaveBeenCalledWith(query);
    expect(service.createProductForAdmin).toHaveBeenCalled();
    expect(service.updateProductForAdmin).toHaveBeenCalledWith("p1", {
      stockQuantity: 12,
    });
    expect(service.deleteProductForAdmin).toHaveBeenCalledWith("p1");
  });

  it("should call cart mutation methods with user id", async () => {
    service.getCart.mockResolvedValue({ items: [], subtotal: 0 } as never);
    service.addToCart.mockResolvedValue({ id: "i1" } as never);
    service.updateCartItem.mockResolvedValue({ id: "i1" } as never);
    service.removeCartItem.mockResolvedValue({ id: "i1" } as never);

    await controller.getCart("u1");
    await controller.addToCart("u1", { productId: "p1", quantity: 1 });
    await controller.updateCartItem("u1", "i1", { quantity: 2 });
    await controller.removeCartItem("u1", "i1");

    expect(service.getCart).toHaveBeenCalledWith("u1");
    expect(service.addToCart).toHaveBeenCalledWith("u1", {
      productId: "p1",
      quantity: 1,
    });
    expect(service.updateCartItem).toHaveBeenCalledWith("u1", "i1", {
      quantity: 2,
    });
    expect(service.removeCartItem).toHaveBeenCalledWith("u1", "i1");
  });
});
