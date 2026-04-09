-- CreateIndex
CREATE INDEX "Preset_public_createdAt_idx" ON "Preset"("public", "createdAt");

-- CreateIndex
CREATE INDEX "Preset_public_downloadCount_idx" ON "Preset"("public", "downloadCount");

-- CreateIndex
CREATE INDEX "Preset_public_ratingAverage_idx" ON "Preset"("public", "ratingAverage");
