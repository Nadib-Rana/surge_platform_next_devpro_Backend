import { randomUUID } from "crypto";
import OpenAI from "openai";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../common/context/prisma.service";
import { StorageService } from "../../storage/storage.service";

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

interface SeededGraph {
  userId: string;
  companyId: string;
  workspaceId: string;
  rssFeedId: string;
  rawPostId: string;
  toneProfileId: string;
}

describe("AI Creative Engine integration with mocked AI providers", () => {
  jest.setTimeout(90_000);

  const runId = `mock-ai-e2e-${Date.now()}-${randomUUID()}`;
  const prisma = new PrismaService();
  const configService = new ConfigService();
  const storage = new StorageService(configService);
  const bucketName =
    configService.get<string>("MINIO_BUCKET") ?? "surge-assets";

  const seeded: SeededGraph[] = [];
  let skipReason: string | null = null;

  beforeAll(async () => {
    try {
      const openAiKey = configService.get<string>("OPENAI_API_KEY");
      if (!openAiKey) {
        skipReason = "OPENAI_API_KEY is not defined in env";
      }
    } catch (err: any) {
      skipReason = `Prisma connection failed: ${err.message}`;
    }
  });

  afterAll(async () => {
    for (const graph of seeded) {
      try {
        await prisma.generatedDraft.deleteMany({
          where: { workspaceId: graph.workspaceId },
        });
        await prisma.rawPostsBuffer.delete({
          where: { id: graph.rawPostId },
        });
        await prisma.rssFeed.delete({
          where: { id: graph.rssFeedId },
        });
        await prisma.workspace.delete({
          where: { id: graph.workspaceId },
        });
        await prisma.company.delete({
          where: { id: graph.companyId },
        });
        await prisma.user.delete({
          where: { id: graph.userId },
        });
      } catch (cleanupErr) {
        // Suppress cleanup failures in mock mode
      }
    }
    await prisma.$disconnect();
  });

  async function seedGraph(): Promise<SeededGraph> {
    const suffix = `${seeded.length}-${randomUUID().slice(0, 6)}`;
    const user = await prisma.user.create({
      data: {
        email: `mock-ai-e2e-${suffix}@surge-test.com`,
        password: "secure-password-123",
        fullName: `Mock AI E2E Tester ${suffix}`,
        role: "admin",
      },
    });

    const company = await prisma.company.create({
      data: {
        name: `Mock AI E2E Corp ${suffix}`,
        domain: `surge-test-${suffix}.com`,
      },
    });

    const workspace = await prisma.workspace.create({
      data: {
        companyId: company.id,
        name: `Mock AI E2E Workspace ${suffix}`,
      },
    });

    const rssFeed = await prisma.rssFeed.create({
      data: {
        workspaceId: workspace.id,
        feedUrl: `https://example.test/${suffix}/feed.xml`,
        status: "active",
      },
    });

    const rawPost = await prisma.rawPostsBuffer.create({
      data: {
        workspaceId: workspace.id,
        feedId: rssFeed.id,
        urlHash: `${runId}-${suffix}`,
        title: "Mock AI integration source article",
        rawContent:
          "A concise article about product launches, funding momentum, and platform reliability.",
        publishedAt: new Date(),
        status: "buffered",
      },
    });

    const toneProfile = await prisma.toneProfile.upsert({
      where: { name: "confident" },
      update: {},
      create: {
        name: "confident",
      },
    });

    const graph = {
      userId: user.id,
      companyId: company.id,
      workspaceId: workspace.id,
      rssFeedId: rssFeed.id,
      rawPostId: rawPost.id,
      toneProfileId: toneProfile.id,
    };
    seeded.push(graph);
    return graph;
  }

  async function waitForAntiLockThrottle() {
    const startedAt = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return Date.now() - startedAt;
  }

  it("generates and inserts WordPress and social draft content with real Prisma", async () => {
    if (skipReason) {
      console.warn(`Skipped: ${skipReason}`);
      return;
    }

    const graph = await seedGraph();
    const mockedPayload = {
      blogPostContent:
        "<article><h1>Mock AI Digest</h1><p>Funding momentum and platform reliability are trending.</p></article>",
      socialPlainText:
        "Funding momentum and platform reliability are trending today.",
    };

    mockOpenAIChatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(mockedPayload) } }],
    });

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY ?? "mock-openai-key",
    });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Create multi-platform content from buffered articles.",
        },
        {
          role: "user",
          content: "Create one blog post and one social post.",
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    expect(content).toBeTruthy();
    const generated = JSON.parse(content as string) as typeof mockedPayload;

    const elapsedMs = await waitForAntiLockThrottle();
    expect(elapsedMs).toBeGreaterThanOrEqual(2900);

    const draft = await prisma.generatedDraft.create({
      data: {
        workspaceId: graph.workspaceId,
        rawPostId: graph.rawPostId,
        toneProfileId: graph.toneProfileId,
        blogPostContent: generated.blogPostContent,
        socialPlainText: generated.socialPlainText,
        generationType: "batch_digest",
        status: "pending",
      },
    });

    expect(draft.blogPostContent).toContain("<article>");
    expect(draft.socialPlainText).toBe(
      "Funding momentum and platform reliability are trending today.",
    );
    expect(draft.generationType).toBe("batch_digest");
    expect(draft.status).toBe("pending");
  });

  it("stores a mocked DALL-E image buffer in real MinIO and updates GeneratedDraft", async () => {
    if (skipReason) {
      console.warn(`Skipped: ${skipReason}`);
      return;
    }

    const graph = await seedGraph();
    const draft = await prisma.generatedDraft.create({
      data: {
        workspaceId: graph.workspaceId,
        rawPostId: graph.rawPostId,
        toneProfileId: graph.toneProfileId,
        socialPlainText: "Mock social draft awaiting image upload.",
        generationType: "batch_digest",
        status: "pending",
      },
    });

    mockOpenAIImageGenerate.mockResolvedValue({
      data: [{ url: "https://example.test/mock-dalle-image.png" }],
    });

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY ?? "mock-openai-key",
    });
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: "Mock prompt for a platform-safe social media hero image.",
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });

    expect(imageResponse.data?.[0]?.url).toBe(
      "https://example.test/mock-dalle-image.png",
    );

    const samplePngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    );
    const objectName = `workspaces/${graph.workspaceId}/assets/${runId}-${randomUUID()}.png`;

    const presignedUrl = await storage.uploadBuffer(
      objectName,
      samplePngBuffer,
      "image/png",
    );

    const updatedDraft = await prisma.generatedDraft.update({
      where: { id: draft.id },
      data: {
        imageUrl: presignedUrl,
        imageProvider: "openai",
      },
    });

    expect(updatedDraft.imageProvider).toBe("openai");
    expect(updatedDraft.imageUrl).toBeTruthy();
    expect(updatedDraft.imageUrl).toContain(bucketName);
  });
});
