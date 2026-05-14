import { Test, TestingModule } from "@nestjs/testing";
import { LmsController } from "./lms.controller";
import { LmsService } from "./lms.service";

describe("LmsController", () => {
  let controller: LmsController;
  let service: jest.Mocked<LmsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LmsController],
      providers: [
        {
          provide: LmsService,
          useValue: {
            listCategoriesForAdmin: jest.fn(),
            listAccessibleCategories: jest.fn(),
            listCategoryClasses: jest.fn(),
            createCategoryForAdmin: jest.fn(),
            getCategoryByIdForAdmin: jest.fn(),
            updateCategoryForAdmin: jest.fn(),
            deleteCategoryForAdmin: jest.fn(),
            listCategoryClassesForAdmin: jest.fn(),
            createClassForAdmin: jest.fn(),
            getClassByIdForAdmin: jest.fn(),
            updateClassForAdmin: jest.fn(),
            deleteClassForAdmin: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<LmsController>(LmsController);
    service = module.get(LmsService);
  });

  it("should call listAccessibleCategories for customer role", async () => {
    service.listAccessibleCategories.mockResolvedValue({
      categories: [],
    } as never);

    await controller.getCategories("u1", "customer");
    expect(service.listAccessibleCategories).toHaveBeenCalledWith("u1");
    expect(service.listCategoriesForAdmin).not.toHaveBeenCalled();
  });

  it("should call listCategoriesForAdmin for vendor role", async () => {
    service.listCategoriesForAdmin.mockResolvedValue([] as never);

    await controller.getCategories("u1", "vendor");
    expect(service.listCategoriesForAdmin).toHaveBeenCalled();
    expect(service.listAccessibleCategories).not.toHaveBeenCalled();
  });

  it("should call listCategoryClasses with user id and category id", async () => {
    service.listCategoryClasses.mockResolvedValue({ classes: [] } as never);

    await controller.getCategoryClasses("u1", { categoryId: "cat-1" });
    expect(service.listCategoryClasses).toHaveBeenCalledWith("u1", "cat-1");
  });

  it("should call createCategoryForAdmin", async () => {
    service.createCategoryForAdmin.mockResolvedValue({ id: "cat-1" } as never);

    await controller.createCategory({
      title: "Strength",
      description: "Strength training",
      thumbnailKey: "lms/strength.png",
    });

    expect(service.createCategoryForAdmin).toHaveBeenCalledWith({
      title: "Strength",
      description: "Strength training",
      thumbnailKey: "lms/strength.png",
    });
  });

  it("should call getCategoryByIdForAdmin", async () => {
    service.getCategoryByIdForAdmin.mockResolvedValue({ id: "cat-1" } as never);

    await controller.getCategoryById("cat-1");
    expect(service.getCategoryByIdForAdmin).toHaveBeenCalledWith("cat-1");
  });

  it("should call updateCategoryForAdmin", async () => {
    service.updateCategoryForAdmin.mockResolvedValue({ id: "cat-1" } as never);

    await controller.updateCategory("cat-1", { title: "Updated" });
    expect(service.updateCategoryForAdmin).toHaveBeenCalledWith("cat-1", {
      title: "Updated",
    });
  });

  it("should call deleteCategoryForAdmin", async () => {
    service.deleteCategoryForAdmin.mockResolvedValue({ id: "cat-1" } as never);

    await controller.deleteCategory("cat-1");
    expect(service.deleteCategoryForAdmin).toHaveBeenCalledWith("cat-1");
  });

  it("should call listCategoryClassesForAdmin", async () => {
    service.listCategoryClassesForAdmin.mockResolvedValue([] as never);

    await controller.listClassesByCategoryForAdmin("cat-1");
    expect(service.listCategoryClassesForAdmin).toHaveBeenCalledWith("cat-1");
  });

  it("should call createClassForAdmin", async () => {
    service.createClassForAdmin.mockResolvedValue({ id: "class-1" } as never);

    await controller.createClassForAdmin("cat-1", {
      classOrder: 1,
      title: "Class 1",
      subtitle: "Intro",
      trainerName: "Trainer A",
      achievements: ["ACE Certified", "5 years coaching"],
      equipmentName: ["Yoga Mat", "Dumbbells"],
      videoKey: "lms/videos/1.mp4",
      thumbKey: "lms/thumbs/1.jpg",
      durationSeconds: 600,
    });

    expect(service.createClassForAdmin).toHaveBeenCalledWith("cat-1", {
      classOrder: 1,
      title: "Class 1",
      subtitle: "Intro",
      trainerName: "Trainer A",
      achievements: ["ACE Certified", "5 years coaching"],
      equipmentName: ["Yoga Mat", "Dumbbells"],
      videoKey: "lms/videos/1.mp4",
      thumbKey: "lms/thumbs/1.jpg",
      durationSeconds: 600,
    });
  });

  it("should call getClassByIdForAdmin", async () => {
    service.getClassByIdForAdmin.mockResolvedValue({ id: "class-1" } as never);

    await controller.getClassByIdForAdmin("cat-1", "class-1");
    expect(service.getClassByIdForAdmin).toHaveBeenCalledWith(
      "cat-1",
      "class-1",
    );
  });

  it("should call updateClassForAdmin", async () => {
    service.updateClassForAdmin.mockResolvedValue({ id: "class-1" } as never);

    await controller.updateClassForAdmin("cat-1", "class-1", {
      title: "Updated class",
      trainerName: "Trainer B",
    });

    expect(service.updateClassForAdmin).toHaveBeenCalledWith(
      "cat-1",
      "class-1",
      { title: "Updated class", trainerName: "Trainer B" },
    );
  });

  it("should call deleteClassForAdmin", async () => {
    service.deleteClassForAdmin.mockResolvedValue({ id: "class-1" } as never);

    await controller.deleteClassForAdmin("cat-1", "class-1");
    expect(service.deleteClassForAdmin).toHaveBeenCalledWith(
      "cat-1",
      "class-1",
    );
  });
});
