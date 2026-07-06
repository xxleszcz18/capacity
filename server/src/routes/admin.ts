import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { db, getDatabasePath, restoreDbFromBackupFile, saveDb } from '../db/connection.js';
import { performDatabaseBackup, resolveBackupDirectory } from '../services/backupService.js';
import { resolveAttachmentsDirectory } from '../services/projectAttachmentService.js';
import { getPickLocationJob, startPickLocationJob } from '../services/pickLocationJobService.js';
import { isOcuEnabled } from '../utils/ocuSettings.js';
import {
  buildCapacityBundleTemplateBuffer,
  clearApplicationDatabase,
  importCapacityBundleFromBuffer,
} from '../services/capacityBundleService.js';
import {
  buildCapacityDataImportTemplateBuffer,
  CAPACITY_DATA_IMPORT_MACHINE_SHEET_HEADERS,
  CAPACITY_DATA_IMPORT_SCHEMA_TAG,
  CAPACITY_DATA_IMPORT_TEMPLATE_DOWNLOAD_NAME,
  CAPACITY_DATA_IMPORT_TEMPLATE_SHEET_ORDER,
  importCapacityDataFromBuffer,
} from '../services/capacityDataImportService.js';
import {
  buildMachinesImportTemplateBuffer,
  importMachinesFromBuffer,
  MACHINES_IMPORT_CONFIRM,
} from '../services/machineImportService.js';

export const adminRouter = Router();

const capacityUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
});

/** Pola multipart muszą być wysłane przed dużym `file`, inaczej bywa puste — patrz importCapacityBundle w kliencie. */
function parseOnlyTablesFromBody(body: Record<string, unknown> | undefined): string[] | undefined {
  const raw = body?.onlyTables;
  if (raw == null) return undefined;
  const pieces: string[] = Array.isArray(raw) ? raw.map((x) => String(x).trim()).filter(Boolean) : [String(raw).trim()].filter(Boolean);
  for (const piece of pieces) {
    const str = piece.replace(/^\uFEFF/, '');
    if (!str) continue;
    try {
      const parsed = JSON.parse(str) as unknown;
      if (Array.isArray(parsed)) {
        const out = parsed.map((x) => String(x).trim()).filter(Boolean);
        if (out.length) return out;
      }
    } catch {
      const out = str.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
      if (out.length) return out;
    }
  }
  return undefined;
}

const DEFAULT_BACKUP_DIR = 'backups';
const SCHEDULER_TICK_MS = 60_000;

let backupInProgress = false;
let schedulerStarted = false;

type BackupConfig = {
  backup_enabled: boolean;
  backup_frequency_days: number;
  backup_output_dir: string;
  last_backup_at: string;
  last_backup_file: string;
  volumes_autosave_enabled: boolean;
  ocu_enabled: boolean;
  project_attachments_output_dir: string;
};

function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(key) as { value?: string } | undefined;
  return row?.value != null ? String(row.value) : null;
}

