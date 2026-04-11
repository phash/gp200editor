'use client';

import { useEffect, useState } from 'react';

export interface AuthStatus {
  /** null while loading, true if logged in, false if not. */
  isLoggedIn: boolean | null;
  /** Username if logged in, empty string otherwise. */
  username: string;
}

/**
 * Fetches /api/profile once on mount and exposes login state + username.
 *
 * Extracted from src/app/[locale]/editor/page.tsx (clean-code PR, 2026-04-11)
 * to shrink the editor page's hook cluster. Zero MIDI coupling and no
 * cross-component state, so the extraction is mechanical.
 *
 * isLoggedIn is `null` until the request resolves so the editor can
 * distinguish "not yet known" from "definitely not logged in" and avoid
 * flashing a Sign-In CTA during the auth roundtrip.
 */
export function useAuthStatus(): AuthStatus {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => {
        setIsLoggedIn(r.ok);
        if (r.ok) return r.json();
        return null;
      })
      .then((data: { username?: string } | null) => {
        if (data?.username) setUsername(data.username);
      })
      .catch(() => setIsLoggedIn(false));
  }, []);

  return { isLoggedIn, username };
}
