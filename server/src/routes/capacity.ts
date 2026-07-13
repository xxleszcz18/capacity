import { Router } from 'express';
import { db } from '../db/connection.js';
import { parseGroupIdsParam, resolveMachineIdsFromGroups } from '../services/machineGroupService.js';
import {
  getMachineCapacityByYears,
  getMachineCapacitiesForYear,
  getMachinePeriodBreakdown,
  getMachineSopEopMarkersByYears,
  getNestCapacitiesForYear,
  getCapacityScopeBreakdown,
  resolveSettingsForYear,
  type CalculatorMachineStatusFilter,
  type CapacityBreakdownSeriesKey,
} from '../services/capacityService.js';
import { calculatorCacheKey, getCalculatorCache, setCalculatorCache } from '../services/calculatorCache.js';
import { parseCalculationSettingsProfile, isOcuEnabled } from '../utils/ocuSettings.js';
import { parseScenarioSnapshotJson, scenarioHydratedOperationsForActiveProjects } from '../services/scenarioSnapshotService.js';
import { parseInternalMachineNumber } from '../utils/internalMachineNumber.js';
import { parseMachineDimensionFiltersFromQuery } from '../utils/machineDimensionFilter.js';
import {
  parseCsvQueryParamSingleOrMulti,
  parseIdList,
  parseMachineStatusList,
  sqlInClause,
} from '../utils/queryListParams.js';
import { normalizeClientName, parseClientFilterQuery } from '../utils/clientName.js';

export const capacityRouter = Router();

function parseUseContractualVolumes(v: unknown): boolean {
  return v === '1' || String(v ?? '').toLowerCase() === 'true';
}

function parseCalculatorMachineStatusFilter(v: unknown): CalculatorMachineStatusFilter {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'inactive' || s === 'nieaktywne') return 'inactive';
  if (s === 'rfq') return 'RFQ';
  if (s === 'all' || s === 'wszystkie') return 'all';
  return 'active';
}

function parseCalculatorMachineStatusFilters(single: unknown, multi: unknown): CalculatorMachineStatusFilter[] {
  const list = parseMachineStatusList(single, multi);
  return list as CalculatorMachineStatusFilter[];
}

function getScenarioForCalculator(scenarioId: number): { bundle: ReturnType<typeof parseScenarioSnapshotJson>; includeRfq: boolean } | null {
  const row = db.prepare('SELECT snapshot, archived_at FROM scenarios WHERE id = ?').get(scenarioId) as
    | { snapshot: string; archived_at: string | null }
    | undefined;
  if (!row) return null;
  const archived = row.archived_at != null && String(row.archived_at).trim() !== '';
  return { bundle: parseScenarioSnapshotJson(row.snapshot), includeRfq: !archived };
}

