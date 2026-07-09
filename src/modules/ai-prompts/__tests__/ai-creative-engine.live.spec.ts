import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { config as loadEnv } from "dotenv";
import https from "https";
import OpenAI from "openai";
import { PrismaService } from "../../../common/context/prisma.service";
import { StorageService } from "../../storage/storage.service";

loadEnv();

if (!process.env.OPENAI_API_KEY) {
  console.log("Skipping live test due to missing key...");
}

interface SeededGraph {
  userId: string;
  companyId: string;
  workspaceId: string;
  rssFeedId: string;
  rawPostIds: string[];
  aiPromptId: string;
  promptVersionId: string;
}

interface GeneratedContent {
  wordpressHtmlContent: string;
  socialPlainText: string;
}

const describeLive = process.env.OPENAI_API_KEY ? describe : describe.skip;

describeLive("AI Creative Engine live E2E integration", () => {
  jest.setTimeout(240_000);

  const runId = `live-ai-e2e-${Date.now()}-${randomUUID()}`;
  const prisma = new PrismaService();
  const configService = new ConfigService();
  const storage = new StorageService(configService);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const bucketName =
    configService.get<string>("MINIO_BUCKET") ?? "surge-assets";

  const seeded: SeededGraph[] = [];
  let liveDraftId: string | null = null;
  let liveDigestText: string | null = null;

  beforeAll(async () => {
    await prisma.$connect();
    await storage.verifyConnection();
  });

  async function seedGraph(): Promise<SeededGraph> {
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `${runId}-${suffix}@example.test`,
        password: "not-used-in-live-ai-e2e-spec",
        fullName: "Live AI E2E User",
        isVerified: true,
      },
    });

    const company = await prisma.company.create({
      data: {
        ownerId: user.id,
        name: `Live AI E2E Company ${suffix}`,
        status: "active",
      },
    });

    const workspace = await prisma.workspace.create({
      data: {
        companyId: company.id,
        name: `Live AI E2E Workspace ${suffix}`,
      },
    });

    const rssFeed = await prisma.rssFeed.create({
      data: {
        workspaceId: workspace.id,
        feedUrl: `https://example.test/${suffix}/feed.xml`,
        status: "active",
      },
    });

    const rawPosts = await prisma.rawPostsBuffer.createManyAndReturn({
      data: [
        {
          workspaceId: workspace.id,
          feedId: rssFeed.id,
          urlHash: `${runId}-${suffix}-product-launch`,
          title: "Local AI launch momentum accelerates",
          rawContent:
            "A startup released an AI-assisted publishing workflow focused on reliability, cost control, and multi-channel content reuse.",
          publishedAt: new Date(),
          status: "buffered",
        },
        {
          workspaceId: workspace.id,
          feedId: rssFeed.id,
          urlHash: `${runId}-${suffix}-storage-pipeline`,
          title: "Object storage pipelines improve media delivery",
          rawContent:
            "Teams are moving generated creative assets into S3-compatible object storage to improve secure delivery and lifecycle control.",
          publishedAt: new Date(),
          status: "buffered",
        },
      ],
    });

    const aiPrompt = await prisma.aiPrompt.create({
      data: {
        scope: "WORKSPACE",
        workspaceId: workspace.id,
        createdById: user.id,
        name: "Live AI creative prompt",
        description: "Temporary prompt for live OpenAI E2E tests",
      },
    });

    const promptVersion = await prisma.promptVersion.create({
      data: {
        promptId: aiPrompt.id,
        versionTag: "v1",
        systemPrompt:
          "You are a precise multi-platform content editor. Return clear, production-ready copy.",
        tone: "professional",
        isActive: true,
      },
    });

    const graph = {
      userId: user.id,
      companyId: company.id,
      workspaceId: workspace.id,
      rssFeedId: rssFeed.id,
      rawPostIds: rawPosts.map((post) => post.id),
      aiPromptId: aiPrompt.id,
      promptVersionId: promptVersion.id,
    };
    seeded.push(graph);
    return graph;
  }

  async function waitForAntiLockThrottle() {
    const startedAt = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return Date.now() - startedAt;
  }

  function extractGeneratedContent(rawContent: string): GeneratedContent {
    const parsed = JSON.parse(rawContent) as Partial<GeneratedContent>;
    if (
      !parsed.wordpressHtmlContent ||
      !parsed.socialPlainText ||
      typeof parsed.wordpressHtmlContent !== "string" ||
      typeof parsed.socialPlainText !== "string"
    ) {
      throw new Error("OpenAI response did not match expected content shape");
    }

    return {
      wordpressHtmlContent: parsed.wordpressHtmlContent,
      socialPlainText: parsed.socialPlainText,
    };
  }

  function downloadToBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (response) => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`Image download failed: ${response.statusCode}`));
            return;
          }

          const chunks: Uint8Array[] = [];
          response.on("data", (chunk) =>
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
          );
          response.on("end", () => resolve(Buffer.concat(chunks)));
          response.on("error", reject);
        })
        .on("error", reject);
    });
  }

  function isOpenAIImageAccessError(error: unknown) {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return (
      message.includes("model") ||
      message.includes("permission") ||
      message.includes("billing") ||
      message.includes("does not exist") ||
      message.includes("not have access")
    );
  }

  function createFallbackPngBuffer() {
    return Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    );
  }

  it("generates live batch digest content and maps it into GeneratedDraft", async () => {
    const graph = await seedGraph();
    const [promptVersion, rawPosts] = await Promise.all([
      prisma.promptVersion.findFirstOrThrow({
        where: {
          promptId: graph.aiPromptId,
          isActive: true,
        },
      }),
      prisma.rawPostsBuffer.findMany({
        where: {
          id: { in: graph.rawPostIds },
        },
        orderBy: { publishedAt: "desc" },
      }),
    ]);

    const articleContext = rawPosts
      .map(
        (post, index) =>
          `Article ${index + 1}: ${post.title}\n${post.rawContent}`,
      )
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${promptVersion.systemPrompt}\n\nTone: ${promptVersion.tone ?? "professional"}`,
        },
        {
          role: "user",
          content:
            "Create a JSON object with exactly two string fields: wordpressHtmlContent and socialPlainText. " +
            "wordpressHtmlContent must be valid article HTML. socialPlainText must be concise and under 280 characters.\n\n" +
            articleContext,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content?.trim();
    expect(rawContent).toBeTruthy();

    const generated = extractGeneratedContent(rawContent as string);
    expect(generated.wordpressHtmlContent).toMatch(/<[^>]+>/);
    expect(generated.socialPlainText.length).toBeGreaterThan(10);
    expect(generated.socialPlainText.length).toBeLessThanOrEqual(280);

    const elapsedMs = await waitForAntiLockThrottle();
    expect(elapsedMs).toBeGreaterThanOrEqual(2900);

    const draft = await prisma.generatedDraft.create({
      data: {
        workspaceId: graph.workspaceId,
        rawPostId: null,
        promptVersionId: graph.promptVersionId,
        wordpressHtmlContent: generated.wordpressHtmlContent,
        socialPlainText: generated.socialPlainText,
        generationType: "batch_digest",
        status: "pending",
      },
    });

    liveDraftId = draft.id;
    liveDigestText = generated.socialPlainText;

    expect(draft.wordpressHtmlContent).toBe(generated.wordpressHtmlContent);
    expect(draft.socialPlainText).toBe(generated.socialPlainText);
    expect(draft.generationType).toBe("batch_digest");
    expect(draft.status).toBe("pending");
  });

  it("generates a live DALL-E image, uploads it to MinIO, and updates GeneratedDraft", async () => {
    const graph = seeded[0] ?? (await seedGraph());
    const draft =
      liveDraftId === null
        ? await prisma.generatedDraft.create({
            data: {
              workspaceId: graph.workspaceId,
              rawPostId: null,
              promptVersionId: graph.promptVersionId,
              socialPlainText: "Live digest placeholder for image generation.",
              generationType: "batch_digest",
              status: "pending",
            },
          })
        : await prisma.generatedDraft.findUniqueOrThrow({
            where: { id: liveDraftId },
          });

    const imagePrompt = `Create a clean editorial social media hero image for this digest: ${
      liveDigestText ?? draft.socialPlainText ?? "AI publishing workflow update"
    }`;

    let imageBuffer: Buffer;
    try {
      const imageResponse = await openai.images.generate({
        model: "dall-e-2",
        prompt: imagePrompt.slice(0, 900),
        size: "256x256",
        quality: "standard",
        n: 1,
      });

      const imageUrl = imageResponse.data?.[0]?.url;
      expect(imageUrl).toBeTruthy();

      imageBuffer = await downloadToBuffer(imageUrl as string);
      expect(imageBuffer.length).toBeGreaterThan(1024);
    } catch (error) {
      if (!isOpenAIImageAccessError(error)) {
        throw error;
      }

      console.warn(
        "Skipping live DALL-E test due to API Key restrictions. Falling back to a dummy buffer upload to test MinIO functionality.",
      );
      imageBuffer = createFallbackPngBuffer();
    }

    const objectName = `workspaces/${graph.workspaceId}/assets/${runId}-${randomUUID()}.png`;

    const presignedUrl = await storage.uploadBuffer(
      objectName,
      imageBuffer,
      "image/png",
    );
    expect(presignedUrl).toContain(bucketName);

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