function setSetting(key: string, value: string): void {
  db.prepare('INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

function resolveBackupDir(rawDir: string): string {
  return resolveBackupDirectory(rawDir);
}

function getVolumesAutosaveEnabled(): boolean {
  const raw = getSetting('volumes_autosave_enabled');
  if (raw == null || raw === '') return true;
  return raw === '1' || raw === 'true';
}

function getBackupConfig(): BackupConfig {
  const enabledRaw = getSetting('backup_enabled');
  const freqDaysRaw = getSetting('backup_frequency_days');
  const freqRawLegacy = getSetting('backup_frequency_minutes');
  const outDirRaw = getSetting('backup_output_dir');
  const attachmentsOutDirRaw = getSetting('project_attachments_output_dir');
  const lastAt = getSetting('backup_last_at') ?? '';
  const lastFile = getSetting('backup_last_file') ?? '';
  const frequencyDays = Number(freqDaysRaw ?? 0);
  const frequencyLegacyMinutes = Number(freqRawLegacy ?? 0);
  const normalizedDays =
    Number.isFinite(frequencyDays) && frequencyDays > 0
      ? Math.round(frequencyDays)
      : Number.isFinite(frequencyLegacyMinutes) && frequencyLegacyMinutes > 0
      ? Math.max(1, Math.round(frequencyLegacyMinutes / 1440))
      : 0;
  return {
    backup_enabled: enabledRaw === '1',
    backup_frequency_days: normalizedDays,
    backup_output_dir: outDirRaw?.trim() || DEFAULT_BACKUP_DIR,
    last_backup_at: lastAt,
    last_backup_file: lastFile,
    volumes_autosave_enabled: getVolumesAutosaveEnabled(),
    ocu_enabled: isOcuEnabled(),
    project_attachments_output_dir: attachmentsOutDirRaw?.trim() || '',
  };
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

function performBackup(reason: 'manual' | 'scheduled'): { filePath: string; at: string } {
  return performDatabaseBackup(reason);
}

function shouldRunScheduledBackup(cfg: BackupConfig): boolean {
  if (!cfg.backup_enabled) return false;
  if (!Number.isFinite(cfg.backup_frequency_days) || cfg.backup_frequency_days <= 0) return false;
  if (!cfg.last_backup_at) return true;
  const last = Date.parse(cfg.last_backup_at);
  if (!Number.isFinite(last)) return true;
  const elapsedMs = Date.now() - last;
  return elapsedMs >= cfg.backup_frequency_days * 24 * 60 * 60_000;
}

function schedulerTick(): void {
  if (backupInProgress) return;
  const cfg = getBackupConfig();
  if (!shouldRunScheduledBackup(cfg)) return;
  backupInProgress = true;
  try {
    const result = performBackup('scheduled');
    console.log(`[admin-backup] Scheduled backup created: ${result.filePath}`);
  } catch (e: any) {
    console.error('[admin-backup] Scheduled backup failed:', e?.message || e);
  } finally {
    backupInProgress = false;
  }
}

export function startAdminBackupScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  setInterval(schedulerTick, SCHEDULER_TICK_MS);
}

adminRouter.get('/backup-settings', (_req, res) => {
  const cfg = getBackupConfig();
  const absoluteOutputDir = resolveBackupDir(cfg.backup_output_dir);
  let absoluteAttachmentsOutputDir = '';
  if (cfg.project_attachments_output_dir.trim()) {
    try {
      absoluteAttachmentsOutputDir = resolveAttachmentsDirectory(cfg.project_attachments_output_dir);
    } catch {
      absoluteAttachmentsOutputDir = '';
    }
  }
  res.json({ ...cfg, absolute_output_dir: absoluteOutputDir, absolute_attachments_output_dir: absoluteAttachmentsOutputDir });
});

adminRouter.put('/backup-settings', (req, res) => {
  const body = req.body as any;
  const enabled = body.backup_enabled === true || body.backup_enabled === 1 || body.backup_enabled === '1';
  const freqDays = Math.max(0, Number(body.backup_frequency_days ?? body.backup_frequency_minutes ?? 0) || 0);
  const outputDir = String(body.backup_output_dir ?? '').trim() || DEFAULT_BACKUP_DIR;
  const attachmentsOutputDir = String(body.project_attachments_output_dir ?? '').trim();
  if (/^https?:\/\//i.test(outputDir)) {
    return res.status(400).json({ error: 'Lokalizacja backupu musi być ścieżką folderu (lokalną, UNC lub file://), nie adresem http/https.' });
  }
  if (attachmentsOutputDir && /^https?:\/\//i.test(attachmentsOutputDir)) {
    return res.status(400).json({ error: 'Lokalizacja załączników musi być ścieżką folderu (lokalną, UNC lub file://), nie adresem http/https.' });
  }
  setSetting('backup_enabled', enabled ? '1' : '0');
  setSetting('backup_frequency_days', String(Math.round(freqDays)));
  // Legacy key retained for compatibility with older code paths.
  setSetting('backup_frequency_minutes', String(Math.round(freqDays * 1440)));
  setSetting('backup_output_dir', outputDir);
  if (body.project_attachments_output_dir !== undefined) {
    setSetting('project_attachments_output_dir', attachmentsOutputDir);
  }
  if (body.volumes_autosave_enabled !== undefined) {
    const autosave = body.volumes_autosave_enabled === true || body.volumes_autosave_enabled === 1 || body.volumes_autosave_enabled === '1';
    setSetting('volumes_autosave_enabled', autosave ? '1' : '0');
  }
  if (body.ocu_enabled !== undefined) {
    const ocu = body.ocu_enabled === true || body.ocu_enabled === 1 || body.ocu_enabled === '1';
    setSetting('ocu_enabled', ocu ? '1' : '0');
  }
  saveDb();
  const cfg = getBackupConfig();
  let absoluteAttachmentsOutputDir = '';
  if (cfg.project_attachments_output_dir.trim()) {
    try {
      absoluteAttachmentsOutputDir = resolveAttachmentsDirectory(cfg.project_attachments_output_dir);
    } catch {
      absoluteAttachmentsOutputDir = '';
    }
  }
  res.json({
    ...cfg,
    absolute_output_dir: resolveBackupDir(cfg.backup_output_dir),
    absolute_attachments_output_dir: absoluteAttachmentsOutputDir,
  });
});

adminRouter.post('/pick-location/start', (req, res) => {
  if (process.platform !== 'win32') {
    return res.status(400).json({ error: 'Wybór lokalizacji przez okno systemowe jest dostępny tylko na Windows.' });
  }
  const body = req.body as { target?: string; initial_dir?: string };
  const target = body.target;
  if (target !== 'backup' && target !== 'attachments' && target !== 'backup-file') {
    return res.status(400).json({ error: 'Nieprawidłowy typ wyboru lokalizacji.' });
  }
  let initialDir = String(body.initial_dir ?? '').trim();
  if (target === 'backup-file' && !initialDir) {
    const cfg = getBackupConfig();
    initialDir = resolveBackupDir(cfg.backup_output_dir);
  }
  const jobId = startPickLocationJob(target, initialDir);
  return res.json({ job_id: jobId });
});

adminRouter.get('/pick-location/result/:jobId', (req, res) => {
  const job = getPickLocationJob(String(req.params.jobId ?? ''));
  if (!job) return res.status(404).json({ error: 'Nie znaleziono zadania wyboru lokalizacji.' });
  return res.json(job);
});

adminRouter.post('/pick-backup-directory', (_req, res) => {
  if (process.platform !== 'win32') {
    return res.status(400).json({ error: 'Wybór lokalizacji przez okno systemowe jest dostępny tylko na Windows.' });
  }
  const jobId = startPickLocationJob('backup');
  return res.json({ job_id: jobId, legacy: true });
});

adminRouter.post('/pick-attachments-directory', (_req, res) => {
  if (process.platform !== 'win32') {
    return res.status(400).json({ error: 'Wybór lokalizacji przez okno systemowe jest dostępny tylko na Windows.' });
  }
  const jobId = startPickLocationJob('attachments');
  return res.json({ job_id: jobId, legacy: true });
});

adminRouter.post('/preview-storage-path', (req, res) => {
  const raw = String((req.body as { path?: string })?.path ?? '').trim();
  const kind = String((req.body as { kind?: string })?.kind ?? 'attachments');
  if (!raw) return res.json({ absolute_path: '' });
  try {
    const absolute_path = kind === 'backup' ? resolveBackupDir(raw) : resolveAttachmentsDirectory(raw);
    return res.json({ absolute_path });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || 'Nieprawidłowa ścieżka.' });
  }
});

