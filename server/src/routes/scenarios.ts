import { Router } from 'express';
import { db } from '../db/connection.js';

export const scenariosRouter = Router();

function exportSnapshot(): string {
  const projects = db.prepare('SELECT * FROM projects ORDER BY id').all();
  const parts = db.prepare('SELECT * FROM parts ORDER BY id').all();
  const operations = db.prepare('SELECT * FROM operations ORDER BY id').all();
  const working_days = db.prepare('SELECT * FROM working_days ORDER BY year').all();
  return JSON.stringify({ projects, parts, operations, working_days });
}

scenariosRouter.get('/', (_req, res) => {
  const list = db.prepare('SELECT id, name, created_at FROM scenarios ORDER BY created_at DESC').all() as any[];
  res.json(list);
});

scenariosRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(id) as any;
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ id: row.id, name: row.name, created_at: row.created_at, snapshot: JSON.parse(row.snapshot) });
});

scenariosRouter.post('/', (req, res) => {
  const name = String((req.body as any).name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'Nazwa scenariusza jest wymagana' });
  const snapshot = exportSnapshot();
  db.prepare('INSERT INTO scenarios (name, snapshot) VALUES (?, ?)').run(name, snapshot);
  const row = db.prepare('SELECT id, name, created_at FROM scenarios WHERE id = last_insert_rowid()').get() as any;
  res.status(201).json(row);
});

scenariosRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('DELETE FROM scenarios WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});
