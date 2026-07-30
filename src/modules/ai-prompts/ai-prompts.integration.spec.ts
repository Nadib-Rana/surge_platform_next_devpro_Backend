import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { getQueueToken } from "@nestjs/bullmq";
import { EventEmitter } from "events";
import https from "https";
import { AiPromptsService } from "./ai-prompts.service";
import { AiAssetService } from "./ai-asset.service";
import { PrismaService } from "../../common/context/prisma.service";
import { StorageService } from "../storage/storage.service";
import { ContentGenerationProcessor } from "./content-generation.processor";
import { GeneratedDraftsService } from "../generated-drafts/generated-drafts.service";

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
  generatedDraft: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
  toneProfile: { findFirst: jest.Mock };
};

type SleepCapableAiPromptsService = {
  sleep: (delayMs: number) => Promise<void>;
};

describe("AiPromptsService Batch Digest Integration", () => {
  const workspaceId = "13512611-3a7d-4a38-9fb3-cd095264e58f";
  const toneProfileId = "tone-profile-1";

  let moduleRef: TestingModule;
  let service: AiPromptsService;
  let processor: ContentGenerationProcessor;
  let prisma: PrismaMock;
  let storageService: { uploadBuffer: jest.Mock };
  const mockQueue = {
    add: jest.fn(),
  };

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

  const mockToneProfile = {
    id: toneProfileId,
    name: "confident",
    stepOneRawDraftPrompt: {
      id: "step1-id",
      toneProfileId,
      title: "Step 1 Prompt",
      systemPrompt: "Create both WordPress HTML and concise social copy for a batch digest.",
      template: "Use the following raw articles for context:\n{{articleContext}}\n\nRespond strictly in valid JSON format with keys: blogPostContent, imagePrompt.",
    },
    stepTwoPolishingPrompt: {
      id: "step2-id",
      toneProfileId,
      title: "Step 2 Prompt",
      systemPrompt: "You are a professional content editor. Take the following raw blog post draft and polish it. Improve grammar, formatting, structure, and tone.",
      template: "Tone: {{tone}}\nAudience: {{audience}}\n\nRaw draft content:\n{{blogPostContent}}\n\nRespond strictly in valid JSON format with keys: blogPostContent, socialPlainText, hashtags.",
    },
    stepThreeImagePrompt: {
      id: "step3-id",
      toneProfileId,
      title: "Step 3 Prompt",
      systemPrompt: "Analyze the polished blog post and generate a detailed image generation prompt suitable for DALL-E.",
      template: "Polished Content:\n{{blogPostContent}}\n\nRespond strictly in valid JSON format with key: imagePrompt.",
    },
  };

  const mockWorkspace = {
    id: workspaceId,
    name: "Test Workspace",
    queueConfig: JSON.stringify({ stepDelayMs: 100 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      rawPostsBuffer: { findMany: jest.fn() },
      generatedDraft: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      toneProfile: { findFirst: jest.fn() },
    };

    storageService = {
      uploadBuffer: jest.fn(),
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        AiPromptsService,
        AiAssetService,
        ContentGenerationProcessor,
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
        {
          provide: getQueueToken("content-generation-queue"),
          useValue: mockQueue,
        },
        {
          provide: GeneratedDraftsService,
          useValue: {
            applyAutoPostPolicy: jest.fn().mockImplementation(async (id) => {
              return { id, status: "READY_FOR_REVIEW", blogPostContent: "Polished blog post content" };
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AiPromptsService);
    processor = moduleRef.get(ContentGenerationProcessor);

    prisma.rawPostsBuffer.findMany.mockResolvedValue(bufferedPosts);
    prisma.toneProfile.findFirst.mockResolvedValue(mockToneProfile);

    let currentDraft: any = null;

    prisma.generatedDraft.create.mockImplementation(
      ({ data }: { data: Record<string, any> }) => {
        currentDraft = {
          id: "draft-1",
          createdAt: new Date("2026-07-09T10:00:00.000Z"),
          workspace: mockWorkspace,
          ...data,
        };
        return currentDraft;
      },
    );
    prisma.generatedDraft.update.mockImplementation(
      ({ data }: { data: Record<string, any> }) => {
        currentDraft = {
          ...currentDraft,
          ...data,
        };
        return currentDraft;
      },
    );
    prisma.generatedDraft.findUnique.mockImplementation(() => {
      return currentDraft;
    });

    mockQueue.add.mockImplementation(async (name, data, opts) => {
      // Synchronously execute the processor steps to simulate queue background process execution
      if (name === "step-one") {
        await processor.process({ name: "step-one", data, id: "job-1" } as any);
      } else if (name === "step-two") {
        await processor.process({ name: "step-two", data, id: "job-2" } as any);
      } else if (name === "step-three") {
        await processor.process({ name: "step-three", data, id: "job-3" } as any);
      }
      return { id: "job-id" };
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await moduleRef.close();
  });

  it("generates social text, WordPress HTML, OpenAI image asset, and stores a pending batch digest draft", async () => {
    const socialPlainText =
      "AI search, creator automation, and smarter GPU scheduling are reshaping teams today.";
    const blogPostContent =
      "<article><h1>AI Daily Digest</h1><p>Enterprise teams are adopting AI search, content automation, and GPU scheduling improvements.</p></article>";
    const minioPresignedUrl =
      "http://localhost:9000/surge-assets/workspaces/13512611/assets/happy.png?X-Amz-Signature=success";

    mockOpenAIChatCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                blogPostContent,
                imagePrompt: "High quality image prompt",
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                blogPostContent: "Polished blog post content",
                socialPlainText,
                hashtags: ["ai", "automation"],
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                imagePrompt: "High quality image prompt",
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
    const sleepTarget = processor as any;
    const sleepSpy = jest
      .spyOn(sleepTarget, "sleep")
      .mockImplementation(() => Promise.resolve());

    const result = await service.generateBatchDigest({
      workspaceId,
      tone: "confident",
      model: "gpt-4o-mini",
      limit: 3,
    });

    expect(result).toEqual({ message: "Generation process started" });
    expect(mockQueue.add).toHaveBeenCalledWith("step-one", expect.any(Object), expect.any(Object));

    expect(mockOpenAIChatCreate).toHaveBeenCalledTimes(3);

    expect(prisma.rawPostsBuffer.findMany).toHaveBeenCalledWith({
      where: { workspaceId, status: "buffered" },
      orderBy: { publishedAt: "desc" },
      take: 3,
    });
    expect(prisma.toneProfile.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: "confident", mode: "insensitive" } },
      include: { stepOneRawDraftPrompt: true },
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
        toneProfileId,
        rawPostId: null,
        generationType: "batch_digest",
        blogPostContent,
        socialPlainText: "",
        imageUrl: null,
        imageProvider: null,
        status: "RAW_DRAFT",
      },
      include: {
        workspace: true,
      },
    });
    expect(prisma.generatedDraft.update).toHaveBeenCalledWith({
      where: { id: "draft-1" },
      data: {
        blogPostContent: "Polished blog post content",
        socialPlainText,
        status: "POLISHED",
      },
    });
  });

  it("keeps generated text intact and stores a fallback MinIO asset when DALL-E is restricted", async () => {
    const socialPlainText =
      "Three trends to watch: AI search, automated content ops, and smarter cloud scheduling.";
    const blogPostContent =
      "<article><h1>Batch Digest</h1><p>AI search, creator tools, and cloud scheduling are moving from experiments into operating workflows.</p></article>";
    const fallbackPresignedUrl =
      "http://localhost:9000/surge-assets/workspaces/13512611/assets/fallback.png?X-Amz-Signature=fallback";

    mockOpenAIChatCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                blogPostContent,
                imagePrompt: "High quality image prompt",
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                blogPostContent: "Polished blog post content",
                socialPlainText,
                hashtags: ["ai", "automation"],
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                imagePrompt: "High quality image prompt",
              }),
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
    const sleepTarget = processor as any;
    const sleepSpy = jest
      .spyOn(sleepTarget, "sleep")
      .mockImplementation(() => Promise.resolve());

    const result = await service.generateBatchDigest({
      workspaceId,
      tone: "confident",
      model: "gpt-4o-mini",
      limit: 3,
    });

    expect(result).toEqual({ message: "Generation process started" });
    expect(mockOpenAIChatCreate).toHaveBeenCalledTimes(3);

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
        toneProfileId,
        rawPostId: null,
        generationType: "batch_digest",
        blogPostContent,
        socialPlainText: "",
        imageUrl: null,
        imageProvider: null,
        status: "RAW_DRAFT",
      },
      include: {
        workspace: true,
      },
    });
    expect(prisma.generatedDraft.update).toHaveBeenCalledWith({
      where: { id: "draft-1" },
      data: {
        blogPostContent: "Polished blog post content",
        socialPlainText,
        status: "POLISHED",
      },
    });
  });
});
