import { db } from '../db/connection.js';

export type MachineDisplayMode = 'sap' | 'internal' | 'both';

export function normalizeMachineDisplayMode(v: unknown): MachineDisplayMode {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'sap' || s === 'internal') return s;
  return 'both';
}

export function loadMachineDisplayMode(): MachineDisplayMode {
  const row = db.prepare(`SELECT value FROM admin_settings WHERE key = 'visual_machine_display'`).get() as
    | { value: string }
    | undefined;
  return normalizeMachineDisplayMode(row?.value ?? 'internal');
}
