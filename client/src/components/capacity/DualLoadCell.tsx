import type { CSSProperties } from 'react';

type LoadVisual = {
  colorize_load_cells: boolean;
  ok_enabled: boolean;
  ok_from: number;
  ok_to: number;
  ok_color: string;
  warn_enabled: boolean;
  warn_from: number;
  warn_to: number;
  warn_color: string;
  danger_enabled: boolean;
  danger_from: number;
  danger_to: number;
  danger_color: string;
};

function loadColor(pct: number, visual: LoadVisual): string {
  if (!visual.colorize_load_cells) return '#ffffff';
  if (visual.ok_enabled && pct >= visual.ok_from && pct <= visual.ok_to) return visual.ok_color;
  if (visual.warn_enabled && pct >= visual.warn_from && pct <= visual.warn_to) return visual.warn_color;
  if (visual.danger_enabled && pct >= visual.danger_from && pct <= visual.danger_to) return visual.danger_color;
  return '#e8f5e9';
}

const halfStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 600,
  minHeight: 20,
  lineHeight: 1.2,
};

export default function DualLoadCell({
  basePct,
  callOffPct,
  visual,
  compact = false,
}: {
  basePct: number;
  callOffPct: number;
  visual: LoadVisual;
  compact?: boolean;
}) {
  const base = Math.round(basePct);
  const co = Math.round(callOffPct);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 2 : 3, minHeight: compact ? 40 : 52 }}>
      <div
        style={{
          ...halfStyle,
          background: loadColor(base, visual),
          border: '1px solid #e0e0e0',
        }}
      >
        {base}%
      </div>
      <div
        style={{
          ...halfStyle,
          background: loadColor(co, visual),
          border: '1px solid #ce93d8',
        }}
      >
        {co}%
      </div>
    </div>
  );
}
