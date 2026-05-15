-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "welcomeReminderD2SentAt" TIMESTAMP(3),
ADD COLUMN     "welcomeReminderD7SentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_emailVerified_welcomeReminderD2SentAt_createdAt_idx" ON "User"("emailVerified", "welcomeReminderD2SentAt", "createdAt");

-- CreateIndex
CREATE INDEX "User_emailVerified_welcomeReminderD7SentAt_createdAt_idx" ON "User"("emailVerified", "welcomeReminderD7SentAt", "createdAt");
