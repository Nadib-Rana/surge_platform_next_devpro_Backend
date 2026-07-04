import { RegistrationService } from './registration.service';
import * as bcrypt from 'bcryptjs';

describe('RegistrationService', () => {
  let service: RegistrationService;
  let prisma: any;
  let jwtService: any;
  let mailtrapService: any;
  let configService: any;
  let tx: any;

  beforeEach(() => {
    jest.clearAllMocks();

    tx = {
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com', role: 'customer' }),
      },
      verificationToken: {
        update: jest.fn().mockResolvedValue({ id: 'token-1', used: true }),
      },
      company: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'company-1' }),
      },
      workspace: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'workspace-1' }),
      },
      workspaceMember: { create: jest.fn().mockResolvedValue({ id: 'member-1' }) },
    };

    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      verificationToken: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      company: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      workspace: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      workspaceMember: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    jwtService = { sign: jest.fn().mockReturnValue('access-token') };
    mailtrapService = { sendOtpEmail: jest.fn().mockResolvedValue(true) };
    configService = { get: jest.fn() };

    service = new RegistrationService(prisma as any, jwtService as any, mailtrapService as any, configService as any);
  });

  it('creates a default company and workspace after email verification', async () => {
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'user@example.com',
      role: 'customer',
      isVerified: false,
    });

    prisma.verificationToken.findMany.mockResolvedValue([
      {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        type: 'email_verification',
        used: false,
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);
    prisma.user.update.mockResolvedValue({ id: 'user-1', isVerified: true });
    prisma.verificationToken.update.mockResolvedValue({ id: 'token-1', used: true });

    const result = await service.verifyEmail('123456');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.company.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: 'user-1',
          name: 'user',
          status: 'active',
        }),
      }),
    );
    expect(tx.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'company-1',
          name: 'Default Workspace',
        }),
      }),
    );
    expect(tx.workspaceMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'workspace-1',
          userId: 'user-1',
          role: 'owner',
        }),
      }),
    );
    expect(result.accessToken).toBe('access-token');
  });
});
