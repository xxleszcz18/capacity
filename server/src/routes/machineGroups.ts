import { Router } from 'express';
import {
  createMachineGroup,
  deleteMachineGroup,
  getMachineGroup,
  listMachineGroups,
  updateMachineGroup,
} from '../services/machineGroupService.js';

export const machineGroupsRouter = Router();

machineGroupsRouter.get('/', (_req, res) => {
  res.json(listMachineGroups());
});

machineGroupsRouter.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const group = getMachineGroup(id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  res.json(group);
});

machineGroupsRouter.post('/', (req, res) => {
  try {
    const name = String(req.body?.name ?? '');
    const machineIds = Array.isArray(req.body?.machine_ids)
      ? req.body.machine_ids.map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0)
      : [];
    const group = createMachineGroup(name, machineIds);
    res.status(201).json(group);
  } catch (e: any) {
    res.status(400).json({ error: e?.message || 'Nie udało się utworzyć grupy.' });
  }
});

machineGroupsRouter.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  try {
    const name = String(req.body?.name ?? '');
    const machineIds = Array.isArray(req.body?.machine_ids)
      ? req.body.machine_ids.map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0)
      : undefined;
    const group = updateMachineGroup(id, name, machineIds);
    res.json(group);
  } catch (e: any) {
    if (e?.message === 'Not found') return res.status(404).json({ error: 'Not found' });
    res.status(400).json({ error: e?.message || 'Nie udało się zapisać grupy.' });
  }
});

machineGroupsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!deleteMachineGroup(id)) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});
