import { Test, TestingModule } from "@nestjs/testing";
import { QueuesService } from "./queues.service";

describe("QueuesService", () => {
  let service: QueuesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueuesService],
    }).compile();

    service = module.get<QueuesService>(QueuesService);
  });

  it("should create and return a queue", async () => {
    const created = await service.create({ name: "daily-sync" });

    expect(created).toMatchObject({
      id: expect.any(String),
      name: "daily-sync",
      status: "active",
    });
  });

  it("should list, get, and delete queues", async () => {
    const created = await service.create({ name: "weekly-report" });
    const all = await service.findAll();
    const one = await service.findOne(created.id);
    const removed = await service.remove(created.id);

    expect(all).toHaveLength(1);
    expect(one.name).toBe("weekly-report");
    expect(removed.id).toBe(created.id);
  });
});
