-- AlterTable
ALTER TABLE "generated_drafts" ADD COLUMN     "company_social_post" TEXT,
ADD COLUMN     "group_id" UUID,
ADD COLUMN     "image_caption" TEXT,
ADD COLUMN     "image_concept" TEXT,
ADD COLUMN     "negative_constraints" TEXT,
ADD COLUMN     "personal_social_post" TEXT,
ADD COLUMN     "polished_content" TEXT,
ADD COLUMN     "raw_content" TEXT;

-- AlterTable
ALTER TABLE "raw_posts_buffer" ADD COLUMN     "group_id" UUID,
ADD COLUMN     "source_name" TEXT;

-- CreateTable
CREATE TABLE "article_groups" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "shared_theme" TEXT NOT NULL,
    "editorial_angle" TEXT NOT NULL,
    "article_urls" TEXT[],
    "article_titles" TEXT[],
    "article_sources" TEXT[],
    "article_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_groups_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "raw_posts_buffer" ADD CONSTRAINT "raw_posts_buffer_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "article_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_drafts" ADD CONSTRAINT "generated_drafts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "article_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_groups" ADD CONSTRAINT "article_groups_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
