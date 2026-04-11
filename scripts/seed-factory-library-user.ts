#!/usr/bin/env tsx
/**
 * Ensures a system user factory-library exists. Idempotent — safe to run
 * multiple times. The password hash is an unusable sentinel so the account
 * cannot log in.
 *
 * Usage: tsx scripts/seed-factory-library-user.ts
 */
import { prisma } from '../src/lib/prisma';

const UNUSABLE_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$UNUSABLE$UNUSABLE-factory-library-system-user';

async function main() {
  const existing = await prisma.user.findUnique({
    where: { username: 'factory-library' },
    select: { id: true },
  });
  if (existing) {
    console.log(`factory-library user already exists (id=${existing.id})`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: 'factory-library@preset-forge.com',
      username: 'factory-library',
      passwordHash: UNUSABLE_PASSWORD_HASH,
      emailVerified: true,
      suspended: false,
      role: 'USER',
      bio: 'Curated library of Valeton GP-200 presets from factory firmware, GitHub, and community sources. Each preset links back to its original source.',
    },
    select: { id: true },
  });
  console.log(`Created factory-library user (id=${user.id})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
