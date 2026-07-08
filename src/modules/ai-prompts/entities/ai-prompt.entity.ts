export class AiPrompt {
  id: string;
  scope: "GLOBAL" | "WORKSPACE";
  workspaceId?: string | null;
  createdById: string;
  name: string;
  description?: string | null;
  createdAt: Date;
}
