import { Router } from 'express';
import { db, saveDb } from '../db/connection.js';
import { parseCsvQueryParamSingleOrMulti, parseMachineStatusList, sqlInClause } from '../utils/queryListParams.js';
import {
  resolveOperationVolumeForYear,
  resolveSettingsForYear,
  resolveWeeklyVolumeFromResolved,
  volumeToWeekly,
} from '../services/capacityService.js';
import {
  getEffectiveVolumeForPartScenarioPreferContract,
  parseScenarioSnapshotJson,
  resolveSettingsForScenarioYear,
  scenarioHydratedOperationsForActiveProjects,
  type ScenarioBundle,
} from '../services/scenarioSnapshotService.js';
import { formatDetailSapAliasLabel } from '../utils/detailLabel.js';
import { loadReferenceDisplayMode } from '../utils/referenceDisplayMode.js';
import { normalizeMachineLineLocationOrOne, normalizeMachineLineLocationOptional, normalizeMachineLineLocationStrict } from '../utils/machineLineLocation.js';
import { parseInternalMachineNumber, parseOptionalInternalMachineNumber } from '../utils/internalMachineNumber.js';
import { ensureMachineTypesExist } from '../utils/machineTypes.js';

export const machinesRouter = Router();

/** Tygodniowy wolumen operacji w roku — z ułamkiem SOP/EOP lub logiką ręcznego roku niepełnego. */
function effectiveWeeklyVolumeForOperationYear(
  row: { project_id?: number | null; part_id?: number | null; sop?: string; eop?: string },
  year: number,
  resolved: {
    volume_value: number;
    volume_unit: 'annual' | 'monthly' | 'weekly';
    volume_origin: import('../services/capacityService.js').VolumeEntryOrigin;
    count_after_eop?: boolean;
  },
  settings: Parameters<typeof volumeToWeekly>[2],
  _useContractualVolumes: boolean,
  _scenarioBundle?: ScenarioBundle | null
): number {
  return resolveWeeklyVolumeFromResolved(resolved.volume_value, resolved.volume_unit, settings, {
    sop: row.sop ?? '',
    eop: row.eop ?? '',
    year,
    volume_origin: resolved.volume_origin,
    count_after_eop: resolved.count_after_eop,
    has_project: row.project_id != null,
  }).weekly;
}

/** Słownik typów + wartości występujące na maszynach (np. po imporcie). */
function mergedMachineTypeNames(): string[] {
  const catalogRows = db.prepare('SELECT name FROM machine_types ORDER BY name COLLATE NOCASE').all() as { name: string }[];
  const usedRows = db
    .prepare(`SELECT DISTINCT TRIM(type) AS t FROM machines WHERE type IS NOT NULL AND TRIM(type) != ''`)
    .all() as { t: string }[];
  const set = new Set<string>();
  for (const r of catalogRows) set.add(r.name);
  for (const r of usedRows) set.add(r.t);
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
}

function machineTypeCatalogHasEntries(): boolean {
  const row = db.prepare('SELECT 1 AS x FROM machine_types LIMIT 1').get() as { x: number } | undefined;
  return !!row;
}

function machineTypeIsInCatalog(type: string): boolean {
  const t = String(type ?? '').trim();
  if (!t) return false;
  const row = db.prepare('SELECT 1 FROM machine_types WHERE TRIM(name) = ? COLLATE NOCASE LIMIT 1').get(t);
  return !!row;
}

function machineTypeValidationError(type: string): string | null {
  if (!machineTypeCatalogHasEntries()) return null;
  if (machineTypeIsInCatalog(type)) return null;
  return 'Typ maszyny musi być jednym z typów zdefiniowanych w Administracja → Ustawienia bazy → Typy maszyn.';
}

/** Clamp value to 0..1 and round to one decimal (0.1 step). */
function clampMachineUsage(v: unknown): number {
  const n = Number(v);
  if (Number.isNaN(n)) return 1;
  const clamped = Math.max(0, Math.min(1, n));
  return Math.round(clamped * 10) / 10;
}

function normalizeMachineStatus(raw: unknown, fallback: 'active' | 'inactive' | 'RFQ' = 'active'): 'active' | 'inactive' | 'RFQ' {
  const s = String(raw ?? fallback).trim().toLowerCase();
  if (s === 'inactive') return 'inactive';
  if (s === 'rfq') return 'RFQ';
  return 'active';
}

function parseOptionalDimension(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return n;
}

const MACHINE_DIMENSION_COLS = 'width_mm, depth_mm, height_mm, stroke_mm';

