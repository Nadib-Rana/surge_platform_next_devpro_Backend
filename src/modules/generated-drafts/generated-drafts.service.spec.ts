import { Test, TestingModule } from "@nestjs/testing";
import { GeneratedDraftsService } from "./generated-drafts.service";

describe("GeneratedDraftsService", () => {
  let service: GeneratedDraftsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeneratedDraftsService],
    }).compile();

    service = module.get<GeneratedDraftsService>(GeneratedDraftsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
