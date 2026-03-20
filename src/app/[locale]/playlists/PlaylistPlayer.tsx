'use client';

type View = { type: 'overview' } | { type: 'edit'; id: string } | { type: 'play'; id: string };

interface PlaylistPlayerProps {
  playlistId: string;
  onNavigate: (view: View) => void;
}

export function PlaylistPlayer({ playlistId, onNavigate }: PlaylistPlayerProps) {
  return <div>Player placeholder for {playlistId}</div>;
}
