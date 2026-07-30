/*
  Warnings:

  - You are about to drop the column `wordpress_html_content` on the `generated_drafts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "generated_drafts" DROP COLUMN "wordpress_html_content",
ADD COLUMN     "blog_post_content" TEXT;

-- CreateTable
CREATE TABLE "tone_profiles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tone_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_one_raw_draft_prompts" (
    "id" UUID NOT NULL,
    "tone_profile_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_one_raw_draft_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_two_polishing_prompts" (
    "id" UUID NOT NULL,
    "tone_profile_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_two_polishing_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_three_image_prompts" (
    "id" UUID NOT NULL,
    "tone_profile_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_three_image_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tone_profiles_name_key" ON "tone_profiles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "step_one_raw_draft_prompts_tone_profile_id_key" ON "step_one_raw_draft_prompts"("tone_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "step_two_polishing_prompts_tone_profile_id_key" ON "step_two_polishing_prompts"("tone_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "step_three_image_prompts_tone_profile_id_key" ON "step_three_image_prompts"("tone_profile_id");

-- AddForeignKey
ALTER TABLE "step_one_raw_draft_prompts" ADD CONSTRAINT "step_one_raw_draft_prompts_tone_profile_id_fkey" FOREIGN KEY ("tone_profile_id") REFERENCES "tone_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_two_polishing_prompts" ADD CONSTRAINT "step_two_polishing_prompts_tone_profile_id_fkey" FOREIGN KEY ("tone_profile_id") REFERENCES "tone_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_three_image_prompts" ADD CONSTRAINT "step_three_image_prompts_tone_profile_id_fkey" FOREIGN KEY ("tone_profile_id") REFERENCES "tone_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
