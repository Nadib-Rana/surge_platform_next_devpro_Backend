import { Test, TestingModule } from '@nestjs/testing';
import { RssFeedsController } from './rss-feeds.controller';
import { RssFeedsService } from './rss-feeds.service';

describe('RssFeedsController', () => {
  let controller: RssFeedsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RssFeedsController],
      providers: [RssFeedsService],
    }).compile();

    controller = module.get<RssFeedsController>(RssFeedsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
