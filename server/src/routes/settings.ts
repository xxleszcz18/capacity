import { Router } from 'express';
import { db, saveDb } from '../db/connection.js';
import {
  cleanupOrphanPartsForProject,
  countOperationsForDesignation,
  deleteOperationInProject,
  listOperationsForDesignation,
} from '../services/operationDeleteService.js';
import { formatDetailSapAliasLabel, normalizeReferenceDisplayMode, type ReferenceDisplayMode } from '../utils/detailLabel.js';
import { normalizeMachineDisplayMode, type MachineDisplayMode } from '../utils/machineDisplayMode.js';
import { loadReferenceDisplayMode } from '../utils/referenceDisplayMode.js';
import { getOcuDefaultTemplate, isOcuEnabled, saveOcuDefaultTemplate } from '../utils/ocuSettings.js';
import { getCapacityDefaultTemplate, saveCapacityDefaultTemplate } from '../utils/capacitySettings.js';
import { mergeWorkingDaysWithDefaults, normalizeOverrideRow, parseOptionalNumber, parseOptionalShifts } from '../utils/workingDaysMerge.js';

const WEEKS_PER_YEAR = 52;

// ---- Osobne routery montowane PRZED settingsRouter (ścieżki /api/settings/phases i /api/settings/designations) ----
export const phasesRouter = Router();
phasesRouter.get('/', (_req, res) => {
  try {
    const rows = db.prepare('SELECT id, name FROM process_phases ORDER BY name').all() as any[];
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Błąd odczytu faz' });
  }
});
phasesRouter.post('/', (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    db.prepare('INSERT INTO process_phases (name) VALUES (?)').run(name);
    const row = db.prepare('SELECT id, name FROM process_phases WHERE name = ?').get(name) as any;
    res.status(201).json(row);
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Faza o takiej nazwie już istnieje' });
    res.status(500).json({ error: e?.message || 'Błąd zapisu fazy' });
  }
});
phasesRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const existing = db.prepare('SELECT id FROM process_phases WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare('UPDATE process_phases SET name = ? WHERE id = ?').run(name, id);
    const row = db.prepare('SELECT id, name FROM process_phases WHERE id = ?').get(id) as any;
    res.json(row);
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Faza o takiej nazwie już istnieje' });
    res.status(500).json({ error: e?.message || 'Błąd zapisu fazy' });
  }
});
phasesRouter.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = db.prepare('DELETE FROM process_phases WHERE id = ?').run(id);
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Błąd usuwania fazy' });
  }
});

export const designationsRouter = Router();
const designationCols = 'id, designation, sap_number, alias, free_text, slot_number';

function mapDesignationRow(row: any): any {
  return {
    id: row.id,
    designation: row.designation,
    sap_number: row.sap_number ?? null,
    alias: row.alias ?? null,
    free_text: row.free_text ?? null,
    slot_number: row.slot_number ?? null,
  };
}

