-- AlterTable
ALTER TABLE "Preset" ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "sourceLabel" TEXT,
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "ingestedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Preset_sourceLabel_idx" ON "Preset"("sourceLabel");

-- CreateIndex
CREATE INDEX "Preset_contentHash_idx" ON "Preset"("contentHash");
