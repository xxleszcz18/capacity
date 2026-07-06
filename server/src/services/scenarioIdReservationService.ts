import { db, saveDb } from '../db/connection.js';
import type { ScenarioBundle } from './scenarioSnapshotService.js';

const ENTITY_TABLE: Record<'project' | 'part' | 'operation', string> = {
  project: 'projects',
  part: 'parts',
  operation: 'operations',
};

function maxProdTableId(table: string): number {
  const row = db.prepare(`SELECT COALESCE(MAX(id), 0) AS m FROM ${table}`).get() as { m: number } | undefined;
  return Number(row?.m ?? 0);
}

function maxReservedGlobal(entity: 'project' | 'part' | 'operation'): number {
  try {
    const row = db
      .prepare(`SELECT COALESCE(MAX(reserved_id), 0) AS m FROM scenario_id_reservations WHERE entity = ?`)
      .get(entity) as { m: number } | undefined;
    return Number(row?.m ?? 0);
  } catch {
    return 0;
  }
}

function maxSnapshotEntityId(entity: 'project' | 'part' | 'operation', bundle: ScenarioBundle): number {
  let m = 0;
  if (entity === 'project') {
    for (const p of bundle.projects || []) m = Math.max(m, Number((p as any).id) || 0);
  } else if (entity === 'part') {
    for (const p of bundle.parts || []) m = Math.max(m, Number((p as any).id) || 0);
  } else {
    for (const o of bundle.operations || []) m = Math.max(m, Number((o as any).id) || 0);
  }
  return m;
}

/**
 * Rezerwuje następny identyfikator w zakresie globalnym (produkcja + aktywne rezerwacje + bieżący snapshot),
 * zapisuje wpis w `scenario_id_reservations` — bez tworzenia wierszy w `projects`/`parts`/`operations`.
 */
export function allocateScenarioEntityId(
  entity: 'project' | 'part' | 'operation',
  scenarioId: number,
  bundle: ScenarioBundle
): number {
  const prodMax = maxProdTableId(ENTITY_TABLE[entity]);
  const resMax = maxReservedGlobal(entity);
  const snapMax = maxSnapshotEntityId(entity, bundle);
  const next = Math.max(prodMax, resMax, snapMax) + 1;
  db.prepare(`INSERT INTO scenario_id_reservations (scenario_id, entity, reserved_id) VALUES (?, ?, ?)`).run(
    scenarioId,
    entity,
    next
  );
  saveDb();
  return next;
}

export function releaseAllReservationsForScenario(scenarioId: number): void {
  try {
    db.prepare(`DELETE FROM scenario_id_reservations WHERE scenario_id = ?`).run(scenarioId);
    saveDb();
  } catch {
    /* tabela może nie istnieć przy starcie z bardzo starej bazy — ignoruj */
  }
}

export function releaseReservationsForDeployedIds(
  scenarioId: number,
  deployed: { projectIds?: number[]; partIds?: number[]; operationIds?: number[] }
): void {
  const stmt = db.prepare(`DELETE FROM scenario_id_reservations WHERE scenario_id = ? AND entity = ? AND reserved_id = ?`);
  try {
    for (const id of deployed.projectIds ?? []) stmt.run(scenarioId, 'project', id);
    for (const id of deployed.partIds ?? []) stmt.run(scenarioId, 'part', id);
    for (const id of deployed.operationIds ?? []) stmt.run(scenarioId, 'operation', id);
    saveDb();
  } catch {
    /* ignore */
  }
}
