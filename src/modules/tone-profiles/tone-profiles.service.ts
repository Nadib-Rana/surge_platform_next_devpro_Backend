import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";
import { CreateToneProfileDto, UpdateToneProfileDto } from "./dto/tone-profile.dto";

@Injectable()
export class ToneProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.toneProfile.findMany({
      include: {
        stepGroupingPrompt: true,
        stepOneRawDraftPrompt: true,
        stepTwoPolishingPrompt: true,
        stepThreeImagePrompt: true,
        stepCompanySocialPrompt: true,
        stepPersonalSocialPrompt: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: string) {
    const toneProfile = await this.prisma.toneProfile.findUnique({
      where: { id },
      include: {
        stepGroupingPrompt: true,
        stepOneRawDraftPrompt: true,
        stepTwoPolishingPrompt: true,
        stepThreeImagePrompt: true,
        stepCompanySocialPrompt: true,
        stepPersonalSocialPrompt: true,
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

      const stepGrouping = await tx.stepGroupingPrompt.create({
        data: {
          toneProfileId: toneProfile.id,
          title: dto.stepGroupingPrompt.title,
          systemPrompt: dto.stepGroupingPrompt.systemPrompt,
          template: dto.stepGroupingPrompt.template,
          isActive: dto.stepGroupingPrompt.isActive ?? true,
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

      const stepCompanySocial = await tx.stepCompanySocialPrompt.create({
        data: {
          toneProfileId: toneProfile.id,
          title: dto.stepCompanySocialPrompt.title,
          systemPrompt: dto.stepCompanySocialPrompt.systemPrompt,
          template: dto.stepCompanySocialPrompt.template,
          isActive: dto.stepCompanySocialPrompt.isActive ?? true,
        },
      });

      const stepPersonalSocial = await tx.stepPersonalSocialPrompt.create({
        data: {
          toneProfileId: toneProfile.id,
          title: dto.stepPersonalSocialPrompt.title,
          systemPrompt: dto.stepPersonalSocialPrompt.systemPrompt,
          template: dto.stepPersonalSocialPrompt.template,
          isActive: dto.stepPersonalSocialPrompt.isActive ?? true,
        },
      });

      return {
        ...toneProfile,
        stepGroupingPrompt: stepGrouping,
        stepOneRawDraftPrompt: stepOne,
        stepTwoPolishingPrompt: stepTwo,
        stepThreeImagePrompt: stepThree,
        stepCompanySocialPrompt: stepCompanySocial,
        stepPersonalSocialPrompt: stepPersonalSocial,
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

      // Update Step Grouping
      if (dto.stepGroupingPrompt) {
        await tx.stepGroupingPrompt.upsert({
          where: { toneProfileId: id },
          update: {
            title: dto.stepGroupingPrompt.title,
            systemPrompt: dto.stepGroupingPrompt.systemPrompt,
            template: dto.stepGroupingPrompt.template,
            isActive: dto.stepGroupingPrompt.isActive,
          },
          create: {
            toneProfileId: id,
            title: dto.stepGroupingPrompt.title ?? "Step Grouping Prompt",
            systemPrompt: dto.stepGroupingPrompt.systemPrompt ?? "",
            template: dto.stepGroupingPrompt.template ?? "",
            isActive: dto.stepGroupingPrompt.isActive ?? true,
          },
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

      // Update Step Company Social
      if (dto.stepCompanySocialPrompt) {
        await tx.stepCompanySocialPrompt.upsert({
          where: { toneProfileId: id },
          update: {
            title: dto.stepCompanySocialPrompt.title,
            systemPrompt: dto.stepCompanySocialPrompt.systemPrompt,
            template: dto.stepCompanySocialPrompt.template,
            isActive: dto.stepCompanySocialPrompt.isActive,
          },
          create: {
            toneProfileId: id,
            title: dto.stepCompanySocialPrompt.title ?? "Step Company Social Prompt",
            systemPrompt: dto.stepCompanySocialPrompt.systemPrompt ?? "",
            template: dto.stepCompanySocialPrompt.template ?? "",
            isActive: dto.stepCompanySocialPrompt.isActive ?? true,
          },
        });
      }

      // Update Step Personal Social
      if (dto.stepPersonalSocialPrompt) {
        await tx.stepPersonalSocialPrompt.upsert({
          where: { toneProfileId: id },
          update: {
            title: dto.stepPersonalSocialPrompt.title,
            systemPrompt: dto.stepPersonalSocialPrompt.systemPrompt,
            template: dto.stepPersonalSocialPrompt.template,
            isActive: dto.stepPersonalSocialPrompt.isActive,
          },
          create: {
            toneProfileId: id,
            title: dto.stepPersonalSocialPrompt.title ?? "Step Personal Social Prompt",
            systemPrompt: dto.stepPersonalSocialPrompt.systemPrompt ?? "",
            template: dto.stepPersonalSocialPrompt.template ?? "",
            isActive: dto.stepPersonalSocialPrompt.isActive ?? true,
          },
        });
      }

      return tx.toneProfile.findUnique({
        where: { id },
        include: {
          stepGroupingPrompt: true,
          stepOneRawDraftPrompt: true,
          stepTwoPolishingPrompt: true,
          stepThreeImagePrompt: true,
          stepCompanySocialPrompt: true,
          stepPersonalSocialPrompt: true,
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
