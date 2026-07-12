import { getQueueToken } from "@nestjs/bullmq";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../common/context/prisma.service";
import { DispatcherService } from "../dispatcher/dispatcher.service";
import { GeneratedDraftsService } from "./generated-drafts.service";

describe("GeneratedDraftsService", () => {
  let service: GeneratedDraftsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneratedDraftsService,
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: DispatcherService,
          useValue: {},
        },
        {
          provide: getQueueToken("autopilot-dispatch-queue"),
          useValue: {
            add: jest.fn(),
            getJobs: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<GeneratedDraftsService>(GeneratedDraftsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
