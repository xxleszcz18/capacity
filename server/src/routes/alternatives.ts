import { Router } from 'express';
import { db } from '../db/connection.js';

export const alternativesRouter = Router();

alternativesRouter.get('/machine/:machineId', (req, res) => {
  const machineId = Number(req.params.machineId);
  const list = db.prepare(`
    SELECT m.id, m.internal_number, m.sap_number, m.type
    FROM machine_alternatives a
    JOIN machines m ON m.id = a.alternative_machine_id
    WHERE a.machine_id = ?
  `).all(machineId) as any[];
  res.json(list);
});

alternativesRouter.post('/', (req, res) => {
  const machine_id = Number(req.body.machine_id);
  const alternative_machine_id = Number(req.body.alternative_machine_id);
  if (machine_id === alternative_machine_id) {
    return res.status(400).json({ error: 'Machine cannot be alternative to itself' });
  }
  try {
    db.prepare('INSERT INTO machine_alternatives (machine_id, alternative_machine_id) VALUES (?, ?)')
      .run(machine_id, alternative_machine_id);
  } catch (e: any) {
    if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(400).json({ error: 'Alternative already added' });
    }
    throw e;
  }
  const alt = db.prepare('SELECT * FROM machines WHERE id = ?').get(alternative_machine_id) as any;
  res.status(201).json(alt);
});

alternativesRouter.delete('/:machineId/:alternativeMachineId', (req, res) => {
  const machineId = Number(req.params.machineId);
  const alternativeMachineId = Number(req.params.alternativeMachineId);
  const r = db.prepare('DELETE FROM machine_alternatives WHERE machine_id = ? AND alternative_machine_id = ?')
    .run(machineId, alternativeMachineId);
  if (r.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});