adminRouter.get('/backup-files', (_req, res) => {
  try {
    const cfg = getBackupConfig();
    const dir = resolveBackupDir(cfg.backup_output_dir);
    if (!fs.existsSync(dir)) return res.json([]);
    const rows = fs
      .readdirSync(dir)
      .map((name) => ({ name, fullPath: path.join(dir, name) }))
      .filter((f) => {
        try {
          return fs.statSync(f.fullPath).isFile() && f.name.toLowerCase().endsWith('.db');
        } catch (_) {
          return false;
        }
      })
      .map((f) => {
        const st = fs.statSync(f.fullPath);
        return {
          name: f.name,
          path: f.fullPath,
          modified_at: st.mtime.toISOString(),
          size_bytes: st.size,
        };
      })
      .sort((a, b) => Date.parse(b.modified_at) - Date.parse(a.modified_at));
    return res.json(rows);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Nie udało się pobrać listy backupów.' });
  }
});

adminRouter.post('/pick-backup-file', (_req, res) => {
  if (process.platform !== 'win32') {
    return res.status(400).json({ error: 'Wybór pliku przez okno systemowe jest dostępny tylko na Windows.' });
  }
  const cfg = getBackupConfig();
  const dir = resolveBackupDir(cfg.backup_output_dir);
  const jobId = startPickLocationJob('backup-file', dir);
  return res.json({ job_id: jobId, legacy: true });
});

