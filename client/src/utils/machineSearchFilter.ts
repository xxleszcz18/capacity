import type { MachineDisplayMode } from './machineLabel';

export type MachineSearchFields = {
  internal_number?: number | string | null;
  sap_number?: string | null;
  machine_id?: number | string | null;
  id?: number | string | null;
};

function normalizeSearchToken(raw: string): string[] {
  const tok = raw.trim().toLowerCase();
  if (!tok) return [];
  const stripped = tok.replace(/^sap\s*/i, '').trim();
  return stripped !== tok && stripped ? [tok, stripped] : [tok];
}

function machineSearchHaystack(machine: MachineSearchFields): { internal: string; sap: string; id: string } {
  const internal = machine.internal_number != null ? String(machine.internal_number).toLowerCase() : '';
  const sap = (machine.sap_number ?? '').toLowerCase();
  const idRaw = machine.machine_id ?? machine.id;
  const id = idRaw != null ? String(idRaw).toLowerCase() : '';
  return { internal, sap, id };
}

function sapTokenMatches(variant: string, sap: string): boolean {
  if (!sap) return false;
  if (sap.includes(variant)) return true;
  const sapStripped = sap.replace(/^sap\s*/i, '').trim();
  return sapStripped !== '' && sapStripped.includes(variant);
}

function tokenMatchesHaystack(
  tok: string,
  haystack: { internal: string; sap: string; id: string },
  displayMode?: MachineDisplayMode
): boolean {
  for (const variant of normalizeSearchToken(tok)) {
    if (displayMode == null) {
      if (haystack.internal !== '' && haystack.internal.includes(variant)) return true;
      if (haystack.id !== '' && haystack.id.includes(variant)) return true;
      if (sapTokenMatches(variant, haystack.sap)) return true;
      continue;
    }
    if ((displayMode === 'internal' || displayMode === 'both') && haystack.internal !== '' && haystack.internal.includes(variant)) {
      return true;
    }
    if ((displayMode === 'sap' || displayMode === 'both') && sapTokenMatches(variant, haystack.sap)) {
      return true;
    }
  }
  return false;
}

/** Dopasowanie maszyny do pola wyszukiwania (nr wewnętrzny, SAP, id; wiele wartości po przecinku/średniku). */
export function machineMatchesCalculatorFilter(
  machine: MachineSearchFields,
  rawFilter: string,
  displayMode?: MachineDisplayMode
): boolean {
  const trimmed = rawFilter.trim();
  if (!trimmed) return true;

  const tokens = trimmed
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = machineSearchHaystack(machine);
  return tokens.some((tok) => tokenMatchesHaystack(tok, haystack, displayMode));
}
