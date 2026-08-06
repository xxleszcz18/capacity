import type { TrendChartRow, TrendSeriesDef } from './capacityTrends';

export type ChartMetricMode = 'load' | 'freeCapacity';

export function applyChartMetric(value: number | null | undefined, mode: ChartMetricMode): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (mode === 'load') return n;
  // Ujemne = deficyt (obciążenie > 100%) — wykres musi to pokazać
  return Math.round((100 - n) * 10) / 10;
}

export function transformTrendRows(
  rows: TrendChartRow[],
  series: TrendSeriesDef[],
  mode: ChartMetricMode
): TrendChartRow[] {
  if (mode === 'load') return rows;
  return rows.map((row) => {
    const out: TrendChartRow = { year: row.year };
    if (row.periodLabel != null) out.periodLabel = row.periodLabel;
    for (const s of series) {
      out[s.key] = applyChartMetric(row[s.key] as number | null | undefined, mode);
    }
    return out;
  });
}