/** Projekty, w których występuje detal (przez parts.designation_id). */
function loadProjectsByDesignationIds(designationIds: number[]): Map<number, { id: number; name: string }[]> {
  const map = new Map<number, { id: number; name: string }[]>();
  if (designationIds.length === 0) return map;
  const placeholders = designationIds.map(() => '?').join(',');
  const usageRows = db
    .prepare(
      `SELECT DISTINCT pt.designation_id AS designation_id, pr.id AS project_id, pr.name AS project_name
       FROM parts pt
       INNER JOIN projects pr ON pr.id = pt.project_id
       WHERE pt.designation_id IS NOT NULL AND pt.designation_id IN (${placeholders})`
    )
    .all(...designationIds) as { designation_id: number; project_id: number; project_name: string }[];
  for (const u of usageRows) {
    let list = map.get(u.designation_id);
    if (!list) {
      list = [];
      map.set(u.designation_id, list);
    }
    if (!list.some((p) => p.id === u.project_id)) {
      list.push({ id: u.project_id, name: u.project_name });
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  }
  return map;
}

/** Numery linii maszyn (pole location) z wszystkich operacji, w których występuje detal (część główna lub składowa setu). */
function loadMachineLinesByDesignationIds(designationIds: number[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  if (designationIds.length === 0) return map;
  const placeholders = designationIds.map(() => '?').join(',');
  const params = designationIds;
  const rowsFromParts = db
    .prepare(
      `SELECT DISTINCT pt.designation_id AS designation_id, TRIM(m.location) AS line_ref
       FROM operations o
       JOIN machines m ON m.id = o.machine_id
       JOIN parts pt ON pt.id = o.part_id
       WHERE pt.designation_id IS NOT NULL AND pt.designation_id IN (${placeholders})
         AND m.location IS NOT NULL AND LENGTH(TRIM(m.location)) > 0`
    )
    .all(...params) as { designation_id: number; line_ref: string }[];
  let rowsFromSets: { designation_id: number; line_ref: string }[] = [];
  try {
    rowsFromSets = db
      .prepare(
        `SELECT DISTINCT pt.designation_id AS designation_id, TRIM(m.location) AS line_ref
         FROM operations o
         JOIN machines m ON m.id = o.machine_id
         JOIN operation_set_members osm ON osm.operation_id = o.id
         JOIN parts pt ON pt.id = osm.part_id
         WHERE pt.designation_id IS NOT NULL AND pt.designation_id IN (${placeholders})
           AND m.location IS NOT NULL AND LENGTH(TRIM(m.location)) > 0`
      )
      .all(...params) as { designation_id: number; line_ref: string }[];
  } catch {
    /* brak tabeli setów w bardzo starych bazach */
  }
  const sets = new Map<number, Set<string>>();
  const addLine = (designationId: number, raw: string) => {
    const v = String(raw ?? '').trim();
    if (!v) return;
    let s = sets.get(designationId);
    if (!s) {
      s = new Set();
      sets.set(designationId, s);
    }
    s.add(v);
  };
  for (const r of rowsFromParts) addLine(r.designation_id, r.line_ref);
  for (const r of rowsFromSets) addLine(r.designation_id, r.line_ref);
  for (const [desId, s] of sets) {
    map.set(desId, Array.from(s).sort((a, b) => a.localeCompare(b, 'pl')));
  }
  return map;
}

function mapDesignationWithAggregates(
  row: any,
  projectsById: Map<number, { id: number; name: string }[]>,
  linesById: Map<number, string[]>
): any {
  const projects = projectsById.get(row.id) ?? [];
  const machine_lines = linesById.get(row.id) ?? [];
  return { ...mapDesignationRow(row), projects, machine_lines };
}

designationsRouter.get('/', (_req, res) => {
  try {
    const rows = db.prepare(`SELECT ${designationCols} FROM part_designations ORDER BY COALESCE(sap_number, alias, designation, free_text)`).all() as any[];
    const ids = rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
    const projectsById = loadProjectsByDesignationIds(ids);
    const linesById = loadMachineLinesByDesignationIds(ids);
    res.json(rows.map((row) => mapDesignationWithAggregates(row, projectsById, linesById)));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Błąd odczytu detali' });
  }
});
designationsRouter.post('/', (req, res) => {
  const body = req.body as any;
  const sap_number = body.sap_number != null ? String(body.sap_number).trim() : '';
  const alias = body.alias != null ? String(body.alias).trim() : '';
  const free_text = body.free_text != null ? String(body.free_text).trim() : '';
  const slot_number = body.slot_number != null ? String(body.slot_number).trim() : null;
  const designation = body.designation != null ? String(body.designation).trim() : (sap_number || alias || free_text || '');
  if (!designation && !sap_number && !alias && !free_text) return res.status(400).json({ error: 'Wypełnij co najmniej jedno pole (Nr SAP, Alias lub Free text)' });
  try {
    const r = db.prepare('INSERT INTO part_designations (designation, sap_number, alias, free_text, slot_number) VALUES (?, ?, ?, ?, ?)').run(designation || sap_number || alias || free_text, sap_number || null, alias || null, free_text || null, slot_number || null);
    const row = db.prepare(`SELECT ${designationCols} FROM part_designations WHERE id = ?`).get(r.lastInsertRowid) as any;
    const mapped = row || { id: r.lastInsertRowid, designation: designation || sap_number || alias || free_text, sap_number: sap_number || null, alias: alias || null, free_text: free_text || null, slot_number: slot_number || null };
    const mid = Number(mapped.id);
    res.status(201).json(
      mapDesignationWithAggregates(mapped, loadProjectsByDesignationIds([mid]), loadMachineLinesByDesignationIds([mid]))
    );
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Detal o takim oznaczeniu już istnieje' });
    res.status(500).json({ error: e?.message || 'Błąd zapisu detalu' });
  }
});
designationsRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as any;
  const existing = db.prepare(`SELECT ${designationCols} FROM part_designations WHERE id = ?`).get(id) as any;
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const sap_number = body.sap_number != null ? String(body.sap_number).trim() : null;
  const alias = body.alias != null ? String(body.alias).trim() : null;
  const free_text = body.free_text != null ? String(body.free_text).trim() : null;
  const slot_number = Object.prototype.hasOwnProperty.call(body, 'slot_number')
    ? body.slot_number != null && String(body.slot_number).trim() !== ''
      ? String(body.slot_number).trim()
      : null
    : (existing.slot_number ?? null);
  const designation = body.designation != null ? String(body.designation).trim() : null;
  try {
    db.prepare('UPDATE part_designations SET designation = COALESCE(?, designation), sap_number = ?, alias = ?, free_text = ?, slot_number = ? WHERE id = ?')
      .run(designation ?? (sap_number || alias || free_text), sap_number, alias, free_text, slot_number, id);
    const row = db.prepare(`SELECT ${designationCols} FROM part_designations WHERE id = ?`).get(id) as any;
    res.json(mapDesignationWithAggregates(row, loadProjectsByDesignationIds([id]), loadMachineLinesByDesignationIds([id])));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Błąd zapisu detalu' });
  }
});
designationsRouter.get('/:id/related-operations', (req, res) => {
  try {
    const id = Number(req.params.id);
    const exists = db.prepare('SELECT id FROM part_designations WHERE id = ?').get(id);
    if (!exists) return res.status(404).json({ error: 'Not found' });
    const refMode = loadReferenceDisplayMode();
    const rows = listOperationsForDesignation(id);
    const operations = rows.map((r) => {
      const detail_label = formatDetailSapAliasLabel(
        {
          sap_number: r.detail_sap_number,
          alias: r.detail_alias,
          free_text: r.detail_free_text,
        },
        refMode
      );
      const mn = r.machine_internal != null ? String(r.machine_internal) : '?';
      const mt = r.machine_type != null ? String(r.machine_type) : '';
      const setMark = Number(r.is_set) === 1 ? ' · set' : '';
      const label = `${detail_label} · ${mn}${mt ? ` (${mt})` : ''} · ${r.phase_name || '—'} · ${r.cycle_time_seconds ?? '?'}s${setMark} · ${r.project_client} — ${r.project_name}`;
      return { ...r, detail_label, label };
    });
    res.json({ operations });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Błąd odczytu operacji powiązanych z detalem' });
  }
});

/** Usuwa wybrane operacje; gdy nie zostanie żadna powiązana operacja — usuwa też wpis detalu z katalogu. */
designationsRouter.post('/:id/delete-cascade', (req, res) => {
  try {
    const designationId = Number(req.params.id);
    const exists = db.prepare('SELECT id FROM part_designations WHERE id = ?').get(designationId);
    if (!exists) return res.status(404).json({ error: 'Not found' });

    const rawIds = req.body?.operation_ids;
    const operationIds = Array.isArray(rawIds)
      ? [...new Set(rawIds.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n) && n > 0))]
      : [];

    const related = listOperationsForDesignation(designationId);
    const relatedById = new Map(related.map((r) => [r.id, r]));
    const invalid = operationIds.filter((opId) => !relatedById.has(opId));
    if (invalid.length > 0) {
      return res.status(400).json({
        error: `Nieprawidłowe ID operacji (nie powiązane z tym detalem): ${invalid.join(', ')}`,
      });
    }

    const errors: string[] = [];
    let operations_deleted = 0;
    const affectedProjects = new Set<number>();

    db.prepare('BEGIN TRANSACTION').run();
    for (const opId of operationIds) {
      const row = relatedById.get(opId)!;
      const result = deleteOperationInProject(row.project_id, opId);
      if (!result.ok) {
        errors.push(`#${opId}: ${result.error}`);
        continue;
      }
      operations_deleted++;
      affectedProjects.add(row.project_id);
    }
    for (const projectId of affectedProjects) {
      cleanupOrphanPartsForProject(projectId);
    }

    let designation_deleted = false;
    const remaining = countOperationsForDesignation(designationId);
    if (remaining === 0) {
      db.prepare('DELETE FROM parts WHERE designation_id = ?').run(designationId);
      const r = db.prepare('DELETE FROM part_designations WHERE id = ?').run(designationId);
      designation_deleted = r.changes > 0;
    }

    if (errors.length > 0) {
      db.prepare('ROLLBACK').run();
      return res.status(400).json({
        error: 'Nie udało się usunąć wszystkich wybranych operacji.',
        errors,
        operations_deleted: 0,
        designation_deleted: false,
      });
    }

    db.prepare('COMMIT').run();
    saveDb();
    res.json({
      operations_deleted,
      designation_deleted,
      operations_remaining: remaining,
      errors: [] as string[],
    });
  } catch (e: any) {
    try {
      db.prepare('ROLLBACK').run();
    } catch {
      /* ignore */
    }
    res.status(500).json({ error: e?.message || 'Błąd usuwania detalu i operacji' });
  }
});

