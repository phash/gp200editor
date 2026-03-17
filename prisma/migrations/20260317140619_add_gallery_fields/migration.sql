-- AlterTable
ALTER TABLE "Preset" ADD COLUMN     "modules" TEXT[],
ADD COLUMN     "public" BOOLEAN NOT NULL DEFAULT false;
