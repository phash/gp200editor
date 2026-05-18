-- DropIndex
DROP INDEX "Comment_presetId_parentId_createdAt_idx";

-- CreateIndex
CREATE INDEX "Comment_presetId_parentId_createdAt_idx" ON "Comment"("presetId", "parentId", "createdAt" DESC);
