import { Test, TestingModule } from '@nestjs/testing';
import { RawPostsService } from './raw-posts.service';

describe('RawPostsService', () => {
  let service: RawPostsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RawPostsService],
    }).compile();

    service = module.get<RawPostsService>(RawPostsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