adminRouter.post('/restore-from-backup', async (req, res) => {
  const body = req.body as any;
  const rawPath = String(body.backup_file_path ?? '').trim();
  if (!rawPath) return res.status(400).json({ error: 'Podaj ścieżkę do pliku backupu.' });
  const cfg = getBackupConfig();
  let resolvedFilePath = rawPath;
  if (/^file:\/\//i.test(rawPath)) {
    try {
      resolvedFilePath = decodeURIComponent(new URL(rawPath).pathname);
    } catch (_) {
      return res.status(400).json({ error: 'Nieprawidłowy link file:// do backupu.' });
    }
  } else if (!path.isAbsolute(rawPath)) {
    resolvedFilePath = path.resolve(resolveBackupDir(cfg.backup_output_dir), rawPath);
  }
  if (!fs.existsSync(resolvedFilePath)) return res.status(404).json({ error: `Nie znaleziono pliku backupu: ${resolvedFilePath}` });
  try {
    const safety = performBackup('manual');
    await restoreDbFromBackupFile(resolvedFilePath);
    return res.json({
      ok: true,
      restored_from: resolvedFilePath,
      safety_backup_file: safety.filePath,
      restored_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Nie udało się przywrócić danych z backupu.' });
  }
});

adminRouter.post('/backup-now', (_req, res) => {
  if (backupInProgress) return res.status(409).json({ error: 'Backup jest już w trakcie tworzenia.' });
  backupInProgress = true;
  try {
    const result = performBackup('manual');
    res.status(201).json({ ok: true, file_path: result.filePath, created_at: result.at });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Nie udało się utworzyć backupu.' });
  } finally {
    backupInProgress = false;
  }
});

/**
 * Szablon .xlsx: jeden arkusz na tabelę + _INSTRUKCJA.
 * Query `onlyTables` — JSON tablica nazw tabel lub lista rozdzielona przecinkami → tylko te arkusze (import częściowy).
 */
adminRouter.get('/capacity-bundle-template.xlsx', (req, res) => {
  try {
    let onlyTables: string[] | undefined;
    const q = req.query.onlyTables;
    if (typeof q === 'string' && q.trim() !== '') {
      try {
        const parsed = JSON.parse(q) as unknown;
        if (Array.isArray(parsed)) onlyTables = parsed.map((x) => String(x).trim()).filter(Boolean);
      } catch {
        onlyTables = q.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      }
    }
    const buf = buildCapacityBundleTemplateBuffer(onlyTables?.length ? { onlyTables } : undefined);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const filename = onlyTables?.length ? 'capacity_baza_szablon_wybrane.xlsx' : 'capacity_baza_szablon.xlsx';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Nie udało się wygenerować szablonu Excel.' });
  }
});

/**
 * Import z uzupełnionego szablonu: multipart field `file` + `confirm` = IMPORTUJ_BAZE.
 * Opcjonalnie `onlyTables` (JSON array nazw tabel) — import częściowy tylko tych arkuszy.
 */
adminRouter.post('/capacity-bundle-import', capacityUpload.single('file'), (req, res) => {
  const confirm = String((req.body as { confirm?: string })?.confirm ?? '').trim();
  if (confirm !== 'IMPORTUJ_BAZE') {
    return res.status(400).json({
      error: 'Potwierdź import: wyślij pole formularza confirm o wartości dokładnie IMPORTUJ_BAZE.',
    });
  }
  const f = req.file;
  if (!f?.buffer?.length) return res.status(400).json({ error: 'Brak pliku .xlsx (pole formularza: file).' });

  const onlyTables = parseOnlyTablesFromBody(req.body as Record<string, unknown>);

  const result = importCapacityBundleFromBuffer(f.buffer, onlyTables?.length ? { onlyTables } : undefined);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json(result);
});

/** Statyczny opis szablonu zwracanego przez capacity-data-template.xlsx — bez generowania pliku (łatwa weryfikacja w przeglądarce). */
adminRouter.get('/capacity-data-template-info.json', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    schemaTag: CAPACITY_DATA_IMPORT_SCHEMA_TAG,
    downloadFilename: CAPACITY_DATA_IMPORT_TEMPLATE_DOWNLOAD_NAME,
    sheets: [...CAPACITY_DATA_IMPORT_TEMPLATE_SHEET_ORDER],
    machinesSheetHeaders: [...CAPACITY_DATA_IMPORT_MACHINE_SHEET_HEADERS],
    instructionRow1MustInclude: CAPACITY_DATA_IMPORT_SCHEMA_TAG,
  });
});

/** Tekstowa wersja szablonu importu — do sprawdzenia w przeglądarce / diagnostyki na stronie administracji. */
adminRouter.get('/capacity-data-import-schema.txt', (_req, res) => {
  res.type('text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`${CAPACITY_DATA_IMPORT_SCHEMA_TAG}\n${CAPACITY_DATA_IMPORT_TEMPLATE_DOWNLOAD_NAME}\n`);
});

/** Szablon danych wejściowych: _INSTRUKCJA, SCIEZKA_MINIMUM, Maszyny, Projekty, Detale, Projekt_detal, Wolumeny, Operacje. */
adminRouter.get('/capacity-data-template.xlsx', (_req, res) => {
  try {
    const buf = buildCapacityDataImportTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Capacity-Data-Import-Schema', CAPACITY_DATA_IMPORT_SCHEMA_TAG);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${CAPACITY_DATA_IMPORT_TEMPLATE_DOWNLOAD_NAME.replace(/"/g, '')}"`
    );
    res.send(buf);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Nie udało się wygenerować szablonu danych.' });
  }
});

