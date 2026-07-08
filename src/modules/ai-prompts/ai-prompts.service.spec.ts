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
    aiPrompt: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
    promptVersion: { create: jest.Mock; findFirst: jest.Mock };
    rawPostsBuffer: { findMany: jest.Mock };
    generatedDraft: { create: jest.Mock };
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      aiPrompt: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
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
      createdById: "user-1",
      name: "Launch Digest",
      description: "Social digest prompt",
      systemPrompt: "Write a high-engagement digest",
      tone: "professional",
      versionTag: "v1",
    });

    expect(prisma.aiPrompt.create).toHaveBeenCalled();
    expect(prisma.promptVersion.create).toHaveBeenCalledWith(
      expect.objectContaining<{ data: unknown }>({
        data: expect.objectContaining<{ promptId: string; tone: string }>({
          promptId: "prompt-1",
          tone: "professional",
        }),
      }),
    );
    expect(result.prompt.id).toBe("prompt-1");
  });

  it("rejects global prompt creation for non-admin users", async () => {
    await expect(
      service.createPromptWithVersion(
        {
          scope: "GLOBAL",
          createdById: "user-1",
          name: "Global Digest",
          systemPrompt: "Write a high-engagement digest",
        },
        { userId: "user-1", role: "customer" },
      ),
    ).rejects.toThrow("Only admins can create global prompts");
  });

  it("allows global prompt creation for admins", async () => {
    prisma.aiPrompt.create.mockResolvedValue({ id: "prompt-1" });
    prisma.promptVersion.create.mockResolvedValue({ id: "version-1" });

    await service.createPromptWithVersion(
      {
        scope: "GLOBAL",
        createdById: "admin-1",
        name: "Global Digest",
        systemPrompt: "Write a high-engagement digest",
      },
      { userId: "admin-1", role: "admin" },
    );

    expect(prisma.aiPrompt.create).toHaveBeenCalledWith(
      expect.objectContaining<{ data: unknown }>({
        data: expect.objectContaining<{
          scope: "GLOBAL";
          workspaceId: null;
          createdById: string;
        }>({
          scope: "GLOBAL",
          workspaceId: null,
          createdById: "admin-1",
        }),
      }),
    );
  });

  it("lists only global prompts", async () => {
    prisma.aiPrompt.findMany.mockResolvedValue([
      { id: "global-prompt", scope: "GLOBAL", createdById: "admin-1" },
    ]);

    await service.findGlobalPrompts();

    expect(prisma.aiPrompt.findMany).toHaveBeenCalledWith({
      where: { scope: "GLOBAL" },
      include: { versions: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("lists only the user's own workspace prompts", async () => {
    prisma.aiPrompt.findMany.mockResolvedValue([
      { id: "workspace-prompt", scope: "WORKSPACE", createdById: "user-1" },
    ]);

    await service.findWorkspacePrompts({
      userId: "user-1",
      role: "customer",
    });

    expect(prisma.aiPrompt.findMany).toHaveBeenCalledWith({
      where: { scope: "WORKSPACE", createdById: "user-1" },
      include: { versions: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns a global prompt for any authenticated user", async () => {
    prisma.aiPrompt.findUnique.mockResolvedValue({
      id: "global-prompt",
      scope: "GLOBAL",
      createdById: "admin-1",
      versions: [],
    });

    const result = await service.findOne("global-prompt", {
      userId: "user-1",
      role: "customer",
    });

    expect(result.id).toBe("global-prompt");
  });

  it("hides another user's workspace prompt", async () => {
    prisma.aiPrompt.findUnique.mockResolvedValue({
      id: "workspace-prompt",
      scope: "WORKSPACE",
      createdById: "user-2",
      versions: [],
    });

    await expect(
      service.findOne("workspace-prompt", {
        userId: "user-1",
        role: "customer",
      }),
    ).rejects.toThrow("AI prompt workspace-prompt not found");
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
