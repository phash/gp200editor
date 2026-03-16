import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { validateSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import Image from 'next/image';

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
      username: true,
      bio: true,
      website: true,
      avatarKey: true,
      createdAt: true,
    },
  });

  if (!profileUser) notFound();

  const avatarUrl = profileUser.avatarKey
    ? `/api/avatar/${profileUser.avatarKey}`
    : null;

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={profileUser.username}
            width={80}
            height={80}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl text-gray-500">
            {profileUser.username[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">@{profileUser.username}</h1>
          <p className="text-gray-500 text-sm">
            {t('memberSince')} {profileUser.createdAt.toLocaleDateString()}
          </p>
        </div>
      </div>

      {profileUser.bio && (
        <p className="text-gray-700 mb-3">{profileUser.bio}</p>
      )}

      {profileUser.website && (
        <a
          href={profileUser.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-sm"
        >
          {profileUser.website}
        </a>
      )}
    </div>
  );
}
