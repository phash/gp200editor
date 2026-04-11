-- Adds an index on PresetRating.userId so queries like "all presets rated by
-- user X" (profile pages, admin dashboard) don't do a sequential scan on the
-- ratings table once the library grows.
CREATE INDEX IF NOT EXISTS "PresetRating_userId_idx" ON "PresetRating"("userId");
