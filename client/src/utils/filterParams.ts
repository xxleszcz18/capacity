/** Łączy wartości filtra multiwyboru do parametru API (CSV). */
export function joinCsvFilter(values: string[]): string | undefined {
  const list = values.map((v) => String(v).trim()).filter(Boolean);
  if (!list.length) return undefined;
  return list.join(',');
}

export function joinCsvFilterNumbers(values: number[]): string | undefined {
  const list = values.filter((n) => Number.isFinite(n));
  if (!list.length) return undefined;
  return list.join(',');
}

export function formatMultiFilterSummary(values: string[], allLabel: string, labelByValue?: Record<string, string>): string {
  if (!values.length) return allLabel;
  if (labelByValue) return values.map((v) => labelByValue[v] ?? v).join(', ');
  return values.join(', ');
}