/** Import danych wejściowych (zastąpienie stanu z pliku): confirm = IMPORTUJ_DANE; przed importem zawsze backup bazy. */
/** Wyczyszczenie danych aplikacji: confirm = WYCZYSC_BAZE; opcjonalnie create_backup = true. */
adminRouter.post('/clear-database', (req, res) => {
  const body = req.body as { confirm?: string; create_backup?: boolean | number | string };
  const confirm = String(body.confirm ?? '').trim();
  if (confirm !== 'WYCZYSC_BAZE') {
    return res.status(400).json({
      error: 'Potwierdź czyszczenie: wyślij pole confirm o wartości dokładnie WYCZYSC_BAZE.',
    });
  }
  const createBackup =
    body.create_backup === true || body.create_backup === 1 || body.create_backup === '1' || body.create_backup === 'true';
  let backupBefore: { filePath: string; at: string } | undefined;
  if (createBackup) {
    try {
      backupBefore = performDatabaseBackup('manual');
    } catch (e: any) {
      return res.status(500).json({
        error: e?.message || 'Nie udało się utworzyć kopii zapasowej przed wyczyszczeniem. Operacja anulowana.',
      });
    }
  }
  const result = clearApplicationDatabase();
  if (!result.ok) return res.status(500).json({ error: result.error });
  res.json({
    ok: true,
    cleared_at: new Date().toISOString(),
    tables_cleared: result.tables_cleared,
    rows_deleted: result.rows_deleted,
    backup_file: backupBefore?.filePath,
    backup_at: backupBefore?.at,
  });
});

adminRouter.post('/capacity-data-import', capacityUpload.single('file'), (req, res) => {
  const confirm = String((req.body as { confirm?: string })?.confirm ?? '').trim();
  if (confirm !== 'IMPORTUJ_DANE') {
    return res.status(400).json({
      error: 'Potwierdź import: wyślij pole confirm o wartości dokładnie IMPORTUJ_DANE.',
    });
  }
  const f = req.file;
  if (!f?.buffer?.length) return res.status(400).json({ error: 'Brak pliku .xlsx (pole formularza: file).' });
  let backupBefore: { filePath: string; at: string };
  try {
    backupBefore = performDatabaseBackup('before_data_import');
  } catch (e: any) {
    return res.status(500).json({
      error: e?.message || 'Nie udało się utworzyć kopii zapasowej przed importem. Import anulowany.',
    });
  }
  const modeRaw = String((req.body as { mode?: string })?.mode ?? 'merge').trim().toLowerCase();
  const mode = modeRaw === 'replace' ? 'replace' : 'merge';
  const result = importCapacityDataFromBuffer(f.buffer, { mode });
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ...result, backup_file: backupBefore.filePath, backup_at: backupBefore.at });
});

adminRouter.get('/machines-import-template.xlsx', (_req, res) => {
  try {
    const buf = buildMachinesImportTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="maszyny_import.xlsx"');
    res.send(buf);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Nie udało się wygenerować szablonu maszyn.' });
  }
});

adminRouter.post('/machines-import', capacityUpload.single('file'), (req, res) => {
  const confirm = String((req.body as { confirm?: string })?.confirm ?? '').trim();
  if (confirm !== MACHINES_IMPORT_CONFIRM) {
    return res.status(400).json({
      error: `Potwierdź import: wyślij pole confirm o wartości dokładnie ${MACHINES_IMPORT_CONFIRM}.`,
    });
  }
  const f = req.file;
  if (!f?.buffer?.length) return res.status(400).json({ error: 'Brak pliku .xlsx (pole formularza: file).' });
  let backupBefore: { filePath: string; at: string };
  try {
    backupBefore = performDatabaseBackup('before_machines_import');
  } catch (e: any) {
    return res.status(500).json({
      error: e?.message || 'Nie udało się utworzyć kopii zapasowej przed importem. Import anulowany.',
    });
  }
  const result = importMachinesFromBuffer(f.buffer);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ...result, backup_file: backupBefore.filePath, backup_at: backupBefore.at });
});
