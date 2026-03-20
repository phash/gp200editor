FROM node:23-alpine AS base

# ── Deps ──────────────────────────────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache openssl \
 && addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

RUN mkdir -p ./public
COPY --from=builder /app/public/             ./public/
COPY --from=builder --chown=nextjs:nodejs \
     /app/.next/standalone                   ./
COPY --from=builder --chown=nextjs:nodejs \
     /app/.next/static                       ./.next/static
COPY --from=builder /app/node_modules/.prisma/client/ \
     ./node_modules/.prisma/client/
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder /app/prisma ./prisma
COPY docker-entrypoint.sh ./
USER root
RUN chmod +x docker-entrypoint.sh
USER nextjs

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
