/** Tylko cyfry, bez białych znaków (do wpisywania nr linii). */
export function digitsOnlyMachineLine(s: string): string {
  return String(s).replace(/\s/g, '').replace(/\D/g, '');
}

/** Gotowa wartość do API lub null jeśli brak poprawnej liczby całkowitej ≥ 0. */
export function toStoredMachineLine(s: string): string | null {
  const d = digitsOnlyMachineLine(s);
  if (!d) return null;
  const n = parseInt(d, 10);
  if (!Number.isSafeInteger(n) || n < 0) return null;
  return String(n);
}

/** Zapis inline: pusty → null; poprawna liczba → string; niepoprawny wpis → undefined. */
export function parseMachineLineForSave(s: string): string | null | undefined {
  const d = digitsOnlyMachineLine(s);
  if (!d) return null;
  const stored = toStoredMachineLine(s);
  return stored ?? undefined;
}
