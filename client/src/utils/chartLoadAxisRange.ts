import type { ChartMetricMode } from './chartMetricMode';

export type ChartLoadAxisMode = 'auto' | 'fixed';

export type ChartLoadAxisRange = {
  mode: ChartLoadAxisMode;
  min: number;
  max: number;
};

export const DEFAULT_LOAD_AXIS_RANGE: ChartLoadAxisRange = {
  mode: 'auto',
  min: 0,
  max: 120,
};

/**
 * Zakres osi Y.
 * Dla „wolne capacity” w trybie auto dopuszczamy wartości ujemne (obciążenie >100%),
 * inaczej linie lądują poniżej 0 i znikają z wykresu (domena zaczynała się od 0).
 */
export function resolveYAxisDomain(
  range: ChartLoadAxisRange,
  metricMode: ChartMetricMode = 'load'
): [number | 'auto', number | 'auto'] {
  if (range.mode === 'auto') {
    if (metricMode === 'freeCapacity') return ['auto', 'auto'];
    return [0, 'auto'];
  }
  if (metricMode === 'freeCapacity') {
    const lo = Math.round(Number(range.min));
    const hi = Math.round(Number(range.max));
    const min = Number.isFinite(lo) ? lo : -50;
    const max = Number.isFinite(hi) ? Math.max(min + 1, hi) : 100;
    return [min, max];
  }
  const lo = Math.max(0, Math.round(Number(range.min) || 0));
  const hi = Math.max(lo + 1, Math.round(Number(range.max) || 100));
  return [lo, hi];
}

export function normalizeLoadAxisRange(range: ChartLoadAxisRange): ChartLoadAxisRange {
  const min = Math.round(Number(range.min) || 0);
  const max = Math.max(min + 1, Math.round(Number(range.max) || 120));
  return { mode: range.mode, min: Math.max(0, min), max };
}
