import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AiPromptsService } from "./ai-prompts.service";
import { PrismaService } from "../../common/context/prisma.service";
import { AiAssetService } from "./ai-asset.service";

const mockOpenAIChatCreate = jest.fn();
const mockAnthropicMessagesCreate = jest.fn();

jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockOpenAIChatCreate,
      },
    },
  })),
}));

jest.mock("@anthropic-ai/sdk", () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: mockAnthropicMessagesCreate,
    },
  })),
}));

describe("AiPromptsService", () => {
  let service: AiPromptsService;
  let prisma: {
    aiPrompt: { create: jest.Mock };
    promptVersion: { create: jest.Mock; findFirst: jest.Mock };
    rawPostsBuffer: { findMany: jest.Mock };
    generatedDraft: { create: jest.Mock };
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      aiPrompt: { create: jest.fn() },
      promptVersion: { create: jest.fn(), findFirst: jest.fn() },
      rawPostsBuffer: { findMany: jest.fn() },
      generatedDraft: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiPromptsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "OPENAI_API_KEY") return "test-key";
              if (key === "ANTHROPIC_API_KEY") return "anthropic-key";
              return undefined;
            }),
          },
        },
        {
          provide: AiAssetService,
          useValue: {
            generateImageFromDigest: jest
              .fn()
              .mockResolvedValue({ imageUrl: "https://example.com/asset.png" }),
          },
        },
      ],
    }).compile();

    service = module.get<AiPromptsService>(AiPromptsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("creates a prompt and initial version", async () => {
    prisma.aiPrompt.create.mockResolvedValue({ id: "prompt-1" });
    prisma.promptVersion.create.mockResolvedValue({ id: "version-1" });

    const result = await service.createPromptWithVersion({
      workspaceId: "workspace-1",
      name: "Launch Digest",
      description: "Social digest prompt",
      systemPrompt: "Write a high-engagement digest",
      tone: "professional",
      versionTag: "v1",
    });

    expect(prisma.aiPrompt.create).toHaveBeenCalled();
    expect(prisma.promptVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptId: "prompt-1",
          tone: "professional",
        }),
      }),
    );
    expect(result.prompt.id).toBe("prompt-1");
  });

  it("uses Anthropic Claude when the request targets a Claude model", async () => {
    prisma.rawPostsBuffer.findMany.mockResolvedValue([
      { title: "Launch", rawContent: "Body" },
    ]);
    prisma.promptVersion.findFirst.mockResolvedValue({
      id: "version-1",
      systemPrompt: "You are a copywriter",
      tone: "professional",
      aiPrompt: { workspaceId: "workspace-1" },
    });
    prisma.generatedDraft.create.mockResolvedValue({ id: "draft-1" });

    mockAnthropicMessagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Claude digest" }],
    });

    await service.generateBatchDigest({
      workspaceId: "workspace-1",
      model: "claude-3-5-sonnet-latest",
    });

    expect(mockAnthropicMessagesCreate).toHaveBeenCalled();
    expect(prisma.generatedDraft.create).toHaveBeenCalled();
  });
});
