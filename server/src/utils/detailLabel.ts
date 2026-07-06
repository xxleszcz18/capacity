export type DetailLabelFields = {
  sap_number?: string | null;
  alias?: string | null;
  free_text?: string | null;
  designation?: string | null;
  id?: number | null;
};

export type ReferenceDisplayMode = 'sap' | 'alias' | 'both';

/**
 * Nr SAP: bez sufiksu „.0” z importu Excel / REAL w SQLite (identyfikator całkowitoliczbowy).
 */
export function formatSapNumberForDisplay(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
    return String(value);
  }
  const raw = String(value).trim();
  if (raw === '') return '';
  const trailingZeros = raw.match(/^(-?\d+)\.0+$/);
  if (trailingZeros) return trailingZeros[1];
  const n = Number(raw);
  if (!Number.isNaN(n) && Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-9) {
    return String(Math.round(n));
  }
  return raw;
}

export function normalizeReferenceDisplayMode(v: unknown): ReferenceDisplayMode {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'sap' || s === 'alias') return s;
  return 'both';
}

/**
 * Etykieta referencji detalu wg ustawienia: tylko SAP, tylko Alias lub oba (z „|”).
 * Opcjonalnie dopina free text / oznaczenie z części, jeśli różni się od SAP/Alias.
 */
export function formatDetailSapAliasLabel(d: DetailLabelFields, mode: ReferenceDisplayMode = 'both'): string {
  const sap = formatSapNumberForDisplay(d.sap_number);
  const alias = String(d.alias ?? '').trim();
  const freeText = String(d.free_text ?? '').trim();
  const designation = String(d.designation ?? '').trim();
  const extra = freeText || designation;
  const idNum = d.id != null ? Number(d.id) : NaN;
  const idOk = Number.isFinite(idNum) && idNum > 0;

  const appendDistinctExtra = (core: string): string => {
    if (extra && extra !== sap && extra !== alias) return `${core} (${extra})`;
    return core;
  };

  if (mode === 'both') {
    const sapDisp = sap || '—';
    const aliasDisp = alias || '—';
    if (!sap && !alias) {
      if (extra) return `${sapDisp} | ${aliasDisp} (${extra})`;
      if (idOk) return `${sapDisp} | ${aliasDisp} (#${idNum})`;
      return `${sapDisp} | ${aliasDisp}`;
    }
    let core = `${sapDisp} | ${aliasDisp}`;
    if (extra && extra !== sap && extra !== alias) core += ` (${extra})`;
    return core;
  }

  const primary = mode === 'sap' ? sap : alias;
  if (!primary) {
    if (!sap && !alias) {
      if (extra) return appendDistinctExtra('—');
      if (idOk) return `— (#${idNum})`;
      return '—';
    }
    return appendDistinctExtra('—');
  }
  return appendDistinctExtra(primary);
}
