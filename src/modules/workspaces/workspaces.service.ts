import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/context/prisma.service";

interface QueueConfig {
	fetchFrequencyHours?: number;
	postingTimes?: string[];
}

@Injectable()
export class WorkspacesService {
	constructor(private prisma: PrismaService) {}

	async updateQueueConfig(workspaceId: string, config: QueueConfig) {
		const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
		if (!ws) throw new Error("Workspace not found");
		const updated = await this.prisma.workspace.update({
			where: { id: workspaceId },
			data: { queueConfig: config as any },
		});
		return updated;
	}
}
