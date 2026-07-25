import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/context/prisma.service";
import { CreateAiPromptDto } from "../dto/create-ai-prompt.dto";
import { UpdateAiPromptDto } from "../dto/update-ai-prompt.dto";

export type PromptScope = "GLOBAL" | "WORKSPACE";

export interface AuthenticatedUser {
  userId: string;
  role: string;
}

export interface UpdateablePrompt {
  name: string;
  description: string | null;
  scope: PromptScope;
}

export function hasVersionChange(updateAiPromptDto: UpdateAiPromptDto) {
  return (
    updateAiPromptDto.systemPrompt !== undefined ||
    updateAiPromptDto.tone !== undefined
  );
}

export async function updatePromptWithVersionTransaction(
  tx: Prisma.TransactionClient,
  id: string,
  updateAiPromptDto: UpdateAiPromptDto,
  prompt: UpdateablePrompt,
) {
  await tx.aiPrompt.update({
    where: { id },
    data: {
      name: updateAiPromptDto.name ?? prompt.name,
      description: updateAiPromptDto.description ?? prompt.description,
    },
  });

  if (hasVersionChange(updateAiPromptDto)) {
    const activeVersion = await tx.promptVersion.findFirst({
      where: { promptId: id, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    const versionCount = await tx.promptVersion.count({
      where: { promptId: id },
    });

    await tx.promptVersion.updateMany({
      where: { promptId: id },
      data: { isActive: false },
    });

    await tx.promptVersion.create({
      data: {
        promptId: id,
        versionTag: `v${versionCount + 1}`,
        systemPrompt:
          updateAiPromptDto.systemPrompt ??
          activeVersion?.systemPrompt ??
          "You are an expert social media copywriter.",
        tone: updateAiPromptDto.tone ?? activeVersion?.tone ?? "professional",
        isActive: true,
      },
    });
  }

  const updatedPrompt = await tx.aiPrompt.findUnique({
    where: { id },
    include: {
      versions: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!updatedPrompt) {
    throw new NotFoundException(`AI prompt ${id} not found`);
  }

  return updatedPrompt;
}

export async function createPromptWithVersionHelper(
  prisma: PrismaService,
  dto: CreateAiPromptDto,
  user?: AuthenticatedUser,
) {
  if (!dto.createdById) {
    throw new BadRequestException("createdById is required");
  }

  if (dto.scope === "GLOBAL") {
    if (user?.role !== "admin") {
      throw new ForbiddenException("Only admins can create global prompts");
    }

    if (dto.workspaceId) {
      throw new BadRequestException(
        "workspaceId must be omitted for global prompts",
      );
    }
  } else if (!dto.workspaceId) {
    throw new BadRequestException(
      "workspaceId is required for workspace prompts",
    );
  }

  const prompt = await prisma.aiPrompt.create({
    data: {
      scope: dto.scope ?? "WORKSPACE",
      workspaceId: dto.scope === "GLOBAL" ? null : (dto.workspaceId ?? null),
      createdById: dto.createdById,
      name: dto.name,
      description: dto.description,
    },
  });

  const version = await prisma.promptVersion.create({
    data: {
      promptId: prompt.id,
      versionTag: dto.versionTag ?? "v1",
      systemPrompt:
        dto.systemPrompt ?? "You are an expert social media copywriter.",
      tone: dto.tone ?? "professional",
      isActive: true,
    },
  });

  return { prompt, version };
}
