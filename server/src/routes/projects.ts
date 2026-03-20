import { Router } from 'express';
import { db, saveDb } from '../db/connection.js';
import { clearParentAllocationOverridesIfNoChildren, mergeSplitChildVolumesIntoParent } from '../services/allocationService.js';

export const projectsRouter = Router();

/** Normalizuje datę do formatu MM.YYYY (np. "2035-06" → "6.2035", "2030-6" → "6.2030", "6.2035" → bez zmian). */
function normalizeEopToMmYyyy(value: string): string {
  const v = value.trim();
  const dotMatch = v.match(/^(\d{1,2})\.(\d{4})$/);
  if (dotMatch) return `${parseInt(dotMatch[1], 10)}.${dotMatch[2]}`;
  const dashMatch = v.match(/^(\d{4})-(\d{1,2})$/);
  if (dashMatch) return `${parseInt(dashMatch[2], 10)}.${dashMatch[1]}`;
  return v;
}

/** Zwraca listę lat z zakresu SOP–EOP (format MM.YYYY) oraz rok z EOP (do usunięcia wolumenów poza zakresem). */
function getSopEopYears(sop: string, eop: string): { years: number[]; eopYear: number } {
  const sopM = String(sop || '').trim().match(/^(\d{1,2})\.(\d{4})$/);
  const eopM = String(eop || '').trim().match(/^(\d{1,2})\.(\d{4})$/);
  const sopYear = sopM ? parseInt(sopM[2], 10) : null;
  const eopYear = eopM ? parseInt(eopM[2], 10) : null;
  if (sopYear == null || eopYear == null || eopYear < sopYear) return { years: [], eopYear: eopYear ?? 0 };
  const years: number[] = [];
  for (let y = sopYear; y <= eopYear; y++) years.push(y);
  return { years, eopYear };
}

/** Synchronizuje project_volumes z zakresem SOP–EOP: dodaje brakujące lata (0, annual), usuwa lata > eopYear. */
function syncProjectVolumesToSopEop(projectId: number, sop: string, eop: string): void {
  const { years, eopYear } = getSopEopYears(sop, eop);
  const existing = db.prepare('SELECT year FROM project_volumes WHERE project_id = ?').all(projectId) as { year: number }[];
  const existingSet = new Set(existing.map((r) => r.year));
  const toAdd = years.filter((y) => !existingSet.has(y));
  const toDelete = existing.filter((r) => r.year > eopYear).map((r) => r.year);
  const delStmt = db.prepare('DELETE FROM project_volumes WHERE project_id = ? AND year = ?');
  for (const y of toDelete) delStmt.run(projectId, y);
  try {
    const ins = db.prepare('INSERT INTO project_volumes (project_id, year, volume_value, volume_unit, include_in_calculator_after_eop) VALUES (?, ?, ?, ?, ?)');
    for (const y of toAdd) ins.run(projectId, y, 0, 'annual', 0);
  } catch (_) {
    const ins = db.prepare('INSERT INTO project_volumes (project_id, year, volume_value, volume_unit) VALUES (?, ?, 0, ?)');
    for (const y of toAdd) ins.run(projectId, y, 'annual');
  }
}

projectsRouter.get('/', (req, res) => {
  const status = req.query.status as string | undefined;
  const client = req.query.client as string | undefined;
  const search = (req.query.search as string)?.trim();

  let sql = `
    SELECT p.id, p.client, p.name, p.sop, p.eop, p.status
    FROM projects p
    WHERE 1=1
  `;
  const params: (string | number)[] = [];
  if (status === 'inactive') {
    sql += ' AND p.status = ?'; params.push('inactive');
  } else if (status === 'RFQ') {
    sql += ' AND p.status = ?'; params.push('RFQ');
  } else if (status === 'active') {
    sql += ' AND p.status = ?'; params.push('active');
  }
  /* status === 'all' lub brak parametru: nie filtruj po statusie */
  if (client && client !== 'Wszyscy' && client !== '') {
    sql += ' AND p.client = ?'; params.push(client);
  }
  if (search) {
    sql += ' AND (p.client LIKE ? OR p.name LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q);
  }
  sql += ' ORDER BY p.client, p.name';

  const list = db.prepare(sql).all(...params) as any[];
  const withMeta = list.map((p) => {
    const machineRows = db.prepare(`
      SELECT DISTINCT m.id AS machine_id, m.internal_number, m.sap_number
      FROM operations o
      JOIN machines m ON m.id = o.machine_id
      WHERE o.project_id = ?
      ORDER BY m.internal_number
    `).all(p.id) as { machine_id: number; internal_number: number; sap_number: string | null }[];
    const partIds = db.prepare('SELECT id, designation FROM parts WHERE project_id = ?').all(p.id) as any[];
    return {
      ...p,
      machines: machineRows,
      parts: partIds,
    };
  });
  res.json(withMeta);
});

