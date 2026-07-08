import { Test, TestingModule } from "@nestjs/testing";
import { CompaniesService } from "./companies.service";
import { PrismaService } from "../../common/context/prisma.service";

describe("CompaniesService", () => {
  let service: CompaniesService;
  let prisma: {
    company: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      company: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("returns a company for the owner", async () => {
    prisma.company.findUnique.mockResolvedValue({
      id: "company-1",
      ownerId: "user-1",
      name: "Acme Media Labs",
    });

    const result = await service.findOne("company-1", {
      userId: "user-1",
      role: "customer",
    });

    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: "company-1" },
    });
    expect(result.name).toBe("Acme Media Labs");
  });

  it("updates company name for the owner", async () => {
    prisma.company.findUnique.mockResolvedValue({
      id: "company-1",
      ownerId: "user-1",
    });
    prisma.company.update.mockResolvedValue({
      id: "company-1",
      name: "Acme Media Labs",
    });

    const result = await service.update(
      "company-1",
      { name: "Acme Media Labs" },
      { userId: "user-1", role: "customer" },
    );

    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: "company-1" },
      data: { name: "Acme Media Labs" },
    });
    expect(result.name).toBe("Acme Media Labs");
  });
});