designationsRouter.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const exists = db.prepare('SELECT id FROM part_designations WHERE id = ?').get(id);
    if (!exists) return res.status(404).json({ error: 'Not found' });
    const opCount = countOperationsForDesignation(id);
    if (opCount > 0) {
      return res.status(400).json({
        error: `Detal ma ${opCount} powiązanych operacji. Użyj usuwania z wyborem operacji.`,
        operations_count: opCount,
      });
    }
    db.prepare('DELETE FROM parts WHERE designation_id = ?').run(id);
    const r = db.prepare('DELETE FROM part_designations WHERE id = ?').run(id);
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    saveDb();
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Błąd usuwania detalu' });
  }
});

export const machineTypesRouter = Router();

/** 0..1, krok 0.1 — jak clampMachineUsage na maszynach (minimum efektywne 0.1). */
function clampTypeDefaultMachineUsage(v: unknown): number {
  const n = Number(v);
  if (Number.isNaN(n)) return 1;
  const clamped = Math.max(0.1, Math.min(1, n));
  return Math.round(clamped * 10) / 10;
}

machineTypesRouter.get('/', (_req, res) => {
  try {
    const rows = db
      .prepare('SELECT id, name, default_machine_usage FROM machine_types ORDER BY name COLLATE NOCASE')
      .all() as { id: number; name: string; default_machine_usage: number }[];
    res.json(
      rows.map((r) => ({
        ...r,
        default_machine_usage:
          r.default_machine_usage != null && Number.isFinite(Number(r.default_machine_usage))
            ? clampTypeDefaultMachineUsage(r.default_machine_usage)
            : 1,
      }))
    );
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Błąd odczytu typów maszyn' });
  }
});

/** Uzupełnia katalog typów o brakujące wartości z kolumny machines.type (DISTINCT, po trim). */
machineTypesRouter.post('/sync-from-machines', (_req, res) => {
  try {
    const before = db.prepare('SELECT COUNT(*) AS c FROM machine_types').get() as { c: number };
    db.prepare(`
      INSERT OR IGNORE INTO machine_types (name, default_machine_usage)
      SELECT DISTINCT TRIM(type), 1
      FROM machines
      WHERE type IS NOT NULL AND TRIM(type) != ''
    `).run();
    const after = db.prepare('SELECT COUNT(*) AS c FROM machine_types').get() as { c: number };
    const inserted = Math.max(0, Number(after.c) - Number(before.c));
    saveDb();
    const rows = db
      .prepare('SELECT id, name, default_machine_usage FROM machine_types ORDER BY name COLLATE NOCASE')
      .all() as { id: number; name: string; default_machine_usage: number }[];
    res.json({
      inserted,
      types: rows.map((r) => ({
        ...r,
        default_machine_usage:
          r.default_machine_usage != null && Number.isFinite(Number(r.default_machine_usage))
            ? clampTypeDefaultMachineUsage(r.default_machine_usage)
            : 1,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Błąd synchronizacji typów z maszyn' });
  }
});

machineTypesRouter.post('/', (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  const default_machine_usage = clampTypeDefaultMachineUsage(req.body?.default_machine_usage ?? 1);
  try {
    const ins = db.prepare('INSERT INTO machine_types (name, default_machine_usage) VALUES (?, ?)').run(name, default_machine_usage);
    const row = db.prepare('SELECT id, name, default_machine_usage FROM machine_types WHERE id = ?').get(ins.lastInsertRowid) as any;
    res.status(201).json(row);
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Typ o takiej nazwie już istnieje' });
    res.status(500).json({ error: e?.message || 'Błąd zapisu typu' });
  }
});

machineTypesRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const existing = db.prepare('SELECT id, name, default_machine_usage FROM machine_types WHERE id = ?').get(id) as
      | { id: number; name: string; default_machine_usage: number }
      | undefined;
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const default_machine_usage =
      req.body?.default_machine_usage !== undefined && req.body?.default_machine_usage !== null && req.body?.default_machine_usage !== ''
        ? clampTypeDefaultMachineUsage(req.body.default_machine_usage)
        : clampTypeDefaultMachineUsage(existing.default_machine_usage ?? 1);
    db.prepare('UPDATE machine_types SET name = ?, default_machine_usage = ? WHERE id = ?').run(name, default_machine_usage, id);
    if (String(existing.name).trim() !== name) {
      db.prepare('UPDATE machines SET type = ? WHERE type = ?').run(name, existing.name);
    }
    const row = db.prepare('SELECT id, name, default_machine_usage FROM machine_types WHERE id = ?').get(id) as any;
    res.json(row);
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Typ o takiej nazwie już istnieje' });
    res.status(500).json({ error: e?.message || 'Błąd zapisu typu' });
  }
});

machineTypesRouter.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT name FROM machine_types WHERE id = ?').get(id) as { name: string } | undefined;
    if (!row) return res.status(404).json({ error: 'Not found' });
    const cnt = db.prepare('SELECT COUNT(*) AS c FROM machines WHERE type = ?').get(row.name) as { c: number };
    if (cnt && Number(cnt.c) > 0) {
      return res.status(400).json({ error: 'Nie można usunąć: istnieją maszyny z tym typem. Najpierw zmień typ tych maszyn.' });
    }
    const r = db.prepare('DELETE FROM machine_types WHERE id = ?').run(id);
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Błąd usuwania typu' });
  }
});