projectsRouter.get('/clients', (_req, res) => {
  const rows = db.prepare('SELECT DISTINCT client FROM projects ORDER BY client').all() as { client: string }[];
  res.json(rows.map((r) => r.client));
});

projectsRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!project) return res.status(404).json({ error: 'Not found' });

  const parts = db.prepare(`
    SELECT pt.*, pd.sap_number AS detail_sap_number, pd.alias AS detail_alias, pd.free_text AS detail_free_text
    FROM parts pt
    LEFT JOIN part_designations pd ON pd.id = pt.designation_id
    WHERE pt.project_id = ?
  `).all(id) as any[];
  let projectVolumes: { year: number; volume_value: number; volume_unit: string; include_in_calculator_after_eop?: number }[] = [];
  try {
    projectVolumes = db.prepare('SELECT year, volume_value, volume_unit, COALESCE(include_in_calculator_after_eop, 0) AS include_in_calculator_after_eop FROM project_volumes WHERE project_id = ? ORDER BY year').all(id) as any[];
  } catch (_) {}
  const partsWithDetail = parts.map((p: any) => {
    let volume_by_year: { year: number; volume_value: number; volume_unit: string }[] = [];
    let volume_share_by_year: { year: number; share_percent: number }[] = [];
    try {
      volume_by_year = db.prepare('SELECT year, volume_value, volume_unit FROM part_volume_by_year WHERE part_id = ? ORDER BY year').all(p.id) as any[];
    } catch (_) {}
    try {
      volume_share_by_year = db.prepare('SELECT year, share_percent FROM part_volume_share_by_year WHERE part_id = ? ORDER BY year').all(p.id) as any[];
    } catch (_) {}
    return {
      ...p,
      volume_mode: p.volume_mode ?? 'project',
      volume_share_percent: p.volume_share_percent ?? null,
      volume_by_year,
      volume_share_by_year,
      detail: p.designation_id ? { sap_number: p.detail_sap_number, alias: p.detail_alias, free_text: p.detail_free_text } : null,
    };
  });
  const operationsRaw = db.prepare(`
    SELECT o.*, ph.name AS phase_name,
           COALESCE(pd.sap_number, pd.alias, pd.free_text, pt.designation) AS part_designation,
           m.internal_number AS machine_number, m.type AS machine_type
    FROM operations o
    JOIN process_phases ph ON ph.id = o.phase_id
    JOIN parts pt ON pt.id = o.part_id
    LEFT JOIN part_designations pd ON pd.id = pt.designation_id
    JOIN machines m ON m.id = o.machine_id
    WHERE o.project_id = ?
    ORDER BY o.id
  `).all(id) as any[];
  const operations = operationsRaw.map((op: any) => {
    if (op.is_set) {
      try {
        const members = db.prepare(`
          SELECT osm.part_id, osm.quantity_per_set, COALESCE(pd.sap_number, pd.alias, pd.free_text, pt.designation) AS label
          FROM operation_set_members osm
          JOIN parts pt ON pt.id = osm.part_id
          LEFT JOIN part_designations pd ON pd.id = pt.designation_id
          WHERE osm.operation_id = ?
          ORDER BY osm.part_id
        `).all(op.id) as any[];
        op.set_members = members;
        op.part_designation = 'Set: ' + members.map((m: any) => m.label).join(' + ');
      } catch (_) {
        op.set_members = [];
      }
    }
    return op;
  });
  const notes = db.prepare('SELECT * FROM project_notes WHERE project_id = ? ORDER BY note_date DESC').all(id) as any[];
  let eop_extensions: { eop_before: string; eop_after: string; created_at: string }[] = [];
  try {
    eop_extensions = db.prepare('SELECT eop_before, eop_after, created_at FROM project_eop_extensions WHERE project_id = ? ORDER BY created_at ASC').all(id) as any[];
  } catch (_) {}

  res.json({ ...project, project_volumes: projectVolumes, parts: partsWithDetail, operations, notes, eop_extensions });
});

projectsRouter.post('/', (req, res) => {
  const body = req.body as any;
  const client = String(body.client ?? '').trim();
  const name = String(body.name ?? '').trim();
  const sop = String(body.sop ?? '');
  const eop = String(body.eop ?? '');
  const status = body.status === 'RFQ' ? 'RFQ' : body.status === 'inactive' ? 'inactive' : 'active';

  const r = db.prepare('INSERT INTO projects (client, name, sop, eop, status) VALUES (?, ?, ?, ?, ?)')
    .run(client, name, sop, eop, status);
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(r.lastInsertRowid) as any;
  res.status(201).json(row);
});

projectsRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!project) return res.status(404).json({ error: 'Not found' });

  const body = req.body as any;
  const client = body.client !== undefined ? String(body.client).trim() : project.client;
  const name = body.name !== undefined ? String(body.name).trim() : project.name;
  const sop = body.sop !== undefined ? String(body.sop) : project.sop;
  const status = body.status === 'RFQ' ? 'RFQ' : body.status === 'inactive' ? 'inactive' : 'active';

  let eop: string;
  let eop_original: string | null;

  const eopExtensionValue = body.eop_extension !== undefined && body.eop_extension !== '' && body.eop_extension != null ? String(body.eop_extension).trim() : null;
  if (eopExtensionValue) {
    eop = normalizeEopToMmYyyy(eopExtensionValue);
    eop_original = project.eop_original ?? project.eop;
    const noteText = `Przedłużenie EOP: poprzednia data ${project.eop}, nowa data ${eop}`;
    db.prepare('INSERT INTO project_notes (project_id, note_date, author, note) VALUES (?, date(\'now\'), ?, ?)')
      .run(id, null, noteText);
    try {
      db.prepare('INSERT INTO project_eop_extensions (project_id, eop_before, eop_after) VALUES (?, ?, ?)')
        .run(id, project.eop, eop);
    } catch (_) {}
  } else {
    eop = body.eop !== undefined ? String(body.eop) : project.eop;
    eop_original = project.eop_original ?? null;
  }

  db.prepare('UPDATE projects SET client = ?, name = ?, sop = ?, eop = ?, eop_original = ?, status = ? WHERE id = ?')
    .run(client, name, sop, eop, eop_original, status, id);
  if (eopExtensionValue) {
    try {
      syncProjectVolumesToSopEop(id, sop, eop);
    } catch (_) {}
  }
  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  res.json(updated);
});

projectsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

// Parts
projectsRouter.post('/:id/parts', (req, res) => {
  const projectId = Number(req.params.id);
  const body = req.body as any;
  const designation_id = body.designation_id != null ? Number(body.designation_id) : null;
  let designation = String(body.designation ?? '').trim();
  if (designation_id) {
    const detail = db.prepare('SELECT sap_number, alias, free_text, designation FROM part_designations WHERE id = ?').get(designation_id) as any;
    if (detail) designation = detail.sap_number || detail.alias || detail.free_text || detail.designation || designation;
  }
  const side = body.side && ['RH', 'LH'].includes(body.side) ? body.side : null;
  const r = db.prepare('INSERT INTO parts (project_id, designation, side, designation_id) VALUES (?, ?, ?, ?)')
    .run(projectId, designation || '-', side, designation_id);
  const row = db.prepare('SELECT pt.*, pd.sap_number AS detail_sap_number, pd.alias AS detail_alias, pd.free_text AS detail_free_text FROM parts pt LEFT JOIN part_designations pd ON pd.id = pt.designation_id WHERE pt.id = ?').get(r.lastInsertRowid) as any;
  const part = row ? { ...row, detail: row.designation_id ? { sap_number: row.detail_sap_number, alias: row.detail_alias, free_text: row.detail_free_text } : null } : db.prepare('SELECT * FROM parts WHERE id = ?').get(r.lastInsertRowid) as any;
  res.status(201).json(part);
});

projectsRouter.delete('/:projectId/parts/:partId', (req, res) => {
  const partId = Number(req.params.partId);
  const r = db.prepare('DELETE FROM parts WHERE id = ?').run(partId);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

// Project volumes (per year; annual/monthly/weekly)
projectsRouter.get('/:id/volumes', (req, res) => {
  const id = Number(req.params.id);
  const exists = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ error: 'Not found' });
  try {
    const rows = db.prepare('SELECT year, volume_value, volume_unit, COALESCE(include_in_calculator_after_eop, 0) AS include_in_calculator_after_eop FROM project_volumes WHERE project_id = ? ORDER BY year').all(id) as any[];
    res.json(rows);
  } catch (_) {
    res.json([]);
  }
});

