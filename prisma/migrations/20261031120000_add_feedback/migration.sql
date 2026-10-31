-- User feedback form (/feedback). Verified users only; cascades with the user.
CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'IDEA', 'GENERAL');
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'READ', 'DONE');

CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "pagePath" VARCHAR(300),
    "userAgent" VARCHAR(400),
    "locale" TEXT NOT NULL DEFAULT 'en',
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt" DESC);
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