// ---- Główny router ustawień (dni robocze itd.) ----
export const settingsRouter = Router();

type VisualSettings = {
  show_alternative_borders: boolean;
  show_rfq_badge: boolean;
  colorize_load_cells: boolean;
  colorize_sum_row: boolean;
  colorize_avg_row: boolean;
  reference_display: ReferenceDisplayMode;
  machine_display: MachineDisplayMode;
  ok_enabled: boolean;
  ok_from: number;
  ok_to: number;
  ok_color: string;
  warn_enabled: boolean;
  warn_from: number;
  warn_to: number;
  warn_color: string;
  danger_enabled: boolean;
  danger_from: number;
  danger_to: number;
  danger_color: string;
  contractual_calculator_frame_color: string;
  /** 25, 50 lub 0 = wszystkie maszyny na jednej stronie kalkulatora */
  calculator_page_size: number;
  /** Domyślny zakres lat na stronie wizualizacji danych (administracja). */
  data_viz_default_year_from: number;
  data_viz_default_year_to: number;
  /** Kolorystyka sekcji Wizualizacja danych. */
  data_viz_color_production: string;
  data_viz_color_contract: string;
  data_viz_color_scenario_production: string;
  data_viz_color_scenario_contract: string;
  data_viz_color_delta_negative: string;
  data_viz_color_delta_positive: string;
  data_viz_color_ref_line_overload: string;
  data_viz_color_ref_line_free: string;
  data_viz_compare_palette: string[];
};

function calendarYearNow(): number {
  return new Date().getFullYear();
}

function toYear(v: unknown, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return fallback;
  return n;
}

function normalizeDataVizYearRange(from: number, to: number): { from: number; to: number } {
  const yFrom = toYear(from, calendarYearNow() - 1);
  const yTo = toYear(to, calendarYearNow() + 10);
  return { from: Math.min(yFrom, yTo), to: Math.max(yFrom, yTo) };
}

const visualDefaults: VisualSettings = {
  show_alternative_borders: true,
  show_rfq_badge: true,
  colorize_load_cells: true,
  colorize_sum_row: true,
  colorize_avg_row: true,
  reference_display: 'both',
  machine_display: 'internal',
  ok_enabled: true,
  ok_from: 0,
  ok_to: 79.99,
  ok_color: '#c8e6c9',
  warn_enabled: true,
  warn_from: 80,
  warn_to: 99.99,
  warn_color: '#fff9c4',
  danger_enabled: true,
  danger_from: 100,
  danger_to: 1000000,
  danger_color: '#ffcdd2',
  contractual_calculator_frame_color: '#ff9800',
  calculator_page_size: 25,
  data_viz_default_year_from: calendarYearNow() - 1,
  data_viz_default_year_to: calendarYearNow() + 10,
  data_viz_color_production: '#8A9300',
  data_viz_color_contract: '#E86A10',
  data_viz_color_scenario_production: '#008BC1',
  data_viz_color_scenario_contract: '#F59B47',
  data_viz_color_delta_negative: '#E86A10',
  data_viz_color_delta_positive: '#8A9300',
  data_viz_color_ref_line_overload: '#E86A10',
  data_viz_color_ref_line_free: '#8A9300',
  data_viz_compare_palette: [
    '#8A9300',
    '#008BC1',
    '#E86A10',
    '#B8C400',
    '#00B0E8',
    '#F59B47',
    '#7A7B7A',
    '#66B9DA',
    '#B9BE66',
    '#F1A670',
  ],
};

function toBool(v: unknown, fallback: boolean): boolean {
  if (v == null) return fallback;
  const s = String(v).trim().toLowerCase();
  if (s === '1' || s === 'true') return true;
  if (s === '0' || s === 'false') return false;
  return fallback;
}

function toNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toColor(v: unknown, fallback: string): string {
  const s = String(v ?? '').trim();
  return /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(s) ? s : fallback;
}

function toComparePalette(v: unknown, fallback: string[]): string[] {
  let raw: unknown[] | null = null;
  if (Array.isArray(v)) raw = v;
  else if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) raw = parsed;
    } catch {
      raw = v.split(/[,;\s]+/).filter(Boolean);
    }
  }
  if (!raw?.length) return [...fallback];
  const out = raw.map((c, i) => toColor(c, fallback[i % fallback.length] ?? fallback[0]));
  return out.length >= 3 ? out : [...fallback];
}

function toCalculatorPageSize(v: unknown, fallback: number): number {
  const n = Number(v);
  if (n === 0 || n === 25 || n === 50) return n;
  return fallback;
}

