'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

type Props = {
  initialData: { bio: string; website: string; avatarUrl: string | null };
  username: string;
};

export default function ProfileEditForm({ initialData, username }: Props) {
  const t = useTranslations('profile');
  const [bio, setBio] = useState(initialData.bio);
  const [website, setWebsite] = useState(initialData.website);
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: bio || null, website: website || null }),
    });

    setStatus(res.ok ? 'saved' : 'error');
    setTimeout(() => setStatus('idle'), 2000);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append('avatar', file);

    const res = await fetch('/api/profile/avatar', { method: 'POST', body: form });
    if (res.ok) {
      const data = await res.json() as { avatarUrl: string };
      setAvatarUrl(data.avatarUrl);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">
      {/* Avatar */}
      <div>
        <p className="text-sm font-medium mb-2">{t('avatarLabel')}</p>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={username}
              width={80}
              height={80}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl text-gray-500">
              {username[0]?.toUpperCase()}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-sm text-blue-600 hover:underline"
          >
            {t('changeAvatar')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="bio">
          {t('bio')}
        </label>
        <textarea
          id="bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Website */}
      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="website">
          {t('website')}
        </label>
        <input
          id="website"
          name="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'saving'}
          data-testid="save-profile"
          className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {status === 'saving' ? t('saving') : t('saveButton')}
        </button>
        {status === 'saved' && (
          <span className="text-green-600 text-sm" data-testid="save-success">
            {t('saved')}
          </span>
        )}
        {status === 'error' && (
          <span className="text-red-600 text-sm">{t('saveFailed')}</span>
        )}
      </div>
    </form>
  );
}
