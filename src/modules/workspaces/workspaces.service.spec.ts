import { Test, TestingModule } from "@nestjs/testing";
import { WorkspacesService } from "./workspaces.service";
import { PrismaService } from "../../common/context/prisma.service";

describe("WorkspacesService", () => {
  let service: WorkspacesService;
  let prisma: {
    workspace: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    workspaceMember: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    company: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      workspace: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workspaceMember: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      company: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("creates a workspace for an accessible company", async () => {
    prisma.company.findUnique.mockResolvedValue({
      id: "company-1",
      ownerId: "user-1",
    });
    prisma.workspace.create.mockResolvedValue({
      id: "workspace-1",
      name: "Ops",
    });
    prisma.workspaceMember.create.mockResolvedValue({});

    const result = await service.create(
      { name: "Ops", companyId: "company-1" },
      { userId: "user-1", role: "customer" },
    );

    expect(prisma.workspace.create).toHaveBeenCalledWith({
      data: {
        companyId: "company-1",
        name: "Ops",
        timezone: "UTC",
        queueConfig: {
          fetchFrequencyHours: 24,
          postingTimes: ["09:00"],
          autoPost: false,
        },
      },
    });
    expect(result.name).toBe("Ops");
  });

  it("lists workspaces accessible to a customer", async () => {
    prisma.workspace.findMany.mockResolvedValue([
      { id: "workspace-1", name: "Ops" },
    ]);

    await service.findAll({ userId: "user-1", role: "customer" });

    expect(prisma.workspace.findMany).toHaveBeenCalled();
  });

  it("updates a workspace for the owner", async () => {
    prisma.workspace.findUnique.mockResolvedValue({
      id: "workspace-1",
      companyId: "company-1",
      company: { ownerId: "user-1" },
    });
    prisma.workspace.update.mockResolvedValue({
      id: "workspace-1",
      name: "Ops",
    });

    await service.update(
      "workspace-1",
      { name: "Ops" },
      { userId: "user-1", role: "customer" },
    );

    expect(prisma.workspace.update).toHaveBeenCalledWith({
      where: { id: "workspace-1" },
      data: { name: "Ops" },
    });
  });

  it("deletes a workspace for an allowed user", async () => {
    prisma.workspace.findUnique.mockResolvedValue({
      id: "workspace-1",
      companyId: "company-1",
      company: { ownerId: "user-1" },
    });
    prisma.workspace.delete.mockResolvedValue({ id: "workspace-1" });

    await service.remove("workspace-1", { userId: "user-1", role: "customer" });

    expect(prisma.workspace.delete).toHaveBeenCalledWith({
      where: { id: "workspace-1" },
    });
  });
});
