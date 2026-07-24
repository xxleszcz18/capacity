/**
 * Średnia obciążenia w ramach każdego typu maszyny, potem maksimum z tych średnich.
 * Np. MC=(130+16)/2=73, WJ=70, HL=55 → wynik 73 (z 2 maszyn typu MC).
 */
export type MaxTypeAverageDetails = {
  avg: number;
  type: string;
  /** Liczba maszyn w typie, którego średnia wygrała. */
  count: number;
};

export function maxTypeAverageLoadDetails<T extends { type?: string | null }>(
  machines: T[],
  getLoad: (m: T) => number
): MaxTypeAverageDetails | null {
  if (!machines.length) return null;
  const byType = new Map<string, { sum: number; count: number }>();
  for (const m of machines) {
    const type = String(m.type ?? '').trim() || '—';
    const raw = Number(getLoad(m));
    const load = Number.isFinite(raw) ? raw : 0;
    const bucket = byType.get(type) ?? { sum: 0, count: 0 };
    bucket.sum += load;
    bucket.count += 1;
    byType.set(type, bucket);
  }
  let best: MaxTypeAverageDetails | null = null;
  for (const [type, { sum, count }] of byType.entries()) {
    if (count <= 0) continue;
    const avg = sum / count;
    if (!best || avg > best.avg) best = { avg, type, count };
  }
  if (!best || !Number.isFinite(best.avg)) return null;
  return best;
}

export function maxTypeAverageLoad<T extends { type?: string | null }>(
  machines: T[],
  getLoad: (m: T) => number
): number | null {
  return maxTypeAverageLoadDetails(machines, getLoad)?.avg ?? null;
}
