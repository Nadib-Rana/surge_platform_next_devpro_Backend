/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { AutopilotDispatchProcessor } from "./autopilot-dispatch.processor";

const mockRedisSet = jest.fn();
const mockRedisEval = jest.fn();

jest.mock("ioredis", () =>
  jest.fn().mockImplementation(() => ({
    set: mockRedisSet,
    eval: mockRedisEval,
  })),
);

describe("AutopilotDispatchProcessor", () => {
  const workspaceId = "13512611-3a7d-4a38-9fb3-cd095264e58f";
  const draftId = "9cd31741-9688-481e-8d35-93fae4c7bdcb";

  let prisma: any;
  let dispatcher: any;
  let failedPostsQueue: any;
  let processor: AutopilotDispatchProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisSet.mockResolvedValue("OK" as never);
    mockRedisEval.mockResolvedValue(1 as never);

    prisma = {
      generatedDraft: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      publishingChannel: {
        findMany: jest.fn(),
      },
      publishedPostsLog: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      failedPostsQueue: {
        create: jest.fn(),
      },
    };

    dispatcher = {
      dispatch: jest.fn(),
    };

    failedPostsQueue = {
      add: jest.fn(),
    };

    processor = new AutopilotDispatchProcessor(
      prisma,
      { get: jest.fn().mockReturnValue("redis://localhost:6379") } as any,
      dispatcher,
      failedPostsQueue,
    );
  });

  it("dispatches the selected draft with image URL and provider metadata", async () => {
    prisma.generatedDraft.findFirst.mockResolvedValue({
      id: draftId,
      workspaceId,
      wordpressHtmlContent: "<p>WordPress digest</p>",
      socialPlainText: "Social digest",
      imageUrl: "http://localhost:9000/surge-assets/fallback.png?signature=1",
      imageProvider: "openai",
    });
    prisma.publishingChannel.findMany.mockResolvedValue([
      {
        id: "channel-1",
        workspaceId,
        platform: "facebook",
        encryptedCredentials: JSON.stringify({
          accessToken: "test-token",
          target: "page-1",
        }),
      },
    ]);
    prisma.publishedPostsLog.findUnique.mockResolvedValue(null);
    prisma.publishedPostsLog.create.mockResolvedValue({ id: "log-1" });
    prisma.publishedPostsLog.update.mockResolvedValue({});
    prisma.generatedDraft.update.mockResolvedValue({});
    dispatcher.dispatch.mockResolvedValue({
      success: true,
      url: "https://facebook.com/post-1",
    });

    await expect(
      processor.process({
        id: "job-1",
        data: { workspaceId, draftId, triggerSource: "manual" },
      } as any),
    ).resolves.toEqual({ dispatched: true, draftId });

    expect(prisma.generatedDraft.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId,
        id: draftId,
        status: { in: ["approved", "scheduled", "auto_dispatch"] },
      },
      orderBy: { createdAt: "desc" },
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "facebook",
        content: "Social digest",
        images: ["http://localhost:9000/surge-assets/fallback.png?signature=1"],
        metadata: expect.objectContaining({
          draftId,
          workspaceId,
          imageProvider: "openai",
          hasGeneratedAsset: true,
        }),
      }),
    );
    expect(mockRedisEval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call"),
      1,
      `autopilot-lock:${draftId}`,
      expect.any(String),
    );
  });

  it("skips dispatch when the Redis idempotency lock is busy", async () => {
    mockRedisSet.mockResolvedValue(null as never);
    prisma.generatedDraft.findFirst.mockResolvedValue({
      id: draftId,
      workspaceId,
      wordpressHtmlContent: null,
      socialPlainText: "Social digest",
      imageUrl: null,
      imageProvider: null,
    });

    await expect(
      processor.process({
        id: "job-1",
        data: { workspaceId, draftId, triggerSource: "manual" },
      } as any),
    ).resolves.toEqual({ skipped: true, reason: "lock-busy" });

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(mockRedisEval).not.toHaveBeenCalled();
  });
});
