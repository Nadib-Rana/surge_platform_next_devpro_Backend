import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AiPromptsService } from "./ai-prompts.service";
import { PrismaService } from "../../common/context/prisma.service";
import { AiAssetService } from "./ai-asset.service";
import { GeneratedDraftsService } from "../generated-drafts/generated-drafts.service";
import { getQueueToken } from "@nestjs/bullmq";

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
    $transaction: jest.Mock;
    aiPrompt: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    promptVersion: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
    };
    rawPostsBuffer: { findMany: jest.Mock };
    generatedDraft: { create: jest.Mock };
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) =>
        callback(prisma),
      ),
      aiPrompt: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      promptVersion: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        updateMany: jest.fn(),
      },
      rawPostsBuffer: { findMany: jest.fn() },
      generatedDraft: { create: jest.fn() },
    };

    const mockQueue = {
      add: jest.fn(),
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
        {
          provide: GeneratedDraftsService,
          useValue: {
            applyAutoPostPolicy: jest.fn(),
          },
        },
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

  it("updates a global prompt by scope-filtered lookup", async () => {
    prisma.aiPrompt.findFirst.mockResolvedValue({
      id: "global-prompt",
      scope: "GLOBAL",
      name: "Global Digest",
      description: null,
    });
    prisma.aiPrompt.update.mockResolvedValue(undefined);
    prisma.aiPrompt.findUnique.mockResolvedValue({
      id: "global-prompt",
      scope: "GLOBAL",
      workspaceId: null,
      name: "Updated Global Digest",
      versions: [{ id: "version-1", isActive: true }],
    });

    const result = await service.updateGlobalPrompt("global-prompt", {
      name: "Updated Global Digest",
    });

    expect(prisma.aiPrompt.findFirst).toHaveBeenCalledWith({
      where: { id: "global-prompt", scope: "GLOBAL" },
    });
    expect(prisma.aiPrompt.update).toHaveBeenCalledWith({
      where: { id: "global-prompt" },
      data: {
        name: "Updated Global Digest",
        description: null,
      },
    });
    expect(prisma.promptVersion.create).not.toHaveBeenCalled();
    expect(prisma.aiPrompt.findUnique).toHaveBeenCalledWith({
      where: { id: "global-prompt" },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    expect(result.versions[0].isActive).toBe(true);
  });

  it("updates only the user's own workspace prompt", async () => {
    prisma.aiPrompt.findFirst.mockResolvedValue({
      id: "workspace-prompt",
      scope: "WORKSPACE",
      createdById: "user-1",
      name: "Workspace Digest",
      description: null,
    });
    prisma.aiPrompt.update.mockResolvedValue(undefined);
    prisma.aiPrompt.findUnique.mockResolvedValue({
      id: "workspace-prompt",
      scope: "WORKSPACE",
      workspaceId: "workspace-1",
      name: "Updated Workspace Digest",
      versions: [{ id: "version-1", isActive: true }],
    });

    await service.updateWorkspacePrompt(
      "workspace-prompt",
      { name: "Updated Workspace Digest" },
      { userId: "user-1", role: "customer" },
    );

    expect(prisma.aiPrompt.findFirst).toHaveBeenCalledWith({
      where: {
        id: "workspace-prompt",
        scope: "WORKSPACE",
        createdById: "user-1",
      },
    });
    expect(prisma.aiPrompt.update).toHaveBeenCalledWith({
      where: { id: "workspace-prompt" },
      data: {
        name: "Updated Workspace Digest",
        description: null,
      },
    });
  });

  it("creates a new active prompt version inside the update transaction", async () => {
    prisma.aiPrompt.findFirst.mockResolvedValue({
      id: "workspace-prompt",
      scope: "WORKSPACE",
      createdById: "user-1",
      name: "Workspace Digest",
      description: "Digest prompt",
    });
    prisma.aiPrompt.update.mockResolvedValue(undefined);
    prisma.promptVersion.findFirst.mockResolvedValue({
      id: "version-1",
      systemPrompt: "Old system prompt",
      tone: "professional",
      isActive: true,
    });
    prisma.promptVersion.count.mockResolvedValue(1);
    prisma.aiPrompt.findUnique.mockResolvedValue({
      id: "workspace-prompt",
      scope: "WORKSPACE",
      name: "Workspace Digest",
      versions: [
        {
          id: "version-2",
          systemPrompt: "Old system prompt",
          tone: "casual",
          isActive: true,
        },
      ],
    });

    const result = await service.updateWorkspacePrompt(
      "workspace-prompt",
      { tone: "casual" },
      { userId: "user-1", role: "customer" },
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.promptVersion.findFirst).toHaveBeenCalledWith({
      where: { promptId: "workspace-prompt", isActive: true },
      orderBy: { createdAt: "desc" },
    });
    expect(prisma.promptVersion.updateMany).toHaveBeenCalledWith({
      where: { promptId: "workspace-prompt" },
      data: { isActive: false },
    });
    expect(prisma.promptVersion.create).toHaveBeenCalledWith({
      data: {
        promptId: "workspace-prompt",
        versionTag: "v2",
        systemPrompt: "Old system prompt",
        tone: "casual",
        isActive: true,
      },
    });
    expect(result.versions[0].tone).toBe("casual");
  });

  it("hides another user's workspace prompt during update", async () => {
    prisma.aiPrompt.findFirst.mockResolvedValue(null);

    await expect(
      service.updateWorkspacePrompt(
        "workspace-prompt",
        { name: "Updated Workspace Digest" },
        { userId: "user-1", role: "customer" },
      ),
    ).rejects.toThrow("AI prompt workspace-prompt not found");
  });

  it("enqueues the content generation job to the queue", async () => {
    const mockQueue = (service as any).contentGenerationQueue;
    const addSpy = jest.spyOn(mockQueue, "add");

    const result = await service.generateBatchDigest({
      workspaceId: "workspace-1",
      model: "claude-3-5-sonnet-latest",
    });

    expect(result).toEqual({ message: "Generation process started" });
    expect(addSpy).toHaveBeenCalledWith(
      "step-one",
      {
        workspaceId: "workspace-1",
        model: "claude-3-5-sonnet-latest",
      },
      expect.any(Object),
    );
  });
});
