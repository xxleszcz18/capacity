import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'capacity.db');

type PrepareFn = (sql: string) => { bind: (p: (number | string | null)[]) => void; step: () => boolean; getAsObject: () => Record<string, unknown>; free: () => void };

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
      const res = db.exec('SELECT last_insert_rowid() as id');
      const lastInsertRowid = res.length && res[0].values?.[0]?.[0] != null ? Number(res[0].values[0][0]) : 0;
      return { changes: db.getRowsModified(), lastInsertRowid };
    },
  };
}

let _db: SqlJsDatabase & {
  prepare: (sql: string) => ReturnType<typeof createStatement>;
  exec: (sql: string) => void;
};

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();
  let db: SqlJsDatabase;
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON;');
  _db = db as typeof _db;
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
  markHistoricalAllocationOverrides();
  cleanupDanglingAllocationOverrides();
}

function ensureOperationsSplitFrom(): void {
  try {
    _db.exec(
      'ALTER TABLE operations ADD COLUMN split_from_operation_id INTEGER REFERENCES operations(id) ON DELETE SET NULL'
    );
    console.log('Ensured column operations.split_from_operation_id');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
}

function ensureOperationVolumeSource(): void {
  try {
    _db.exec("ALTER TABLE operation_volume_by_year ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
    console.log('Ensured column operation_volume_by_year.source');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
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
  } catch (_) {
    // best-effort repair for historical projects
  }
}

function ensureMachinesMachineUsage(): void {
  try {
    _db.exec('ALTER TABLE machines ADD COLUMN machine_usage REAL DEFAULT 1');
    console.log('Ensured column machines.machine_usage');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
}

function ensurePartsDefaultVolume(): void {
  try {
    _db.exec('ALTER TABLE parts ADD COLUMN default_volume_value REAL');
    console.log('Ensured column parts.default_volume_value');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
  try {
    _db.exec('ALTER TABLE parts ADD COLUMN default_volume_unit TEXT');
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
    console.log('Ensured table part_volume_share_by_year');
  } catch (_) {}
}

function ensureSlotNumberColumn(): void {
  try {
    _db.exec('ALTER TABLE part_designations ADD COLUMN slot_number TEXT');
    console.log('Ensured column part_designations.slot_number');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
}

function ensureProjectEopExtension(): void {
  try {
    _db.exec('ALTER TABLE projects ADD COLUMN eop_extension TEXT');
    console.log('Ensured column projects.eop_extension');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
}

function ensureProjectEopOriginal(): void {
  try {
    _db.exec('ALTER TABLE projects ADD COLUMN eop_original TEXT');
    console.log('Ensured column projects.eop_original');
  } catch (e: any) {
    if (!e?.message?.includes('duplicate column name')) throw e;
  }
}

function ensureProjectVolumesIncludeAfterEop(): void {
  try {
    _db.exec('ALTER TABLE project_volumes ADD COLUMN include_in_calculator_after_eop INTEGER NOT NULL DEFAULT 0');
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
  const data = _db.export();
  const buf = Buffer.from(data);
  fs.writeFileSync(dbPath, buf);
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
