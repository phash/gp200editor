-- ErrorLog v2: fingerprint-based grouping + severity + per-fingerprint email throttle.
--
-- Strategy:
--   1) Add new columns as nullable / with defaults so existing rows survive.
--   2) Backfill: legacy rows get category='legacy', severity mapped from old level,
--      fingerprint from md5(category|message). Built-in md5 is fine for legacy
--      bucketing because legacy rows can never collide with new rows (different
--      category prefix), and the format matches the 32-hex-char shape the
--      application logger will produce going forward.
--   3) Tighten new columns to NOT NULL, drop the old `level` column.
--   4) Add indexes.

-- 1) Add new columns
ALTER TABLE "ErrorLog"
  ADD COLUMN "fingerprint"   TEXT,
  ADD COLUMN "category"      TEXT,
  ADD COLUMN "severity"      TEXT,
  ADD COLUMN "route"         TEXT,
  ADD COLUMN "method"        TEXT,
  ADD COLUMN "ip"            TEXT,
  ADD COLUMN "count"         INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "firstSeenAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "resolvedAt"    TIMESTAMP(3),
  ADD COLUMN "lastEmailedAt" TIMESTAMP(3);

-- 2) Backfill from old `level` column
UPDATE "ErrorLog"
SET
  "category"    = 'legacy',
  "severity"    = CASE WHEN "level" = 'warn' THEN 'warning' ELSE 'error' END,
  "fingerprint" = substring(md5('legacy|' || "message"), 1, 32),
  "firstSeenAt" = "createdAt",
  "lastSeenAt"  = "createdAt"
WHERE "fingerprint" IS NULL;

-- 3) Tighten constraints + drop old column
ALTER TABLE "ErrorLog"
  ALTER COLUMN "fingerprint" SET NOT NULL,
  ALTER COLUMN "category"    SET NOT NULL,
  ALTER COLUMN "severity"    SET NOT NULL;

ALTER TABLE "ErrorLog" DROP COLUMN "level";

-- 4) Indexes
CREATE INDEX "ErrorLog_fingerprint_idx"            ON "ErrorLog"("fingerprint");
CREATE INDEX "ErrorLog_severity_resolvedAt_idx"    ON "ErrorLog"("severity", "resolvedAt");
CREATE INDEX "ErrorLog_lastSeenAt_idx"             ON "ErrorLog"("lastSeenAt");
