import { db } from '../db/connection.js';
import { parseGroupIdsParam, resolveMachineIdsFromGroups } from '../services/machineGroupService.js';
import { parseCsvQueryParamSingleOrMulti, parseIdList, sqlInClause } from '../utils/queryListParams.js';
import { normalizeClientName, parseClientFilterQuery } from '../utils/clientName.js';

export type CallOffCalculatorFilterContext = {
  empty: boolean;
  machineIds?: number[];
  types: string[];
};

export function resolveCallOffCalculatorFilters(
  query: Record<string, unknown>,
  machineIdsFromQuery?: number[]
): CallOffCalculatorFilterContext {
  const types = parseCsvQueryParamSingleOrMulti(query.types, query.types);
  const clients = parseClientFilterQuery(query.client, query.clients);
  let machineIds = machineIdsFromQuery?.length ? [...machineIdsFromQuery] : undefined;

  const groupIds = parseGroupIdsParam(query.groupIds as string | undefined);
  if (groupIds.length > 0) {
    const groupMachineIds = resolveMachineIdsFromGroups(groupIds);
    if (groupMachineIds.length === 0) {
      return { empty: true, types, machineIds: [] };
    }
    if (machineIds?.length) {
      const set = new Set(groupMachineIds);
      machineIds = machineIds.filter((id) => set.has(id));
      if (machineIds.length === 0) return { empty: true, types, machineIds: [] };
    } else {
      machineIds = groupMachineIds;
    }
  }

  if (clients.length > 0) {
    const clientIn = sqlInClause(clients, 'p.client');
    const clientMachineIds = (
      db
        .prepare(`
          SELECT DISTINCT o.machine_id AS id
          FROM operations o
          JOIN projects p ON p.id = o.project_id
          WHERE p.status = 'active' AND ${clientIn.clause}
        `)
        .all(...clientIn.params) as { id: number }[]
    ).map((r) => r.id);

    if (clientMachineIds.length === 0) {
      return { empty: true, types, machineIds: [] };
    }
    if (machineIds?.length) {
      const set = new Set(clientMachineIds);
      machineIds = machineIds.filter((id) => set.has(id));
      if (machineIds.length === 0) return { empty: true, types, machineIds: [] };
    } else {
      machineIds = clientMachineIds;
    }
  }

  const machineIdsParam = query.machineIds as string | undefined;
  if (machineIdsParam?.trim()) {
    const ids = parseIdList(machineIdsParam, undefined);
    if (ids.length > 0) {
      if (machineIds?.length) {
        const set = new Set(ids);
        machineIds = machineIds.filter((id) => set.has(id));
        if (machineIds.length === 0) return { empty: true, types, machineIds: [] };
      } else {
        machineIds = ids;
      }
    }
  }

  return { empty: false, machineIds, types };
}