machinesRouter.get('/', (req, res) => {
  const statuses = parseMachineStatusList(req.query.status, req.query.statuses);
  const types = parseCsvQueryParamSingleOrMulti(req.query.type, req.query.types);
  const search = (req.query.search as string)?.trim();

  let sql = `SELECT id, internal_number, sap_number, type, oee_override, status, location, COALESCE(machine_usage, 1) AS machine_usage, ${MACHINE_DIMENSION_COLS} FROM machines WHERE 1=1`;
  const params: (string | number)[] = [];

  if (statuses.length === 1) {
    sql += ' AND status = ?';
    params.push(statuses[0]);
  } else if (statuses.length > 1) {
    const statusIn = sqlInClause(statuses, 'status');
    sql += ` AND ${statusIn.clause}`;
    params.push(...statusIn.params);
  }
  if (types.length === 1) {
    sql += ' AND type = ?';
    params.push(types[0]);
  } else if (types.length > 1) {
    const typeIn = sqlInClause(types, 'type');
    sql += ` AND ${typeIn.clause}`;
    params.push(...typeIn.params);
  }
  if (search) {
    sql += ' AND (CAST(internal_number AS TEXT) LIKE ? OR sap_number LIKE ? OR type LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  sql += ' ORDER BY internal_number';

  const list = db.prepare(sql).all(...params);
  res.json(list);
});

machinesRouter.get('/types', (_req, res) => {
  res.json(mergedMachineTypeNames());
});

/** Operacje na maszynie powiązane z projektami w statusie „active” — liczba + lista projektów (UI ostrzeżenia). */
machinesRouter.get('/:id/active-project-operation-count', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  const exists = db.prepare('SELECT 1 FROM machines WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ error: 'Not found' });
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM operations o
       INNER JOIN projects p ON p.id = o.project_id
       WHERE o.machine_id = ? AND p.status = 'active'`
    )
    .get(id) as { c: number };
  const projects = db
    .prepare(
      `SELECT DISTINCT p.id, p.client, p.name
       FROM operations o
       INNER JOIN projects p ON p.id = o.project_id
       WHERE o.machine_id = ? AND p.status = 'active'
       ORDER BY p.client COLLATE NOCASE, p.name COLLATE NOCASE`
    )
    .all(id) as { id: number; client: string; name: string }[];
  res.json({ count: Number(row?.c ?? 0), projects });
});

machinesRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const machine = db.prepare(`
    SELECT id, internal_number, sap_number, type, oee_override, status, location, COALESCE(machine_usage, 1) AS machine_usage, ${MACHINE_DIMENSION_COLS}
    FROM machines WHERE id = ?
  `).get(id) as any;
  if (!machine) return res.status(404).json({ error: 'Not found' });

  const alternatives = db.prepare(`
    SELECT m.id, m.internal_number, m.sap_number, m.type
    FROM machine_alternatives a
    JOIN machines m ON m.id = a.alternative_machine_id
    WHERE a.machine_id = ?
  `).all(id) as any[];

  const projects = db.prepare(`
    SELECT DISTINCT p.id, p.client, p.name, p.status
    FROM projects p
    JOIN operations o ON o.project_id = p.id
    WHERE o.machine_id = ?
  `).all(id) as any[];

  res.json({
    ...machine,
    machine_usage: machine.machine_usage != null ? Number(machine.machine_usage) : 1,
    alternatives,
    projects,
  });
});

machinesRouter.get('/:id/operations', (req, res) => {
  const refMode = loadReferenceDisplayMode();
  const id = Number(req.params.id);
  const yearQ = req.query.year != null ? Number(req.query.year) : NaN;
  const year = Number.isFinite(yearQ) ? yearQ : null;
  const useContractualVolumes =
    req.query.useContractualVolumes === '1' || String(req.query.useContractualVolumes ?? '').toLowerCase() === 'true';
  const scenarioIdQ = req.query.scenarioId != null ? Number(req.query.scenarioId) : NaN;
  if (Number.isFinite(scenarioIdQ) && scenarioIdQ > 0) {
    const snapRow = db.prepare('SELECT snapshot, archived_at FROM scenarios WHERE id = ?').get(scenarioIdQ) as
      | { snapshot: string; archived_at: string | null }
      | undefined;
    if (!snapRow) return res.status(404).json({ error: 'Scenariusz nie znaleziony' });
    const bundle = parseScenarioSnapshotJson(snapRow.snapshot);
    const archived = snapRow.archived_at != null && String(snapRow.archived_at).trim() !== '';
    const hydrated = scenarioHydratedOperationsForActiveProjects(bundle, { includeRfq: !archived });
    const list = hydrated
      .filter((o: any) => Number(o.machine_id) === id)
      .map((o: any) => {
        const ph = db.prepare('SELECT name FROM process_phases WHERE id = ?').get(o.phase_id) as { name: string } | undefined;
        const p = (bundle.projects || []).find((pr: any) => Number(pr.id) === Number(o.project_id));
        return {
          id: o.id,
          project_id: o.project_id,
          part_id: o.part_id,
          phase_id: o.phase_id,
          cycle_time_seconds: o.cycle_time_seconds,
          nests_count: o.nests_count,
          oee_override: o.oee_override,
          alt_cycle_time_seconds: o.alt_cycle_time_seconds ?? null,
          alt_nests_count: o.alt_nests_count ?? null,
          alt_oee_override: o.alt_oee_override ?? null,
          use_alternative_in_calculator: o.use_alternative_in_calculator ?? 0,
          volume_value: o.volume_value,
          volume_unit: o.volume_unit,
          phase_name: ph?.name ?? '',
          detail_sap_number: o.detail_sap_number ?? null,
          detail_alias: o.detail_alias ?? null,
          detail_free_text: o.detail_free_text ?? null,
          detail_designation: o.detail_designation ?? null,
          project_name: p?.name ?? '',
          client: p?.client ?? '',
          sop: p?.sop ?? '',
          eop: p?.eop ?? '',
        };
      })
      .sort((a: any, b: any) => Number(a.id) - Number(b.id)) as any[];
    for (const row of list) {
      row.part_designation = formatDetailSapAliasLabel(
        {
          sap_number: row.detail_sap_number,
          alias: row.detail_alias,
          free_text: row.detail_free_text,
          designation: row.detail_designation,
          id: row.part_id,
        },
        refMode
      );
    }
    if (year != null) {
      const settings = resolveSettingsForScenarioYear(year, bundle) ?? resolveSettingsForYear(year);
      const ov = bundle.operation_volume_by_year || [];
      for (const row of list) {
        const opYear = ov.find((v: any) => Number(v.operation_id) === Number(row.id) && Number(v.year) === year) as
          | { volume_value: number; volume_unit: string }
          | undefined;
        const resolved = resolveOperationVolumeForYear(
          {
            operation_id: row.id,
            project_id: row.project_id,
            part_id: row.part_id,
            volume_value: row.volume_value,
            volume_unit: row.volume_unit,
            split_from_operation_id: row.split_from_operation_id,
          },
          year,
          opYear ?? null,
          bundle,
          useContractualVolumes
        );
        row.effective_volume_value = resolved.volume_value;
        row.effective_volume_unit = resolved.volume_unit;
        row.effective_volume_source = resolved.source;
        row.effective_volume_weekly = effectiveWeeklyVolumeForOperationYear(
          row,
          year,
          resolved,
          settings,
          useContractualVolumes,
          bundle
        );
      }
    }
    return res.json(list);
  }

  const list = db.prepare(`
    SELECT o.id, o.project_id, o.part_id, o.phase_id, o.cycle_time_seconds, o.nests_count, o.oee_override,
           o.split_from_operation_id,
           o.alt_cycle_time_seconds, o.alt_nests_count, o.alt_oee_override, o.use_alternative_in_calculator,
           o.volume_value, o.volume_unit,
           ph.name AS phase_name,
           pd.sap_number AS detail_sap_number, pd.alias AS detail_alias, pd.free_text AS detail_free_text,
           pt.designation AS detail_designation,
           p.name AS project_name, p.client, p.sop, p.eop
    FROM operations o
    JOIN process_phases ph ON ph.id = o.phase_id
    JOIN parts pt ON pt.id = o.part_id
    LEFT JOIN part_designations pd ON pd.id = pt.designation_id
    JOIN projects p ON p.id = o.project_id
    WHERE o.machine_id = ?
    ORDER BY o.id
  `).all(id) as any[];
  for (const row of list) {
    row.part_designation = formatDetailSapAliasLabel(
      {
        sap_number: row.detail_sap_number,
        alias: row.detail_alias,
        free_text: row.detail_free_text,
        designation: row.detail_designation,
        id: row.part_id,
      },
      refMode
    );
  }
  if (year != null) {
    const settings = resolveSettingsForYear(year);
    const opYearStmt = db.prepare(
      'SELECT volume_value, volume_unit FROM operation_volume_by_year WHERE operation_id = ? AND year = ?'
    );
    for (const row of list) {
      const opYear = opYearStmt.get(row.id, year) as { volume_value: number; volume_unit: string } | undefined;
      const resolved = resolveOperationVolumeForYear(
        {
          operation_id: row.id,
          project_id: row.project_id,
          part_id: row.part_id,
          volume_value: row.volume_value,
          volume_unit: row.volume_unit,
          split_from_operation_id: row.split_from_operation_id,
        },
        year,
        opYear ?? null,
        null,
        useContractualVolumes
      );
      row.effective_volume_value = resolved.volume_value;
      row.effective_volume_unit = resolved.volume_unit;
      row.effective_volume_source = resolved.source;
      row.effective_volume_weekly = effectiveWeeklyVolumeForOperationYear(row, year, resolved, settings, useContractualVolumes);
    }
  }
  res.json(list);
});

machinesRouter.post('/', (req, res) => {
  const body = req.body as any;
  const internalParsed = parseOptionalInternalMachineNumber(body.internal_number);
  if (!internalParsed.ok) return res.status(400).json({ error: internalParsed.error });
  const internal_number = internalParsed.value;
  const sap_number_raw = body.sap_number != null ? String(body.sap_number).trim() : '';
  if (!sap_number_raw) return res.status(400).json({ error: 'sap_number is required' });
  const sap_number = sap_number_raw;
  const type = String(body.type ?? '').trim();
  const oee_override = body.oee_override != null ? Number(body.oee_override) : null;
  const status = normalizeMachineStatus(body.status, 'active');
  const locRes = normalizeMachineLineLocationStrict(body.location);
  if (!locRes.ok) return res.status(400).json({ error: locRes.error });
  const location = locRes.value;
  const machine_usage = body.machine_usage !== undefined ? clampMachineUsage(body.machine_usage) : 1;
  const width_mm = parseOptionalDimension(body.width_mm) ?? null;
  const depth_mm = parseOptionalDimension(body.depth_mm) ?? null;
  const height_mm = parseOptionalDimension(body.height_mm) ?? null;
  const stroke_mm = parseOptionalDimension(body.stroke_mm) ?? null;
  if (!type) return res.status(400).json({ error: 'type is required' });
  const typeErr = machineTypeValidationError(type);
  if (typeErr) return res.status(400).json({ error: typeErr });

  if (internal_number != null) {
    const existing = db.prepare('SELECT id FROM machines WHERE internal_number = ?').get(internal_number);
    if (existing) return res.status(400).json({ error: 'Machine number already exists' });
  }

  db.prepare(`
    INSERT INTO machines (internal_number, sap_number, type, oee_override, status, location, machine_usage, width_mm, depth_mm, height_mm, stroke_mm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(internal_number, sap_number, type, oee_override, status, location, machine_usage, width_mm, depth_mm, height_mm, stroke_mm);
  const lastId = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
  const row = db.prepare('SELECT * FROM machines WHERE id = ?').get(lastId.id) as any;
  res.status(201).json(row);
});

/** Bulk import: body { machines: [{ internal_number, sap_number?, type, status?, location?, oee_override? }] } */
machinesRouter.post('/import', (req, res) => {
  const body = req.body as { machines: any[] };
  const list = Array.isArray(body?.machines) ? body.machines : [];
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  const insertStmt = db.prepare(`
    INSERT INTO machines (internal_number, sap_number, type, oee_override, status, location, machine_usage, width_mm, depth_mm, height_mm, stroke_mm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const typesToEnsure = list
    .map((row) => (row?.type != null ? String(row.type).trim() : ''))
    .filter(Boolean);
  const typesAdded = ensureMachineTypesExist(typesToEnsure);

  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const internalParsed = parseInternalMachineNumber(row?.internal_number);
    if (!internalParsed.ok) {
      errors.push(`Wiersz ${i + 1}: ${internalParsed.error}`);
      continue;
    }
    const internal_number = internalParsed.value;
    const sap_number = row.sap_number != null ? String(row.sap_number).trim() || null : null;
    const type = row.type != null ? String(row.type).trim() : '';
    if (!type) {
      errors.push(`Wiersz ${i + 1} (nr ${internal_number}): brak typu`);
      continue;
    }
    const status = normalizeMachineStatus(row.status, 'active');
    const location = normalizeMachineLineLocationOrOne(row.location);
    const oee_override = row.oee_override != null && row.oee_override !== '' ? Number(row.oee_override) : null;
    const machine_usage = row.machine_usage !== undefined ? clampMachineUsage(row.machine_usage) : 1;
    const width_mm = parseOptionalDimension(row.width_mm) ?? null;
    const depth_mm = parseOptionalDimension(row.depth_mm) ?? null;
    const height_mm = parseOptionalDimension(row.height_mm) ?? null;
    const stroke_mm = parseOptionalDimension(row.stroke_mm) ?? null;

    const existing = db.prepare('SELECT id FROM machines WHERE internal_number = ?').get(internal_number);
    if (existing) {
      skipped.push(internal_number);
      continue;
    }
    try {
      insertStmt.run(internal_number, sap_number, type, oee_override, status, location, machine_usage, width_mm, depth_mm, height_mm, stroke_mm);
      created.push(internal_number);
    } catch (e: any) {
      errors.push(`Wiersz ${i + 1} (nr ${internal_number}): ${e.message || 'błąd zapisu'}`);
    }
  }

  if (created.length > 0 || typesAdded.length > 0) saveDb();
  res.json({
    created: created.length,
    skipped: skipped.length,
    types_added: typesAdded.length,
    types_added_names: typesAdded,
    errors,
    createdNumbers: created,
    skippedNumbers: skipped,
  });
});

machinesRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as any;
  const row = db.prepare('SELECT * FROM machines WHERE id = ?').get(id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });

  let internal_number: string | null = row.internal_number != null ? String(row.internal_number) : null;
  if (body.internal_number !== undefined) {
    const parsed = parseOptionalInternalMachineNumber(body.internal_number);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    if (parsed.value != null) {
      const other = db.prepare('SELECT id FROM machines WHERE internal_number = ? AND id != ?').get(parsed.value, id);
      if (other) return res.status(400).json({ error: 'Machine number already exists' });
    }
    internal_number = parsed.value;
  }

  const sap_number = body.sap_number !== undefined ? body.sap_number : row.sap_number;
  const type = body.type !== undefined ? String(body.type).trim() : row.type;
  if (body.type !== undefined) {
    const typeErrPut = machineTypeValidationError(type);
    if (typeErrPut) return res.status(400).json({ error: typeErrPut });
  }
  const oee_override = body.oee_override !== undefined ? (body.oee_override == null ? null : Number(body.oee_override)) : row.oee_override;
  const status = body.status !== undefined ? normalizeMachineStatus(body.status) : normalizeMachineStatus(row.status, 'active');
  let location = row.location;
  if (body.location !== undefined) {
    const locRes = normalizeMachineLineLocationOptional(body.location);
    if (!locRes.ok) return res.status(400).json({ error: locRes.error });
    location = locRes.value;
  }
  const machine_usage = body.machine_usage !== undefined ? clampMachineUsage(body.machine_usage) : (row.machine_usage != null ? clampMachineUsage(row.machine_usage) : 1);
  const width_mm = body.width_mm !== undefined ? parseOptionalDimension(body.width_mm) ?? null : row.width_mm;
  const depth_mm = body.depth_mm !== undefined ? parseOptionalDimension(body.depth_mm) ?? null : row.depth_mm;
  const height_mm = body.height_mm !== undefined ? parseOptionalDimension(body.height_mm) ?? null : row.height_mm;
  const stroke_mm = body.stroke_mm !== undefined ? parseOptionalDimension(body.stroke_mm) ?? null : row.stroke_mm;

  try {
    db.prepare(`
      UPDATE machines SET internal_number = ?, sap_number = ?, type = ?, oee_override = ?, status = ?, location = ?, machine_usage = ?,
        width_mm = ?, depth_mm = ?, height_mm = ?, stroke_mm = ? WHERE id = ?
    `).run(internal_number, sap_number, type, oee_override, status, location, machine_usage, width_mm, depth_mm, height_mm, stroke_mm, id);
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE') || e?.message?.includes('unique')) return res.status(400).json({ error: 'Machine number already exists' });
    throw e;
  }
  saveDb();
  const updated = db.prepare(`
    SELECT id, internal_number, sap_number, type, oee_override, status, location, COALESCE(machine_usage, 1) AS machine_usage, ${MACHINE_DIMENSION_COLS}
    FROM machines WHERE id = ?
  `).get(id) as any;
  res.json({ ...updated, machine_usage: updated.machine_usage != null ? Number(updated.machine_usage) : 1 });
});

machinesRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('DELETE FROM machines WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});
