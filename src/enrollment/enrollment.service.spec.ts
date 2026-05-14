import { EnrollmentService } from "./enrollment.service";
import {
  BadRequestException,
  ForbiddenException,
} from "../common/exceptions/http.exceptions";

describe("EnrollmentService", () => {
  const createService = () => {
    const prisma = {
      enrollment: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      classCategory: {
        findMany: jest.fn(),
      },
      class: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      enrollmentCategory: {
        findFirst: jest.fn(),
      },
      classProgress: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
      },
      classCategoryProgress: {
        upsert: jest.fn(),
      },
    } as any;

    const service = new EnrollmentService(prisma);
    return { service, prisma };
  };

  it("should reject enrollment when category bundle is not exactly 3 unique categories", async () => {
    const { service } = createService();

    await expect(
      service.createEnrollment("user-1", {
        categoryIds: ["c1", "c1", "c2"],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("should block class progress when previous class is incomplete", async () => {
    const { service, prisma } = createService();

    prisma.enrollment.findFirst.mockResolvedValue({
      id: "enr-1",
      userId: "user-1",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    prisma.class.findUnique.mockResolvedValue({
      id: "class-2",
      categoryId: "cat-1",
      classOrder: 2,
      durationSeconds: 300,
    });

    prisma.class.findFirst.mockResolvedValue({ id: "class-1" });
    prisma.classProgress.findUnique.mockResolvedValue({ isCompleted: false });

    await expect(
      service.updateClassProgress("user-1", "enr-1", "class-2", {
        progressPercent: 40,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("should set milestones and completion on progress update", async () => {
    const { service, prisma } = createService();

    prisma.enrollment.findFirst.mockResolvedValue({
      id: "enr-1",
      userId: "user-1",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    prisma.class.findUnique.mockResolvedValue({
      id: "class-1",
      categoryId: "cat-1",
      classOrder: 1,
      durationSeconds: 200,
    });

    prisma.enrollmentCategory.findFirst.mockResolvedValue({ id: "ec-1" });
    prisma.classProgress.findUnique.mockResolvedValue(null);
    prisma.classProgress.upsert.mockResolvedValue({ id: "cp-1" });
    prisma.class.count.mockResolvedValue(4);
    prisma.classProgress.count.mockResolvedValue(2);
    prisma.classCategoryProgress.upsert.mockResolvedValue({ id: "ccp-1" });

    const result = await service.updateClassProgress(
      "user-1",
      "enr-1",
      "class-1",
      {
        progressPercent: 100,
        lastWatchedSeconds: 200,
      },
    );

    const upsertArgs = prisma.classProgress.upsert.mock.calls[0][0];
    expect(upsertArgs.update.reached50Milestone).toBe(true);
    expect(upsertArgs.update.reached75Milestone).toBe(true);
    expect(upsertArgs.update.isCompleted).toBe(true);

    expect(result.categoryProgress.progressPercent).toBe(50);
    expect(result.categoryProgress.totalCompleteClass).toBe(2);
  });
});
