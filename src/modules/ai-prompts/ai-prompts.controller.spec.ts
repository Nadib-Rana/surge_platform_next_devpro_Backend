import { Test, TestingModule } from "@nestjs/testing";
import { AiPromptsController } from "./ai-prompts.controller";
import { AiPromptsService } from "./ai-prompts.service";

describe("AiPromptsController", () => {
  let controller: AiPromptsController;
  const aiPromptsService = {
    create: jest.fn(),
    generateBatchDigest: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiPromptsController],
      providers: [{ provide: AiPromptsService, useValue: aiPromptsService }],
    }).compile();

    controller = module.get<AiPromptsController>(AiPromptsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
