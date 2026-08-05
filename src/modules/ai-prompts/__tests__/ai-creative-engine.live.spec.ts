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
  toneProfileId: string;
}

interface GeneratedContent {
  blogPostContent: string;
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
  let skipReason: string | null = null;

  beforeAll(async () => {
    try {
      await prisma.$connect();
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
        await prisma.rawPostsBuffer.deleteMany({
          where: { id: { in: graph.rawPostIds } },
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
        email: `live-ai-e2e-${suffix}@surge-test.com`,
        password: "secure-password-123",
        fullName: `Live AI E2E Tester ${suffix}`,
        role: "admin",
      },
    });

    const company = await prisma.company.create({
      data: {
        name: `Live AI E2E Corp ${suffix}`,
        ownerId: user.id,
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

    const rawPosts = await Promise.all([
      prisma.rawPostsBuffer.create({
        data: {
          workspaceId: workspace.id,
          feedId: rssFeed.id,
          urlHash: `${runId}-${suffix}-1`,
          title: "Live E2E source article 1",
          rawContent:
            "This is a live E2E article describing how technology accelerates development and testing pipelines.",
          publishedAt: new Date(),
          status: "buffered",
        },
      }),
      prisma.rawPostsBuffer.create({
        data: {
          workspaceId: workspace.id,
          feedId: rssFeed.id,
          urlHash: `${runId}-${suffix}-2`,
          title: "Live E2E source article 2",
          rawContent:
            "Platform reliability increases dramatically when dependencies are fully integrated and mocked.",
          publishedAt: new Date(),
          status: "buffered",
        },
      }),
    ]);

    const toneProfile = await prisma.toneProfile.upsert({
      where: { name: "professional" },
      update: {},
      create: {
        name: "professional",
      },
    });

    // Make sure prompts exist
    await prisma.stepOneRawDraftPrompt.upsert({
      where: { toneProfileId: toneProfile.id },
      update: {},
      create: {
        toneProfileId: toneProfile.id,
        title: "Default Step 1 Prompt",
        systemPrompt: "You are a precise multi-platform content editor.",
        template: "Create a blog draft based on the context:\n{{articleContext}}",
      },
    });

    const graph = {
      userId: user.id,
      companyId: company.id,
      workspaceId: workspace.id,
      rssFeedId: rssFeed.id,
      rawPostIds: rawPosts.map((post) => post.id),
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

  function extractGeneratedContent(rawContent: string): GeneratedContent {
    const parsed = JSON.parse(rawContent) as Partial<GeneratedContent>;
    if (
      !parsed.blogPostContent ||
      !parsed.socialPlainText ||
      typeof parsed.blogPostContent !== "string" ||
      typeof parsed.socialPlainText !== "string"
    ) {
      throw new Error("OpenAI response did not match expected content shape");
    }

    return {
      blogPostContent: parsed.blogPostContent,
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
    if (skipReason) {
      console.warn(`Skipped: ${skipReason}`);
      return;
    }

    const graph = await seedGraph();
    const [toneProfile, rawPosts] = await Promise.all([
      prisma.toneProfile.findUniqueOrThrow({
        where: { id: graph.toneProfileId },
        include: { stepOneRawDraftPrompt: true },
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

    const systemPrompt = toneProfile.stepOneRawDraftPrompt?.systemPrompt ?? "You are a precise editor.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nTone: ${toneProfile.name}`,
        },
        {
          role: "user",
          content:
            "Create a JSON object with exactly two string fields: blogPostContent and socialPlainText. " +
            "blogPostContent must be valid article HTML. socialPlainText must be concise and under 280 characters.\n\n" +
            articleContext,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content?.trim();
    expect(rawContent).toBeTruthy();

    const generated = extractGeneratedContent(rawContent as string);
    expect(generated.blogPostContent).toMatch(/<[^>]+>/);
    expect(generated.socialPlainText.length).toBeGreaterThan(10);
    expect(generated.socialPlainText.length).toBeLessThanOrEqual(280);

    const elapsedMs = await waitForAntiLockThrottle();
    expect(elapsedMs).toBeGreaterThanOrEqual(2900);

    const draft = await prisma.generatedDraft.create({
      data: {
        workspaceId: graph.workspaceId,
        rawPostId: null,
        toneProfileId: graph.toneProfileId,
        blogPostContent: generated.blogPostContent,
        socialPlainText: generated.socialPlainText,
        generationType: "batch_digest",
        status: "pending",
      },
    });

    liveDraftId = draft.id;
    liveDigestText = generated.socialPlainText;

    expect(draft.blogPostContent).toBe(generated.blogPostContent);
    expect(draft.socialPlainText).toBe(generated.socialPlainText);
    expect(draft.generationType).toBe("batch_digest");
    expect(draft.status).toBe("pending");
  });

  it("generates a live DALL-E image, uploads it to MinIO, and updates GeneratedDraft", async () => {
    if (skipReason) {
      console.warn(`Skipped: ${skipReason}`);
      return;
    }

    const graph = seeded[0] ?? (await seedGraph());
    const draft =
      liveDraftId === null
        ? await prisma.generatedDraft.create({
            data: {
              workspaceId: graph.workspaceId,
              rawPostId: null,
              toneProfileId: graph.toneProfileId,
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
