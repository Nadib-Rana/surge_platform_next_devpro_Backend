import { Test, TestingModule } from "@nestjs/testing";
import { RssFeedsService } from "./rss-feeds.service";

describe("RssFeedsService", () => {
  let service: RssFeedsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RssFeedsService],
    }).compile();

    service = module.get<RssFeedsService>(RssFeedsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
