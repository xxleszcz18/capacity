import type { CSSProperties } from 'react';

import type { LoadVisualSettings } from '../../utils/loadCellColors';
import { loadColor } from '../../utils/loadCellColors';

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
  colorizeLoads = true,
  neutralBackground,
}: {
  basePct: number;
  callOffPct: number;
  visual: LoadVisualSettings;
  compact?: boolean;
  /** false — bez progów obciążenia (np. wiersz sumy/średniej wyłączony lub tylko podświetlenie wiersza). */
  colorizeLoads?: boolean;
  /** Tło połówek gdy colorizeLoads=false (np. delikatny odcień wiersza sumy/średniej). */
  neutralBackground?: string;
}) {
  const base = Math.round(basePct);
  const co = Math.round(callOffPct);
  const halfBg = (pct: number) =>
    colorizeLoads ? loadColor(pct, visual) : neutralBackground ?? '#ffffff';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 2 : 3, minHeight: compact ? 40 : 52 }}>
      <div
        style={{
          ...halfStyle,
          background: halfBg(base),
          border: '1px solid #e0e0e0',
        }}
      >
        {base}%
      </div>
      <div
        style={{
          ...halfStyle,
          background: halfBg(co),
          border: '1px solid #ce93d8',
        }}
      >
        {co}%
      </div>
    </div>
  );
}
