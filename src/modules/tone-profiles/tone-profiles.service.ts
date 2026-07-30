import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";
import { CreateToneProfileDto, UpdateToneProfileDto } from "./dto/tone-profile.dto";

@Injectable()
export class ToneProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.toneProfile.findMany({
      include: {
        stepOneRawDraftPrompt: true,
        stepTwoPolishingPrompt: true,
        stepThreeImagePrompt: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: string) {
    const toneProfile = await this.prisma.toneProfile.findUnique({
      where: { id },
      include: {
        stepOneRawDraftPrompt: true,
        stepTwoPolishingPrompt: true,
        stepThreeImagePrompt: true,
      },
    });

    if (!toneProfile) {
      throw new NotFoundException(`Tone profile ${id} not found`);
    }

    return toneProfile;
  }

  async create(dto: CreateToneProfileDto) {
    // Check if tone profile name already exists
    const existing = await this.prisma.toneProfile.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new BadRequestException(`Tone profile with name '${dto.name}' already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      const toneProfile = await tx.toneProfile.create({
        data: {
          name: dto.name,
        },
      });

      const stepOne = await tx.stepOneRawDraftPrompt.create({
        data: {
          toneProfileId: toneProfile.id,
          title: dto.stepOneRawDraftPrompt.title,
          systemPrompt: dto.stepOneRawDraftPrompt.systemPrompt,
          template: dto.stepOneRawDraftPrompt.template,
          isActive: dto.stepOneRawDraftPrompt.isActive ?? true,
        },
      });

      const stepTwo = await tx.stepTwoPolishingPrompt.create({
        data: {
          toneProfileId: toneProfile.id,
          title: dto.stepTwoPolishingPrompt.title,
          systemPrompt: dto.stepTwoPolishingPrompt.systemPrompt,
          template: dto.stepTwoPolishingPrompt.template,
          isActive: dto.stepTwoPolishingPrompt.isActive ?? true,
        },
      });

      const stepThree = await tx.stepThreeImagePrompt.create({
        data: {
          toneProfileId: toneProfile.id,
          title: dto.stepThreeImagePrompt.title,
          systemPrompt: dto.stepThreeImagePrompt.systemPrompt,
          template: dto.stepThreeImagePrompt.template,
          isActive: dto.stepThreeImagePrompt.isActive ?? true,
        },
      });

      return {
        ...toneProfile,
        stepOneRawDraftPrompt: stepOne,
        stepTwoPolishingPrompt: stepTwo,
        stepThreeImagePrompt: stepThree,
      };
    });
  }

  async update(id: string, dto: UpdateToneProfileDto) {
    const toneProfile = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      // Update parent name if provided
      if (dto.name && dto.name !== toneProfile.name) {
        const existingName = await tx.toneProfile.findUnique({
          where: { name: dto.name },
        });
        if (existingName && existingName.id !== id) {
          throw new BadRequestException(`Tone profile with name '${dto.name}' already exists`);
        }

        await tx.toneProfile.update({
          where: { id },
          data: { name: dto.name },
        });
      }

      // Update Step One
      if (dto.stepOneRawDraftPrompt) {
        await tx.stepOneRawDraftPrompt.upsert({
          where: { toneProfileId: id },
          update: {
            title: dto.stepOneRawDraftPrompt.title,
            systemPrompt: dto.stepOneRawDraftPrompt.systemPrompt,
            template: dto.stepOneRawDraftPrompt.template,
            isActive: dto.stepOneRawDraftPrompt.isActive,
          },
          create: {
            toneProfileId: id,
            title: dto.stepOneRawDraftPrompt.title ?? "Step 1 Prompt",
            systemPrompt: dto.stepOneRawDraftPrompt.systemPrompt ?? "",
            template: dto.stepOneRawDraftPrompt.template ?? "",
            isActive: dto.stepOneRawDraftPrompt.isActive ?? true,
          },
        });
      }

      // Update Step Two
      if (dto.stepTwoPolishingPrompt) {
        await tx.stepTwoPolishingPrompt.upsert({
          where: { toneProfileId: id },
          update: {
            title: dto.stepTwoPolishingPrompt.title,
            systemPrompt: dto.stepTwoPolishingPrompt.systemPrompt,
            template: dto.stepTwoPolishingPrompt.template,
            isActive: dto.stepTwoPolishingPrompt.isActive,
          },
          create: {
            toneProfileId: id,
            title: dto.stepTwoPolishingPrompt.title ?? "Step 2 Prompt",
            systemPrompt: dto.stepTwoPolishingPrompt.systemPrompt ?? "",
            template: dto.stepTwoPolishingPrompt.template ?? "",
            isActive: dto.stepTwoPolishingPrompt.isActive ?? true,
          },
        });
      }

      // Update Step Three
      if (dto.stepThreeImagePrompt) {
        await tx.stepThreeImagePrompt.upsert({
          where: { toneProfileId: id },
          update: {
            title: dto.stepThreeImagePrompt.title,
            systemPrompt: dto.stepThreeImagePrompt.systemPrompt,
            template: dto.stepThreeImagePrompt.template,
            isActive: dto.stepThreeImagePrompt.isActive,
          },
          create: {
            toneProfileId: id,
            title: dto.stepThreeImagePrompt.title ?? "Step 3 Prompt",
            systemPrompt: dto.stepThreeImagePrompt.systemPrompt ?? "",
            template: dto.stepThreeImagePrompt.template ?? "",
            isActive: dto.stepThreeImagePrompt.isActive ?? true,
          },
        });
      }

      return tx.toneProfile.findUnique({
        where: { id },
        include: {
          stepOneRawDraftPrompt: true,
          stepTwoPolishingPrompt: true,
          stepThreeImagePrompt: true,
        },
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.toneProfile.delete({
      where: { id },
    });
  }
}
