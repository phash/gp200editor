import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { validateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Image from 'next/image';
import { AdminActions } from '@/components/AdminActions';

type Props = {
  params: Promise<{ username: string }>;
};

export default async function UserProfilePage({ params }: Props) {
  // Spec: all profile pages require login in v1
  const { user } = await validateSession();
  if (!user) redirect('/auth/login');

  const { username } = await params;
  const t = await getTranslations('profile');

  const profileUser = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      bio: true,
      website: true,
      avatarKey: true,
      createdAt: true,
      suspended: true,
    },
  });

  if (!profileUser) notFound();

  // Check if current user is admin (for contextual admin actions)
  const isAdmin = !!user && (await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  }))?.role === 'ADMIN';

  const avatarUrl = profileUser.avatarKey
    ? `/api/avatar/${profileUser.avatarKey}`
    : null;

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
        <div className="flex items-center gap-4 mb-6">
          {avatarUrl ? (
            <div
              className="rounded-full p-0.5 flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--accent-amber), var(--accent-amber-dim))',
                boxShadow: '0 0 16px var(--glow-amber)',
              }}
            >
              <Image
                src={avatarUrl}
                alt={profileUser.username}
                width={80}
                height={80}
                className="rounded-full object-cover"
                style={{ border: '2px solid var(--bg-surface)' }}
              />
            </div>
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center font-mono-display text-2xl font-bold flex-shrink-0"
              style={{
                background: 'var(--bg-elevated)',
                border: '2px solid var(--border-active)',
                color: 'var(--accent-amber-dim)',
              }}
            >
              {profileUser.username[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h1
              className="font-mono-display text-xl font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              @{profileUser.username}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('memberSince')} {profileUser.createdAt.toLocaleDateString()}
            </p>
          </div>
        </div>

        {profileUser.bio && (
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            {profileUser.bio}
          </p>
        )}

        {profileUser.website && (
          <a
            href={profileUser.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm transition-colors text-[var(--accent-amber)] hover:!text-[var(--text-primary)]"
          >
            {profileUser.website}
          </a>
        )}

        {isAdmin && profileUser.id !== user!.id && (
          <div style={{ borderTop: '1px solid var(--border-subtle)' }} className="pt-3 mt-3">
            <AdminActions
              type="user"
              targetId={profileUser.id}
              username={profileUser.username}
              suspended={profileUser.suspended}
            />
          </div>
        )}
      </div>
    </div>
  );
}
