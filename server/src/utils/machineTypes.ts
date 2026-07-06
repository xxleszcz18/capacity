import { db } from '../db/connection.js';

function normalizeTypeName(raw: unknown): string {
  return String(raw ?? '').trim();
}

/** Uzupełnia katalog machine_types o brakujące nazwy (domyślne machine usage = 1). */
export function ensureMachineTypesExist(typeNames: string[]): string[] {
  if (typeNames.length === 0) return [];
  const insertType = db.prepare('INSERT OR IGNORE INTO machine_types (name, default_machine_usage) VALUES (?, 1)');
  const hasType = db.prepare('SELECT 1 FROM machine_types WHERE name = ? COLLATE NOCASE');
  const added: string[] = [];
  const seen = new Set<string>();
  for (const name of typeNames) {
    const normalized = normalizeTypeName(name);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const existedBefore = Boolean(hasType.get(normalized));
    insertType.run(normalized);
    if (!existedBefore && hasType.get(normalized)) added.push(normalized);
  }
  return added;
}
