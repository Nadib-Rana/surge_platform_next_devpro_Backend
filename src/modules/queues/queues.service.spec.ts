import { Test, TestingModule } from "@nestjs/testing";
import { QueuesService } from "./queues.service";
import { getQueueToken } from "@nestjs/bullmq";
import { NotFoundException } from "@nestjs/common";

describe("QueuesService", () => {
  let service: QueuesService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      getJobCounts: jest.fn().mockResolvedValue({ active: 1, completed: 2, failed: 3, delayed: 0, waiting: 0 }),
      getFailed: jest.fn().mockResolvedValue([
        {
          id: "job-1",
          name: "step-one",
          data: { x: 1 },
          failedReason: "API Timeout",
          stacktrace: ["Error: API Timeout at ..."],
          processedOn: 1719999900000,
          finishedOn: 1719999950000,
        },
      ]),
      getJob: jest.fn(),
      clean: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueuesService,
        {
          provide: getQueueToken("content-generation-queue"),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<QueuesService>(QueuesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getStats", () => {
    it("should return job counts from queue", async () => {
      const res = await service.getStats();
      expect(res["content-generation-queue"].active).toBe(1);
      expect(mockQueue.getJobCounts).toHaveBeenCalled();
    });
  });

  describe("getFailedJobs", () => {
    it("should map and return failed jobs", async () => {
      const res = await service.getFailedJobs();
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("job-1");
      expect(res[0].failedReason).toBe("API Timeout");
    });
  });

  describe("retryJob", () => {
    it("should retry job if in failed state", async () => {
      const mockJob = {
        id: "job-1",
        getState: jest.fn().mockResolvedValue("failed"),
        retry: jest.fn().mockResolvedValue(undefined),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const res = await service.retryJob("job-1");
      expect(res.message).toContain("retried");
      expect(mockJob.retry).toHaveBeenCalled();
    });

    it("should throw NotFoundException if job is not found", async () => {
      mockQueue.getJob.mockResolvedValue(null);
      await expect(service.retryJob("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw error if job is not failed state", async () => {
      const mockJob = {
        id: "job-1",
        getState: jest.fn().mockResolvedValue("active"),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);
      await expect(service.retryJob("job-1")).rejects.toThrow(
        /is not in a failed state/,
      );
    });
  });

  describe("cleanHistory", () => {
    it("should call clean on queue", async () => {
      const res = await service.cleanHistory();
      expect(res.message).toContain("cleaned");
      expect(mockQueue.clean).toHaveBeenCalledTimes(2);
    });
  });
});
