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

export function resolveYAxisDomain(range: ChartLoadAxisRange): [number, number | 'auto'] {
  if (range.mode === 'auto') {
    return [0, 'auto'];
  }
  const lo = Math.max(0, Math.round(Number(range.min) || 0));
  const hi = Math.max(lo + 1, Math.round(Number(range.max) || 100));
  return [lo, hi];
}

export function normalizeLoadAxisRange(range: ChartLoadAxisRange): ChartLoadAxisRange {
  const min = Math.max(0, Math.round(Number(range.min) || 0));
  const max = Math.max(min + 1, Math.round(Number(range.max) || 120));
  return { mode: range.mode, min, max };
}
