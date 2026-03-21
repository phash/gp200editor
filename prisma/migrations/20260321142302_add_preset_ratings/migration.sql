-- AlterTable
ALTER TABLE "Preset" ADD COLUMN     "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "effects" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PresetRating" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresetRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PresetRating_presetId_idx" ON "PresetRating"("presetId");

-- CreateIndex
CREATE UNIQUE INDEX "PresetRating_presetId_userId_key" ON "PresetRating"("presetId", "userId");

-- AddForeignKey
ALTER TABLE "PresetRating" ADD CONSTRAINT "PresetRating_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "Preset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresetRating" ADD CONSTRAINT "PresetRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
