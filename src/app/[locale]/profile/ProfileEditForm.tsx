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
  const [uploading, setUploading] = useState(false);
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

    setUploading(true);
    const form = new FormData();
    form.append('avatar', file);

    try {
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form });
      if (res.ok) {
        const data = await res.json() as { avatarUrl: string };
        setAvatarUrl(data.avatarUrl);
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">
      {/* Avatar */}
      <div>
        <p
          className="font-mono-display text-[11px] font-medium tracking-wider uppercase mb-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('avatarLabel')}
        </p>
        <div className="flex items-center gap-4" style={{ opacity: uploading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
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
                alt={username}
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
              {username[0]?.toUpperCase()}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-sm font-mono-display transition-colors text-accent-amber hover:text-text-primary"
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
        <label
          className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
          htmlFor="bio"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('bio')}
        </label>
        <textarea
          id="bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-shadow resize-none"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-active)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-amber)';
            e.currentTarget.style.boxShadow = '0 0 0 2px var(--glow-amber)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-active)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Website */}
      <div>
        <label
          className="block font-mono-display text-[11px] font-medium tracking-wider uppercase mb-1.5"
          htmlFor="website"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('website')}
        </label>
        <input
          id="website"
          name="website"
          type="text"
          placeholder="www.example.com"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="w-full rounded px-3 py-2 text-sm focus:outline-none transition-shadow"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-active)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-amber)';
            e.currentTarget.style.boxShadow = '0 0 0 2px var(--glow-amber)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-active)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'saving'}
          data-testid="save-profile"
          className="font-mono-display text-sm font-bold tracking-wider uppercase rounded px-5 py-2.5 transition-all duration-150 disabled:opacity-50 bg-[var(--glow-amber)] border border-accent-amber text-accent-amber shadow-glow-amber hover:bg-accent-amber hover:text-bg-primary hover:shadow-[0_0_20px_var(--glow-amber)] disabled:hover:bg-[var(--glow-amber)] disabled:hover:text-accent-amber disabled:hover:shadow-glow-amber"
        >
          {status === 'saving' ? t('saving') : t('saveButton')}
        </button>
        {status === 'saved' && (
          <span
            className="text-sm font-mono-display"
            data-testid="save-success"
            style={{ color: 'var(--accent-green)' }}
          >
            {t('saved')}
          </span>
        )}
        {status === 'error' && (
          <span className="text-sm font-mono-display" style={{ color: 'var(--accent-red)' }}>
            {t('saveFailed')}
          </span>
        )}
      </div>
    </form>
  );
}
