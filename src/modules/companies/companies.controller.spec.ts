import { Test, TestingModule } from "@nestjs/testing";
import { CompaniesController } from "./companies.controller";
import { CompaniesService } from "./companies.service";

describe("CompaniesController", () => {
  let controller: CompaniesController;
  const companiesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [{ provide: CompaniesService, useValue: companiesService }],
    }).compile();

    controller = module.get<CompaniesController>(CompaniesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
