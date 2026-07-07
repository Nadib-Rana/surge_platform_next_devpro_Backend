import { Test, TestingModule } from "@nestjs/testing";
import { PublishingChannelsController } from "./publishing-channels.controller";
import { PublishingChannelsService } from "./publishing-channels.service";

describe("PublishingChannelsController", () => {
  let controller: PublishingChannelsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublishingChannelsController],
      providers: [PublishingChannelsService],
    }).compile();

    controller = module.get<PublishingChannelsController>(
      PublishingChannelsController,
    );
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
