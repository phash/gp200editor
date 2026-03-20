-- AlterTable
ALTER TABLE "Preset" ADD COLUMN "effects" TEXT[] DEFAULT ARRAY[]::TEXT[];
