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

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

RUN mkdir -p ./public
COPY --from=builder /app/public/             ./public/
COPY --from=builder --chown=nextjs:nodejs \
     /app/.next/standalone                   ./
COPY --from=builder --chown=nextjs:nodejs \
     /app/.next/static                       ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
