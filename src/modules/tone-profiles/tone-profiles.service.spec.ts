import { Test, TestingModule } from "@nestjs/testing";
import { ToneProfilesService } from "./tone-profiles.service";
import { PrismaService } from "../../common/context/prisma.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";

describe("ToneProfilesService", () => {
  let service: ToneProfilesService;
  let prisma: any;

  const mockToneProfile = {
    id: "tp-1",
    name: "confident",
    stepGroupingPrompt: { title: "PG", systemPrompt: "SG", template: "TG" },
    stepOneRawDraftPrompt: { title: "P1", systemPrompt: "S1", template: "T1" },
    stepTwoPolishingPrompt: { title: "P2", systemPrompt: "S2", template: "T2" },
    stepThreeImagePrompt: { title: "P3", systemPrompt: "S3", template: "T3" },
    stepCompanySocialPrompt: { title: "PC", systemPrompt: "SC", template: "TC" },
    stepPersonalSocialPrompt: { title: "PS", systemPrompt: "SS", template: "TS" },
  };

  beforeEach(async () => {
    prisma = {
      toneProfile: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      stepGroupingPrompt: { create: jest.fn(), upsert: jest.fn() },
      stepOneRawDraftPrompt: { create: jest.fn(), upsert: jest.fn() },
      stepTwoPolishingPrompt: { create: jest.fn(), upsert: jest.fn() },
      stepThreeImagePrompt: { create: jest.fn(), upsert: jest.fn() },
      stepCompanySocialPrompt: { create: jest.fn(), upsert: jest.fn() },
      stepPersonalSocialPrompt: { create: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToneProfilesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ToneProfilesService>(ToneProfilesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findAll", () => {
    it("should return all tone profiles", async () => {
      prisma.toneProfile.findMany.mockResolvedValue([mockToneProfile]);
      const res = await service.findAll();
      expect(res).toEqual([mockToneProfile]);
      expect(prisma.toneProfile.findMany).toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should return a tone profile by id", async () => {
      prisma.toneProfile.findUnique.mockResolvedValue(mockToneProfile);
      const res = await service.findOne("tp-1");
      expect(res).toEqual(mockToneProfile);
    });

    it("should throw NotFoundException if tone profile does not exist", async () => {
      prisma.toneProfile.findUnique.mockResolvedValue(null);
      await expect(service.findOne("non-existent")).rejects.toThrow(
        NotFoundException,
      );
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

    it("should create a tone profile and nested prompts", async () => {
      prisma.toneProfile.findUnique.mockResolvedValue(null);
      prisma.toneProfile.create.mockResolvedValue({ id: "tp-2", name: "happy" });
      prisma.stepGroupingPrompt.create.mockResolvedValue({ id: "sg" });
      prisma.stepOneRawDraftPrompt.create.mockResolvedValue({ id: "s1" });
      prisma.stepTwoPolishingPrompt.create.mockResolvedValue({ id: "s2" });
      prisma.stepThreeImagePrompt.create.mockResolvedValue({ id: "s3" });
      prisma.stepCompanySocialPrompt.create.mockResolvedValue({ id: "sc" });
      prisma.stepPersonalSocialPrompt.create.mockResolvedValue({ id: "ss" });

      const res = await service.create(createDto);
      expect(res.name).toBe("happy");
      expect(prisma.toneProfile.create).toHaveBeenCalledWith({ data: { name: "happy" } });
    });

    it("should throw BadRequestException if tone profile name exists", async () => {
      prisma.toneProfile.findUnique.mockResolvedValue(mockToneProfile);
      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("remove", () => {
    it("should delete tone profile", async () => {
      prisma.toneProfile.findUnique.mockResolvedValue(mockToneProfile);
      prisma.toneProfile.delete.mockResolvedValue(mockToneProfile);

      const res = await service.remove("tp-1");
      expect(res).toEqual(mockToneProfile);
      expect(prisma.toneProfile.delete).toHaveBeenCalledWith({ where: { id: "tp-1" } });
    });
  });
});
