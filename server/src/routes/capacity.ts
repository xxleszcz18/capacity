import { Router } from 'express';
import { db } from '../db/connection.js';
import {
  getMachineCapacityByYears,
  getMachineCapacitiesForYear,
  getNestCapacitiesForYear,
  getSettingsForYear,
} from '../services/capacityService.js';

export const capacityRouter = Router();

function getOperationsFromScenario(scenarioId: number): any[] | null {
  const row = db.prepare('SELECT snapshot FROM scenarios WHERE id = ?').get(scenarioId) as { snapshot: string } | undefined;
  if (!row) return null;
  const snap = JSON.parse(row.snapshot) as { projects: any[]; operations: any[] };
  const activeProjectIds = new Set((snap.projects || []).filter((p: any) => p.status === 'active' || p.status === 'RFQ').map((p: any) => p.id));
  return (snap.operations || []).filter((o: any) => activeProjectIds.has(o.project_id));
}

capacityRouter.get('/calculator', (req, res) => {
  const yearFrom = Number(req.query.yearFrom ?? 2026);
  const yearTo = Number(req.query.yearTo ?? 2036);
  const type = req.query.type as string | undefined;
  const machinesParam = req.query.machines as string | undefined;
  const scenarioId = req.query.scenarioId != null ? Number(req.query.scenarioId) : undefined;
  const internalNumbers = machinesParam
    ? machinesParam.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0)
    : undefined;
  let machineIds: number[] | undefined;
  if (internalNumbers?.length) {
    machineIds = (db.prepare('SELECT id FROM machines WHERE internal_number IN (' + internalNumbers.map(() => '?').join(',') + ')').all(...internalNumbers) as { id: number }[]).map((r) => r.id);
    if (machineIds.length === 0) return res.json({ yearFrom, yearTo, machines: [] });
  }

  const operationsOverride = scenarioId != null ? getOperationsFromScenario(scenarioId) ?? undefined : undefined;
  const data = getMachineCapacityByYears(yearFrom, yearTo, machineIds, type, operationsOverride);
  res.set('Cache-Control', 'no-store');
  res.json({ yearFrom, yearTo, scenarioId: scenarioId ?? null, machines: data });
});

capacityRouter.get('/machine/:machineId', (req, res) => {
  const machineId = Number(req.params.machineId);
  const yearFrom = Number(req.query.yearFrom ?? 2026);
  const yearTo = Number(req.query.yearTo ?? 2036);

  const data = getMachineCapacityByYears(yearFrom, yearTo, [machineId]);
  const machine = data[0];
  if (!machine) return res.status(404).json({ error: 'Machine not found or no capacity data' });
  res.json(machine);
});

capacityRouter.get('/year/:year', (req, res) => {
  const year = Number(req.params.year);
  const type = req.query.type as string | undefined;
  const machinesParam = req.query.machines as string | undefined;
  const machineIds = machinesParam
    ? machinesParam.split(',').map((s) => Number(s.trim())).filter(Boolean)
    : undefined;

  const data = getMachineCapacitiesForYear(year, machineIds, type);
  res.json({ year, machines: data });
});

capacityRouter.get('/nests/year/:year', (req, res) => {
  const year = Number(req.params.year);
  const data = getNestCapacitiesForYear(year);
  res.json(data);
});

capacityRouter.get('/settings/:year', (req, res) => {
  const year = Number(req.params.year);
  const settings = getSettingsForYear(year);
  if (!settings) return res.status(404).json({ error: 'No settings for year' });
  res.json(settings);
});