function resolveCalculatorContext(req: import('express').Request) {
  const yearFrom = Number(req.query.yearFrom ?? 2026);
  const yearTo = Number(req.query.yearTo ?? 2036);
  const types = parseCsvQueryParamSingleOrMulti(req.query.type, req.query.types);
  const clients = parseClientFilterQuery(req.query.client, req.query.clients);
  const machinesParam = req.query.machines as string | undefined;
  const scenarioId = req.query.scenarioId != null ? Number(req.query.scenarioId) : undefined;
  const statusList = parseCalculatorMachineStatusFilters(req.query.machineStatus, req.query.machineStatuses);
  const machineStatus: CalculatorMachineStatusFilter | CalculatorMachineStatusFilter[] =
    statusList.length > 0 ? statusList : parseCalculatorMachineStatusFilter(req.query.machineStatus);
  const dimensionFilters = parseMachineDimensionFiltersFromQuery(req.query as Record<string, unknown>);
  const settingsProfile = parseCalculationSettingsProfile(req.query.settingsProfile, {
    scenarioActive: scenarioId != null && Number.isFinite(scenarioId) && scenarioId > 0,
    ocuEnabled: isOcuEnabled(),
  });
  let machineIds: number[] | undefined;
  if (machinesParam?.trim()) {
    const tokens = machinesParam.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
    const ids = new Set<number>();
    for (const tok of tokens) {
      const parsed = parseInternalMachineNumber(tok);
      if (!parsed.ok) continue;
      const rows = db.prepare('SELECT id FROM machines WHERE internal_number = ?').all(parsed.value) as { id: number }[];
      for (const r of rows) ids.add(r.id);
    }
    machineIds = [...ids];
  }

  const byClient = clients.length > 0;
  let operationsOverride: any[] | undefined;
  let clientMachineIds: number[] | undefined;
  let scenarioBundle: ReturnType<typeof parseScenarioSnapshotJson> | null = null;
  let scenarioIncludeRfq = true;

  if (scenarioId != null) {
    const meta = getScenarioForCalculator(scenarioId);
    scenarioBundle = meta?.bundle ?? null;
    scenarioIncludeRfq = meta?.includeRfq ?? true;
    if (scenarioBundle) {
      const hydrated = scenarioHydratedOperationsForActiveProjects(scenarioBundle, { includeRfq: scenarioIncludeRfq });
      const activeProjects = (scenarioBundle.projects || []).filter((p: any) => {
        const st = p.status ?? 'active';
        if (st === 'inactive') return false;
        if (st === 'RFQ') return scenarioIncludeRfq;
        return st === 'active';
      });
      const clientSet = new Set(clients);
      const selectedProjects = byClient
        ? activeProjects.filter((p: any) => clientSet.has(normalizeClientName(p.client)))
        : activeProjects;
      const projectIds = new Set(selectedProjects.map((p: any) => p.id));
      operationsOverride = hydrated.filter((o: any) => projectIds.has(o.project_id));
      if (byClient) {
        clientMachineIds = [...new Set(operationsOverride.map((o: any) => Number(o.machine_id)).filter((id: number) => Number.isFinite(id) && id > 0))];
      }
    }
  } else if (byClient) {
    const clientIn = sqlInClause(clients, 'p.client');
    clientMachineIds = (
      db
        .prepare(`
          SELECT DISTINCT o.machine_id AS id
          FROM operations o
          JOIN projects p ON p.id = o.project_id
          WHERE p.status = 'active' AND ${clientIn.clause}
        `)
        .all(...clientIn.params) as { id: number }[]
    ).map((r) => r.id);
  }

  if (byClient) {
    if (!clientMachineIds || clientMachineIds.length === 0) {
      return { empty: true as const, yearFrom, yearTo, scenarioId, settingsProfile, machineStatus, dimensionFilters, types, machineIds: [] as number[] };
    }
    if (machineIds?.length) {
      const set = new Set(clientMachineIds);
      machineIds = machineIds.filter((id) => set.has(id));
      if (machineIds.length === 0) {
        return { empty: true as const, yearFrom, yearTo, scenarioId, settingsProfile, machineStatus, dimensionFilters, types, machineIds: [] as number[] };
      }
    } else {
      machineIds = clientMachineIds;
    }
  }

  return {
    empty: false as const,
    yearFrom,
    yearTo,
    scenarioId,
    machineStatus,
    dimensionFilters,
    types,
    machineIds,
    operationsOverride,
    scenarioBundle,
    scenarioIncludeRfq,
    settingsProfile,
  };
}

capacityRouter.get('/breakdown', (req, res) => {
  const year = Number(req.query.year);
  const line = (req.query.line as string | undefined)?.trim();
  const machineId = req.query.machineId != null ? Number(req.query.machineId) : undefined;
  const seriesParam = String(req.query.series ?? '').trim();
  const seriesKeys = seriesParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as CapacityBreakdownSeriesKey[];

  if (!Number.isFinite(year)) return res.status(400).json({ error: 'Invalid year' });
  if (line && machineId != null && Number.isFinite(machineId)) {
    return res.status(400).json({ error: 'Provide line or machineId, not both' });
  }
  if (!line && (machineId == null || !Number.isFinite(machineId))) {
    return res.status(400).json({ error: 'Provide line or machineId' });
  }
  if (!seriesKeys.length) return res.status(400).json({ error: 'Missing series parameter' });

  const ctx = resolveCalculatorContext(req);
  if (ctx.empty) {
    return res.json({ year, series: {} });
  }

  const scope = line ? ({ kind: 'line' as const, line }) : ({ kind: 'machine' as const, machineId: machineId! });
  const series = getCapacityScopeBreakdown(
    year,
    scope,
    {
      machineIds: ctx.machineIds,
      machineType: ctx.types.length ? ctx.types : undefined,
      operationsOverride: ctx.operationsOverride,
      scenarioSnapshot: ctx.scenarioBundle,
      scenarioIncludeRfqProjects: ctx.scenarioId != null && ctx.scenarioBundle ? ctx.scenarioIncludeRfq : undefined,
      machineStatusFilter: ctx.machineStatus,
      dimensionFilters: ctx.dimensionFilters,
      settingsProfile: ctx.settingsProfile,
    },
    seriesKeys
  );

  res.set('Cache-Control', 'no-store');
  res.json({ year, series });
});

