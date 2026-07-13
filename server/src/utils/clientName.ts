import { parseCsvQueryParamSingleOrMulti } from './queryListParams.js';

/** Klient zawsze wielkimi literami (AUDI = Audi). */
export function normalizeClientName(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase();
}

export function normalizeClientFilterList(clients: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of clients) {
    const n = normalizeClientName(c);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function parseClientFilterQuery(
  single: unknown,
  multi: unknown
): string[] {
  return normalizeClientFilterList(parseCsvQueryParamSingleOrMulti(single, multi));
}

export function clientNamesMatch(a: unknown, b: unknown): boolean {
  return normalizeClientName(a) === normalizeClientName(b);
}
