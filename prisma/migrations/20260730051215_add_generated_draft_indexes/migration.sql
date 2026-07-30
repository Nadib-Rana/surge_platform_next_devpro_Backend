-- CreateIndex
CREATE INDEX "generated_drafts_workspace_id_idx" ON "generated_drafts"("workspace_id");

-- CreateIndex
CREATE INDEX "generated_drafts_prompt_version_id_idx" ON "generated_drafts"("prompt_version_id");
