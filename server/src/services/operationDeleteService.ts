import { db } from '../db/connection.js';
import {
  clearParentAllocationOverridesIfNoChildren,
  ensureSplitChildYearCoverage,
  findAllocationTreeRootOperationId,
  mergeSplitChildVolumesIntoParent,
} from './allocationService.js';

export type DeleteOperationResult = { ok: true } | { ok: false; error: string; statusCode?: number };

/** Usuwa z projektu detale bez powiązanych operacji (główny part_id ani set_member). */
export function cleanupOrphanPartsForProject(projectId: number): void {
  db.prepare(`
    DELETE FROM parts
    WHERE project_id = ?
      AND id NOT IN (
        SELECT o.part_id FROM operations o WHERE o.project_id = ?
        UNION
        SELECT osm.part_id
        FROM operation_set_members osm
        JOIN operations o2 ON o2.id = osm.operation_id
        WHERE o2.project_id = ?
      )
  `).run(projectId, projectId, projectId);
}

/** Usuwa operację w projekcie (ta sama logika co DELETE /projects/:id/operations/:opId). */
export function deleteOperationInProject(projectId: number, opId: number): DeleteOperationResult {
  const opRow = db
    .prepare('SELECT id, split_from_operation_id, machine_id, part_id FROM operations WHERE id = ? AND project_id = ?')
    .get(opId, projectId) as
    | { id: number; split_from_operation_id: number | null; machine_id: number | null; part_id: number | null }
    | undefined;
  if (!opRow) return { ok: false, error: 'Nie znaleziono operacji', statusCode: 404 };

  const hasChildren = db.prepare('SELECT 1 FROM operations WHERE split_from_operation_id = ? LIMIT 1').get(opId);

  if (hasChildren) {
    if (opRow.split_from_operation_id == null) {
      return {
        ok: false,
        statusCode: 400,
        error:
          'Operacja ma operacje potomne — najpierw usuń potomki lub operacje pośrednie z alokacji wolumenu.',
      };
    }
    const rootId = findAllocationTreeRootOperationId(opId);
    const rootInProject = db.prepare('SELECT id FROM operations WHERE id = ? AND project_id = ?').get(rootId, projectId);
    if (!rootInProject || rootId === opId) {
      return { ok: false, statusCode: 400, error: 'Nie można ustalić operacji źródłowej do scalenia wolumenu.' };
    }
    const childIds = db.prepare('SELECT id FROM operations WHERE split_from_operation_id = ?').all(opId) as { id: number }[];
    mergeSplitChildVolumesIntoParent(rootId, opId);
    db.prepare('UPDATE operations SET split_from_operation_id = ? WHERE split_from_operation_id = ?').run(rootId, opId);
    for (const { id } of childIds) {
      ensureSplitChildYearCoverage(id);
    }
    const r = db.prepare('DELETE FROM operations WHERE id = ? AND project_id = ?').run(opId, projectId);
    if (r.changes === 0) return { ok: false, error: 'Nie znaleziono operacji', statusCode: 404 };
    cleanupOrphanPartsForProject(projectId);
    clearParentAllocationOverridesIfNoChildren(rootId);
    const immediateParentId = Number(opRow.split_from_operation_id);
    if (Number.isFinite(immediateParentId)) {
      clearParentAllocationOverridesIfNoChildren(immediateParentId);
    }
    return { ok: true };
  }

  const parentId = opRow.split_from_operation_id != null ? Number(opRow.split_from_operation_id) : null;
  if (parentId != null && !Number.isNaN(parentId)) {
    const parent = db.prepare('SELECT id FROM operations WHERE id = ? AND project_id = ?').get(parentId, projectId);
    if (parent) mergeSplitChildVolumesIntoParent(parentId, opId);
  }

  const r = db.prepare('DELETE FROM operations WHERE id = ? AND project_id = ?').run(opId, projectId);
  if (r.changes === 0) return { ok: false, error: 'Nie znaleziono operacji', statusCode: 404 };
  cleanupOrphanPartsForProject(projectId);
  if (parentId != null && !Number.isNaN(parentId)) {
    clearParentAllocationOverridesIfNoChildren(parentId);
  }
  return { ok: true };
}

export type DesignationRelatedOperation = {
  id: number;
  project_id: number;
  project_client: string;
  project_name: string;
  machine_id: number;
  machine_internal: string | number | null;
  machine_sap: string | null;
  machine_type: string | null;
  phase_name: string;
  cycle_time_seconds: number;
  is_set: number;
  has_children: number;
  detail_sap_number: string | null;
  detail_alias: string | null;
  detail_free_text: string | null;
};

/** Operacje powiązane z oznaczeniem detalu (part główny lub skład setu). */
export function listOperationsForDesignation(designationId: number): DesignationRelatedOperation[] {
  return db
    .prepare(
      `
    SELECT DISTINCT
      o.id,
      o.project_id,
      TRIM(COALESCE(pr.client, '')) AS project_client,
      TRIM(COALESCE(pr.name, '')) AS project_name,
      o.machine_id,
      m.internal_number AS machine_internal,
      m.sap_number AS machine_sap,
      m.type AS machine_type,
      ph.name AS phase_name,
      o.cycle_time_seconds,
      COALESCE(o.is_set, 0) AS is_set,
      CASE WHEN EXISTS (SELECT 1 FROM operations ch WHERE ch.split_from_operation_id = o.id) THEN 1 ELSE 0 END AS has_children,
      pd.sap_number AS detail_sap_number,
      pd.alias AS detail_alias,
      pd.free_text AS detail_free_text
    FROM operations o
    JOIN projects pr ON pr.id = o.project_id
    JOIN machines m ON m.id = o.machine_id
    JOIN process_phases ph ON ph.id = o.phase_id
    LEFT JOIN parts pt ON pt.id = o.part_id
    LEFT JOIN part_designations pd ON pd.id = pt.designation_id
    WHERE pt.designation_id = ?
       OR o.id IN (
         SELECT osm.operation_id
         FROM operation_set_members osm
         JOIN parts pt2 ON pt2.id = osm.part_id
         WHERE pt2.designation_id = ?
       )
    ORDER BY pr.client, pr.name, o.id
  `
    )
    .all(designationId, designationId) as DesignationRelatedOperation[];
}

export function countOperationsForDesignation(designationId: number): number {
  const row = db
    .prepare(
      `
    SELECT COUNT(DISTINCT o.id) AS c
    FROM operations o
    LEFT JOIN parts pt ON pt.id = o.part_id
    WHERE pt.designation_id = ?
       OR o.id IN (
         SELECT osm.operation_id
         FROM operation_set_members osm
         JOIN parts pt2 ON pt2.id = osm.part_id
         WHERE pt2.designation_id = ?
       )
  `
    )
    .get(designationId, designationId) as { c: number };
  return Number(row?.c ?? 0);
}
