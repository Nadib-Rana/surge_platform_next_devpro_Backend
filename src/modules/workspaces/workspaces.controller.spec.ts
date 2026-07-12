import { Test, TestingModule } from "@nestjs/testing";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
import { RssSchedulerService } from "./rss-scheduler.service";
import { AutopilotSchedulerService } from "../autopilot/autopilot-scheduler.service";

describe("WorkspacesController", () => {
  let controller: WorkspacesController;
  const workspacesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    updateQueueConfig: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: RssSchedulerService, useValue: { onWorkspaceConfigChange: jest.fn() } },
        { provide: AutopilotSchedulerService, useValue: { syncWorkspaceSchedules: jest.fn() } },
      ],
    }).compile();

    controller = module.get<WorkspacesController>(WorkspacesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("delegates workspace creation", async () => {
    workspacesService.create.mockResolvedValue({ id: "workspace-1" });

    const result = await controller.create({ name: "Ops", companyId: "company-1" }, { userId: "user-1", role: "customer" });

    expect(workspacesService.create).toHaveBeenCalledWith(
      { name: "Ops", companyId: "company-1" },
      { userId: "user-1", role: "customer" },
    );
    expect(result.id).toBe("workspace-1");
  });
});
