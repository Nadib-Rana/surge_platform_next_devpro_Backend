import { Test, TestingModule } from "@nestjs/testing";
import { RawPostsController } from "./raw-posts.controller";
import { RawPostsService } from "./raw-posts.service";
import { PrismaService } from "../../common/context/prisma.service";

describe("RawPostsController", () => {
  let controller: RawPostsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RawPostsController],
      providers: [
        RawPostsService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<RawPostsController>(RawPostsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
