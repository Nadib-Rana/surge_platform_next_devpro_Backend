import { EnrollmentExpiryNotifierService } from "./enrollment-expiry-notifier.service";

describe("EnrollmentExpiryNotifierService", () => {
  const createService = () => {
    const prisma = {
      enrollment: {
        updateMany: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    const mailer = {
      sendMail: jest.fn(),
    } as any;

    const service = new EnrollmentExpiryNotifierService(prisma, mailer);
    return { service, prisma, mailer };
  };

  it("should mark expired enrollments and send reminders for exactly 3 days remaining", async () => {
    const { service, prisma, mailer } = createService();

    prisma.enrollment.findMany.mockResolvedValue([
      {
        id: "enr-3d",
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        user: { email: "u3@example.com", fullName: "User Three" },
      },
      {
        id: "enr-2d",
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        user: { email: "u2@example.com", fullName: "User Two" },
      },
    ]);

    mailer.sendMail.mockResolvedValue(undefined);
    prisma.enrollment.update.mockResolvedValue({});

    await service.processExpiryReminders();

    expect(prisma.enrollment.updateMany).toHaveBeenCalledTimes(1);
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    expect(prisma.enrollment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "enr-3d" },
        data: expect.objectContaining({
          expiryEmailSent: true,
          notificationStatus: "SENT",
        }),
      }),
    );
  });

  it("should retry up to 3 times and mark failed when mail send keeps failing", async () => {
    const { service, prisma, mailer } = createService();

    prisma.enrollment.findMany.mockResolvedValue([
      {
        id: "enr-fail",
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        user: { email: "fail@example.com", fullName: "Fail User" },
      },
    ]);

    mailer.sendMail.mockRejectedValue(new Error("SMTP down"));
    prisma.enrollment.update.mockResolvedValue({});

    await service.processExpiryReminders();

    expect(mailer.sendMail).toHaveBeenCalledTimes(3);
    expect(prisma.enrollment.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "enr-fail" },
        data: expect.objectContaining({
          notificationStatus: "FAILED",
          notificationLastError: "SMTP down",
        }),
      }),
    );
  });
});
