# Datenbankschema (Prisma)

```prisma
enum Role     { USER, ADMIN }
enum FeedbackCategory { BUG, IDEA, GENERAL }
enum FeedbackStatus   { NEW, READ, DONE }
User          id, email, username, passwordHash, emailVerified, bio, website, avatarKey,
              role(Role @default(USER)), suspended(Boolean @default(false)),
              locale(@default("en")), welcomeReminderD2SentAt?, welcomeReminderD7SentAt?,
              createdAt
              Relations: sessions, resetTokens, emailVerifyTokens, presets, ratings, comments, adminActions, feedback
              @@index([emailVerified, welcomeReminderD2SentAt, createdAt]) (+ D7 analog)
Session       id, userId, expiresAt  (Lucia v3)
PasswordResetToken  id, userId, tokenHash, expiresAt, usedAt
EmailVerificationToken  id, userId, tokenHash, expiresAt, usedAt
Preset        id, userId, presetKey, name(VarChar32), description, tags(String[]),
              shareToken(@unique), downloadCount, public, style, author,
              flagged(Boolean @default(false)),
              ratingAverage(Float), ratingCount(Int), modules(String[]), effects(String[]),
              audioKey?, audioMimeType?, audioDurationMs?        (30s-Snippet, Bucket GARAGE_AUDIO_BUCKET)
              sourceUrl?, sourceLabel?, contentHash?, ingestedAt? (Library-Ingest, siehe library-ingest.md)
              createdAt, updatedAt
              Relations: user, ratings, comments
              @@index([userId]) @@index([sourceUrl]) @@index([sourceLabel]) @@index([contentHash]) @@index([audioKey])
              @@index([public, createdAt])
              @@index([public, downloadCount])
              @@index([public, ratingAverage])
PresetRating  id, presetId, userId, score(Int 1-5), createdAt, updatedAt
              @@unique([presetId, userId])
              @@index([presetId]) @@index([userId])
Comment       id, presetId, userId, parentId?(→Comment "CommentReplies", onDelete:Cascade),
              body?(VarChar1000), editedAt?, deletedAt?, deletedBy?, createdAt, updatedAt
              (Soft-Delete: body=null + deletedAt, Antworten bleiben erhalten)
              @@index([presetId, parentId, createdAt desc]) @@index([userId]) @@index([createdAt desc])
ErrorLog      id, fingerprint, category, severity, message, stack?(Text), route?, method?, url?,
              userId?, ip?, metadata(Json?), count(@default(1)), firstSeenAt, lastSeenAt,
              resolvedAt?, lastEmailedAt?, createdAt
              (gleiche Fehler werden per fingerprint gruppiert: count++ / lastSeenAt)
              @@index([fingerprint]) @@index([severity, resolvedAt]) @@index([lastSeenAt]) @@index([createdAt])
AdminAction   id, adminId?(→User onDelete:SetNull), action, targetType, targetId,
              reason?, metadata(Json?), createdAt
              @@index([adminId]) @@index([createdAt])
Feedback      id, userId(→User onDelete:Cascade), category(FeedbackCategory), message(VarChar2000),
              pagePath?(VarChar300), userAgent?(VarChar400), locale(@default("en")),
              status(FeedbackStatus @default(NEW)), createdAt, updatedAt
              @@index([status, createdAt desc]) @@index([userId, createdAt])
```
