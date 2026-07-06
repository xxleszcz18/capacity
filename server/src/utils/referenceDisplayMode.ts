import { db } from '../db/connection.js';
import { normalizeReferenceDisplayMode, type ReferenceDisplayMode } from './detailLabel.js';

export type { ReferenceDisplayMode };

export function loadReferenceDisplayMode(): ReferenceDisplayMode {
  const row = db.prepare(`SELECT value FROM admin_settings WHERE key = 'visual_reference_display'`).get() as { value: string } | undefined;
  return normalizeReferenceDisplayMode(row?.value);
}
