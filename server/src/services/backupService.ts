import fs from 'fs';
import path from 'path';
import { db, getDatabasePath, saveDb } from '../db/connection.js';
import { resolveStoragePath } from '../utils/storagePath.js';

const DEFAULT_BACKUP_DIR = 'backups';

export type BackupReason = 'manual' | 'scheduled' | 'before_data_import' | 'before_machines_import';

function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(key) as { value?: string } | undefined;
  return row?.value != null ? String(row.value) : null;
}

function setSetting(key: string, value: string): void {
  db.prepare('INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    value,
  );
}

function resolveBackupDir(rawDir: string): string {
  return resolveStoragePath(rawDir, DEFAULT_BACKUP_DIR);
}

function getBackupOutputDir(): string {
  const outDirRaw = getSetting('backup_output_dir');
  return resolveBackupDir(outDirRaw?.trim() || DEFAULT_BACKUP_DIR);
}

function formatStamp(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

/** Kopiuje plik bazy do folderu backupu (ustawienia administracyjne). */
export function performDatabaseBackup(reason: BackupReason): { filePath: string; at: string } {
  const dbPath = getDatabasePath();
  const outDir = getBackupOutputDir();
  fs.mkdirSync(outDir, { recursive: true });
  saveDb();
  const stamp = formatStamp(new Date());
  const reasonTag = reason === 'before_data_import' ? 'pre-import' : reason;
  const fileName = `capacity-backup-${reasonTag}-${stamp}.db`;
  const targetPath = path.join(outDir, fileName);
  fs.copyFileSync(dbPath, targetPath);
  const nowIso = new Date().toISOString();
  setSetting('backup_last_at', nowIso);
  setSetting('backup_last_file', targetPath);
  setSetting('backup_last_reason', reason);
  saveDb();
  return { filePath: targetPath, at: nowIso };
}

export function resolveBackupDirectory(rawDir: string): string {
  return resolveBackupDir(rawDir);
}
