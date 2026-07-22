/** Parsuje wartość query (pojedynczą lub CSV) na listę unikalnych tokenów. */
export function parseCsvQueryParam(raw: unknown): string[] {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (!s) return [];
  return [...new Set(s.split(/[,;]+/).map((x) => x.trim()).filter(Boolean))];
}

const ALL_TOKENS = new Set(['', 'wszystkie', 'wszyscy', 'all', 'wsszystkie']);

/** Pojedynczy param lub `types` / `clients` / `statuses` (CSV). */
export function parseCsvQueryParamSingleOrMulti(single: unknown, multi: unknown): string[] {
  const fromMulti = parseCsvQueryParam(multi);
  if (fromMulti.length) return fromMulti;
  const one = String(single ?? '').trim();
  if (!one || ALL_TOKENS.has(one.toLowerCase())) return [];
  return [one];
}

export function parseMachineStatusList(single: unknown, multi: unknown): string[] {
  return parseCsvQueryParamSingleOrMulti(single, multi)
    .map((s) => {
      const l = s.toLowerCase();
      if (l === 'rfq') return 'RFQ';
      if (l === 'inactive' || l === 'nieaktywne' || l === 'nieaktywny') return 'inactive';
      if (l === 'active' || l === 'aktywne' || l === 'aktywny') return 'active';
      return s;
    })
    .filter((s) => s === 'active' || s === 'inactive' || s === 'RFQ');
}

/**
 * Lista ID z query: oba argumenty mogą być CSV (`1800,1801`).
 * Nie używamy parseCsvQueryParamSingleOrMulti — tam „single” nie jest dzielone po przecinku,
 * więc includeRfqOperationIds=1800,1801 dawało [] i RFQ nie wchodził do kalkulacji.
 */
export function parseIdList(single: unknown, multi: unknown): number[] {
  const tokens = [...parseCsvQueryParam(single), ...parseCsvQueryParam(multi)];
  return [...new Set(tokens.map((s) => Number(s)).filter((n) => Number.isFinite(n) && n > 0))];
}

export function sqlInClause(values: (string | number)[], column: string): { clause: string; params: (string | number)[] } {
  if (!values.length) return { clause: '1=1', params: [] };
  return {
    clause: `${column} IN (${values.map(() => '?').join(',')})`,
    params: values,
  };
}
