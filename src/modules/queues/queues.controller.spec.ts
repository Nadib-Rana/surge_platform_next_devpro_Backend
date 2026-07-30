import { Test, TestingModule } from "@nestjs/testing";
import { QueuesController } from "./queues.controller";
import { QueuesService } from "./queues.service";

describe("QueuesController", () => {
  let controller: QueuesController;
  let service: any;

  beforeEach(async () => {
    service = {
      getStats: jest.fn().mockResolvedValue({
        "content-generation-queue": { active: 0, completed: 5, failed: 0, delayed: 0, waiting: 0 },
      }),
      getFailedJobs: jest.fn().mockResolvedValue([]),
      retryJob: jest.fn().mockResolvedValue({ message: "Job retried successfully" }),
      cleanHistory: jest.fn().mockResolvedValue({ message: "Queue history cleaned successfully" }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueuesController],
      providers: [{ provide: QueuesService, useValue: service }],
    }).compile();

    controller = module.get<QueuesController>(QueuesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getStats", () => {
    it("should return job status stats", async () => {
      const res = await controller.getStats();
      expect(res["content-generation-queue"]).toBeDefined();
      expect(service.getStats).toHaveBeenCalled();
    });
  });

  describe("getFailedJobs", () => {
    it("should return empty failed list", async () => {
      const res = await controller.getFailedJobs();
      expect(res).toEqual([]);
      expect(service.getFailedJobs).toHaveBeenCalled();
    });
  });

  describe("retryJob", () => {
    it("should call retryService", async () => {
      const res = await controller.retryJob("job-1");
      expect(res.message).toContain("retried");
      expect(service.retryJob).toHaveBeenCalledWith("job-1");
    });
  });

  describe("cleanHistory", () => {
    it("should clean queue logs", async () => {
      const res = await controller.cleanHistory();
      expect(res.message).toContain("cleaned");
      expect(service.cleanHistory).toHaveBeenCalled();
    });
  });
});
