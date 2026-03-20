import { Router } from 'express';
import { db } from '../db/connection.js';

export const nestsRouter = Router();

nestsRouter.get('/', (_req, res) => {
  const list = db.prepare('SELECT id, name FROM nests ORDER BY id').all() as any[];
  const withMachines = list.map((n) => {
    const machines = db.prepare(`
      SELECT m.id, m.internal_number, m.sap_number, m.type
      FROM nest_machines nm
      JOIN machines m ON m.id = nm.machine_id
      WHERE nm.nest_id = ?
    `).all(n.id) as any[];
    return { ...n, machines };
  });
  res.json(withMachines);
});

nestsRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const nest = db.prepare('SELECT * FROM nests WHERE id = ?').get(id) as any;
  if (!nest) return res.status(404).json({ error: 'Not found' });
  const machines = db.prepare(`
    SELECT m.id, m.internal_number, m.sap_number, m.type
    FROM nest_machines nm
    JOIN machines m ON m.id = nm.machine_id
    WHERE nm.nest_id = ?
  `).all(id) as any[];
  res.json({ ...nest, machines });
});

nestsRouter.post('/', (req, res) => {
  const name = (req.body.name as string) ?? null;
  const r = db.prepare('INSERT INTO nests (name) VALUES (?)').run(name);
  const row = db.prepare('SELECT * FROM nests WHERE id = ?').get(r.lastInsertRowid) as any;
  res.status(201).json(row);
});

nestsRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id FROM nests WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const name = (req.body.name as string) ?? null;
  db.prepare('UPDATE nests SET name = ? WHERE id = ?').run(name, id);
  const updated = db.prepare('SELECT * FROM nests WHERE id = ?').get(id) as any;
  res.json(updated);
});

nestsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('DELETE FROM nests WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

nestsRouter.post('/:id/machines', (req, res) => {
  const nestId = Number(req.params.id);
  const machineId = Number(req.body.machine_id);
  db.prepare('INSERT OR IGNORE INTO nest_machines (nest_id, machine_id) VALUES (?, ?)').run(nestId, machineId);
  const machines = db.prepare(`
    SELECT m.id, m.internal_number, m.sap_number, m.type
    FROM nest_machines nm
    JOIN machines m ON m.id = nm.machine_id
    WHERE nm.nest_id = ?
  `).all(nestId) as any[];
  res.json(machines);
});

nestsRouter.delete('/:id/machines/:machineId', (req, res) => {
  const nestId = Number(req.params.id);
  const machineId = Number(req.params.machineId);
  db.prepare('DELETE FROM nest_machines WHERE nest_id = ? AND machine_id = ?').run(nestId, machineId);
  res.status(204).send();
});
