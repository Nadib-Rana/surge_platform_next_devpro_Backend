import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiPromptsService } from './ai-prompts.service';
import { PrismaService } from '../../common/context/prisma.service';
import { AiAssetService } from './ai-asset.service';

describe('AiPromptsService', () => {
  let service: AiPromptsService;
  let prisma: {
    aiPrompt: { create: jest.Mock };
    promptVersion: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      aiPrompt: { create: jest.fn() },
      promptVersion: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiPromptsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => (key === 'OPENAI_API_KEY' ? 'test-key' : undefined)),
          },
        },
        {
          provide: AiAssetService,
          useValue: {
            generateImageFromDigest: jest.fn().mockResolvedValue({ imageUrl: 'https://example.com/asset.png' }),
          },
        },
      ],
    }).compile();

    service = module.get<AiPromptsService>(AiPromptsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a prompt and initial version', async () => {
    prisma.aiPrompt.create.mockResolvedValue({ id: 'prompt-1' });
    prisma.promptVersion.create.mockResolvedValue({ id: 'version-1' });

    const result = await service.createPromptWithVersion({
      workspaceId: 'workspace-1',
      name: 'Launch Digest',
      description: 'Social digest prompt',
      systemPrompt: 'Write a high-engagement digest',
      tone: 'professional',
      versionTag: 'v1',
    });

    expect(prisma.aiPrompt.create).toHaveBeenCalled();
    expect(prisma.promptVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptId: 'prompt-1',
          tone: 'professional',
        }),
      }),
    );
    expect(result.prompt.id).toBe('prompt-1');
  });
});
