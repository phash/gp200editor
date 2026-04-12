# Datenbankschema (Prisma)

```prisma
enum Role     { USER, ADMIN }
User          id, email, username, passwordHash, emailVerified, bio, website, avatarKey,
              role(Role @default(USER)), suspended(Boolean @default(false)),
              createdAt
              Relations: sessions, resetTokens, emailVerifyTokens, presets, ratings, adminActions
Session       id, userId, expiresAt  (Lucia v3)
PasswordResetToken  id, userId, tokenHash, expiresAt, usedAt
EmailVerificationToken  id, userId, tokenHash, expiresAt, usedAt
Preset        id, userId, presetKey, name(VarChar32), description, tags(String[]),
              shareToken(@unique), downloadCount, public, style, author,
              flagged(Boolean @default(false)),
              ratingAverage(Float), ratingCount(Int), modules(String[]), effects(String[]),
              createdAt, updatedAt
              @@index([userId])
              @@index([public, createdAt])
              @@index([public, downloadCount])
              @@index([public, ratingAverage])
PresetRating  id, presetId, userId, score(Int 1-5), createdAt, updatedAt
              @@unique([presetId, userId])
              @@index([presetId])
ErrorLog      id, level, message, stack?, url?, userId?, metadata(Json?), createdAt
              @@index([createdAt])
AdminAction   id, adminId?(→User onDelete:SetNull), action, targetType, targetId,
              reason?, metadata(Json?), createdAt
              @@index([adminId]) @@index([createdAt])
```
