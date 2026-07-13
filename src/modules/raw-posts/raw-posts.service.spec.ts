import { RawPostsService } from "./raw-posts.service";

describe("RawPostsService", () => {
  let service: RawPostsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      workspace: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: "workspace-1",
            company: { ownerId: "user-1" },
          }),
      },
      workspaceMember: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      rawPostsBuffer: {
        findMany: jest.fn().mockResolvedValue([{ id: "post-1" }]),
      },
    };

    service = new RawPostsService(prisma);
  });

  it("returns buffered posts for the requested historical window", async () => {
    const result = await service.findBufferedPosts("workspace-1", "7", {
      userId: "user-1",
      role: "customer",
    });

    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: "workspace-1" },
      include: { company: true },
    });
    expect(prisma.rawPostsBuffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace-1",
          status: "buffered",
          publishedAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
    expect(result).toEqual([{ id: "post-1" }]);
  });

  it("rejects access for users who do not own or belong to the workspace", async () => {
    await expect(
      service.findBufferedPosts("workspace-1", "7", {
        userId: "user-2",
        role: "customer",
      }),
    ).rejects.toThrow(
      "You can only view buffered posts from workspaces you own or belong to",
    );
  });
});