projectsRouter.put('/:id/volumes', (req, res) => {
  const id = Number(req.params.id);
  const exists = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ error: 'Not found' });
  const body = req.body as any;
  const volumes = Array.isArray(body.volumes) ? body.volumes : [];
  try {
    db.prepare('DELETE FROM project_volumes WHERE project_id = ?').run(id);
    let rows: any[];
    try {
      const ins = db.prepare('INSERT INTO project_volumes (project_id, year, volume_value, volume_unit, include_in_calculator_after_eop) VALUES (?, ?, ?, ?, ?)');
      for (const v of volumes) {
        const year = Number(v.year);
        const volume_value = Number(v.volume_value);
        const volume_unit = ['annual', 'monthly', 'weekly'].includes(v.volume_unit) ? v.volume_unit : 'annual';
        const include_after_eop = v.include_in_calculator_after_eop === true || v.include_in_calculator_after_eop === 1 ? 1 : 0;
        ins.run(id, year, volume_value, volume_unit, include_after_eop);
      }
      rows = db.prepare('SELECT year, volume_value, volume_unit, COALESCE(include_in_calculator_after_eop, 0) AS include_in_calculator_after_eop FROM project_volumes WHERE project_id = ? ORDER BY year').all(id) as any[];
    } catch (colErr: any) {
      if (colErr?.message?.includes('include_in_calculator_after_eop') || colErr?.message?.includes('no such column')) {
        const ins = db.prepare('INSERT INTO project_volumes (project_id, year, volume_value, volume_unit) VALUES (?, ?, ?, ?)');
        for (const v of volumes) {
          ins.run(id, Number(v.year), Number(v.volume_value), ['annual', 'monthly', 'weekly'].includes(v.volume_unit) ? v.volume_unit : 'annual');
        }
        rows = (db.prepare('SELECT year, volume_value, volume_unit FROM project_volumes WHERE project_id = ? ORDER BY year').all(id) as any[]).map((r: any) => ({ ...r, include_in_calculator_after_eop: 0 }));
      } else {
        throw colErr;
      }
    }
    // Kalkulator stosuje operation_volume_by_year przed wolumenem projektu — po zapisie nowych wolumenów projektu
    // usuń te nadpisania, żeby obciążenie brało się z aktualnej tabeli project_volumes (chyba że są aktywne podziały alokacji).
    try {
      const split = db
        .prepare('SELECT 1 AS x FROM operations WHERE project_id = ? AND split_from_operation_id IS NOT NULL LIMIT 1')
        .get(id) as { x: number } | undefined;
      if (!split) {
        try {
          db.prepare(`
            DELETE FROM operation_volume_by_year
            WHERE operation_id IN (SELECT id FROM operations WHERE project_id = ?)
              AND COALESCE(source, 'manual') = 'allocation'
          `).run(id);
        } catch (_) {
          // Legacy DB without source column: fallback to full cleanup for project.
          db.prepare('DELETE FROM operation_volume_by_year WHERE operation_id IN (SELECT id FROM operations WHERE project_id = ?)').run(id);
        }
      }
    } catch (_) {
      /* brak kolumny split_from_operation_id lub tabeli — pomiń */
    }
    saveDb();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'Failed' });
  }
});

// Part volume mode, share (default + per year) and override per year
projectsRouter.put('/:projectId/parts/:partId', (req, res) => {
  const partId = Number(req.params.partId);
  const body = req.body as any;
  const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(partId) as any;
  if (!part) return res.status(404).json({ error: 'Not found' });
  const designation = body.designation !== undefined ? String(body.designation).trim() : part.designation;
  const side = body.side !== undefined ? (body.side && ['RH', 'LH'].includes(body.side) ? body.side : null) : part.side;
  const volume_mode = body.volume_mode !== undefined && ['project', 'share', 'override'].includes(body.volume_mode) ? body.volume_mode : (part.volume_mode ?? 'project');
  const volume_share_percent = body.volume_share_percent !== undefined ? (body.volume_share_percent == null ? null : Number(body.volume_share_percent)) : (part.volume_share_percent ?? null);
  const default_volume_value = body.default_volume_value !== undefined ? (body.default_volume_value == null || body.default_volume_value === '' ? null : Number(body.default_volume_value)) : (part.default_volume_value ?? null);
  const default_volume_unit = body.default_volume_unit !== undefined ? (['annual', 'monthly', 'weekly'].includes(body.default_volume_unit) ? body.default_volume_unit : null) : (part.default_volume_unit ?? null);
  try {
    db.prepare('UPDATE parts SET designation = ?, side = ?, volume_mode = ?, volume_share_percent = ?, default_volume_value = ?, default_volume_unit = ? WHERE id = ?')
      .run(designation, side, volume_mode, volume_share_percent, default_volume_value, default_volume_unit, partId);
  } catch (_) {
    try {
      db.prepare('UPDATE parts SET designation = ?, side = ?, volume_mode = ?, volume_share_percent = ? WHERE id = ?')
        .run(designation, side, volume_mode, volume_share_percent, partId);
    } catch (__) {
      db.prepare('UPDATE parts SET designation = ?, side = ? WHERE id = ?').run(designation, side, partId);
    }
  }
  if (Array.isArray(body.volume_share_by_year)) {
    try {
      db.prepare('DELETE FROM part_volume_share_by_year WHERE part_id = ?').run(partId);
      const ins = db.prepare('INSERT INTO part_volume_share_by_year (part_id, year, share_percent) VALUES (?, ?, ?)');
      for (const row of body.volume_share_by_year) {
        const year = Number(row.year);
        const share_percent = Number(row.share_percent);
        if (!Number.isInteger(year) || isNaN(share_percent)) continue;
        ins.run(partId, year, Math.max(0, Math.min(100, share_percent)));
      }
    } catch (_) {}
  }
  const updated = db.prepare('SELECT * FROM parts WHERE id = ?').get(partId) as any;
  res.json(updated);
});

