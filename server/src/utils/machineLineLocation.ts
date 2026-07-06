/** Usuwa wszystkie białe znaki; zostawia tylko cyfry. */
export function stripWhitespaceNonDigits(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s/g, '')
    .replace(/\D/g, '');
}

/** Zapis nr linii: pusty dozwolony (null); inaczej kanoniczna liczba całkowita. */
export function normalizeMachineLineLocationOptional(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  const digits = stripWhitespaceNonDigits(raw);
  if (!digits) return { ok: true, value: null };
  const n = parseInt(digits, 10);
  if (!Number.isSafeInteger(n) || n < 0) return { ok: false, error: 'Numer linii musi być liczbą całkowitą (tylko cyfry)' };
  return { ok: true, value: String(n) };
}

/** Zapis nr linii: niepusty ciąg cyfr → kanoniczna postać dziesiętna (bez zer wiodących). */
export function normalizeMachineLineLocationStrict(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const digits = stripWhitespaceNonDigits(raw);
  if (!digits) return { ok: false, error: 'Numer linii jest wymagany' };
  const n = parseInt(digits, 10);
  if (!Number.isSafeInteger(n) || n < 0) return { ok: false, error: 'Numer linii musi być liczbą całkowitą (tylko cyfry)' };
  return { ok: true, value: String(n) };
}

/** Import / domyślna wartość przy braku lub niepoprawnym polu. */
export function normalizeMachineLineLocationOrOne(raw: unknown): string {
  const digits = stripWhitespaceNonDigits(raw);
  if (!digits || !/^\d+$/.test(digits)) return '1';
  const n = parseInt(digits, 10);
  if (!Number.isSafeInteger(n) || n < 0) return '1';
  return String(n);
}
