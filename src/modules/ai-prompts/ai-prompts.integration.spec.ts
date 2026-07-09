import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EventEmitter } from "events";
import https from "https";
import { AiPromptsService } from "./ai-prompts.service";
import { AiAssetService } from "./ai-asset.service";
import { PrismaService } from "../../common/context/prisma.service";
import { StorageService } from "../storage/storage.service";

const mockOpenAIChatCreate = jest.fn();
const mockOpenAIImageGenerate = jest.fn();

jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockOpenAIChatCreate,
      },
    },
    images: {
      generate: mockOpenAIImageGenerate,
    },
  })),
}));

type PrismaMock = {
  rawPostsBuffer: { findMany: jest.Mock };
  promptVersion: { findUnique: jest.Mock; findFirst: jest.Mock };
  generatedDraft: { create: jest.Mock };
};

type SleepCapableAiPromptsService = {
  sleep: (delayMs: number) => Promise<void>;
};

describe("AiPromptsService Batch Digest Integration", () => {
  const workspaceId = "13512611-3a7d-4a38-9fb3-cd095264e58f";
  const promptVersionId = "9cd31741-9688-481e-8d35-93fae4c7bdcb";

  let moduleRef: TestingModule;
  let service: AiPromptsService;
  let prisma: PrismaMock;
  let storageService: { uploadBuffer: jest.Mock };

  const bufferedPosts = [
    {
      id: "raw-1",
      workspaceId,
      title: "AI search adoption accelerates",
      rawContent: "Enterprise buyers are adopting AI search for support teams.",
      status: "buffered",
      publishedAt: new Date("2026-07-09T09:00:00.000Z"),
    },
    {
      id: "raw-2",
      workspaceId,
      title: "Creator tools expand",
      rawContent: "Design teams are automating social content variations.",
      status: "buffered",
      publishedAt: new Date("2026-07-09T08:00:00.000Z"),
    },
    {
      id: "raw-3",
      workspaceId,
      title: "Cloud costs stabilize",
      rawContent: "Infrastructure teams are improving GPU workload scheduling.",
      status: "buffered",
      publishedAt: new Date("2026-07-09T07:00:00.000Z"),
    },
  ];

  const activePromptVersion = {
    id: promptVersionId,
    promptId: "prompt-1",
    versionTag: "v3",
    systemPrompt:
      "Create both WordPress HTML and concise social copy for a batch digest.",
    tone: "confident",
    isActive: true,
    aiPrompt: {
      id: "prompt-1",
      workspaceId,
      scope: "WORKSPACE",
      createdById: "user-1",
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      rawPostsBuffer: { findMany: jest.fn() },
      promptVersion: { findUnique: jest.fn(), findFirst: jest.fn() },
      generatedDraft: { create: jest.fn() },
    };

    storageService = {
      uploadBuffer: jest.fn(),
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        AiPromptsService,
        AiAssetService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "OPENAI_API_KEY") return "test-openai-key";
              if (key === "MINIO_BUCKET") return "surge-assets";
              return undefined;
            }),
          },
        },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = moduleRef.get(AiPromptsService);

    prisma.rawPostsBuffer.findMany.mockResolvedValue(bufferedPosts);
    prisma.promptVersion.findUnique.mockResolvedValue(activePromptVersion);
    prisma.generatedDraft.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => ({
        id: "draft-1",
        createdAt: new Date("2026-07-09T10:00:00.000Z"),
        ...data,
      }),
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await moduleRef.close();
  });

  it("generates social text, WordPress HTML, OpenAI image asset, and stores a pending batch digest draft", async () => {
    const socialPlainText =
      "AI search, creator automation, and smarter GPU scheduling are reshaping teams today.";
    const wordpressHtmlContent =
      "<article><h1>AI Daily Digest</h1><p>Enterprise teams are adopting AI search, content automation, and GPU scheduling improvements.</p></article>";
    const minioPresignedUrl =
      "http://localhost:9000/surge-assets/workspaces/13512611/assets/happy.png?X-Amz-Signature=success";

    mockOpenAIChatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              socialPlainText,
              wordpressHtmlContent,
            }),
          },
        },
      ],
    });
    mockOpenAIImageGenerate.mockResolvedValue({
      data: [{ url: "https://openai.example/assets/digest.png" }],
    });
    jest.spyOn(https, "get").mockImplementation(((_url, callback) => {
      const response = new EventEmitter() as EventEmitter & {
        statusCode: number;
      };
      response.statusCode = 200;

      process.nextTick(() => {
        const responseCallback = callback as (
          incoming: typeof response,
        ) => void;
        responseCallback(response);
        response.emit("data", Buffer.from("downloaded-openai-image"));
        response.emit("end");
      });

      return { on: jest.fn().mockReturnThis() } as never;
    }) as typeof https.get);
    storageService.uploadBuffer.mockResolvedValue(minioPresignedUrl);
    const sleepTarget = service as unknown as SleepCapableAiPromptsService;
    const sleepSpy = jest
      .spyOn(sleepTarget, "sleep")
      .mockImplementation(() => Promise.resolve());

    const result = await service.generateBatchDigest({
      workspaceId,
      promptVersionId,
      model: "gpt-4o-mini",
      limit: 3,
    });

    expect(mockOpenAIChatCreate).toHaveBeenCalledTimes(1);
    expect(sleepSpy).toHaveBeenCalledWith(3000);

    expect(prisma.rawPostsBuffer.findMany).toHaveBeenCalledWith({
      where: { workspaceId, status: "buffered" },
      orderBy: { publishedAt: "desc" },
      take: 3,
    });
    expect(prisma.promptVersion.findUnique).toHaveBeenCalledWith({
      where: { id: promptVersionId },
      include: { aiPrompt: true },
    });
    expect(mockOpenAIImageGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "dall-e-3",
        size: "1024x1024",
        quality: "standard",
        n: 1,
      }),
    );
    expect(storageService.uploadBuffer).toHaveBeenCalledWith(
      expect.stringContaining(`workspaces/${workspaceId}/assets/`),
      expect.any(Buffer),
      "image/png",
    );
    expect(prisma.generatedDraft.create).toHaveBeenCalledWith({
      data: {
        workspaceId,
        promptVersionId,
        rawPostId: null,
        generationType: "batch_digest",
        wordpressHtmlContent,
        socialPlainText,
        imageUrl: minioPresignedUrl,
        imageProvider: "openai",
        status: "pending",
      },
    });
    expect(result.draft.wordpressHtmlContent).toBe(wordpressHtmlContent);
    expect(result.draft.socialPlainText).toBe(socialPlainText);
    expect(result.draft.imageUrl).toBe(minioPresignedUrl);
    expect(result.draft.imageProvider).toBe("openai");
    expect(result.asset.usedFallback).toBe(false);
  });

  it("keeps generated text intact and stores a fallback MinIO asset when DALL-E is restricted", async () => {
    const socialPlainText =
      "Three trends to watch: AI search, automated content ops, and smarter cloud scheduling.";
    const wordpressHtmlContent =
      "<article><h1>Batch Digest</h1><p>AI search, creator tools, and cloud scheduling are moving from experiments into operating workflows.</p></article>";
    const fallbackPresignedUrl =
      "http://localhost:9000/surge-assets/workspaces/13512611/assets/fallback.png?X-Amz-Signature=fallback";

    mockOpenAIChatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: [
              `WORDPRESS HTML: ${wordpressHtmlContent}`,
              `SOCIAL TEXT: ${socialPlainText}`,
            ].join("\n"),
          },
        },
      ],
    });
    mockOpenAIImageGenerate.mockRejectedValue(
      Object.assign(new Error("400 Billing/Key Restriction"), {
        status: 400,
      }),
    );
    storageService.uploadBuffer.mockResolvedValue(fallbackPresignedUrl);
    const sleepTarget = service as unknown as SleepCapableAiPromptsService;
    const sleepSpy = jest
      .spyOn(sleepTarget, "sleep")
      .mockImplementation(() => Promise.resolve());

    const result = await service.generateBatchDigest({
      workspaceId,
      promptVersionId,
      model: "gpt-4o-mini",
      limit: 3,
    });

    expect(mockOpenAIChatCreate).toHaveBeenCalledTimes(1);
    expect(sleepSpy).toHaveBeenCalledWith(3000);

    const httpsGetSpy = jest.spyOn(https, "get");
    expect(httpsGetSpy).not.toHaveBeenCalled();
    expect(mockOpenAIImageGenerate).toHaveBeenCalledTimes(1);
    expect(storageService.uploadBuffer).toHaveBeenCalledWith(
      expect.stringContaining(`workspaces/${workspaceId}/assets/`),
      expect.any(Buffer),
      "image/png",
    );

    const uploadCall = storageService.uploadBuffer.mock.calls[0] as [
      string,
      Buffer,
      string,
    ];
    const uploadedBuffer = uploadCall[1];
    expect(Buffer.isBuffer(uploadedBuffer)).toBe(true);
    expect(uploadedBuffer.length).toBeGreaterThan(0);
    expect(prisma.generatedDraft.create).toHaveBeenCalledWith({
      data: {
        workspaceId,
        promptVersionId,
        rawPostId: null,
        generationType: "batch_digest",
        wordpressHtmlContent,
        socialPlainText,
        imageUrl: fallbackPresignedUrl,
        imageProvider: "openai",
        status: "pending",
      },
    });
    expect(result.draft.wordpressHtmlContent).toBe(wordpressHtmlContent);
    expect(result.draft.socialPlainText).toBe(socialPlainText);
    expect(result.draft.imageUrl).toBe(fallbackPresignedUrl);
    expect(result.draft.imageProvider).toBe("openai");
    expect(result.asset.usedFallback).toBe(true);
  });
});
