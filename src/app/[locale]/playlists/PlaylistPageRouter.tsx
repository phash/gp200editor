'use client';

import { useEffect, useState, useCallback } from 'react';
import { PlaylistOverview } from './PlaylistOverview';
import { PlaylistEditor } from './PlaylistEditor';
import { PlaylistPlayer } from './PlaylistPlayer';

type View = { type: 'overview' } | { type: 'edit'; id: string } | { type: 'play'; id: string };

export function PlaylistPageRouter() {
  const [view, setView] = useState<View>({ type: 'overview' });

  const parseUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    const playId = params.get('play');
    if (editId) setView({ type: 'edit', id: editId });
    else if (playId) setView({ type: 'play', id: playId });
    else setView({ type: 'overview' });
  }, []);

  useEffect(() => {
    parseUrl();
    window.addEventListener('popstate', parseUrl);
    return () => window.removeEventListener('popstate', parseUrl);
  }, [parseUrl]);

  const navigate = useCallback((newView: View) => {
    let url = '/playlists';
    if (newView.type === 'edit') url = `/playlists?edit=${newView.id}`;
    else if (newView.type === 'play') url = `/playlists?play=${newView.id}`;
    window.history.pushState(null, '', url);
    setView(newView);
  }, []);

  switch (view.type) {
    case 'edit': return <PlaylistEditor playlistId={view.id} onNavigate={navigate} />;
    case 'play': return <PlaylistPlayer playlistId={view.id} onNavigate={navigate} />;
    default: return <PlaylistOverview onNavigate={navigate} />;
  }
}
