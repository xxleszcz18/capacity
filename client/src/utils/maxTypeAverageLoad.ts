/**
 * Średnia obciążenia w ramach każdego typu maszyny, potem maksimum z tych średnich.
 * Np. MC=(130+16)/2=73, WJ=70, HL=55 → wynik 73.
 */
export function maxTypeAverageLoad<T extends { type?: string | null }>(
  machines: T[],
  getLoad: (m: T) => number
): number | null {
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
  let maxAvg = -Infinity;
  for (const { sum, count } of byType.values()) {
    if (count > 0) maxAvg = Math.max(maxAvg, sum / count);
  }
  if (!Number.isFinite(maxAvg) || maxAvg === -Infinity) return null;
  return maxAvg;
}
