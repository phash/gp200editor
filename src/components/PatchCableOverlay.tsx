'use client';
import { useEffect, useState, useCallback } from 'react';

interface PatchCableOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  count: number;
  dragIndex: number | null;
  dragOverIndex: number | null;
}

// Cable colors — cycle through warm tones like real patch cables
const CABLE_COLORS = [
  '#d4a24e', // amber
  '#d45050', // red
  '#50b878', // green
  '#5090e0', // blue
  '#c876d4', // purple
  '#e08040', // orange
  '#50b8d4', // cyan
  '#9060c8', // violet
  '#7070d8', // indigo
  '#d4a24e', // amber again
  '#d45050', // red again
];

export function PatchCableOverlay({ containerRef, count, dragIndex, dragOverIndex }: PatchCableOverlayProps) {
  const [paths, setPaths] = useState<{ d: string; color: string }[]>([]);

  const recalculate = useCallback(() => {
    const container = containerRef.current;
    if (!container || count < 2) { setPaths([]); return; }

    const containerRect = container.getBoundingClientRect();
    const cards: DOMRect[] = [];

    for (let i = 0; i < count; i++) {
      const el = container.querySelector(`[data-testid="effect-slot-${i}"]`) as HTMLElement | null;
      // Fall back to nth-child if data-testid doesn't match reordered slots
      const card = el ?? container.children[i] as HTMLElement | null;
      if (!card) continue;
      cards.push(card.getBoundingClientRect());
    }

    if (cards.length < 2) { setPaths([]); return; }

    const newPaths: { d: string; color: string }[] = [];

    for (let i = 0; i < cards.length - 1; i++) {
      const from = cards[i];
      const to = cards[i + 1];

      // Connect from bottom-center of current to top-center of next (relative to container)
      const x1 = from.left + from.width / 2 - containerRect.left;
      const y1 = from.top + from.height - containerRect.top;
      const x2 = to.left + to.width / 2 - containerRect.left;
      const y2 = to.top - containerRect.top;

      const sameRow = Math.abs(from.top - to.top) < 20;

      let d: string;
      if (sameRow) {
        // Same row — connect right side of left pedal to left side of right pedal
        const sx = from.left + from.width - containerRect.left;
        const sy = from.top + from.height * 0.6 - containerRect.top;
        const ex = to.left - containerRect.left;
        const ey = to.top + to.height * 0.6 - containerRect.top;
        const midX = (sx + ex) / 2;
        // Droopy cable effect
        const sag = 20 + Math.abs(ex - sx) * 0.15;
        d = `M${sx},${sy} C${midX},${sy + sag} ${midX},${ey + sag} ${ex},${ey}`;
      } else {
        // Different row — connect bottom of current to top of next
        const sag = Math.abs(y2 - y1) * 0.3 + 15;
        const midY = (y1 + y2) / 2;
        d = `M${x1},${y1} C${x1},${y1 + sag} ${x2},${y2 - sag} ${x2},${y2}`;
        // If crossing columns, add extra horizontal sag
        if (Math.abs(x2 - x1) > 50) {
          const cp1x = x1 + (x2 - x1) * 0.2;
          const cp2x = x1 + (x2 - x1) * 0.8;
          d = `M${x1},${y1} C${cp1x},${midY + sag * 0.5} ${cp2x},${midY - sag * 0.5} ${x2},${y2}`;
        }
      }

      const isDragging = dragIndex !== null && (i === dragIndex || i + 1 === dragIndex || i === dragOverIndex || i + 1 === dragOverIndex);

      newPaths.push({
        d,
        color: isDragging ? 'rgba(100,100,100,0.3)' : CABLE_COLORS[i % CABLE_COLORS.length],
      });
    }

    setPaths(newPaths);
  }, [containerRef, count, dragIndex, dragOverIndex]);

  useEffect(() => {
    recalculate();
    // Recalculate on resize and after animations
    window.addEventListener('resize', recalculate);
    const timer = setTimeout(recalculate, 300); // after slot-enter animation
    return () => {
      window.removeEventListener('resize', recalculate);
      clearTimeout(timer);
    };
  }, [recalculate]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {/* Cable shadows */}
      {paths.map((path, i) => (
        <path
          key={`shadow-${i}`}
          d={path.d}
          fill="none"
          stroke="rgba(0,0,0,0.4)"
          strokeWidth={5}
          strokeLinecap="round"
          style={{ filter: 'blur(3px)' }}
        />
      ))}
      {/* Cables */}
      {paths.map((path, i) => (
        <path
          key={`cable-${i}`}
          d={path.d}
          fill="none"
          stroke={path.color}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.6}
          style={{
            transition: 'all 0.3s ease',
            filter: `drop-shadow(0 0 3px ${path.color})`,
          }}
        />
      ))}
      {/* Cable plugs — small circles at connection points */}
      {paths.map((path, i) => {
        // Extract start and end points from the path
        const startMatch = path.d.match(/^M([\d.]+),([\d.]+)/);
        const endParts = path.d.split(' ');
        const endMatch = endParts[endParts.length - 1].match(/([\d.]+),([\d.]+)$/);
        if (!startMatch || !endMatch) return null;
        return (
          <g key={`plugs-${i}`}>
            <circle cx={startMatch[1]} cy={startMatch[2]} r={4} fill={path.color} opacity={0.8} />
            <circle cx={endMatch[1]} cy={endMatch[2]} r={4} fill={path.color} opacity={0.8} />
          </g>
        );
      })}
    </svg>
  );
}