capacityRouter.get('/calculator', (req, res) => {
  const useContractualVolumes = parseUseContractualVolumes(req.query.useContractualVolumes);
  const groupIdsParam = req.query.groupIds as string | undefined;
  const ctx = resolveCalculatorContext(req);
  let machineIds = ctx.empty ? ([] as number[]) : ctx.machineIds;

  const groupIds = parseGroupIdsParam(groupIdsParam);
  if (groupIds.length > 0) {
    const groupMachineIds = resolveMachineIdsFromGroups(groupIds);
    if (groupMachineIds.length === 0) {
      return res.json({ yearFrom: ctx.yearFrom, yearTo: ctx.yearTo, scenarioId: ctx.scenarioId ?? null, machines: [] });
    }
    if (machineIds?.length) {
      const set = new Set(groupMachineIds);
      machineIds = machineIds.filter((id) => set.has(id));
      if (machineIds.length === 0) {
        return res.json({ yearFrom: ctx.yearFrom, yearTo: ctx.yearTo, scenarioId: ctx.scenarioId ?? null, machines: [] });
      }
    } else {
      machineIds = groupMachineIds;
    }
  }

  if (ctx.empty) {
    return res.json({ yearFrom: ctx.yearFrom, yearTo: ctx.yearTo, scenarioId: ctx.scenarioId ?? null, machines: [] });
  }

  const cacheKey = calculatorCacheKey({
    yearFrom: ctx.yearFrom,
    yearTo: ctx.yearTo,
    machineIds: machineIds ?? [],
    types: ctx.types,
    scenarioId: ctx.scenarioId ?? null,
    useContractualVolumes,
    machineStatus: ctx.machineStatus,
    dimensionFilters: ctx.dimensionFilters,
    settingsProfile: ctx.settingsProfile,
    groupIds: groupIdsParam ?? '',
  });
  const cached = getCalculatorCache<ReturnType<typeof getMachineCapacityByYears>>(cacheKey);
  if (cached) {
    res.set('Cache-Control', 'private, max-age=30');
    res.set('X-Calculator-Cache', 'HIT');
    return res.json({ yearFrom: ctx.yearFrom, yearTo: ctx.yearTo, scenarioId: ctx.scenarioId ?? null, machines: cached });
  }

  const data = getMachineCapacityByYears(
    ctx.yearFrom,
    ctx.yearTo,
    machineIds,
    ctx.types.length ? ctx.types : undefined,
    ctx.operationsOverride,
    ctx.scenarioBundle,
    ctx.scenarioId != null && ctx.scenarioBundle ? ctx.scenarioIncludeRfq : undefined,
    useContractualVolumes,
    ctx.machineStatus,
    ctx.dimensionFilters,
    ctx.settingsProfile,
  );
  setCalculatorCache(cacheKey, data);
  res.set('Cache-Control', 'private, max-age=30');
  res.set('X-Calculator-Cache', 'MISS');
  res.json({ yearFrom: ctx.yearFrom, yearTo: ctx.yearTo, scenarioId: ctx.scenarioId ?? null, machines: data });
});

capacityRouter.get('/calculator/period-breakdown', (req, res) => {
  const useContractualVolumes = parseUseContractualVolumes(req.query.useContractualVolumes);
  const groupIdsParam = req.query.groupIds as string | undefined;
  const year = Number(req.query.year);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Invalid year' });
  }
  const ctx = resolveCalculatorContext(req);
  let machineIds = ctx.empty ? ([] as number[]) : ctx.machineIds;

  const groupIds = parseGroupIdsParam(groupIdsParam);
  if (groupIds.length > 0) {
    const groupMachineIds = resolveMachineIdsFromGroups(groupIds);
    if (groupMachineIds.length === 0) {
      return res.json({ year, machines: [] });
    }
    if (machineIds?.length) {
      const set = new Set(groupMachineIds);
      machineIds = machineIds.filter((id) => set.has(id));
      if (machineIds.length === 0) {
        return res.json({ year, machines: [] });
      }
    } else {
      machineIds = groupMachineIds;
    }
  }

  const machineIdsParam = req.query.machineIds as string | undefined;
  if (machineIdsParam?.trim()) {
    const ids = parseIdList(machineIdsParam, undefined);
    if (ids.length > 0) {
      if (machineIds?.length) {
        const set = new Set(ids);
        machineIds = machineIds.filter((id) => set.has(id));
      } else {
        machineIds = ids;
      }
    }
  }

  if (ctx.empty && (!machineIds || machineIds.length === 0)) {
    return res.json({ year, machines: [] });
  }

  const data = getMachinePeriodBreakdown(
    year,
    machineIds,
    ctx.types.length ? ctx.types : undefined,
    ctx.operationsOverride,
    ctx.scenarioBundle,
    ctx.scenarioId != null && ctx.scenarioBundle ? ctx.scenarioIncludeRfq : undefined,
    useContractualVolumes,
    ctx.machineStatus,
    ctx.dimensionFilters,
    ctx.settingsProfile
  );
  res.set('Cache-Control', 'no-store');
  res.json({ year, machines: data });
});