projectsRouter.get('/:projectId/parts/:partId/volumes', (req, res) => {
  const partId = Number(req.params.partId);
  const part = db.prepare('SELECT 1 FROM parts WHERE id = ?').get(partId);
  if (!part) return res.status(404).json({ error: 'Not found' });
  try {
    const rows = db.prepare('SELECT year, volume_value, volume_unit FROM part_volume_by_year WHERE part_id = ? ORDER BY year').all(partId) as any[];
    res.json(rows);
  } catch (_) {
    res.json([]);
  }
});

projectsRouter.put('/:projectId/parts/:partId/volumes', (req, res) => {
  const partId = Number(req.params.partId);
  const part = db.prepare('SELECT 1 FROM parts WHERE id = ?').get(partId);
  if (!part) return res.status(404).json({ error: 'Not found' });
  const body = req.body as any;
  const volumes = Array.isArray(body.volumes) ? body.volumes : [];
  try {
    db.prepare('DELETE FROM part_volume_by_year WHERE part_id = ?').run(partId);
    const ins = db.prepare('INSERT INTO part_volume_by_year (part_id, year, volume_value, volume_unit) VALUES (?, ?, ?, ?)');
    for (const v of volumes) {
      const year = Number(v.year);
      const volume_value = Number(v.volume_value);
      const volume_unit = ['annual', 'monthly', 'weekly'].includes(v.volume_unit) ? v.volume_unit : 'annual';
      ins.run(partId, year, volume_value, volume_unit);
    }
    const rows = db.prepare('SELECT year, volume_value, volume_unit FROM part_volume_by_year WHERE part_id = ? ORDER BY year').all(partId) as any[];
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'Failed' });
  }
});

// Operations - validate sum of capacity_percent per machine (musi być 100% w ramach projektu na danej maszynie)
function checkCapacityPercent(machineId: number, projectId: number, excludeOpId: number | null): void {
  let sql = `
    SELECT SUM(capacity_percent) AS total FROM operations WHERE machine_id = ? AND project_id = ?
  `;
  const params: (number | null)[] = [machineId, projectId];
  if (excludeOpId != null) {
    sql += ' AND id != ?';
    params.push(excludeOpId);
  }
  const row = db.prepare(sql).get(...params) as { total: number };
  const total = row?.total ?? 0;
  if (total > 0 && Math.abs(total - 100) > 0.01) {
    throw new Error(`Suma procentów capacity dla maszyny musi wynosić 100% (obecnie ${Math.round(total)}%)`);
  }
}

/** Przy dodawaniu operacji: jeśli suma (istniejące + nowa) przekraczałaby 100%, równo rozdziel procenty między wszystkie operacje na tej maszynie w projekcie. */
function rebalanceCapacityPercentOnInsert(machineId: number, projectId: number, newOpCapacityPercent: number): number {
  const existing = db.prepare('SELECT id, capacity_percent FROM operations WHERE machine_id = ? AND project_id = ?').all(machineId, projectId) as { id: number; capacity_percent: number }[];
  const currentSum = existing.reduce((s, r) => s + r.capacity_percent, 0);
  const wouldBeTotal = currentSum + newOpCapacityPercent;
  if (Math.abs(wouldBeTotal - 100) <= 0.01) return newOpCapacityPercent;
  if (wouldBeTotal <= 100) return newOpCapacityPercent;
  const n = existing.length + 1;
  const perOp = Math.round((100 / n) * 100) / 100;
  db.prepare('UPDATE operations SET capacity_percent = ? WHERE machine_id = ? AND project_id = ?').run(perOp, machineId, projectId);
  return perOp;
}

projectsRouter.get('/:id/phases', (_req, res) => {
  const phases = db.prepare('SELECT id, name FROM process_phases ORDER BY name').all() as any[];
  res.json(phases);
});

