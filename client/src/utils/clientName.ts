/** Klient zawsze wielkimi literami (AUDI = Audi). */
export function normalizeClientName(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase();
}
