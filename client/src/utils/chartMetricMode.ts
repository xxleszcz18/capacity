import type { TrendChartRow, TrendSeriesDef } from './capacityTrends';

export type ChartMetricMode = 'load' | 'freeCapacity';

export function applyChartMetric(value: number | null | undefined, mode: ChartMetricMode): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (mode === 'load') return value;
  return Math.round((100 - value) * 10) / 10;
}

export function transformTrendRows(
  rows: TrendChartRow[],
  series: TrendSeriesDef[],
  mode: ChartMetricMode
): TrendChartRow[] {
  if (mode === 'load') return rows;
  return rows.map((row) => {
    const out: TrendChartRow = { year: row.year };
    for (const s of series) {
      out[s.key] = applyChartMetric(row[s.key] as number | null | undefined, mode);
    }
    return out;
  });
}
