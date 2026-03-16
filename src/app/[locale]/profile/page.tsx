import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import ProfileEditForm from './ProfileEditForm';

export default async function ProfilePage() {
  const { user } = await validateSession();
  // Redirect unauthenticated users (e.g., expired session with stale cookie)
  if (!user) redirect('/auth/login');

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const t = await getTranslations('profile');

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
      <p className="text-gray-500 text-sm mb-6">
        @{dbUser.username} · {t('memberSince')}{' '}
        {dbUser.createdAt.toLocaleDateString()}
      </p>
      <ProfileEditForm
        initialData={{
          bio: dbUser.bio ?? '',
          website: dbUser.website ?? '',
          avatarUrl: dbUser.avatarKey ? `/api/avatar/${dbUser.avatarKey}` : null,
        }}
        username={dbUser.username}
      />
    </div>
  );
}
