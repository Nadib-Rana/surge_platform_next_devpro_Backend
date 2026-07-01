import { RawPostsService } from './raw-posts.service';

describe('RawPostsService', () => {
  let service: RawPostsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      workspace: {
        findUnique: jest.fn().mockResolvedValue({ id: 'workspace-1' }),
      },
      rawPostsBuffer: {
        findMany: jest.fn().mockResolvedValue([{ id: 'post-1' }]),
      },
    };

    service = new RawPostsService(prisma);
  });

  it('returns buffered posts for the requested historical window', async () => {
    const result = await service.findBufferedPosts('workspace-1', '7');

    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({ where: { id: 'workspace-1' } });
    expect(prisma.rawPostsBuffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-1',
          status: 'buffered',
          publishedAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
    expect(result).toEqual([{ id: 'post-1' }]);
  });
});
