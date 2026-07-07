import { Test, TestingModule } from "@nestjs/testing";
import { GeneratedDraftsController } from "./generated-drafts.controller";
import { GeneratedDraftsService } from "./generated-drafts.service";

describe("GeneratedDraftsController", () => {
  let controller: GeneratedDraftsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeneratedDraftsController],
      providers: [GeneratedDraftsService],
    }).compile();

    controller = module.get<GeneratedDraftsController>(
      GeneratedDraftsController,
    );
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