capacityRouter.get('/calculator/sop-eop-markers', (req, res) => {
  const groupIdsParam = req.query.groupIds as string | undefined;
  const ctx = resolveCalculatorContext(req);
  let machineIds = ctx.empty ? ([] as number[]) : ctx.machineIds;

  const groupIds = parseGroupIdsParam(groupIdsParam);
  if (groupIds.length > 0) {
    const groupMachineIds = resolveMachineIdsFromGroups(groupIds);
    if (groupMachineIds.length === 0) {
      return res.json({ yearFrom: ctx.yearFrom, yearTo: ctx.yearTo, machines: [] });
    }
    if (machineIds?.length) {
      const set = new Set(groupMachineIds);
      machineIds = machineIds.filter((id) => set.has(id));
      if (machineIds.length === 0) {
        return res.json({ yearFrom: ctx.yearFrom, yearTo: ctx.yearTo, machines: [] });
      }
    } else {
      machineIds = groupMachineIds;
    }
  }

  const machineIdsParam = req.query.machineIds as string | undefined;
  if (machineIdsParam?.trim()) {
    const ids = parseIdList(machineIdsParam, undefined);
    if (ids.length > 0) {
      if (machineIds?.length) {
        const set = new Set(ids);
        machineIds = machineIds.filter((id) => set.has(id));
      } else {
        machineIds = ids;
      }
    }
  }

  if (ctx.empty && (!machineIds || machineIds.length === 0)) {
    return res.json({ yearFrom: ctx.yearFrom, yearTo: ctx.yearTo, machines: [] });
  }

  const data = getMachineSopEopMarkersByYears(
    ctx.yearFrom,
    ctx.yearTo,
    machineIds,
    ctx.types.length ? ctx.types : undefined,
    ctx.operationsOverride,
    ctx.scenarioBundle,
    ctx.scenarioId != null && ctx.scenarioBundle ? ctx.scenarioIncludeRfq : undefined,
    ctx.machineStatus,
    ctx.dimensionFilters
  );
  res.set('Cache-Control', 'no-store');
  res.json({ yearFrom: ctx.yearFrom, yearTo: ctx.yearTo, machines: data });
});

capacityRouter.get('/machine/:machineId', (req, res) => {
  const machineId = Number(req.params.machineId);
  const yearFrom = Number(req.query.yearFrom ?? 2026);
  const yearTo = Number(req.query.yearTo ?? 2036);
  const scenarioId = req.query.scenarioId != null ? Number(req.query.scenarioId) : undefined;
  const useContractualVolumes = parseUseContractualVolumes(req.query.useContractualVolumes);
  const settingsProfile = parseCalculationSettingsProfile(req.query.settingsProfile, {
    scenarioActive: scenarioId != null && Number.isFinite(scenarioId) && scenarioId > 0,
    ocuEnabled: isOcuEnabled(),
  });

  let operationsOverride: any[] | undefined;
  let scenarioBundle: ReturnType<typeof parseScenarioSnapshotJson> | null = null;
  let scenarioIncludeRfq = true;
  if (scenarioId != null && Number.isFinite(scenarioId) && scenarioId > 0) {
    const meta = getScenarioForCalculator(scenarioId);
    scenarioBundle = meta?.bundle ?? null;
    scenarioIncludeRfq = meta?.includeRfq ?? true;
    if (scenarioBundle) {
      const hydrated = scenarioHydratedOperationsForActiveProjects(scenarioBundle, { includeRfq: scenarioIncludeRfq });
      const activeProjects = (scenarioBundle.projects || []).filter((p: any) => {
        const st = p.status ?? 'active';
        if (st === 'inactive') return false;
        if (st === 'RFQ') return scenarioIncludeRfq;
        return st === 'active';
      });
      const projectIds = new Set(activeProjects.map((p: any) => p.id));
      operationsOverride = hydrated.filter((o: any) => projectIds.has(o.project_id));
    }
  }

  const data = getMachineCapacityByYears(
    yearFrom,
    yearTo,
    [machineId],
    undefined,
    operationsOverride,
    scenarioBundle,
    scenarioId != null && scenarioBundle ? scenarioIncludeRfq : undefined,
    useContractualVolumes,
    'all',
    undefined,
    settingsProfile
  );
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
  const settingsProfile = parseCalculationSettingsProfile(req.query.settingsProfile, { ocuEnabled: isOcuEnabled() });
  res.json(resolveSettingsForYear(year, settingsProfile));
});
