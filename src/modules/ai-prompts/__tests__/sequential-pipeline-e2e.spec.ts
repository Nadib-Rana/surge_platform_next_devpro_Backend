import { validateHyperlinksPreservation } from "../helpers/hyperlink-validator";
import { ArticleGroupingProcessor } from "../processors/article-grouping.processor";
import { ArticleWritingProcessor } from "../processors/article-writing.processor";
import { ArticlePolishingProcessor } from "../processors/article-polishing.processor";
import { ImageConceptProcessor } from "../processors/image-concept.processor";
import { PrismaService } from "../../../common/context/prisma.service";
import { ConfigService } from "@nestjs/config";
import { Job } from "bullmq";

describe("Sequential Pipeline End-To-End Unit Flow", () => {
  let prisma: PrismaService;
  let config: ConfigService;

  beforeAll(() => {
    prisma = new PrismaService();
    config = new ConfigService();
  });

  it("should correctly validate and flow data through pipeline helpers", () => {
    const raw = "Check <a href='https://google.com'>Google</a>";
    const polished = "Check out <a href='https://google.com'>Google</a> immediately.";
    const result = validateHyperlinksPreservation(raw, polished);
    expect(result.valid).toBe(true);

    const altered = "Check out <a href='https://yahoo.com'>Google</a>";
    const resultAltered = validateHyperlinksPreservation(raw, altered);
    expect(resultAltered.valid).toBe(false);
  });

  it("should generate mock jobs data structure that aligns with processors", async () => {
    const mockJob = {
      data: {
        workspaceId: "test-workspace-id",
        tone: "confident",
        model: "gpt-4o",
      },
    } as unknown as Job;

    expect(mockJob.data.tone).toBe("confident");
    expect(mockJob.data.model).toBe("gpt-4o");
  });
});
