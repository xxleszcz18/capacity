import { Router } from 'express';
import { db, saveDb } from '../db/connection.js';
import { resolveOperationVolumeForYear } from '../services/capacityService.js';

export const machinesRouter = Router();

/** Clamp value to 0..1 and round to one decimal (0.1 step). */
function clampMachineUsage(v: unknown): number {
  const n = Number(v);
  if (Number.isNaN(n)) return 1;
  const clamped = Math.max(0, Math.min(1, n));
  return Math.round(clamped * 10) / 10;
}

machinesRouter.get('/', (req, res) => {
  const status = req.query.status as string | undefined;
  const type = req.query.type as string | undefined;
  const search = (req.query.search as string)?.trim();

  let sql = 'SELECT id, internal_number, sap_number, type, oee_override, status, location, COALESCE(machine_usage, 1) AS machine_usage FROM machines WHERE 1=1';
  const params: (string | number)[] = [];

  if (status === 'inactive') {
    sql += ' AND status = ?';
    params.push('inactive');
  } else if (status === 'active') {
    sql += ' AND status = ?';
    params.push('active');
  }
  /* status === 'all' lub brak parametru: nie filtruj po statusie */
  if (type && type !== 'Wszystkie' && type !== '') {
    sql += ' AND type = ?';
    params.push(type);
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
  const rows = db.prepare('SELECT DISTINCT type FROM machines ORDER BY type').all() as { type: string }[];
  res.json(rows.map((r) => r.type));
});

machinesRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const machine = db.prepare(`
    SELECT id, internal_number, sap_number, type, oee_override, status, location, COALESCE(machine_usage, 1) AS machine_usage
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
  const id = Number(req.params.id);
  const yearQ = req.query.year != null ? Number(req.query.year) : NaN;
  const year = Number.isFinite(yearQ) ? yearQ : null;
  const list = db.prepare(`
    SELECT o.id, o.project_id, o.part_id, o.phase_id, o.cycle_time_seconds, o.volume_value, o.volume_unit,
           ph.name AS phase_name, pt.designation AS part_designation, p.name AS project_name, p.client
    FROM operations o
    JOIN process_phases ph ON ph.id = o.phase_id
    JOIN parts pt ON pt.id = o.part_id
    JOIN projects p ON p.id = o.project_id
    WHERE o.machine_id = ?
    ORDER BY o.id
  `).all(id) as any[];
  if (year != null) {
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
        },
        year,
        opYear ?? null
      );
      row.effective_volume_value = resolved.volume_value;
      row.effective_volume_unit = resolved.volume_unit;
      row.effective_volume_source = resolved.source;
    }
  }
  res.json(list);
});

machinesRouter.post('/', (req, res) => {
  const body = req.body as any;
  const internal_number = Number(body.internal_number);
  const sap_number = body.sap_number ?? null;
  const type = String(body.type ?? '').trim();
  const oee_override = body.oee_override != null ? Number(body.oee_override) : null;
  const status = body.status === 'inactive' ? 'inactive' : 'active';
  const location = body.location ?? null;
  const machine_usage = body.machine_usage !== undefined ? clampMachineUsage(body.machine_usage) : 1;

  const existing = db.prepare('SELECT id FROM machines WHERE internal_number = ?').get(internal_number);
  if (existing) return res.status(400).json({ error: 'Machine number already exists' });

  db.prepare(`
    INSERT INTO machines (internal_number, sap_number, type, oee_override, status, location, machine_usage)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(internal_number, sap_number, type, oee_override, status, location, machine_usage);
  const row = db.prepare('SELECT * FROM machines WHERE internal_number = ?').get(internal_number) as any;
  res.status(201).json(row);
});

/** Bulk import: body { machines: [{ internal_number, sap_number?, type, status?, location?, oee_override? }] } */
machinesRouter.post('/import', (req, res) => {
  const body = req.body as { machines: any[] };
  const list = Array.isArray(body?.machines) ? body.machines : [];
  const created: number[] = [];
  const skipped: number[] = [];
  const errors: string[] = [];

  const insertStmt = db.prepare(`
    INSERT INTO machines (internal_number, sap_number, type, oee_override, status, location, machine_usage)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    const internal_number = row?.internal_number != null ? Number(row.internal_number) : NaN;
    if (!Number.isInteger(internal_number) || internal_number <= 0) {
      errors.push(`Wiersz ${i + 1}: nieprawidłowy numer maszyny`);
      continue;
    }
    const sap_number = row.sap_number != null ? String(row.sap_number).trim() || null : null;
    const type = row.type != null ? String(row.type).trim() : '';
    if (!type) {
      errors.push(`Wiersz ${i + 1} (nr ${internal_number}): brak typu`);
      continue;
    }
    const status = row.status === 'inactive' ? 'inactive' : 'active';
    const location = row.location != null ? String(row.location).trim() || null : null;
    const oee_override = row.oee_override != null && row.oee_override !== '' ? Number(row.oee_override) : null;
    const machine_usage = row.machine_usage !== undefined ? clampMachineUsage(row.machine_usage) : 1;

    const existing = db.prepare('SELECT id FROM machines WHERE internal_number = ?').get(internal_number);
    if (existing) {
      skipped.push(internal_number);
      continue;
    }
    try {
      insertStmt.run(internal_number, sap_number, type, oee_override, status, location, machine_usage);
      created.push(internal_number);
    } catch (e: any) {
      errors.push(`Wiersz ${i + 1} (nr ${internal_number}): ${e.message || 'błąd zapisu'}`);
    }
  }

  res.json({ created: created.length, skipped: skipped.length, errors, createdNumbers: created, skippedNumbers: skipped });
});

machinesRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as any;
  const row = db.prepare('SELECT * FROM machines WHERE id = ?').get(id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });

  let internal_number = row.internal_number;
  if (body.internal_number !== undefined) {
    const num = Number(body.internal_number);
    if (!Number.isInteger(num) || num <= 0) return res.status(400).json({ error: 'internal_number must be a positive integer' });
    const other = db.prepare('SELECT id FROM machines WHERE internal_number = ? AND id != ?').get(num, id);
    if (other) return res.status(400).json({ error: 'Machine number already exists' });
    internal_number = num;
  }

  const sap_number = body.sap_number !== undefined ? body.sap_number : row.sap_number;
  const type = body.type !== undefined ? String(body.type).trim() : row.type;
  const oee_override = body.oee_override !== undefined ? (body.oee_override == null ? null : Number(body.oee_override)) : row.oee_override;
  const status = body.status === 'inactive' ? 'inactive' : 'active';
  const location = body.location !== undefined ? body.location : row.location;
  const machine_usage = body.machine_usage !== undefined ? clampMachineUsage(body.machine_usage) : (row.machine_usage != null ? clampMachineUsage(row.machine_usage) : 1);

  try {
    db.prepare(`
      UPDATE machines SET internal_number = ?, sap_number = ?, type = ?, oee_override = ?, status = ?, location = ?, machine_usage = ? WHERE id = ?
    `).run(internal_number, sap_number, type, oee_override, status, location, machine_usage, id);
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE') || e?.message?.includes('unique')) return res.status(400).json({ error: 'Machine number already exists' });
    throw e;
  }
  saveDb();
  const updated = db.prepare(`
    SELECT id, internal_number, sap_number, type, oee_override, status, location, COALESCE(machine_usage, 1) AS machine_usage
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
