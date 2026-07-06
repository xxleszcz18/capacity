import type { CSSProperties } from 'react';
import { useI18n } from '../../context/I18nContext';
import {
  type ChartLoadAxisRange,
  normalizeLoadAxisRange,
} from '../../utils/chartLoadAxisRange';

type Props = {
  value: ChartLoadAxisRange;
  onChange: (value: ChartLoadAxisRange) => void;
  axisLabel?: string;
};

const PRESETS = [
  { max: 100, key: 'preset100' as const },
  { max: 120, key: 'preset120' as const },
  { max: 150, key: 'preset150' as const },
];

export default function ChartLoadAxisRangePicker({ value, onChange, axisLabel }: Props) {
  const { t } = useI18n();
  const fixed = value.mode === 'fixed';
  const label = axisLabel ?? t('dataViz.loadAxisLabel');

  const setMode = (mode: ChartLoadAxisRange['mode']) => {
    onChange(normalizeLoadAxisRange({ ...value, mode }));
  };

  const setMin = (min: number) => {
    onChange(normalizeLoadAxisRange({ ...value, mode: 'fixed', min }));
  };

  const setMax = (max: number) => {
    onChange(normalizeLoadAxisRange({ ...value, mode: 'fixed', max }));
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, color: '#666' }}>{label}</span>
      <div
        role="group"
        aria-label={label}
        style={{ display: 'inline-flex', gap: 4, padding: 3, background: '#f0f0f0', borderRadius: 8 }}
      >
        <button
          type="button"
          aria-pressed={!fixed}
          onClick={() => setMode('auto')}
          style={axisModeBtnStyle(!fixed)}
        >
          {t('dataViz.loadAxisAuto')}
        </button>
        <button
          type="button"
          aria-pressed={fixed}
          onClick={() => setMode('fixed')}
          style={axisModeBtnStyle(fixed)}
        >
          {t('dataViz.loadAxisFixed')}
        </button>
      </div>
      {fixed && (
        <>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            {t('dataViz.loadAxisMin')}
            <input
              type="number"
              min={0}
              max={999}
              step={1}
              value={value.min}
              onChange={(e) => setMin(Number(e.target.value))}
              style={numInputStyle}
            />
          </label>
          <span style={{ color: '#888', fontSize: 13 }}>–</span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
            {t('dataViz.loadAxisMax')}
            <input
              type="number"
              min={1}
              max={999}
              step={1}
              value={value.max}
              onChange={(e) => setMax(Number(e.target.value))}
              style={numInputStyle}
            />
            <span style={{ color: '#666' }}>%</span>
          </label>
          <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
            {PRESETS.map(({ max, key }) => (
              <button
                key={key}
                type="button"
                title={t(`dataViz.${key}`)}
                onClick={() => onChange({ mode: 'fixed', min: 0, max })}
                style={presetBtnStyle(value.min === 0 && value.max === max)}
              >
                {t(`dataViz.${key}`)}
              </button>
            ))}
          </span>
        </>
      )}
    </div>
  );
}

function axisModeBtnStyle(active: boolean): CSSProperties {
  return {
    padding: '4px 10px',
    fontSize: 13,
    border: active ? '1px solid var(--cap-green, #2e7d32)' : '1px solid transparent',
    borderRadius: 6,
    background: active ? '#fff' : 'transparent',
    color: active ? 'var(--cap-green, #2e7d32)' : '#666',
    cursor: 'pointer',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
  };
}

const numInputStyle: CSSProperties = {
  width: 56,
  padding: '3px 6px',
  borderRadius: 6,
  border: '1px solid #ccc',
  fontSize: 13,
};

function presetBtnStyle(active: boolean): CSSProperties {
  return {
    padding: '3px 8px',
    fontSize: 12,
    border: active ? '1px solid var(--cap-green, #2e7d32)' : '1px solid #ccc',
    borderRadius: 6,
    background: active ? '#e8f5e9' : '#fff',
    color: active ? '#1b5e20' : '#444',
    cursor: 'pointer',
  };
}