projectsRouter.post('/:id/operations', (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const body = req.body as any;
    const is_set = body.is_set ? 1 : 0;
    const set_part_ids: number[] = Array.isArray(body.set_part_ids) ? body.set_part_ids.map(Number) : [];
    const part_id = is_set ? (set_part_ids[0] ?? Number(body.part_id)) : Number(body.part_id);
    const phase_id = Number(body.phase_id);
    const machine_id = Number(body.machine_id);
    const cycle_time_seconds = Number(body.cycle_time_seconds);
    const volume_value = Number(body.volume_value);
    const volume_unit = ['annual', 'monthly', 'weekly'].includes(body.volume_unit) ? body.volume_unit : 'annual';
    const nests_count = Number(body.nests_count ?? 1) || 1;
    const oee_override = body.oee_override != null ? Number(body.oee_override) : null;
    const capacity_percent = Number(body.capacity_percent ?? 100);
    const opf = body.opf ? 1 : 0;
    const sap = body.sap ?? null;
    const description = body.description ?? null;

    if (is_set && set_part_ids.length < 2) {
      return res.status(400).json({ error: 'Set musi zawierać co najmniej 2 detale.' });
    }

    const capacityPercentToInsert = rebalanceCapacityPercentOnInsert(machine_id, projectId, capacity_percent);

    db.prepare(`
      INSERT INTO operations (project_id, part_id, phase_id, machine_id, cycle_time_seconds, volume_value, volume_unit, nests_count, oee_override, capacity_percent, opf, sap, description, is_set)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(projectId, part_id, phase_id, machine_id, cycle_time_seconds, volume_value, volume_unit, nests_count, oee_override, capacityPercentToInsert, opf, sap, description, is_set);

    try {
      checkCapacityPercent(machine_id, projectId, null);
    } catch (e: any) {
      const lastId = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
      db.prepare('DELETE FROM operations WHERE id = ?').run(lastId.id);
      return res.status(400).json({ error: e.message });
    }

    const lastId = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    if (is_set && set_part_ids.length) {
      const ins = db.prepare('INSERT INTO operation_set_members (operation_id, part_id, quantity_per_set) VALUES (?, ?, 1)');
      for (const pid of set_part_ids) {
        ins.run(lastId.id, pid);
      }
    }

    const row = db.prepare(`
      SELECT o.*, ph.name AS phase_name,
             COALESCE(pd.sap_number, pd.alias, pd.free_text, pt.designation) AS part_designation,
             m.internal_number AS machine_number, m.type AS machine_type
      FROM operations o
      JOIN process_phases ph ON ph.id = o.phase_id
      JOIN parts pt ON pt.id = o.part_id
      LEFT JOIN part_designations pd ON pd.id = pt.designation_id
      JOIN machines m ON m.id = o.machine_id
      WHERE o.id = ?
    `).get(lastId.id) as any;
    if (row.is_set) {
      const members = db.prepare(`
        SELECT osm.part_id, osm.quantity_per_set, COALESCE(pd.sap_number, pd.alias, pd.free_text, pt.designation) AS label
        FROM operation_set_members osm
        JOIN parts pt ON pt.id = osm.part_id
        LEFT JOIN part_designations pd ON pd.id = pt.designation_id
        WHERE osm.operation_id = ?
        ORDER BY osm.part_id
      `).all(lastId.id) as any[];
      row.set_members = members;
      row.part_designation = 'Set: ' + members.map((m: any) => m.label).join(' + ');
    }
    res.status(201).json(row);
  } catch (e: any) {
    console.error('POST /operations error:', e);
    const msg = e?.message ?? String(e);
    if (msg.includes('no such column: is_set') || msg.includes('no such table: operation_set_members')) {
      return res.status(500).json({ error: 'Baza wymaga migracji (sety). Zrestartuj serwer (npm run dev) i spróbuj ponownie.' });
    }
    res.status(500).json({ error: msg || 'Internal Server Error' });
  }
});

projectsRouter.put('/:projectId/operations/:opId', (req, res) => {
  const projectId = Number(req.params.projectId);
  const opId = Number(req.params.opId);
  const op = db.prepare('SELECT * FROM operations WHERE id = ? AND project_id = ?').get(opId, projectId) as any;
  if (!op) return res.status(404).json({ error: 'Not found' });
  const prevSetMembers = (op.is_set ? db.prepare('SELECT part_id FROM operation_set_members WHERE operation_id = ?').all(opId) : []) as any[];

  const body = req.body as any;
  const is_set = body.is_set !== undefined ? (body.is_set ? 1 : 0) : op.is_set;
  const set_part_ids: number[] = Array.isArray(body.set_part_ids) ? body.set_part_ids.map(Number) : [];
  let part_id = body.part_id !== undefined ? Number(body.part_id) : op.part_id;
  if (is_set && set_part_ids.length >= 2) part_id = set_part_ids[0];
  if (is_set && set_part_ids.length > 0 && set_part_ids.length < 2) {
    return res.status(400).json({ error: 'Set musi zawierać co najmniej 2 detale.' });
  }

  const phase_id = body.phase_id !== undefined ? Number(body.phase_id) : op.phase_id;
  const machine_id = body.machine_id !== undefined ? Number(body.machine_id) : op.machine_id;
  const cycle_time_seconds = body.cycle_time_seconds !== undefined ? Number(body.cycle_time_seconds) : op.cycle_time_seconds;
  const volumeExplicit = body.volume_value !== undefined || body.volume_unit !== undefined;
  const volume_value = body.volume_value !== undefined ? Number(body.volume_value) : op.volume_value;
  const volume_unit = body.volume_unit !== undefined && ['annual', 'monthly', 'weekly'].includes(body.volume_unit) ? body.volume_unit : op.volume_unit;
  const nests_count = body.nests_count !== undefined ? Number(body.nests_count) || 1 : op.nests_count;
  const oee_override = body.oee_override !== undefined ? (body.oee_override == null ? null : Number(body.oee_override)) : op.oee_override;
  const capacity_percent = body.capacity_percent !== undefined ? Number(body.capacity_percent) : op.capacity_percent;
  const opf = body.opf ? 1 : 0;
  const sap = body.sap !== undefined ? body.sap : op.sap;
  const description = body.description !== undefined ? body.description : op.description;

  db.prepare(`
    UPDATE operations SET part_id = ?, phase_id = ?, machine_id = ?, cycle_time_seconds = ?, volume_value = ?, volume_unit = ?, nests_count = ?, oee_override = ?, capacity_percent = ?, opf = ?, sap = ?, description = ?, is_set = ?
    WHERE id = ?
  `).run(part_id, phase_id, machine_id, cycle_time_seconds, volume_value, volume_unit, nests_count, oee_override, capacity_percent, opf, sap, description, is_set, opId);

  if (is_set && set_part_ids.length) {
    db.prepare('DELETE FROM operation_set_members WHERE operation_id = ?').run(opId);
    const ins = db.prepare('INSERT INTO operation_set_members (operation_id, part_id, quantity_per_set) VALUES (?, ?, 1)');
    for (const pid of set_part_ids) {
      ins.run(opId, pid);
    }
  } else if (!is_set) {
    db.prepare('DELETE FROM operation_set_members WHERE operation_id = ?').run(opId);
  }

  try {
    checkCapacityPercent(machine_id, projectId, opId);
  } catch (e: any) {
    db.prepare(`
      UPDATE operations SET part_id = ?, phase_id = ?, machine_id = ?, cycle_time_seconds = ?, volume_value = ?, volume_unit = ?, nests_count = ?, oee_override = ?, capacity_percent = ?, opf = ?, sap = ?, description = ?, is_set = ?
      WHERE id = ?
    `).run(op.part_id, op.phase_id, op.machine_id, op.cycle_time_seconds, op.volume_value, op.volume_unit, op.nests_count, op.oee_override, op.capacity_percent, op.opf, op.sap, op.description, op.is_set ?? 0, opId);
    db.prepare('DELETE FROM operation_set_members WHERE operation_id = ?').run(opId);
    if (prevSetMembers.length) {
      const ins = db.prepare('INSERT INTO operation_set_members (operation_id, part_id, quantity_per_set) VALUES (?, ?, 1)');
      prevSetMembers.forEach((r) => ins.run(opId, r.part_id));
    }
    return res.status(400).json({ error: e.message });
  }

  if (volumeExplicit) {
    db.prepare('DELETE FROM operation_volume_by_year WHERE operation_id = ?').run(opId);
  }

  const row = db.prepare(`
    SELECT o.*, ph.name AS phase_name,
           COALESCE(pd.sap_number, pd.alias, pd.free_text, pt.designation) AS part_designation,
           m.internal_number AS machine_number, m.type AS machine_type
    FROM operations o
    JOIN process_phases ph ON ph.id = o.phase_id
    JOIN parts pt ON pt.id = o.part_id
    LEFT JOIN part_designations pd ON pd.id = pt.designation_id
    JOIN machines m ON m.id = o.machine_id
    WHERE o.id = ?
  `).get(opId) as any;
  if (row.is_set) {
    const members = db.prepare(`
      SELECT osm.part_id, osm.quantity_per_set, COALESCE(pd.sap_number, pd.alias, pd.free_text, pt.designation) AS label
      FROM operation_set_members osm
      JOIN parts pt ON pt.id = osm.part_id
      LEFT JOIN part_designations pd ON pd.id = pt.designation_id
      WHERE osm.operation_id = ?
      ORDER BY osm.part_id
    `).all(opId) as any[];
    row.set_members = members;
    row.part_designation = 'Set: ' + members.map((m: any) => m.label).join(' + ');
  }
  res.json(row);
});

projectsRouter.delete('/:projectId/operations/:opId', (req, res) => {
  const opId = Number(req.params.opId);
  const projectId = Number(req.params.projectId);
  const opRow = db
    .prepare('SELECT id, split_from_operation_id FROM operations WHERE id = ? AND project_id = ?')
    .get(opId, projectId) as { id: number; split_from_operation_id: number | null } | undefined;
  if (!opRow) return res.status(404).json({ error: 'Not found' });

  const parentId = opRow.split_from_operation_id != null ? Number(opRow.split_from_operation_id) : null;
  if (parentId != null && !Number.isNaN(parentId)) {
    const parent = db.prepare('SELECT id FROM operations WHERE id = ? AND project_id = ?').get(parentId, projectId);
    if (parent) mergeSplitChildVolumesIntoParent(parentId, opId);
  } else {
    // Protect source operation: deleting parent while split children exist corrupts allocation lineage.
    const hasChildren = db.prepare('SELECT 1 FROM operations WHERE split_from_operation_id = ? LIMIT 1').get(opId);
    if (hasChildren) {
      return res.status(400).json({ error: 'Nie można usunąć operacji źródłowej alokacji, dopóki istnieją operacje podzielone.' });
    }
  }

  const r = db.prepare('DELETE FROM operations WHERE id = ? AND project_id = ?').run(opId, projectId);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  if (parentId != null && !Number.isNaN(parentId)) {
    clearParentAllocationOverridesIfNoChildren(parentId);
  }
  saveDb();
  res.status(204).send();
});

// Operation volume by year (override dla wybranych lat; brak wpisu = używany volume_value/volume_unit operacji)
projectsRouter.get('/:projectId/operations/:opId/volumes', (req, res) => {
  const opId = Number(req.params.opId);
  const projectId = Number(req.params.projectId);
  const op = db.prepare('SELECT id FROM operations WHERE id = ? AND project_id = ?').get(opId, projectId);
  if (!op) return res.status(404).json({ error: 'Not found' });
  const rows = db.prepare('SELECT year, volume_value, volume_unit FROM operation_volume_by_year WHERE operation_id = ? ORDER BY year').all(opId) as any[];
  res.json(rows);
});

projectsRouter.put('/:projectId/operations/:opId/volumes', (req, res) => {
  const opId = Number(req.params.opId);
  const projectId = Number(req.params.projectId);
  const op = db.prepare('SELECT id FROM operations WHERE id = ? AND project_id = ?').get(opId, projectId);
  if (!op) return res.status(404).json({ error: 'Not found' });
  const body = req.body as any;
  if (body.volumes && Array.isArray(body.volumes)) {
    db.prepare('DELETE FROM operation_volume_by_year WHERE operation_id = ?').run(opId);
    for (const v of body.volumes) {
      const year = Number(v.year);
      const volume_value = Number(v.volume_value);
      const volume_unit = ['annual', 'monthly', 'weekly'].includes(v.volume_unit) ? v.volume_unit : 'annual';
      try {
        db.prepare('INSERT OR REPLACE INTO operation_volume_by_year (operation_id, year, volume_value, volume_unit, source) VALUES (?, ?, ?, ?, ?)').run(opId, year, volume_value, volume_unit, 'manual');
      } catch (_) {
        db.prepare('INSERT OR REPLACE INTO operation_volume_by_year (operation_id, year, volume_value, volume_unit) VALUES (?, ?, ?, ?)').run(opId, year, volume_value, volume_unit);
      }
    }
    const rows = db.prepare('SELECT year, volume_value, volume_unit FROM operation_volume_by_year WHERE operation_id = ? ORDER BY year').all(opId) as any[];
    return res.json(rows);
  }
  const year = Number(body.year);
  const volume_value = Number(body.volume_value);
  const volume_unit = ['annual', 'monthly', 'weekly'].includes(body.volume_unit) ? body.volume_unit : 'annual';
  try {
    db.prepare('INSERT OR REPLACE INTO operation_volume_by_year (operation_id, year, volume_value, volume_unit, source) VALUES (?, ?, ?, ?, ?)').run(opId, year, volume_value, volume_unit, 'manual');
  } catch (_) {
    db.prepare('INSERT OR REPLACE INTO operation_volume_by_year (operation_id, year, volume_value, volume_unit) VALUES (?, ?, ?, ?)').run(opId, year, volume_value, volume_unit);
  }
  const row = db.prepare('SELECT year, volume_value, volume_unit FROM operation_volume_by_year WHERE operation_id = ? AND year = ?').get(opId, year) as any;
  res.json(row);
});

projectsRouter.delete('/:projectId/operations/:opId/volumes/:year', (req, res) => {
  const opId = Number(req.params.opId);
  const projectId = Number(req.params.projectId);
  const year = Number(req.params.year);
  const op = db.prepare('SELECT id FROM operations WHERE id = ? AND project_id = ?').get(opId, projectId);
  if (!op) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM operation_volume_by_year WHERE operation_id = ? AND year = ?').run(opId, year);
  res.status(204).send();
});

// Notes
projectsRouter.post('/:id/notes', (req, res) => {
  const projectId = Number(req.params.id);
  const body = req.body as any;
  const note = String(body.note ?? '').trim();
  const author = body.author ?? null;
  const note_date = body.note_date ?? new Date().toISOString().slice(0, 10);
  const r = db.prepare('INSERT INTO project_notes (project_id, note_date, author, note) VALUES (?, ?, ?, ?)')
    .run(projectId, note_date, author, note);
  const row = db.prepare('SELECT * FROM project_notes WHERE id = ?').get(r.lastInsertRowid) as any;
  res.status(201).json(row);
});

projectsRouter.delete('/:projectId/notes/:noteId', (req, res) => {
  const noteId = Number(req.params.noteId);
  const r = db.prepare('DELETE FROM project_notes WHERE id = ?').run(noteId);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});
