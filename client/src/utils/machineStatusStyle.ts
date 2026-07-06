import type { CSSProperties } from 'react';

export type MachineStatusKey = 'active' | 'inactive' | 'RFQ';

export function machineStatusFromDb(s: unknown): MachineStatusKey {
  if (s === 'inactive') return 'inactive';
  if (s === 'RFQ') return 'RFQ';
  return 'active';
}

/**
 * Style jak natywny `<select>` statusu w liście projektów (`Projects.tsx`):
 * szer. 130, padding, brak obramowania, biały tekst, tło wg statusu.
 */
export function machineStatusSelectStyle(
  status: unknown,
  opts?: { disabled?: boolean; saving?: boolean }
): CSSProperties {
  const k = machineStatusFromDb(status);
  return {
    width: 130,
    padding: '0.25rem 0.5rem',
    borderRadius: 4,
    border: 'none',
    color: 'white',
    background: k === 'active' ? 'var(--cap-green)' : k === 'RFQ' ? '#ff9800' : '#9e9e9e',
    opacity: opts?.disabled || opts?.saving ? 0.7 : 1,
    cursor: opts?.disabled || opts?.saving ? 'wait' : 'pointer',
  };
}

/** Podgląd statusu (bez edycji) — wizualnie jak zamknięty select w projektach. */
export function machineStatusReadonlyStyle(status: unknown): CSSProperties {
  const k = machineStatusFromDb(status);
  return {
    display: 'inline-block',
    width: 130,
    padding: '0.25rem 0.5rem',
    borderRadius: 4,
    border: 'none',
    color: 'white',
    background: k === 'active' ? 'var(--cap-green)' : k === 'RFQ' ? '#ff9800' : '#9e9e9e',
    textAlign: 'center',
    boxSizing: 'border-box',
    fontSize: 13,
  };
}
