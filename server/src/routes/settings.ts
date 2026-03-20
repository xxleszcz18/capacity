import { Router } from 'express';
import { db } from '../db/connection.js';

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

designationsRouter.get('/', (_req, res) => {
  try {
    const rows = db.prepare(`SELECT ${designationCols} FROM part_designations ORDER BY COALESCE(sap_number, alias, designation, free_text)`).all() as any[];
    res.json(rows.map(mapDesignationRow));
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
    res.status(201).json(mapDesignationRow(row || { id: r.lastInsertRowid, designation: designation || sap_number || alias || free_text, sap_number: sap_number || null, alias: alias || null, free_text: free_text || null, slot_number: slot_number || null }));
  } catch (e: any) {
    if (e?.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Detal o takim oznaczeniu już istnieje' });
    res.status(500).json({ error: e?.message || 'Błąd zapisu detalu' });
  }
});
designationsRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as any;
  const existing = db.prepare('SELECT id FROM part_designations WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const sap_number = body.sap_number != null ? String(body.sap_number).trim() : null;
  const alias = body.alias != null ? String(body.alias).trim() : null;
  const free_text = body.free_text != null ? String(body.free_text).trim() : null;
  const slot_number = body.slot_number != null ? String(body.slot_number).trim() || null : null;
  const designation = body.designation != null ? String(body.designation).trim() : null;
  try {
    db.prepare('UPDATE part_designations SET designation = COALESCE(?, designation), sap_number = ?, alias = ?, free_text = ?, slot_number = ? WHERE id = ?')
      .run(designation ?? (sap_number || alias || free_text), sap_number, alias, free_text, slot_number, id);
    const row = db.prepare(`SELECT ${designationCols} FROM part_designations WHERE id = ?`).get(id) as any;
    res.json(mapDesignationRow(row));
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Błąd zapisu detalu' });
  }
});
designationsRouter.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = db.prepare('DELETE FROM part_designations WHERE id = ?').run(id);
    if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Błąd usuwania detalu' });
  }
});

// ---- Główny router ustawień (dni robocze itd.) ----
export const settingsRouter = Router();

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

settingsRouter.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT id, year, working_days_year, oee_factor, shift_time_seconds, startup_shutdown_seconds, status,
           COALESCE(working_weeks_per_year, 48) AS working_weeks_per_year, COALESCE(shifts_per_day, 1) AS shifts_per_day,
           working_days_jan, working_days_feb, working_days_mar, working_days_apr,
           working_days_may, working_days_jun, working_days_jul, working_days_aug,
           working_days_sep, working_days_oct, working_days_nov, working_days_dec
    FROM working_days ORDER BY year
  `).all() as any[];
  const list = rows.map((r) => ({
    ...r,
    capacity: calcCapacity(r),
  }));
  res.json(list);
});

// Użyj dopasowania tylko liczbowego ID, żeby /phases i /designations nie trafiały tutaj
settingsRouter.get('/:id(\\d+)', (req, res) => {
  const row = db.prepare('SELECT * FROM working_days WHERE id = ?').get(Number(req.params.id)) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ ...row, capacity: calcCapacity(row) });
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
  const working_days_year = Number(body.working_days_year ?? 0);
  const oee_factor = Number(body.oee_factor ?? 0.85);
  const shift_time_seconds = Number(body.shift_time_seconds ?? 450);
  const startup_shutdown_seconds = Number(body.startup_shutdown_seconds ?? 720);
  const working_weeks_per_year = Number(body.working_weeks_per_year ?? 48);
  const shifts_per_day = Math.max(1, Math.min(4, Number(body.shifts_per_day ?? 3)));
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
  stmt.run(year, working_days_year, oee_factor, shift_time_seconds, startup_shutdown_seconds, status,
    working_weeks_per_year, shifts_per_day,
    months[0] ?? 0, months[1] ?? 0, months[2] ?? 0, months[3] ?? 0,
    months[4] ?? 0, months[5] ?? 0, months[6] ?? 0, months[7] ?? 0,
    months[8] ?? 0, months[9] ?? 0, months[10] ?? 0, months[11] ?? 0);
  const row = db.prepare('SELECT * FROM working_days WHERE year = ?').get(year) as any;
  res.status(201).json({ ...row, capacity: calcCapacity(row) });
});

settingsRouter.put('/:id(\\d+)', (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as any;
  const row = db.prepare('SELECT * FROM working_days WHERE id = ?').get(id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });

  const working_days_year = Number(body.working_days_year ?? row.working_days_year);
  const oee_factor = Number(body.oee_factor ?? row.oee_factor);
  const shift_time_seconds = Number(body.shift_time_seconds ?? row.shift_time_seconds);
  const startup_shutdown_seconds = Number(body.startup_shutdown_seconds ?? row.startup_shutdown_seconds);
  const working_weeks_per_year = Number(body.working_weeks_per_year ?? row.working_weeks_per_year ?? 48);
  const shifts_per_day = Math.max(1, Math.min(4, Number(body.shifts_per_day ?? row.shifts_per_day ?? 3)));
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
  `).run(working_days_year, oee_factor, shift_time_seconds, startup_shutdown_seconds, working_weeks_per_year, shifts_per_day, status,
    months[0] ?? 0, months[1] ?? 0, months[2] ?? 0, months[3] ?? 0,
    months[4] ?? 0, months[5] ?? 0, months[6] ?? 0, months[7] ?? 0,
    months[8] ?? 0, months[9] ?? 0, months[10] ?? 0, months[11] ?? 0, id);

  const updated = db.prepare('SELECT * FROM working_days WHERE id = ?').get(id) as any;
  res.json({ ...updated, capacity: calcCapacity(updated) });
});

settingsRouter.delete('/:id(\\d+)', (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('DELETE FROM working_days WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});
