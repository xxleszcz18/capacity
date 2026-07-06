const INTERNAL_MACHINE_NUMBER_RE = /^\d+(\/\d+)?$/;

export function parseInternalMachineNumber(
  raw: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: false, error: 'Podaj numer maszyny' };
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && Number.isInteger(raw) && raw > 0) {
    return { ok: true, value: String(raw) };
  }
  const s = String(raw).trim();
  if (!s) return { ok: false, error: 'Podaj numer maszyny' };
  if (!INTERNAL_MACHINE_NUMBER_RE.test(s)) {
    return { ok: false, error: 'Numer maszyny: cyfry lub format np. 1134/1' };
  }
  return { ok: true, value: s };
}

export function parseOptionalInternalMachineNumber(
  raw: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { ok: true, value: null };
  }
  const parsed = parseInternalMachineNumber(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value };
}

export function compareInternalMachineNumbers(a: unknown, b: unknown): number {
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
}
