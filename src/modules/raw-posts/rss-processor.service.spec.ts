import { RssProcessor } from "./rss-processor.service";

describe("RssProcessor", () => {
  let processor: RssProcessor;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      workspace: {
        findUnique: jest.fn(),
      },
      rssFeed: {
        update: jest.fn().mockResolvedValue({}),
      },
      rawPostsBuffer: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "post-1" }),
      },
    };

    processor = new RssProcessor(prismaMock);
  });

  it("should deactivate feed if target workspace does not exist in DB", async () => {
    prismaMock.workspace.findUnique.mockResolvedValue(null);

    const jobMock: any = {
      data: {
        workspaceId: "non-existent-ws",
        feedId: "feed-1",
        feedUrl: "https://example.com/feed.xml",
      },
    };

    const result = await processor.process(jobMock);

    expect(prismaMock.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: "non-existent-ws" },
      select: { id: true },
    });
    expect(prismaMock.rssFeed.update).toHaveBeenCalledWith({
      where: { id: "feed-1" },
      data: { status: "inactive" },
    });
    expect(result).toEqual({
      inserted: 0,
      skipped: 0,
      error: "Workspace non-existent-ws not found",
    });
  });

  it("should process items and insert into buffer when workspace exists", async () => {
    prismaMock.workspace.findUnique.mockResolvedValue({ id: "ws-1" });

    // Mock parser instance method
    (processor as any).parser = {
      parseString: jest.fn().mockResolvedValue({
        items: [
          {
            title: "Test RSS Article 1",
            link: "https://example.com/article-1",
            content: "This is article content",
            pubDate: new Date().toISOString(),
          },
        ],
      }),
      parseURL: jest.fn(),
    };

    // Mock global fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue("<rss><channel><item><title>Test</title></item></channel></rss>"),
    } as any);

    const jobMock: any = {
      data: {
        workspaceId: "ws-1",
        feedId: "feed-1",
        feedUrl: "https://example.com/valid-feed.xml",
      },
    };

    const result = await processor.process(jobMock);

    expect(prismaMock.rawPostsBuffer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "ws-1",
          feedId: "feed-1",
          title: "Test RSS Article 1",
          status: "buffered",
        }),
      }),
    );
    expect(result.inserted).toBe(1);
  });
});
