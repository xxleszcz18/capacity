import type { TrendChartRow, TrendSeriesDef } from './capacityTrends';

/** Pusty / niepoprawny / ≤0 → brak wstęgi Flex. */
export function parseFlexPercentInput(raw: string): number | null {
  const cleaned = String(raw ?? '')
    .trim()
    .replace('%', '')
    .replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(100, Math.round(n * 10) / 10);
}

/** Nominał ± flex% (względnie); dolna granica ≥ 0. */
export function flexBandForValue(
  nominal: number | null | undefined,
  flexPercent: number
): { lo: number; hi: number } | null {
  if (nominal == null || !Number.isFinite(nominal) || flexPercent <= 0) return null;
  const f = flexPercent / 100;
  const lo = Math.round(nominal * (1 - f) * 10) / 10;
  const hi = Math.round(nominal * (1 + f) * 10) / 10;
  return { lo: Math.max(0, lo), hi };
}

export function flexLoKey(seriesKey: string): string {
  return `${seriesKey}__flexLo`;
}

export function flexHiKey(seriesKey: string): string {
  return `${seriesKey}__flexHi`;
}

/** Flex tylko dla serii Kontrakt. Produkcja i Call offs — bez wstęgi. */
export function seriesAppliesFlex(seriesKey: string): boolean {
  const k = String(seriesKey).toLowerCase();
  if (k.includes('calloff') || k.includes('call_off')) return false;
  if (/(^|_)co$/.test(k)) return false;
  // Produkcja
  if (
    k === 'production' ||
    k.endsWith('_prod') ||
    k.endsWith('_production') ||
    k.includes('_scen_prod') ||
    /(^|_)p$/.test(k)
  ) {
    return false;
  }
  // Kontrakt
  if (
    k === 'contract' ||
    k.endsWith('_contract') ||
    k.endsWith('_kon') ||
    k.includes('_scen_contract') ||
    /(^|_)k$/.test(k)
  ) {
    return true;
  }
  return false;
}

/** Dokłada do wierszy pola lo/hi dla wstęgi Flex wokół serii kontraktowych. */
export function withFlexBandRows(
  rows: TrendChartRow[],
  series: TrendSeriesDef[],
  flexPercent: number | null | undefined
): TrendChartRow[] {
  if (flexPercent == null || !Number.isFinite(flexPercent) || flexPercent <= 0) return rows;
  return rows.map((row) => {
    const out: TrendChartRow = { ...row };
    for (const s of series) {
      if (!seriesAppliesFlex(s.key)) {
        out[flexLoKey(s.key)] = null;
        out[flexHiKey(s.key)] = null;
        continue;
      }
      const band = flexBandForValue(row[s.key] as number | null | undefined, flexPercent);
      out[flexLoKey(s.key)] = band?.lo ?? null;
      out[flexHiKey(s.key)] = band?.hi ?? null;
    }
    return out;
  });
}
