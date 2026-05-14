import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MailerService } from "@nestjs-modules/mailer";
import { PrismaService } from "../common/context/prisma.service";

@Injectable()
export class EnrollmentExpiryNotifierService {
  private readonly logger = new Logger(EnrollmentExpiryNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailerService: MailerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailyReminderJob() {
    await this.processExpiryReminders();
  }

  async processExpiryReminders() {
    const now = new Date();

    await this.prisma.enrollment.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    });

    const candidates = await this.prisma.enrollment.findMany({
      where: {
        status: "ACTIVE",
        expiryEmailSent: false,
        notificationRetryCount: { lt: 3 },
        expiresAt: { gt: now },
      },
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    for (const enrollment of candidates) {
      const diffMs = enrollment.expiresAt.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

      if (daysRemaining !== 3) {
        continue;
      }

      await this.sendReminderWithRetry(enrollment.id, {
        email: enrollment.user.email,
        name: enrollment.user.fullName ?? "User",
        expiresAt: enrollment.expiresAt,
      });
    }
  }

  private async sendReminderWithRetry(
    enrollmentId: string,
    payload: {
      email: string;
      name: string;
      expiresAt: Date;
    },
  ) {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.mailerService.sendMail({
          to: payload.email,
          subject: "Your enrollment expires in 3 days",
          text: `Hello ${payload.name}, your enrollment will expire on ${payload.expiresAt.toISOString()}. Please renew to keep access.`,
        });

        await this.prisma.enrollment.update({
          where: { id: enrollmentId },
          data: {
            expiryEmailSent: true,
            notificationStatus: "SENT",
            notificationLastError: null,
          },
        });

        return;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        await this.prisma.enrollment.update({
          where: { id: enrollmentId },
          data: {
            notificationRetryCount: { increment: 1 },
            notificationStatus: attempt === maxAttempts ? "FAILED" : "PENDING",
            notificationLastError: message,
          },
        });

        if (attempt === maxAttempts) {
          this.logger.error(
            `Failed to send expiry reminder for enrollment ${enrollmentId}: ${message}`,
          );
        }
      }
    }
  }
}
