import { Test, TestingModule } from "@nestjs/testing";
import { AiPromptsService } from "./ai-prompts.service";
import { getQueueToken } from "@nestjs/bullmq";

describe("AiPromptsService", () => {
  let service: AiPromptsService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: "job-id" }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiPromptsService,
        {
          provide: getQueueToken("content-generation-queue"),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<AiPromptsService>(AiPromptsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("generateBatchDigest", () => {
    it("should add job to queue and return success message", async () => {
      const dto = {
        workspaceId: "workspace-1",
        tone: "confident",
        model: "gpt-4o",
        limit: 3,
      };

      const result = await service.generateBatchDigest(dto);

      expect(result).toEqual({ message: "Generation process started" });
      expect(mockQueue.add).toHaveBeenCalledWith("step-one", dto, {
        removeOnComplete: true,
        removeOnFail: 100,
      });
    });
  });
});
