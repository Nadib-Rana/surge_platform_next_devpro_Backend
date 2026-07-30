/*
  Warnings:

  - You are about to drop the column `prompt_version_id` on the `generated_drafts` table. All the data in the column will be lost.
  - You are about to drop the `ai_prompts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `prompt_versions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ai_prompts" DROP CONSTRAINT "ai_prompts_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "ai_prompts" DROP CONSTRAINT "ai_prompts_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "generated_drafts" DROP CONSTRAINT "generated_drafts_prompt_version_id_fkey";

-- DropForeignKey
ALTER TABLE "prompt_versions" DROP CONSTRAINT "prompt_versions_prompt_id_fkey";

-- DropIndex
DROP INDEX "generated_drafts_prompt_version_id_idx";

-- AlterTable
ALTER TABLE "generated_drafts" DROP COLUMN "prompt_version_id",
ADD COLUMN     "tone_profile_id" UUID;

-- DropTable
DROP TABLE "ai_prompts";

-- DropTable
DROP TABLE "prompt_versions";

-- DropEnum
DROP TYPE "PromptScope";

-- CreateIndex
CREATE INDEX "generated_drafts_tone_profile_id_idx" ON "generated_drafts"("tone_profile_id");

-- AddForeignKey
ALTER TABLE "generated_drafts" ADD CONSTRAINT "generated_drafts_tone_profile_id_fkey" FOREIGN KEY ("tone_profile_id") REFERENCES "tone_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
