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
      <div
        className="rounded-lg p-6"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        <h1
          className="font-mono-display text-xl font-bold tracking-tight mb-1"
          style={{ color: 'var(--accent-amber)' }}
        >
          {t('title')}
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
          <span className="font-mono-display">@{dbUser.username}</span>
          <span className="mx-2" style={{ color: 'var(--border-active)' }}>&middot;</span>
          {t('memberSince')} {dbUser.createdAt.toLocaleDateString()}
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
    </div>
  );
}
