import { Test, TestingModule } from "@nestjs/testing";
import { ToneProfilesController } from "./tone-profiles.controller";
import { ToneProfilesService } from "./tone-profiles.service";

describe("ToneProfilesController", () => {
  let controller: ToneProfilesController;
  let service: any;

  const mockToneProfile = {
    id: "tp-1",
    name: "confident",
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ToneProfilesController],
      providers: [
        { provide: ToneProfilesService, useValue: service },
      ],
    }).compile();

    controller = module.get<ToneProfilesController>(ToneProfilesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    it("should return all tone profiles", async () => {
      service.findAll.mockResolvedValue([mockToneProfile]);
      const res = await controller.findAll();
      expect(res).toEqual([mockToneProfile]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should return single profile", async () => {
      service.findOne.mockResolvedValue(mockToneProfile);
      const res = await controller.findOne("tp-1");
      expect(res).toEqual(mockToneProfile);
      expect(service.findOne).toHaveBeenCalledWith("tp-1");
    });
  });

  describe("create", () => {
    const createDto = {
      name: "happy",
      stepGroupingPrompt: { title: "PG", systemPrompt: "SG", template: "TG" },
      stepOneRawDraftPrompt: { title: "P1", systemPrompt: "S1", template: "T1" },
      stepTwoPolishingPrompt: { title: "P2", systemPrompt: "S2", template: "T2" },
      stepThreeImagePrompt: { title: "P3", systemPrompt: "S3", template: "T3" },
      stepCompanySocialPrompt: { title: "PC", systemPrompt: "SC", template: "TC" },
      stepPersonalSocialPrompt: { title: "PS", systemPrompt: "SS", template: "TS" },
    };

    it("should call service.create", async () => {
      service.create.mockResolvedValue({ id: "tp-2", ...createDto });
      const res = await controller.create(createDto);
      expect(res.name).toBe("happy");
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe("update", () => {
    const updateDto = {
      name: "happy-updated",
    };

    it("should call service.update", async () => {
      service.update.mockResolvedValue({ id: "tp-1", ...updateDto });
      const res = await controller.update("tp-1", updateDto);
      expect(res.name).toBe("happy-updated");
      expect(service.update).toHaveBeenCalledWith("tp-1", updateDto);
    });
  });

  describe("remove", () => {
    it("should call service.remove", async () => {
      service.remove.mockResolvedValue(mockToneProfile);
      const res = await controller.remove("tp-1");
      expect(res).toEqual(mockToneProfile);
      expect(service.remove).toHaveBeenCalledWith("tp-1");
    });
  });
});
