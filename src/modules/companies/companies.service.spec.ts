import { Test, TestingModule } from "@nestjs/testing";
import { CompaniesService } from "./companies.service";
import { PrismaService } from "../../common/context/prisma.service";

describe("CompaniesService", () => {
  let service: CompaniesService;
  let prisma: {
    company: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      company: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
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

  it("creates a company for the current owner", async () => {
    prisma.company.create.mockResolvedValue({
      id: "company-1",
      ownerId: "user-1",
      name: "Acme Media Labs",
      status: "active",
    });

    const result = await service.create(
      { name: "Acme Media Labs" },
      { userId: "user-1", role: "customer" },
    );

    expect(prisma.company.create).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        name: "Acme Media Labs",
        status: "active",
      },
    });
    expect(result.name).toBe("Acme Media Labs");
  });

  it("returns only owned companies for a customer", async () => {
    prisma.company.findMany.mockResolvedValue([
      {
        id: "company-1",
        ownerId: "user-1",
        name: "Acme Media Labs",
      },
    ]);

    const result = await service.findAll({
      userId: "user-1",
      role: "customer",
    });

    expect(prisma.company.findMany).toHaveBeenCalledWith({
      where: { ownerId: "user-1" },
      orderBy: { createdAt: "desc" },
    });
    expect(result).toHaveLength(1);
  });

  it("returns all companies for an admin", async () => {
    prisma.company.findMany.mockResolvedValue([
      {
        id: "company-1",
        ownerId: "user-1",
        name: "Acme Media Labs",
      },
    ]);

    await service.findAll({
      userId: "admin-1",
      role: "admin",
    });

    expect(prisma.company.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
    });
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

  it("deletes a company for the owner", async () => {
    prisma.company.findUnique.mockResolvedValue({
      id: "company-1",
      ownerId: "user-1",
    });
    prisma.company.delete.mockResolvedValue({ id: "company-1" });

    await service.remove("company-1", { userId: "user-1", role: "customer" });

    expect(prisma.company.delete).toHaveBeenCalledWith({
      where: { id: "company-1" },
    });
  });
});
