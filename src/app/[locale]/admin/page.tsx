import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { AdminDashboard } from '@/components/AdminDashboard';
import { validateSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: `${t('title')} — Preset Forge`, robots: 'noindex' };
}

export default async function AdminPage() {
  const { user } = await validateSession();
  if (!user) redirect('/auth/login');

  // Check role from DB (Lucia session may not have it yet after migration)
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (!dbUser || dbUser.role !== 'ADMIN') redirect('/');

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <AdminDashboard />
    </main>
  );
}
