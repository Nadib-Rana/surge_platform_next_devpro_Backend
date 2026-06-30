import { Test, TestingModule } from '@nestjs/testing';
import { AiPromptsController } from './ai-prompts.controller';
import { AiPromptsService } from './ai-prompts.service';

describe('AiPromptsController', () => {
  let controller: AiPromptsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiPromptsController],
      providers: [AiPromptsService],
    }).compile();

    controller = module.get<AiPromptsController>(AiPromptsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
