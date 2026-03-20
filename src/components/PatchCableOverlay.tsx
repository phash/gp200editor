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
  '#d4a24e', // amber
  '#d45050', // red
];

interface CablePath {
  d: string;
  color: string;
}

export function PatchCableOverlay({ containerRef, count, dragIndex, dragOverIndex }: PatchCableOverlayProps) {
  const [paths, setPaths] = useState<CablePath[]>([]);

  const recalculate = useCallback(() => {
    const container = containerRef.current;
    if (!container || count < 1) { setPaths([]); return; }

    const containerRect = container.getBoundingClientRect();
    const ox = containerRect.left;
    const oy = containerRect.top;

    // Collect card bounding rects (skip the SVG overlay element)
    const cards: DOMRect[] = [];
    for (let i = 0; i < count; i++) {
      // data-testid uses slotIndex which may differ from visual order after reorder
      // Use children order instead, skipping the SVG overlay (first child)
      const children = Array.from(container.children).filter(
        el => el.tagName !== 'svg'
      );
      const card = children[i] as HTMLElement | null;
      if (!card) continue;
      cards.push(card.getBoundingClientRect());
    }

    if (cards.length < 1) { setPaths([]); return; }

    const newPaths: CablePath[] = [];

    // Connection points: always right-center OUT, left-center IN
    // Vertically centered at 45% height (roughly where the module badge sits)
    const yFrac = 0.45;

    // Input stub — short cable coming into the first pedal from the left
    {
      const first = cards[0];
      const inX = first.left - ox;
      const inY = first.top + first.height * yFrac - oy;
      const stubLen = 25;
      newPaths.push({
        d: `M${inX - stubLen},${inY + 8} C${inX - stubLen * 0.3},${inY + 12} ${inX - 4},${inY + 2} ${inX},${inY}`,
        color: 'rgba(100,100,100,0.5)',
      });
    }

    // Cables between pedals: right side of [i] → left side of [i+1]
    for (let i = 0; i < cards.length - 1; i++) {
      const from = cards[i];
      const to = cards[i + 1];

      // Start: right-center of current pedal
      const sx = from.left + from.width - ox;
      const sy = from.top + from.height * yFrac - oy;

      // End: left-center of next pedal
      const ex = to.left - ox;
      const ey = to.top + to.height * yFrac - oy;

      const sameRow = Math.abs(from.top - to.top) < 30;

      let d: string;
      if (sameRow) {
        // Same row: gentle horizontal droop
        const gap = ex - sx;
        const sag = 12 + gap * 0.12;
        const midX = (sx + ex) / 2;
        d = `M${sx},${sy} C${midX},${sy + sag} ${midX},${ey + sag} ${ex},${ey}`;
      } else {
        // Different row: route right-out, curve down, come in from left
        // Go right from source, then swoop down to the next row, enter from left
        const exitX = sx + 20;     // extend right past the pedal
        const entryX = ex - 20;    // come in from left of next pedal
        const midY = (sy + ey) / 2;

        // Right-going exit, then curve down and left to next pedal's input
        d = [
          `M${sx},${sy}`,
          `C${exitX},${sy}`,     // ease right
          `${exitX},${midY}`,    // drop down on right side
          `${(exitX + entryX) / 2},${midY}`, // midpoint
          `S${entryX},${ey}`,    // smooth into left entry
          `${ex},${ey}`,
        ].join(' ');
      }

      const isDragging = dragIndex !== null &&
        (i === dragIndex || i + 1 === dragIndex || i === dragOverIndex || i + 1 === dragOverIndex);

      newPaths.push({
        d,
        color: isDragging ? 'rgba(100,100,100,0.3)' : CABLE_COLORS[i % CABLE_COLORS.length],
      });
    }

    // Output stub — short cable going out from the last pedal to the right
    {
      const last = cards[cards.length - 1];
      const outX = last.left + last.width - ox;
      const outY = last.top + last.height * yFrac - oy;
      const stubLen = 25;
      newPaths.push({
        d: `M${outX},${outY} C${outX + 4},${outY + 2} ${outX + stubLen * 0.7},${outY + 12} ${outX + stubLen},${outY + 8}`,
        color: 'rgba(100,100,100,0.5)',
      });
    }

    setPaths(newPaths);
  }, [containerRef, count, dragIndex, dragOverIndex]);

  useEffect(() => {
    recalculate();
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
          stroke="rgba(0,0,0,0.5)"
          strokeWidth={6}
          strokeLinecap="round"
          style={{ filter: 'blur(4px)' }}
        />
      ))}
      {/* Cables */}
      {paths.map((path, i) => (
        <path
          key={`cable-${i}`}
          d={path.d}
          fill="none"
          stroke={path.color}
          strokeWidth={3.5}
          strokeLinecap="round"
          opacity={0.7}
          style={{
            transition: 'all 0.3s ease',
            filter: `drop-shadow(0 0 4px ${path.color})`,
          }}
        />
      ))}
      {/* Cable plugs at connection points */}
      {paths.map((path, i) => {
        const startMatch = path.d.match(/^M([\d.-]+),([\d.-]+)/);
        const nums = path.d.match(/[\d.-]+/g);
        if (!startMatch || !nums || nums.length < 4) return null;
        const endX = nums[nums.length - 2];
        const endY = nums[nums.length - 1];
        return (
          <g key={`plugs-${i}`}>
            <circle cx={startMatch[1]} cy={startMatch[2]} r={4.5}
              fill="rgba(40,40,40,0.9)" stroke={path.color} strokeWidth={1.5} />
            <circle cx={endX} cy={endY} r={4.5}
              fill="rgba(40,40,40,0.9)" stroke={path.color} strokeWidth={1.5} />
          </g>
        );
      })}
    </svg>
  );
}