function loadVisualSettings(): VisualSettings {
  const keys = [
    'visual_show_alternative_borders',
    'visual_show_rfq_badge',
    'visual_colorize_load_cells',
    'visual_colorize_sum_row',
    'visual_colorize_avg_row',
    'visual_reference_display',
    'visual_machine_display',
    'visual_ok_enabled',
    'visual_ok_from',
    'visual_ok_to',
    'visual_ok_color',
    'visual_warn_enabled',
    'visual_warn_from',
    'visual_warn_to',
    'visual_warn_color',
    'visual_danger_enabled',
    'visual_danger_from',
    'visual_danger_to',
    'visual_danger_color',
    'visual_contractual_calculator_frame_color',
    'visual_calculator_page_size',
    'visual_data_viz_default_year_from',
    'visual_data_viz_default_year_to',
    'visual_data_viz_color_production',
    'visual_data_viz_color_contract',
    'visual_data_viz_color_scenario_production',
    'visual_data_viz_color_scenario_contract',
    'visual_data_viz_color_delta_negative',
    'visual_data_viz_color_delta_positive',
    'visual_data_viz_color_ref_line_overload',
    'visual_data_viz_color_ref_line_free',
    'visual_data_viz_compare_palette',
  ];
  const rows = db.prepare(
    `SELECT key, value FROM admin_settings WHERE key IN (${keys.map(() => '?').join(',')})`
  ).all(...keys) as { key: string; value: string }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const yearRange = normalizeDataVizYearRange(
    toYear(map.get('visual_data_viz_default_year_from'), visualDefaults.data_viz_default_year_from),
    toYear(map.get('visual_data_viz_default_year_to'), visualDefaults.data_viz_default_year_to)
  );
  return {
    show_alternative_borders: toBool(map.get('visual_show_alternative_borders'), visualDefaults.show_alternative_borders),
    show_rfq_badge: toBool(map.get('visual_show_rfq_badge'), visualDefaults.show_rfq_badge),
    colorize_load_cells: toBool(map.get('visual_colorize_load_cells'), visualDefaults.colorize_load_cells),
    colorize_sum_row: toBool(map.get('visual_colorize_sum_row'), visualDefaults.colorize_sum_row),
    colorize_avg_row: toBool(map.get('visual_colorize_avg_row'), visualDefaults.colorize_avg_row),
    reference_display: normalizeReferenceDisplayMode(map.get('visual_reference_display') ?? visualDefaults.reference_display),
    machine_display: normalizeMachineDisplayMode(map.get('visual_machine_display') ?? visualDefaults.machine_display),
    ok_enabled: toBool(map.get('visual_ok_enabled'), visualDefaults.ok_enabled),
    ok_from: toNum(map.get('visual_ok_from'), visualDefaults.ok_from),
    ok_to: toNum(map.get('visual_ok_to'), visualDefaults.ok_to),
    ok_color: toColor(map.get('visual_ok_color'), visualDefaults.ok_color),
    warn_enabled: toBool(map.get('visual_warn_enabled'), visualDefaults.warn_enabled),
    warn_from: toNum(map.get('visual_warn_from'), visualDefaults.warn_from),
    warn_to: toNum(map.get('visual_warn_to'), visualDefaults.warn_to),
    warn_color: toColor(map.get('visual_warn_color'), visualDefaults.warn_color),
    danger_enabled: toBool(map.get('visual_danger_enabled'), visualDefaults.danger_enabled),
    danger_from: toNum(map.get('visual_danger_from'), visualDefaults.danger_from),
    danger_to: toNum(map.get('visual_danger_to'), visualDefaults.danger_to),
    danger_color: toColor(map.get('visual_danger_color'), visualDefaults.danger_color),
    contractual_calculator_frame_color: toColor(
      map.get('visual_contractual_calculator_frame_color'),
      visualDefaults.contractual_calculator_frame_color
    ),
    calculator_page_size: toCalculatorPageSize(
      map.get('visual_calculator_page_size'),
      visualDefaults.calculator_page_size
    ),
    data_viz_default_year_from: yearRange.from,
    data_viz_default_year_to: yearRange.to,
    data_viz_color_production: toColor(map.get('visual_data_viz_color_production'), visualDefaults.data_viz_color_production),
    data_viz_color_contract: toColor(map.get('visual_data_viz_color_contract'), visualDefaults.data_viz_color_contract),
    data_viz_color_scenario_production: toColor(
      map.get('visual_data_viz_color_scenario_production'),
      visualDefaults.data_viz_color_scenario_production
    ),
    data_viz_color_scenario_contract: toColor(
      map.get('visual_data_viz_color_scenario_contract'),
      visualDefaults.data_viz_color_scenario_contract
    ),
    data_viz_color_delta_negative: toColor(map.get('visual_data_viz_color_delta_negative'), visualDefaults.data_viz_color_delta_negative),
    data_viz_color_delta_positive: toColor(map.get('visual_data_viz_color_delta_positive'), visualDefaults.data_viz_color_delta_positive),
    data_viz_color_ref_line_overload: toColor(
      map.get('visual_data_viz_color_ref_line_overload'),
      visualDefaults.data_viz_color_ref_line_overload
    ),
    data_viz_color_ref_line_free: toColor(map.get('visual_data_viz_color_ref_line_free'), visualDefaults.data_viz_color_ref_line_free),
    data_viz_compare_palette: toComparePalette(map.get('visual_data_viz_compare_palette'), visualDefaults.data_viz_compare_palette),
  };
}

