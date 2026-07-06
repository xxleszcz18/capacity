import type { CSSProperties } from 'react';
import { useI18n } from '../../context/I18nContext';

export type ChartGridCols = 1 | 2 | 3;

type Props = {
  value: ChartGridCols;
  onChange: (value: ChartGridCols) => void;
};

function GridIcon({ cols }: { cols: ChartGridCols }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 2,
        width: 28,
        height: 18,
      }}
    >
      {Array.from({ length: cols }, (_, i) => (
        <span
          key={i}
          style={{
            background: 'currentColor',
            borderRadius: 1,
            opacity: 0.9,
          }}
        />
      ))}
    </span>
  );
}

export default function ChartGridLayoutPicker({ value, onChange }: Props) {
  const { t } = useI18n();
  const options: ChartGridCols[] = [1, 2, 3];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, color: '#666' }}>{t('dataViz.chartLayout')}</span>
      <div
        role="group"
        aria-label={t('dataViz.chartLayout')}
        style={{ display: 'inline-flex', gap: 4, padding: 3, background: '#f0f0f0', borderRadius: 8 }}
      >
        {options.map((cols) => {
          const active = value === cols;
          const labelKey = `dataViz.chartLayout${cols}` as const;
          return (
            <button
              key={cols}
              type="button"
              title={t(labelKey)}
              aria-label={t(labelKey)}
              aria-pressed={active}
              onClick={() => onChange(cols)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 32,
                padding: 0,
                border: active ? '1px solid var(--cap-green, #2e7d32)' : '1px solid transparent',
                borderRadius: 6,
                background: active ? '#fff' : 'transparent',
                color: active ? 'var(--cap-green, #2e7d32)' : '#666',
                cursor: 'pointer',
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <GridIcon cols={cols} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function chartGridStyle(cols: ChartGridCols): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gap: '1rem',
    alignItems: 'start',
  };
}
