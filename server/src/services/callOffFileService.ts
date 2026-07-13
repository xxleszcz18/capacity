import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { CallOffUnmatchedSapRow } from './callOffService.js';
import { assertPathWithinStorageBase, resolveStoragePath } from '../utils/storagePath.js';

const CALL_OFFS_DIR = 'call-offs';
const UNMATCHED_REPORT_FILENAME = 'unmatched-sap-report.csv';

export function buildUnmatchedReportCsv(rows: CallOffUnmatchedSapRow[]): string {
  const header = 'sap_ref;row_count;total_quantity';
  const body = rows.map((r) => `${r.sap_ref};${r.row_count};${r.total_quantity}`).join('\n');
  return `\uFEFF${header}\n${body}`;
}
export function getCallOffsStorageRoot(): string {
  const root = resolveStoragePath(CALL_OFFS_DIR, CALL_OFFS_DIR);
  fs.mkdirSync(root, { recursive: true });
  assertPathWithinStorageBase(root);
  return root;
}

function comparisonDir(comparisonId: number): string {
  return path.join(getCallOffsStorageRoot(), String(comparisonId));
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()ąćęłńóśźżĄĆĘŁŃÓŚŹŻ+]/gi, '_');
  return base.slice(0, 180) || 'SalesFcst.xlsx';
}

/** Zapisuje plik źródłowy importu (nadpisuje poprzedni dla tego porównania). */
export function saveCallOffSourceFile(comparisonId: number, buffer: Buffer, originalFilename: string): string {
  deleteCallOffSourceFiles(comparisonId);
  const dir = comparisonDir(comparisonId);
  fs.mkdirSync(dir, { recursive: true });
  const stored = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${sanitizeFilename(originalFilename)}`;
  const fullPath = path.join(dir, stored);
  fs.writeFileSync(fullPath, buffer);
  return stored;
}

export function getCallOffSourceFilePath(comparisonId: number, storedFilename: string): string | null {
  const base = path.basename(String(storedFilename ?? '').trim());
  if (!base) return null;
  const full = path.join(comparisonDir(comparisonId), base);
  assertPathWithinStorageBase(full);
  return fs.existsSync(full) ? full : null;
}

export function saveCallOffUnmatchedReport(comparisonId: number, rows: CallOffUnmatchedSapRow[]): void {
  const dir = comparisonDir(comparisonId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, UNMATCHED_REPORT_FILENAME), buildUnmatchedReportCsv(rows), 'utf8');
}

export function getCallOffUnmatchedReportPath(comparisonId: number): string | null {
  const full = path.join(comparisonDir(comparisonId), UNMATCHED_REPORT_FILENAME);
  assertPathWithinStorageBase(full);
  return fs.existsSync(full) ? full : null;
}

export function isCallOffUnmatchedReportAvailable(comparisonId: number): boolean {
  return getCallOffUnmatchedReportPath(comparisonId) != null;
}

/** Usuwa katalog plików porównania (przy kasowaniu lub przed nowym importem). */
export function deleteCallOffSourceFiles(comparisonId: number): void {
  const dir = comparisonDir(comparisonId);
  if (!fs.existsSync(dir)) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
