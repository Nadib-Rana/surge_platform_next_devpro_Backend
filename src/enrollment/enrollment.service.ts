import { Injectable } from "@nestjs/common";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../common/exceptions/http.exceptions";
import { PrismaService } from "../common/context/prisma.service";
import { CreateEnrollmentDto } from "./dto/create-enrollment.dto";
import { UpdateClassProgressDto } from "./dto/update-class-progress.dto";

@Injectable()
export class EnrollmentService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOwnedEnrollment(userId: string, enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, userId },
    });

    if (!enrollment) {
      throw new NotFoundException("Enrollment");
    }

    return enrollment;
  }

  private async assertClassUnlocked(enrollmentId: string, classId: string) {
    const currentClass = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        categoryId: true,
        classOrder: true,
        durationSeconds: true,
      },
    });

    if (!currentClass) {
      throw new NotFoundException("Class");
    }

    if (currentClass.classOrder <= 1) {
      return currentClass;
    }

    const previousClass = await this.prisma.class.findFirst({
      where: {
        categoryId: currentClass.categoryId,
        classOrder: currentClass.classOrder - 1,
      },
      select: { id: true },
    });

    if (!previousClass) {
      return currentClass;
    }

    const previousProgress = await this.prisma.classProgress.findUnique({
      where: {
        enrollmentId_classId: {
          enrollmentId,
          classId: previousClass.id,
        },
      },
      select: { isCompleted: true },
    });

    if (!previousProgress?.isCompleted) {
      throw new ForbiddenException(
        "Previous class must be completed before continuing",
        "CLASS_LOCKED",
      );
    }

    return currentClass;
  }

  private async recalculateCategoryProgress(
    enrollmentId: string,
    categoryId: string,
  ) {
    const [totalClasses, completedClasses] = await Promise.all([
      this.prisma.class.count({ where: { categoryId } }),
      this.prisma.classProgress.count({
        where: {
          enrollmentId,
          class: { categoryId },
          isCompleted: true,
        },
      }),
    ]);

    const progressPercent =
      totalClasses === 0
        ? 0
        : Math.min(100, Math.floor((completedClasses / totalClasses) * 100));

    await this.prisma.classCategoryProgress.upsert({
      where: {
        enrollmentId_categoryId: {
          enrollmentId,
          categoryId,
        },
      },
      update: {
        progressPercent,
        totalCompleteClass: completedClasses,
      },
      create: {
        enrollmentId,
        categoryId,
        progressPercent,
        totalCompleteClass: completedClasses,
      },
    });

    return {
      progressPercent,
      totalCompleteClass: completedClasses,
      totalClasses,
    };
  }

  async createEnrollment(userId: string, dto: CreateEnrollmentDto) {
    const uniqueCategoryIds = Array.from(new Set(dto.categoryIds));
    if (uniqueCategoryIds.length !== 3) {
      throw new BadRequestException(
        "Enrollment requires exactly 3 unique categories",
        "INVALID_CATEGORY_BUNDLE",
      );
    }

    const categories = await this.prisma.classCategory.findMany({
      where: { id: { in: uniqueCategoryIds } },
      select: { id: true },
    });

    if (categories.length !== 3) {
      throw new BadRequestException(
        "One or more selected categories do not exist",
        "CATEGORY_NOT_FOUND",
      );
    }

    const activeEnrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (activeEnrollment) {
      throw new BadRequestException(
        "User already has an active enrollment",
        "ACTIVE_ENROLLMENT_EXISTS",
      );
    }

    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const enrollment = await this.prisma.enrollment.create({
      data: {
        userId,
        status: "ACTIVE",
        expiresAt,
        categories: {
          create: uniqueCategoryIds.map((categoryId) => ({ categoryId })),
        },
        categoryProgress: {
          create: uniqueCategoryIds.map((categoryId) => ({
            categoryId,
            progressPercent: 0,
            totalCompleteClass: 0,
          })),
        },
      },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });

    return {
      id: enrollment.id,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      expiresAt: enrollment.expiresAt,
      categories: enrollment.categories.map((item) => item.category),
    };
  }

  async getActiveEnrollment(userId: string) {
    const now = new Date();
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
      include: {
        categories: {
          include: { category: true },
        },
        categoryProgress: true,
      },
      orderBy: { enrolledAt: "desc" },
    });

    if (!enrollment) {
      throw new NotFoundException("Active enrollment");
    }

    return {
      id: enrollment.id,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      expiresAt: enrollment.expiresAt,
      categories: enrollment.categories.map((item) => item.category),
      categoryProgress: enrollment.categoryProgress,
    };
  }

  async updateClassProgress(
    userId: string,
    enrollmentId: string,
    classId: string,
    dto: UpdateClassProgressDto,
  ) {
    const enrollment = await this.getOwnedEnrollment(userId, enrollmentId);
    if (enrollment.status !== "ACTIVE" || enrollment.expiresAt <= new Date()) {
      throw new ForbiddenException(
        "Enrollment is not active",
        "ENROLLMENT_INACTIVE",
      );
    }

    const currentClass = await this.assertClassUnlocked(enrollmentId, classId);

    const access = await this.prisma.enrollmentCategory.findFirst({
      where: {
        enrollmentId,
        categoryId: currentClass.categoryId,
      },
      select: { id: true },
    });

    if (!access) {
      throw new ForbiddenException(
        "Class is not included in this enrollment",
        "CLASS_ACCESS_DENIED",
      );
    }

    const currentProgress = await this.prisma.classProgress.findUnique({
      where: {
        enrollmentId_classId: {
          enrollmentId,
          classId,
        },
      },
      select: {
        reached50Milestone: true,
        reached75Milestone: true,
      },
    });

    const watchedSeconds = Math.max(0, dto.lastWatchedSeconds ?? 0);
    const duration = Math.max(1, currentClass.durationSeconds);
    const computedFromDuration = Math.min(
      100,
      Math.floor((watchedSeconds / duration) * 100),
    );
    const progressPercent = Math.min(
      100,
      Math.max(0, dto.progressPercent ?? computedFromDuration),
    );
    const isCompleted = progressPercent >= 100;

    const reached50Milestone =
      (currentProgress?.reached50Milestone ?? false) || progressPercent >= 50;
    const reached75Milestone =
      (currentProgress?.reached75Milestone ?? false) || progressPercent >= 75;

    const progress = await this.prisma.classProgress.upsert({
      where: {
        enrollmentId_classId: {
          enrollmentId,
          classId,
        },
      },
      update: {
        lastWatchedSeconds: watchedSeconds,
        progressPercent,
        isCompleted,
        reached50Milestone,
        reached75Milestone,
        lastWatchedAt: new Date(),
      },
      create: {
        enrollmentId,
        classId,
        lastWatchedSeconds: watchedSeconds,
        progressPercent,
        isCompleted,
        reached50Milestone,
        reached75Milestone,
        lastWatchedAt: new Date(),
      },
    });

    const categoryProgress = await this.recalculateCategoryProgress(
      enrollmentId,
      currentClass.categoryId,
    );

    return {
      progress,
      categoryProgress,
    };
  }
}
