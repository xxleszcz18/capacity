import { useState } from 'react';
import { useI18n } from '../context/I18nContext';
import {
  type DimFilterOp,
  type DimFiltersState,
  formatDimFilterSummary,
  hasActiveDimFilters,
} from '../utils/machineDimensionFilters';

type Props = {
  value: DimFiltersState;
  onChange: (next: DimFiltersState) => void;
  /** Tekst nagłówka; domyślnie z kalkulatora. */
  titleKey?: string;
  /** Hint pod polami (np. dataViz.dimFilterHint). */
  hintKey?: string;
  /** Otwórz panel przy montowaniu / gdy filtry aktywne. */
  defaultOpen?: boolean;
  busy?: boolean;
  busyLabel?: string;
};

const DIM_KEYS = [
  { key: 'width' as const, labelKey: 'calculator.dimWidth' },
  { key: 'depth' as const, labelKey: 'calculator.dimDepth' },
  { key: 'height' as const, labelKey: 'calculator.dimHeight' },
  { key: 'stroke' as const, labelKey: 'calculator.dimStroke' },
];

export default function MachineDimensionFiltersPanel({
  value,
  onChange,
  titleKey = 'calculator.advancedFilters',
  hintKey = 'calculator.dimFilterHint',
  defaultOpen = false,
  busy = false,
  busyLabel,
}: Props) {
  const { t } = useI18n();
  const active = hasActiveDimFilters(value);
  const [open, setOpen] = useState(defaultOpen || active);

  const patch = (key: keyof DimFiltersState, patchRow: Partial<{ op: DimFilterOp; value: string }>) => {
    onChange({
      ...value,
      [key]: {
        op: patchRow.op !== undefined ? patchRow.op : value[key].op,
        value: patchRow.value !== undefined ? patchRow.value : value[key].value,
      },
    });
  };

  return (
    <div className={`filters-toolbar filters-toolbar--advanced${active ? ' filters-toolbar--advanced-active' : ''}`} style={{ marginTop: 12 }}>
      <div className="calculator-advanced-filters-header">
        <button
          type="button"
          className="calculator-advanced-filters-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? '▾' : '▸'} {t(titleKey)}
        </button>
        {!open && active && (
          <span className="calculator-advanced-filters-applied">
            <strong>{t('calculator.advancedFiltersApplied')}</strong> {formatDimFilterSummary(value, t)}
          </span>
        )}
        {busy && (
          <span className="data-loading-badge" role="status" aria-live="polite">
            <span className="data-loading-spinner" aria-hidden="true" />
            {busyLabel ?? t('calculator.applyingDimensionFilters')}
          </span>
        )}
      </div>
      {open && (
        <div className="calculator-advanced-filters-grid">
          {DIM_KEYS.map(({ key, labelKey }) => (
            <label key={key} className="calculator-dim-filter-row">
              <span className="calculator-dim-filter-label">{t(labelKey)}</span>
              <select
                className="calculator-dim-filter-op"
                value={value[key].op}
                onChange={(e) => {
                  const op = e.target.value as DimFilterOp;
                  patch(key, { op, value: op ? value[key].value : '' });
                }}
              >
                <option value="">{t('calculator.dimOpNone')}</option>
                <option value="gte">{t('calculator.dimOpGte')}</option>
                <option value="lte">{t('calculator.dimOpLte')}</option>
              </select>
              <input
                type="number"
                step="0.1"
                min={0}
                className="calculator-dim-filter-value"
                value={value[key].value}
                onChange={(e) => patch(key, { value: e.target.value })}
                onBlur={(e) => patch(key, { value: e.currentTarget.value })}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  patch(key, { value: (e.target as HTMLInputElement).value });
                }}
                placeholder={t('calculator.dimValuePlaceholder')}
                disabled={!value[key].op}
              />
            </label>
          ))}
          <p className="calculator-dim-filter-hint">{t(hintKey)}</p>
        </div>
      )}
    </div>
  );
}
