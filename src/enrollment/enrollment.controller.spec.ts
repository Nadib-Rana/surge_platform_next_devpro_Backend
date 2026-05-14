import { Test, TestingModule } from "@nestjs/testing";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentService } from "./enrollment.service";

describe("EnrollmentController", () => {
  let controller: EnrollmentController;
  let service: jest.Mocked<EnrollmentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrollmentController],
      providers: [
        {
          provide: EnrollmentService,
          useValue: {
            createEnrollment: jest.fn(),
            getActiveEnrollment: jest.fn(),
            updateClassProgress: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<EnrollmentController>(EnrollmentController);
    service = module.get(EnrollmentService);
  });

  it("should call createEnrollment with user and dto", async () => {
    const dto = {
      categoryIds: [
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
        "33333333-3333-3333-3333-333333333333",
      ],
    };

    service.createEnrollment.mockResolvedValue({ id: "e1" } as never);
    await controller.create("u1", dto);

    expect(service.createEnrollment).toHaveBeenCalledWith("u1", dto);
  });

  it("should call getActiveEnrollment with user", async () => {
    service.getActiveEnrollment.mockResolvedValue({ id: "e1" } as never);

    await controller.getActive("u1");
    expect(service.getActiveEnrollment).toHaveBeenCalledWith("u1");
  });

  it("should call updateClassProgress with all params", async () => {
    const dto = { progressPercent: 60, lastWatchedSeconds: 120 };
    service.updateClassProgress.mockResolvedValue({} as never);

    await controller.updateClassProgress("u1", "e1", "c1", dto);

    expect(service.updateClassProgress).toHaveBeenCalledWith(
      "u1",
      "e1",
      "c1",
      dto,
    );
  });
});
