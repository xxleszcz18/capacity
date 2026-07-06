import { formatSapNumberForDisplay } from './detailLabel';

export type MachineDisplayMode = 'sap' | 'internal' | 'both';

export type MachineLabelFields = {
  sap_number?: string | null;
  internal_number?: string | number | null;
  type?: string | null;
};

export function normalizeMachineDisplayMode(v: unknown): MachineDisplayMode {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'sap' || s === 'internal') return s;
  return 'both';
}

/** Etykieta maszyny wg ustawienia: SAP, nr wewnętrzny lub oba (z „|”). Opcjonalnie typ w nawiasie. */
export function formatMachineSapInternalLabel(
  m: MachineLabelFields,
  mode: MachineDisplayMode = 'internal',
  opts?: { includeType?: boolean; rfq?: boolean }
): string {
  const sap = formatSapNumberForDisplay(m.sap_number);
  const internal = m.internal_number != null ? String(m.internal_number).trim() : '';
  const type = m.type != null ? String(m.type).trim() : '';

  const core = (() => {
    if (mode === 'sap') return sap || internal || '—';
    if (mode === 'internal') return internal || sap || '—';
    const sapDisp = sap || '—';
    const intDisp = internal || '—';
    if (!sap && !internal) return '—';
    if (!sap) return intDisp;
    if (!internal) return sapDisp;
    if (sap === internal) return sapDisp;
    return `${sapDisp} | ${intDisp}`;
  })();

  let label = core;
  if (opts?.includeType && type) label = `${label} (${type})`;
  if (opts?.rfq) label = `${label} · RFQ`;
  return label;
}

/** Tekst do wyszukiwania w liście maszyn (zawsze oba identyfikatory + typ). */
export function machineSelectFilterText(m: MachineLabelFields): string {
  const sap = formatSapNumberForDisplay(m.sap_number);
  const internal = m.internal_number != null ? String(m.internal_number).trim() : '';
  const type = m.type != null ? String(m.type).trim() : '';
  return [sap, internal, type].filter(Boolean).join(' ');
}
