import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { invalidateCalculatorCache } from '../services/calculatorCache.js';

function readPkgName(dir: string): string | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name as string | undefined;
  } catch {
    return undefined;
  }
}

/** Katalog pakietu `server/` (capacity.db) — bez `import.meta` (kompatybilność z wyjściem CommonJS z `tsc`). */
function resolveServerPackageRoot(): string {
  const entry = process.argv[1];
  if (entry) {
    let dir = path.dirname(path.resolve(entry));
    for (let i = 0; i < 8; i++) {
      if (readPkgName(dir) === 'capacity-server') return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  let dir = path.resolve(process.cwd());
  for (let i = 0; i < 8; i++) {
    if (readPkgName(dir) === 'capacity-server') return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(process.cwd());
}

const serverPackageRoot = resolveServerPackageRoot();
const dbPath = process.env.DB_PATH || path.join(serverPackageRoot, 'capacity.db');

/** Absolutna ścieżka zapisu bazy (persist co saveDb). */
export function getDatabasePath(): string {
  return path.resolve(dbPath);
}

/**
 * Zapisuj capacity.db tylko po realnych zmianach. sql.js przy każdym export() buduje nowy, zwarty plik SQLite
 * (bez wolnych stron) — stąd mniejszy rozmiar (~164→140 KB) mimo tych samych danych; ciągłe saveDb() myliło to z utratą danych.
 */
let _dbDirty = false;
let _sqlModule: Awaited<ReturnType<typeof initSqlJs>> | null = null;

export function markDbDirty(): void {
  _dbDirty = true;
  invalidateCalculatorCache();
}

type PrepareFn = (sql: string) => { bind: (p: (number | string | null)[]) => void; step: () => boolean; getAsObject: () => Record<string, unknown>; free: () => void };

type SqlExecRowset = { columns: string[]; values: unknown[][] };

function rowsModified(db: SqlJsDatabase): number {
  return typeof (db as any).getRowsModified === 'function' ? Number((db as any).getRowsModified()) : 0;
}

function createStatement(db: SqlJsDatabase, sql: string, rawPrepare: PrepareFn) {
  return {
    get(...params: unknown[]) {
      const stmt = rawPrepare(sql);
      try {
        stmt.bind(params as (number | string | null)[]);
        if (stmt.step()) return stmt.getAsObject() as Record<string, unknown>;
        return undefined;
      } finally {
        stmt.free();
      }
    },
    all(...params: unknown[]) {
      const stmt = rawPrepare(sql);
      const result: Record<string, unknown>[] = [];
      try {
        stmt.bind(params as (number | string | null)[]);
        while (stmt.step()) result.push(stmt.getAsObject() as Record<string, unknown>);
        return result;
      } finally {
        stmt.free();
      }
    },
    run(...params: unknown[]) {
      const stmt = rawPrepare(sql);
      try {
        if (params.length > 0) stmt.bind(params as (number | string | null)[]);
        stmt.step();
      } finally {
        stmt.free();
      }
      const changes = rowsModified(db);
      const res = db.exec('SELECT last_insert_rowid() as id') as SqlExecRowset[];
      const lastInsertRowid = res.length && res[0].values?.[0]?.[0] != null ? Number(res[0].values[0][0]) : 0;
      if (changes > 0) markDbDirty();
      return { changes, lastInsertRowid };
    },
  };
}

let _db: SqlJsDatabase & {
  prepare: (sql: string) => ReturnType<typeof createStatement>;
  exec: (sql: string) => void;
};

function countMachinesInDatabaseBuffer(
  SQL: Awaited<ReturnType<typeof initSqlJs>>,
  buf: Buffer
): { total: number; active: number } {
  let probe: SqlJsDatabase | null = null;
  try {
    probe = new SQL.Database(buf);
    const r = probe.exec('SELECT COUNT(*) FROM machines') as SqlExecRowset[];
    const total = Number(r[0]?.values?.[0]?.[0] ?? 0);
    const ra = probe.exec("SELECT COUNT(*) FROM machines WHERE status = 'active'") as SqlExecRowset[];
    const active = Number(ra[0]?.values?.[0]?.[0] ?? 0);
    return { total, active };
  } catch {
    return { total: -1, active: -1 };
  } finally {
    try {
      probe?.close();
    } catch {
      /* ignore */
    }
  }
}

/** Czy drugi plik ma „więcej” sensownych danych (najpierw liczba maszyn, potem aktywnych). */
function parentDatabaseLooksRicher(
  primary: { total: number; active: number },
  parent: { total: number; active: number }
): boolean {
  if (primary.total < 0 && parent.total >= 0) return true;
  if (parent.total < 0) return false;
  if (parent.total > primary.total) return true;
  if (parent.total === primary.total && parent.active > primary.active) return true;
  return false;
}

export async function initDb(): Promise<void> {
  const SQL = _sqlModule ?? (await initSqlJs());
  _sqlModule = SQL;
  let db: SqlJsDatabase;
  const resolvedPrimary = path.resolve(dbPath);
  const parentDbPath = path.join(serverPackageRoot, '..', 'capacity.db');
  const resolvedParent = path.resolve(parentDbPath);
  const sameFile = resolvedParent === resolvedPrimary;

  const primaryBuf =
    fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0 ? fs.readFileSync(dbPath) : null;
  const parentBuf =
    !sameFile && fs.existsSync(parentDbPath) && fs.statSync(parentDbPath).size > 0
      ? fs.readFileSync(parentDbPath)
      : null;

  const cp = primaryBuf ? countMachinesInDatabaseBuffer(SQL, primaryBuf) : { total: -1, active: -1 };
  const cr = parentBuf ? countMachinesInDatabaseBuffer(SQL, parentBuf) : { total: -1, active: -1 };

  let initialBuf: Buffer | null = null;

  if (primaryBuf && parentBuf) {
    if (parentDatabaseLooksRicher(cp, cr)) {
      console.warn(
        `[capacity] Wczytuję ${resolvedParent} (${cr.total} maszyn, ${cr.active} aktywnych) zamiast ${resolvedPrimary} (${cp.total}, ${cp.active}). ` +
          `Stara wersja aplikacji przy starcie z katalogu głównego repo zapisywała bazę w capacity.db obok folderu server/; po zmianie ścieżki serwer czytał tylko server/capacity.db. ` +
          `Kolejne zapisy zapiszą dane do server/capacity.db. Stałą ścieżkę wymusza DB_PATH.`
      );
      initialBuf = parentBuf;
    } else {
      initialBuf = primaryBuf;
    }
  } else if (primaryBuf) {
    initialBuf = primaryBuf;
  } else if (parentBuf) {
    if (cr.total > 0 || cr.active > 0) {
      console.warn(
        `[capacity] Brak ${resolvedPrimary} — start z ${resolvedParent} (${cr.total} maszyn, ${cr.active} aktywnych). Pierwszy zapis utworzy server/capacity.db.`
      );
    }
    initialBuf = parentBuf;
  }

  db = initialBuf && initialBuf.length > 0 ? new SQL.Database(initialBuf) : new SQL.Database();

  console.log('[capacity] SQLite (zapis):', resolvedPrimary);
  db.run('PRAGMA foreign_keys = ON;');
  _db = db as typeof _db;
  ensureDatabaseSchemaAndRepairs();
}

function ensureDatabaseSchemaAndRepairs(): void {
  runMigrations();
  ensureSlotNumberColumn();
  ensureProjectEopExtension();
  ensureProjectEopOriginal();
  ensureProjectVolumesIncludeAfterEop();
  ensurePartVolumeShareByYearTable();
  ensurePartsDefaultVolume();
  ensureMachinesMachineUsage();
  ensureOperationsSplitFrom();
  ensureOperationVolumeSource();
  ensureOperationVolumeEffectiveFrom();
  markHistoricalAllocationOverrides();
  cleanupDanglingAllocationOverrides();
}

export async function restoreDbFromBackupFile(backupFilePath: string): Promise<void> {
  const SQL = _sqlModule ?? (await initSqlJs());
  _sqlModule = SQL;
  const resolved = path.resolve(backupFilePath);
  if (!fs.existsSync(resolved)) throw new Error(`Plik backupu nie istnieje: ${resolved}`);
  const stat = fs.statSync(resolved);
  if (!stat.isFile() || stat.size <= 0) throw new Error(`Nieprawidłowy plik backupu: ${resolved}`);
  const buf = fs.readFileSync(resolved);
  const restored = new SQL.Database(buf);
  restored.run('PRAGMA foreign_keys = ON;');
  try {
    if (_db && typeof (_db as any).close === 'function') (_db as any).close();
  } catch (_) {
    // Ignore close failures and continue with replaced handle.
  }
  _db = restored as typeof _db;
  ensureDatabaseSchemaAndRepairs();
  markDbDirty();
  saveDb();
}

function ensureOperationsSplitFrom(): void {
  try {
    _db.exec(
      'ALTER TABLE operations ADD COLUMN split_from_operation_id INTEGER REFERENCES operations(id) ON DELETE SET NULL'
    );
    markDbDirty();
    console.log('Ensured column operations.split_from_operation_id');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
}

function ensureOperationVolumeSource(): void {
  try {
    _db.exec("ALTER TABLE operation_volume_by_year ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
    markDbDirty();
    console.log('Ensured column operation_volume_by_year.source');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
}

function ensureOperationVolumeEffectiveFrom(): void {
  const cols: { sql: string; label: string }[] = [
    { sql: 'ALTER TABLE operation_volume_by_year ADD COLUMN volume_value_before REAL', label: 'volume_value_before' },
    { sql: 'ALTER TABLE operation_volume_by_year ADD COLUMN effective_from_month INTEGER', label: 'effective_from_month' },
    { sql: 'ALTER TABLE operation_volume_by_year ADD COLUMN effective_from_week INTEGER', label: 'effective_from_week' },
  ];
  for (const c of cols) {
    try {
      _db.exec(c.sql);
      markDbDirty();
      console.log(`Ensured column operation_volume_by_year.${c.label}`);
    } catch (e: any) {
      if (!e?.message?.includes('duplicate column name')) throw e;
    }
  }
}

function markHistoricalAllocationOverrides(): void {
  try {
    _db.exec(`
      UPDATE operation_volume_by_year
      SET source = 'allocation'
      WHERE operation_id IN (
        SELECT id FROM operations WHERE split_from_operation_id IS NOT NULL
      )
    `);
    if (rowsModified(_db) > 0) markDbDirty();
    _db.exec(`
      UPDATE operation_volume_by_year
      SET source = 'allocation'
      WHERE operation_id IN (
        SELECT DISTINCT split_from_operation_id
        FROM operations
        WHERE split_from_operation_id IS NOT NULL
      )
        AND source = 'manual'
    `);
    if (rowsModified(_db) > 0) markDbDirty();
  } catch (_) {
    // older schema during first boot; no-op
  }
}

function cleanupDanglingAllocationOverrides(): void {
  try {
    _db.exec(`
      DELETE FROM operation_volume_by_year
      WHERE COALESCE(source, 'manual') = 'allocation'
        AND operation_id IN (
          SELECT o.id
          FROM operations o
          LEFT JOIN operations c ON c.split_from_operation_id = o.id
          WHERE o.split_from_operation_id IS NULL
          GROUP BY o.id
          HAVING COUNT(c.id) = 0
        )
    `);
    if (rowsModified(_db) > 0) markDbDirty();
    // Legacy cleanup: before source tagging, some split leftovers were stored as "manual".
    // Heuristic: operation uses "z detalu" baseline (0 annual), has no split parent/children,
    // and yearly overrides are weekly-only residues from allocation merge/split.
    _db.exec(`
      DELETE FROM operation_volume_by_year
      WHERE COALESCE(source, 'manual') = 'manual'
        AND volume_unit = 'weekly'
        AND operation_id IN (
          SELECT o.id
          FROM operations o
          LEFT JOIN operations c ON c.split_from_operation_id = o.id
          WHERE o.split_from_operation_id IS NULL
            AND o.volume_value = 0
            AND o.volume_unit = 'annual'
          GROUP BY o.id
          HAVING COUNT(c.id) = 0
        )
    `);
    if (rowsModified(_db) > 0) markDbDirty();
  } catch (_) {
    // best-effort repair for historical projects
  }
}

function ensureMachinesMachineUsage(): void {
  try {
    _db.exec('ALTER TABLE machines ADD COLUMN machine_usage REAL DEFAULT 1');
    markDbDirty();
    console.log('Ensured column machines.machine_usage');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
}

function ensurePartsDefaultVolume(): void {
  try {
    _db.exec('ALTER TABLE parts ADD COLUMN default_volume_value REAL');
    markDbDirty();
    console.log('Ensured column parts.default_volume_value');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
  try {
    _db.exec('ALTER TABLE parts ADD COLUMN default_volume_unit TEXT');
    markDbDirty();
    console.log('Ensured column parts.default_volume_unit');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
}

function ensurePartVolumeShareByYearTable(): void {
  try {
    _db.exec(`
      CREATE TABLE IF NOT EXISTS part_volume_share_by_year (
        part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        share_percent REAL NOT NULL,
        PRIMARY KEY (part_id, year)
      );
    `);
    if (rowsModified(_db) > 0) markDbDirty();
    console.log('Ensured table part_volume_share_by_year');
  } catch (_) {}
}

function ensureSlotNumberColumn(): void {
  try {
    _db.exec('ALTER TABLE part_designations ADD COLUMN slot_number TEXT');
    markDbDirty();
    console.log('Ensured column part_designations.slot_number');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
}

function ensureProjectEopExtension(): void {
  try {
    _db.exec('ALTER TABLE projects ADD COLUMN eop_extension TEXT');
    markDbDirty();
    console.log('Ensured column projects.eop_extension');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
}

function ensureProjectEopOriginal(): void {
  try {
    _db.exec('ALTER TABLE projects ADD COLUMN eop_original TEXT');
    markDbDirty();
    console.log('Ensured column projects.eop_original');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
}

function ensureProjectVolumesIncludeAfterEop(): void {
  try {
    _db.exec('ALTER TABLE project_volumes ADD COLUMN include_in_calculator_after_eop INTEGER NOT NULL DEFAULT 0');
    markDbDirty();
    console.log('Ensured column project_volumes.include_in_calculator_after_eop');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
}

function runMigrations(): void {
  _db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);
  if (rowsModified(_db) > 0) markDbDirty();
  const rawPrepare = (_db as any).prepare.bind(_db);
  let migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir) || fs.readdirSync(migrationsDir).filter((f: string) => f.endsWith('.sql')).length === 0) {
    const srcFromDist = path.join(__dirname, '..', '..', 'src', 'db', 'migrations');
    const srcFromCwd = path.join(process.cwd(), 'src', 'db', 'migrations');
    if (fs.existsSync(srcFromDist)) migrationsDir = srcFromDist;
    else if (fs.existsSync(srcFromCwd)) migrationsDir = srcFromCwd;
  }
  const files = fs.readdirSync(migrationsDir).filter((f: string) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const name = path.basename(file, '.sql');
    const row = createStatement(_db, 'SELECT 1 FROM _migrations WHERE name = ?', rawPrepare).get(name);
    if (row) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      _db.exec(sql);
      markDbDirty();
    } catch (e: any) {
      if (e?.message?.includes('duplicate column name')) {
        console.log('Migration', name, ': column already exists, skipping');
      } else {
        throw e;
      }
    }
    createStatement(_db, 'INSERT INTO _migrations (name) VALUES (?)', rawPrepare).run(name);
    console.log('Applied migration:', name);
  }
}

export function saveDb(): void {
  if (!_db) return;
  if (!_dbDirty) return;
  const data = _db.export();
  const buf = Buffer.from(data);
  fs.writeFileSync(dbPath, buf);
  _dbDirty = false;
}

export const db = new Proxy({} as typeof _db, {
  get(_, prop) {
    if (!_db) throw new Error('DB not initialized. Call initDb() first.');
    if (prop === 'prepare') {
      const rawPrepare = (_db as any).prepare.bind(_db);
      return (sql: string) => createStatement(_db, sql, rawPrepare);
    }
    return (_db as any)[prop];
  },
});
