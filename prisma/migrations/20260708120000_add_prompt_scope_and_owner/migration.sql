-- CreateEnum
CREATE TYPE "PromptScope" AS ENUM ('GLOBAL', 'WORKSPACE');

-- AlterTable
ALTER TABLE "ai_prompts"
ADD COLUMN "scope" "PromptScope" NOT NULL DEFAULT 'WORKSPACE';

ALTER TABLE "ai_prompts"
ADD COLUMN "created_by_id" UUID;

-- Backfill existing rows with a safe fallback owner.
UPDATE "ai_prompts"
SET "created_by_id" = (
  SELECT "id"
  FROM "users"
  ORDER BY "created_at" ASC
  LIMIT 1
)
WHERE "created_by_id" IS NULL;

-- Make the column required after backfill.
ALTER TABLE "ai_prompts"
ALTER COLUMN "created_by_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ai_prompts"
ADD CONSTRAINT "ai_prompts_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ai_prompts_scope_workspace_id_idx" ON "ai_prompts"("scope", "workspace_id");
