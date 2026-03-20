import { Router } from 'express';
import {
  getOverloadedMachines,
  getCandidatesForAllocation,
  executeAllocation,
} from '../services/allocationService.js';

export const allocationRouter = Router();

allocationRouter.get('/overloaded', (req, res) => {
  const year = Number(req.query.year ?? new Date().getFullYear());
  const threshold = Number(req.query.threshold ?? 100);
  const list = getOverloadedMachines(year, threshold);
  res.json({ year, threshold, machines: list });
});

allocationRouter.get('/candidates/:machineId', (req, res) => {
  const machineId = Number(req.params.machineId);
  const year = Number(req.query.year ?? new Date().getFullYear());
  const maxLoad = Number(req.query.maxLoad ?? 90);
  const list = getCandidatesForAllocation(machineId, year, maxLoad);
  res.json({ machineId, year, candidates: list });
});

allocationRouter.post('/execute', (req, res) => {
  const { operationId, targetMachineId, volumeToMove, volumeUnit, cycleTimeSecondsOnTarget, year } = req.body;
  const y = Number(year);
  const yearResolved = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : new Date().getFullYear();
  const cycle =
    cycleTimeSecondsOnTarget !== undefined && cycleTimeSecondsOnTarget !== null && Number(cycleTimeSecondsOnTarget) > 0
      ? Number(cycleTimeSecondsOnTarget)
      : undefined;
  const result = executeAllocation(
    Number(operationId),
    Number(targetMachineId),
    Number(volumeToMove),
    volumeUnit === 'monthly' ? 'monthly' : volumeUnit === 'weekly' ? 'weekly' : 'annual',
    yearResolved,
    cycle
  );
  if (!result.success) return res.status(400).json({ ...result, error: result.error });
  res.json(result);
});
