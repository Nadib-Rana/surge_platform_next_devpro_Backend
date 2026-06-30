import { Test, TestingModule } from '@nestjs/testing';
import { PublishingChannelsService } from './publishing-channels.service';

describe('PublishingChannelsService', () => {
  let service: PublishingChannelsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PublishingChannelsService],
    }).compile();

    service = module.get<PublishingChannelsService>(PublishingChannelsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
