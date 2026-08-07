import type { CSSProperties } from 'react';
import { useI18n } from '../../context/I18nContext';
import type { ChartSeriesType } from '../../utils/chartSeriesType';

type Props = {
  value: ChartSeriesType;
  onChange: (value: ChartSeriesType) => void;
};

export default function ChartTypePicker({ value, onChange }: Props) {
  const { t } = useI18n();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13, color: '#666' }}>{t('dataViz.chartTypeLabel')}</span>
      <div
        role="group"
        aria-label={t('dataViz.chartTypeLabel')}
        style={{ display: 'inline-flex', gap: 4, padding: 3, background: '#f0f0f0', borderRadius: 8 }}
      >
        <button
          type="button"
          aria-pressed={value === 'line'}
          onClick={() => onChange('line')}
          style={btnStyle(value === 'line')}
        >
          {t('dataViz.chartTypeLine')}
        </button>
        <button
          type="button"
          aria-pressed={value === 'bar'}
          onClick={() => onChange('bar')}
          style={btnStyle(value === 'bar')}
        >
          {t('dataViz.chartTypeBar')}
        </button>
      </div>
    </div>
  );
}

function btnStyle(active: boolean): CSSProperties {
  return {
    padding: '4px 10px',
    fontSize: 13,
    border: active ? '1px solid var(--cap-green, #2e7d32)' : '1px solid transparent',
    borderRadius: 6,
    background: active ? '#fff' : 'transparent',
    color: active ? 'var(--cap-green, #2e7d32)' : '#666',
    cursor: 'pointer',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
    whiteSpace: 'nowrap',
  };
}