function saveVisualSettings(payload: Partial<VisualSettings>): void {
  const current = loadVisualSettings();
  const merged: VisualSettings = {
    ...current,
    ...payload,
    reference_display: normalizeReferenceDisplayMode(
      payload.reference_display !== undefined ? payload.reference_display : current.reference_display
    ),
    machine_display: normalizeMachineDisplayMode(
      payload.machine_display !== undefined ? payload.machine_display : current.machine_display
    ),
    contractual_calculator_frame_color: toColor(
      payload.contractual_calculator_frame_color !== undefined
        ? payload.contractual_calculator_frame_color
        : current.contractual_calculator_frame_color,
      visualDefaults.contractual_calculator_frame_color
    ),
    calculator_page_size: toCalculatorPageSize(
      payload.calculator_page_size !== undefined ? payload.calculator_page_size : current.calculator_page_size,
      visualDefaults.calculator_page_size
    ),
    data_viz_color_production: toColor(
      payload.data_viz_color_production !== undefined ? payload.data_viz_color_production : current.data_viz_color_production,
      visualDefaults.data_viz_color_production
    ),
    data_viz_color_contract: toColor(
      payload.data_viz_color_contract !== undefined ? payload.data_viz_color_contract : current.data_viz_color_contract,
      visualDefaults.data_viz_color_contract
    ),
    data_viz_color_scenario_production: toColor(
      payload.data_viz_color_scenario_production !== undefined
        ? payload.data_viz_color_scenario_production
        : current.data_viz_color_scenario_production,
      visualDefaults.data_viz_color_scenario_production
    ),
    data_viz_color_scenario_contract: toColor(
      payload.data_viz_color_scenario_contract !== undefined
        ? payload.data_viz_color_scenario_contract
        : current.data_viz_color_scenario_contract,
      visualDefaults.data_viz_color_scenario_contract
    ),
    data_viz_color_delta_negative: toColor(
      payload.data_viz_color_delta_negative !== undefined ? payload.data_viz_color_delta_negative : current.data_viz_color_delta_negative,
      visualDefaults.data_viz_color_delta_negative
    ),
    data_viz_color_delta_positive: toColor(
      payload.data_viz_color_delta_positive !== undefined ? payload.data_viz_color_delta_positive : current.data_viz_color_delta_positive,
      visualDefaults.data_viz_color_delta_positive
    ),
    data_viz_color_ref_line_overload: toColor(
      payload.data_viz_color_ref_line_overload !== undefined
        ? payload.data_viz_color_ref_line_overload
        : current.data_viz_color_ref_line_overload,
      visualDefaults.data_viz_color_ref_line_overload
    ),
    data_viz_color_ref_line_free: toColor(
      payload.data_viz_color_ref_line_free !== undefined ? payload.data_viz_color_ref_line_free : current.data_viz_color_ref_line_free,
      visualDefaults.data_viz_color_ref_line_free
    ),
    data_viz_compare_palette: toComparePalette(
      payload.data_viz_compare_palette !== undefined ? payload.data_viz_compare_palette : current.data_viz_compare_palette,
      visualDefaults.data_viz_compare_palette
    ),
  };
  const mergedYears = normalizeDataVizYearRange(
    payload.data_viz_default_year_from !== undefined ? payload.data_viz_default_year_from : current.data_viz_default_year_from,
    payload.data_viz_default_year_to !== undefined ? payload.data_viz_default_year_to : current.data_viz_default_year_to
  );
  merged.data_viz_default_year_from = mergedYears.from;
  merged.data_viz_default_year_to = mergedYears.to;
  if (merged.ok_from > merged.ok_to) throw new Error('Zakres "OK" ma niepoprawne granice');
  if (merged.warn_from > merged.warn_to) throw new Error('Zakres "Uwaga" ma niepoprawne granice');
  if (merged.danger_from > merged.danger_to) throw new Error('Zakres "Alarm" ma niepoprawne granice');
  const entries: [string, string][] = [
    ['visual_show_alternative_borders', merged.show_alternative_borders ? '1' : '0'],
    ['visual_show_rfq_badge', merged.show_rfq_badge ? '1' : '0'],
    ['visual_colorize_load_cells', merged.colorize_load_cells ? '1' : '0'],
    ['visual_colorize_sum_row', merged.colorize_sum_row ? '1' : '0'],
    ['visual_colorize_avg_row', merged.colorize_avg_row ? '1' : '0'],
    ['visual_reference_display', merged.reference_display],
    ['visual_machine_display', merged.machine_display],
    ['visual_ok_enabled', merged.ok_enabled ? '1' : '0'],
    ['visual_ok_from', String(merged.ok_from)],
    ['visual_ok_to', String(merged.ok_to)],
    ['visual_ok_color', merged.ok_color],
    ['visual_warn_enabled', merged.warn_enabled ? '1' : '0'],
    ['visual_warn_from', String(merged.warn_from)],
    ['visual_warn_to', String(merged.warn_to)],
    ['visual_warn_color', merged.warn_color],
    ['visual_danger_enabled', merged.danger_enabled ? '1' : '0'],
    ['visual_danger_from', String(merged.danger_from)],
    ['visual_danger_to', String(merged.danger_to)],
    ['visual_danger_color', merged.danger_color],
    ['visual_contractual_calculator_frame_color', merged.contractual_calculator_frame_color],
    ['visual_calculator_page_size', String(merged.calculator_page_size)],
    ['visual_data_viz_default_year_from', String(merged.data_viz_default_year_from)],
    ['visual_data_viz_default_year_to', String(merged.data_viz_default_year_to)],
    ['visual_data_viz_color_production', merged.data_viz_color_production],
    ['visual_data_viz_color_contract', merged.data_viz_color_contract],
    ['visual_data_viz_color_scenario_production', merged.data_viz_color_scenario_production],
    ['visual_data_viz_color_scenario_contract', merged.data_viz_color_scenario_contract],
    ['visual_data_viz_color_delta_negative', merged.data_viz_color_delta_negative],
    ['visual_data_viz_color_delta_positive', merged.data_viz_color_delta_positive],
    ['visual_data_viz_color_ref_line_overload', merged.data_viz_color_ref_line_overload],
    ['visual_data_viz_color_ref_line_free', merged.data_viz_color_ref_line_free],
    ['visual_data_viz_compare_palette', JSON.stringify(merged.data_viz_compare_palette)],
  ];
  const upsert = db.prepare('INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  entries.forEach(([k, v]) => upsert.run(k, v));
}

/** Dostępny czas produkcyjny na tydzień [s] – używany w kalkulatorze obciążenia. Uwzględnia dni robocze, czas zmiany, liczbę zmian na dobę, OEE i czas uruchomienia/zakończenia. */
function calcCapacity(row: {
  working_days_year: number;
  oee_factor: number;
  shift_time_seconds: number;
  startup_shutdown_seconds: number;
  shifts_per_day?: number;
}) {
  const shifts = Math.max(1, row.shifts_per_day ?? 1);
  const secondsPerWeek = (row.working_days_year / WEEKS_PER_YEAR) * row.shift_time_seconds * 60 * shifts * row.oee_factor;
  return Math.round(secondsPerWeek - (row.startup_shutdown_seconds ?? 0));
}

function mapWorkingDaysListRow(row: any, defaults: ReturnType<typeof getCapacityDefaultTemplate> | ReturnType<typeof getOcuDefaultTemplate>) {
  const normalized = normalizeOverrideRow(row);
  const resolved = mergeWorkingDaysWithDefaults(normalized, defaults);
  return {
    ...normalized,
    capacity: calcCapacity(resolved),
    resolved_working_days_year: resolved.working_days_year,
    resolved_oee_factor: resolved.oee_factor,
    resolved_shift_time_seconds: resolved.shift_time_seconds,
    resolved_startup_shutdown_seconds: resolved.startup_shutdown_seconds,
    resolved_working_weeks_per_year: resolved.working_weeks_per_year,
    resolved_shifts_per_day: resolved.shifts_per_day,
  };
}

function parseOverrideFields(body: any, existing?: any) {
  const pickNum = (key: string) => {
    if (body[key] !== undefined) return parseOptionalNumber(body[key]);
    if (!existing) return null;
    return existing[key] == null ? null : Number(existing[key]);
  };
  const pickShifts = () => {
    if (body.shifts_per_day !== undefined) return parseOptionalShifts(body.shifts_per_day);
    if (!existing || existing.shifts_per_day == null) return null;
    return Number(existing.shifts_per_day);
  };
  return {
    working_days_year: pickNum('working_days_year'),
    oee_factor: pickNum('oee_factor'),
    shift_time_seconds: pickNum('shift_time_seconds'),
    startup_shutdown_seconds: pickNum('startup_shutdown_seconds'),
    working_weeks_per_year: pickNum('working_weeks_per_year'),
    shifts_per_day: pickShifts(),
  };
}

settingsRouter.get('/', (_req, res) => {
  const defaults = getCapacityDefaultTemplate();
  const rows = db.prepare(`
    SELECT id, year, working_days_year, oee_factor, shift_time_seconds, startup_shutdown_seconds, status,
           working_weeks_per_year, shifts_per_day,
           working_days_jan, working_days_feb, working_days_mar, working_days_apr,
           working_days_may, working_days_jun, working_days_jul, working_days_aug,
           working_days_sep, working_days_oct, working_days_nov, working_days_dec
    FROM working_days ORDER BY year
  `).all() as any[];
  res.json(rows.map((r) => mapWorkingDaysListRow(r, defaults)));
});

settingsRouter.get('/visual', (_req, res) => {
  res.json(loadVisualSettings());
});

settingsRouter.get('/behavior', (_req, res) => {
  const row = db.prepare(`SELECT value FROM admin_settings WHERE key = 'volumes_autosave_enabled'`).get() as { value?: string } | undefined;
  const raw = row?.value;
  const volumes_autosave_enabled = raw == null || raw === '' ? true : raw === '1' || raw === 'true';
  res.json({ volumes_autosave_enabled, ocu_enabled: isOcuEnabled() });
});

settingsRouter.put('/behavior', (req, res) => {
  const body = req.body as { volumes_autosave_enabled?: boolean | number | string; ocu_enabled?: boolean | number | string };
  const enabled =
    body.volumes_autosave_enabled === undefined
      ? true
      : body.volumes_autosave_enabled === true || body.volumes_autosave_enabled === 1 || body.volumes_autosave_enabled === '1';
  db.prepare('INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    'volumes_autosave_enabled',
    enabled ? '1' : '0'
  );
  if (body.ocu_enabled !== undefined) {
    const ocu = body.ocu_enabled === true || body.ocu_enabled === 1 || body.ocu_enabled === '1';
    db.prepare('INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
      'ocu_enabled',
      ocu ? '1' : '0'
    );
  }
  saveDb();
  res.json({ volumes_autosave_enabled: enabled, ocu_enabled: isOcuEnabled() });
});

settingsRouter.put('/visual', (req, res) => {
  try {
    const body = (req.body ?? {}) as Partial<VisualSettings>;
    saveVisualSettings(body);
    res.json(loadVisualSettings());
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Błąd zapisu ustawień wizualnych' });
  }
});

settingsRouter.get('/defaults', (_req, res) => {
  res.json(getCapacityDefaultTemplate());
});

settingsRouter.put('/defaults', (req, res) => {
  const body = req.body as Partial<ReturnType<typeof getCapacityDefaultTemplate>>;
  saveCapacityDefaultTemplate(body);
  saveDb();
  res.json(getCapacityDefaultTemplate());
});

settingsRouter.get('/ocu', (_req, res) => {
  const defaults = getOcuDefaultTemplate();
  const rows = db.prepare(`
    SELECT id, year, working_days_year, oee_factor, shift_time_seconds, startup_shutdown_seconds, status,
           working_weeks_per_year, shifts_per_day,
           working_days_jan, working_days_feb, working_days_mar, working_days_apr,
           working_days_may, working_days_jun, working_days_jul, working_days_aug,
           working_days_sep, working_days_oct, working_days_nov, working_days_dec
    FROM working_days_ocu ORDER BY year
  `).all() as any[];
  res.json(rows.map((r) => mapWorkingDaysListRow(r, defaults)));
});

settingsRouter.get('/ocu/defaults', (_req, res) => {
  res.json(getOcuDefaultTemplate());
});

settingsRouter.put('/ocu/defaults', (req, res) => {
  const body = req.body as Partial<ReturnType<typeof getOcuDefaultTemplate>>;
  saveOcuDefaultTemplate(body);
  saveDb();
  res.json(getOcuDefaultTemplate());
});

settingsRouter.get('/ocu/:id(\\d+)', (req, res) => {
  const row = db.prepare('SELECT * FROM working_days_ocu WHERE id = ?').get(Number(req.params.id)) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(mapWorkingDaysListRow(row, getOcuDefaultTemplate()));
});

settingsRouter.post('/ocu', (req, res) => {
  const body = req.body as any;
  const year = Number(body.year);
  if (!Number.isFinite(year)) return res.status(400).json({ error: 'year is required' });
  const overrides = parseOverrideFields(body);
  const status = body.status === 'inactive' ? 'inactive' : 'active';
  const months: number[] = body.months ?? Array(12).fill(0);

  const existing = db.prepare('SELECT id FROM working_days_ocu WHERE year = ?').get(year);
  if (existing) return res.status(400).json({ error: 'Year already exists' });

  db.prepare(`
    INSERT INTO working_days_ocu (year, working_days_year, oee_factor, shift_time_seconds, startup_shutdown_seconds, status,
      working_weeks_per_year, shifts_per_day,
      working_days_jan, working_days_feb, working_days_mar, working_days_apr,
      working_days_may, working_days_jun, working_days_jul, working_days_aug,
      working_days_sep, working_days_oct, working_days_nov, working_days_dec)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    year,
    overrides.working_days_year,
    overrides.oee_factor,
    overrides.shift_time_seconds,
    overrides.startup_shutdown_seconds,
    status,
    overrides.working_weeks_per_year,
    overrides.shifts_per_day,
    months[0] ?? 0,
    months[1] ?? 0,
    months[2] ?? 0,
    months[3] ?? 0,
    months[4] ?? 0,
    months[5] ?? 0,
    months[6] ?? 0,
    months[7] ?? 0,
    months[8] ?? 0,
    months[9] ?? 0,
    months[10] ?? 0,
    months[11] ?? 0
  );
  const row = db.prepare('SELECT * FROM working_days_ocu WHERE year = ?').get(year) as any;
  saveDb();
  res.status(201).json(mapWorkingDaysListRow(row, getOcuDefaultTemplate()));
});

settingsRouter.put('/ocu/:id(\\d+)', (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as any;
  const row = db.prepare('SELECT * FROM working_days_ocu WHERE id = ?').get(id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });

  const overrides = parseOverrideFields(body, row);
  const status = body.status === 'inactive' ? 'inactive' : 'active';
  const months = body.months ?? [
    row.working_days_jan, row.working_days_feb, row.working_days_mar, row.working_days_apr,
    row.working_days_may, row.working_days_jun, row.working_days_jul, row.working_days_aug,
    row.working_days_sep, row.working_days_oct, row.working_days_nov, row.working_days_dec,
  ];

  db.prepare(`
    UPDATE working_days_ocu SET
      working_days_year = ?, oee_factor = ?, shift_time_seconds = ?, startup_shutdown_seconds = ?,
      working_weeks_per_year = ?, shifts_per_day = ?, status = ?,
      working_days_jan = ?, working_days_feb = ?, working_days_mar = ?, working_days_apr = ?,
      working_days_may = ?, working_days_jun = ?, working_days_jul = ?, working_days_aug = ?,
      working_days_sep = ?, working_days_oct = ?, working_days_nov = ?, working_days_dec = ?
    WHERE id = ?
  `).run(
    overrides.working_days_year,
    overrides.oee_factor,
    overrides.shift_time_seconds,
    overrides.startup_shutdown_seconds,
    overrides.working_weeks_per_year,
    overrides.shifts_per_day,
    status,
    months[0] ?? 0,
    months[1] ?? 0,
    months[2] ?? 0,
    months[3] ?? 0,
    months[4] ?? 0,
    months[5] ?? 0,
    months[6] ?? 0,
    months[7] ?? 0,
    months[8] ?? 0,
    months[9] ?? 0,
    months[10] ?? 0,
    months[11] ?? 0,
    id
  );

  const updated = db.prepare('SELECT * FROM working_days_ocu WHERE id = ?').get(id) as any;
  saveDb();
  res.json(mapWorkingDaysListRow(updated, getOcuDefaultTemplate()));
});

settingsRouter.delete('/ocu/:id(\\d+)', (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('DELETE FROM working_days_ocu WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  saveDb();
  res.status(204).send();
});

// Użyj dopasowania tylko liczbowego ID, żeby /phases i /designations nie trafiały tutaj
settingsRouter.get('/:id(\\d+)', (req, res) => {
  const row = db.prepare('SELECT * FROM working_days WHERE id = ?').get(Number(req.params.id)) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(mapWorkingDaysListRow(row, getCapacityDefaultTemplate()));
});

settingsRouter.post('/from-months', (req, res) => {
  const months = req.body.months as number[];
  if (!Array.isArray(months) || months.length !== 12) {
    return res.status(400).json({ error: 'months must be array of 12 numbers' });
  }
  const total = months.reduce((a, b) => a + b, 0);
  res.json({ working_days_year: total });
});

const monthCols = ['working_days_jan', 'working_days_feb', 'working_days_mar', 'working_days_apr',
  'working_days_may', 'working_days_jun', 'working_days_jul', 'working_days_aug',
  'working_days_sep', 'working_days_oct', 'working_days_nov', 'working_days_dec'] as const;

settingsRouter.post('/', (req, res) => {
  const body = req.body as any;
  const year = Number(body.year);
  if (!Number.isFinite(year)) return res.status(400).json({ error: 'year is required' });
  const overrides = parseOverrideFields(body);
  const status = body.status === 'inactive' ? 'inactive' : 'active';
  const months: number[] = body.months ?? Array(12).fill(0);

  const existing = db.prepare('SELECT id FROM working_days WHERE year = ?').get(year);
  if (existing) return res.status(400).json({ error: 'Year already exists' });

  const stmt = db.prepare(`
    INSERT INTO working_days (year, working_days_year, oee_factor, shift_time_seconds, startup_shutdown_seconds, status,
      working_weeks_per_year, shifts_per_day,
      working_days_jan, working_days_feb, working_days_mar, working_days_apr,
      working_days_may, working_days_jun, working_days_jul, working_days_aug,
      working_days_sep, working_days_oct, working_days_nov, working_days_dec)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    year,
    overrides.working_days_year,
    overrides.oee_factor,
    overrides.shift_time_seconds,
    overrides.startup_shutdown_seconds,
    status,
    overrides.working_weeks_per_year,
    overrides.shifts_per_day,
    months[0] ?? 0,
    months[1] ?? 0,
    months[2] ?? 0,
    months[3] ?? 0,
    months[4] ?? 0,
    months[5] ?? 0,
    months[6] ?? 0,
    months[7] ?? 0,
    months[8] ?? 0,
    months[9] ?? 0,
    months[10] ?? 0,
    months[11] ?? 0
  );
  const row = db.prepare('SELECT * FROM working_days WHERE year = ?').get(year) as any;
  saveDb();
  res.status(201).json(mapWorkingDaysListRow(row, getCapacityDefaultTemplate()));
});

settingsRouter.put('/:id(\\d+)', (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as any;
  const row = db.prepare('SELECT * FROM working_days WHERE id = ?').get(id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });

  const overrides = parseOverrideFields(body, row);
  const status = body.status === 'inactive' ? 'inactive' : 'active';
  const months = body.months ?? [
    row.working_days_jan, row.working_days_feb, row.working_days_mar, row.working_days_apr,
    row.working_days_may, row.working_days_jun, row.working_days_jul, row.working_days_aug,
    row.working_days_sep, row.working_days_oct, row.working_days_nov, row.working_days_dec,
  ];

  db.prepare(`
    UPDATE working_days SET
      working_days_year = ?, oee_factor = ?, shift_time_seconds = ?, startup_shutdown_seconds = ?,
      working_weeks_per_year = ?, shifts_per_day = ?, status = ?,
      working_days_jan = ?, working_days_feb = ?, working_days_mar = ?, working_days_apr = ?,
      working_days_may = ?, working_days_jun = ?, working_days_jul = ?, working_days_aug = ?,
      working_days_sep = ?, working_days_oct = ?, working_days_nov = ?, working_days_dec = ?
    WHERE id = ?
  `).run(
    overrides.working_days_year,
    overrides.oee_factor,
    overrides.shift_time_seconds,
    overrides.startup_shutdown_seconds,
    overrides.working_weeks_per_year,
    overrides.shifts_per_day,
    status,
    months[0] ?? 0,
    months[1] ?? 0,
    months[2] ?? 0,
    months[3] ?? 0,
    months[4] ?? 0,
    months[5] ?? 0,
    months[6] ?? 0,
    months[7] ?? 0,
    months[8] ?? 0,
    months[9] ?? 0,
    months[10] ?? 0,
    months[11] ?? 0,
    id
  );

  const updated = db.prepare('SELECT * FROM working_days WHERE id = ?').get(id) as any;
  saveDb();
  res.json(mapWorkingDaysListRow(updated, getCapacityDefaultTemplate()));
});

settingsRouter.delete('/:id(\\d+)', (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('DELETE FROM working_days WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});
