/**
 * Wartość do komórki generowanego Excela: liczby całkowite (w tym „123.0”) jako int;
 * prawdziwe ułamki bez zmian; tekst bez zmian.
 */
export function excelExportCell(v: unknown): string | number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : String(v);
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v;
  }
  const s = String(v).trim();
  if (s === '') return null;
  const trailingDotZero = /^(-?\d+)\.0+$/;
  const tm = s.match(trailingDotZero);
  if (tm) {
    const k = Number(tm[1]);
    return Number.isSafeInteger(k) ? k : tm[1];
  }
  if (/^-?\d+$/.test(s)) {
    const k = Number(s);
    return Number.isSafeInteger(k) ? k : s;
  }
  const normalized = s.replace(',', '.');
  const asNum = Number(normalized);
  if (!Number.isNaN(asNum) && Number.isFinite(asNum) && /^-?\d+([.,]\d+)?$/.test(s)) {
    return Math.abs(asNum - Math.round(asNum)) < 1e-9 ? Math.round(asNum) : asNum;
  }
  return s;
}
