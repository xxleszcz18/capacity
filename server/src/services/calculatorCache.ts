const TTL_MS = Number(process.env.CALCULATOR_CACHE_TTL_MS ?? 45_000);
const ENABLED = process.env.CALCULATOR_CACHE !== '0';

type CacheEntry = { expires: number; value: unknown };

const store = new Map<string, CacheEntry>();

export function calculatorCacheKey(parts: Record<string, unknown>): string {
  return JSON.stringify(parts, Object.keys(parts).sort());
}

export function getCalculatorCache<T>(key: string): T | undefined {
  if (!ENABLED) return undefined;
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCalculatorCache(key: string, value: unknown): void {
  if (!ENABLED) return;
  store.set(key, { expires: Date.now() + TTL_MS, value });
}

export function invalidateCalculatorCache(): void {
  store.clear();
}
