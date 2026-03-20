import { db } from '../db/connection.js';
import {
  getMachineCapacitiesForYear,
  getSettingsForYear,
  volumeToWeekly,
  resolveOperationVolumeForYear,
  getEffectiveVolumeForPart,
  getYearFractionFromSopEop,
} from './capacityService.js';

export interface OverloadInfo {
  machine_id: number;
  internal_number: number;
  type: string;
  year: number;
  load_percent: number;
  required_sec_per_week: number;
  availability_sec_per_week: number;
}

export function getOverloadedMachines(year: number, thresholdPercent: number = 100): OverloadInfo[] {
  const rows = getMachineCapacitiesForYear(year);
  return rows.filter((r) => r.load_percent > thresholdPercent).map((r) => ({
    machine_id: r.machine_id,
    internal_number: r.internal_number,
    type: r.type,
    year,
    load_percent: r.load_percent,
    required_sec_per_week: r.required_sec_per_week,
    availability_sec_per_week: r.availability_sec_per_week,
  }));
}

/** Get candidate machines for reallocation: same nest OR in alternatives list; optionally same location. Must be "free" (under threshold). */
export function getCandidatesForAllocation(
  machineId: number,
  year: number,
  maxLoadPercent: number = 90
): { machine_id: number; internal_number: number; type: string; sap_number: string | null; load_percent: number; free_capacity_sec_per_week: number }[] {
  const capacities = getMachineCapacitiesForYear(year);
  const sourceMachine = capacities.find((c) => c.machine_id === machineId);
  /* Bez wiersza źródła (np. maszyna nieaktywna) nie ma sensu listy kandydatów. */
  if (!sourceMachine) return [];

  const nestMachineIds = db.prepare(`
    SELECT nm2.machine_id
    FROM nest_machines nm1
    JOIN nest_machines nm2 ON nm2.nest_id = nm1.nest_id
    WHERE nm1.machine_id = ? AND nm2.machine_id != ?
  `).all(machineId, machineId) as { machine_id: number }[];

  const altMachineIds = db.prepare(`
    SELECT alternative_machine_id AS machine_id FROM machine_alternatives WHERE machine_id = ?
  `).all(machineId) as { machine_id: number }[];

  const candidateIds = new Set<number>([
    ...nestMachineIds.map((m) => m.machine_id),
    ...altMachineIds.map((m) => m.machine_id),
  ]);

  const machine = db.prepare('SELECT location FROM machines WHERE id = ?').get(machineId) as { location: string | null } | undefined;
  const sourceLocation = machine?.location ?? null;

  const buildList = (respectLocation: boolean) => {
    const result: { machine_id: number; internal_number: number; type: string; sap_number: string | null; load_percent: number; free_capacity_sec_per_week: number }[] = [];
    for (const id of candidateIds) {
      const cap = capacities.find((c) => c.machine_id === id);
      if (!cap || cap.load_percent >= maxLoadPercent) continue;

      if (respectLocation && sourceLocation) {
        const m = db.prepare('SELECT location FROM machines WHERE id = ?').get(id) as { location: string | null } | undefined;
        if (m?.location != null && m.location !== sourceLocation) continue;
      }

      const freeSec = Math.max(0, cap.availability_sec_per_week - cap.required_sec_per_week);
      const machineRow = db.prepare('SELECT internal_number, type, sap_number FROM machines WHERE id = ?').get(id) as any;
      result.push({
        machine_id: id,
        internal_number: machineRow.internal_number,
        type: machineRow.type,
        sap_number: machineRow.sap_number ?? null,
        load_percent: cap.load_percent,
        free_capacity_sec_per_week: freeSec,
      });
    }
    result.sort((a, b) => b.free_capacity_sec_per_week - a.free_capacity_sec_per_week);
    return result;
  };

  let result = buildList(true);
  /* Gdy w bazie są alternatywy / gniazdo, ale wszystkie odpadły przez różną lokalizację — pokaż je mimo to. */
  if (result.length === 0 && candidateIds.size > 0) {
    result = buildList(false);
  }

  return result;
}

/** Execute allocation: move (or split) volume for wybrany rok — ten sam wolumen co w kalkulatorze (nadpisanie per rok > projekt/detal > pole operacji). */
export function executeAllocation(
  operationId: number,
  targetMachineId: number,
  volumeToMove: number,
  volumeUnit: 'annual' | 'monthly' | 'weekly',
  year: number,
  cycleTimeSecondsOnTarget?: number | null
): { success: boolean; error?: string } {
  const op = db
    .prepare(
      `
    SELECT o.*, p.sop, p.eop
    FROM operations o
    JOIN projects p ON p.id = o.project_id
    WHERE o.id = ?
  `
    )
    .get(operationId) as any;
  if (!op) return { success: false, error: 'Operation not found' };

  const settings = getSettingsForYear(year);
  if (!settings) return { success: false, error: `Brak ustawień dni roboczych dla roku ${year}` };

  const opYearRow = db
    .prepare('SELECT volume_value, volume_unit FROM operation_volume_by_year WHERE operation_id = ? AND year = ?')
    .get(operationId, year) as { volume_value: number; volume_unit: string } | undefined;

  const resolved = resolveOperationVolumeForYear(
    {
      operation_id: operationId,
      project_id: op.project_id,
      part_id: op.part_id,
      volume_value: op.volume_value,
      volume_unit: op.volume_unit,
    },
    year,
    opYearRow ?? null
  );

  if (resolved.volume_value <= 0) {
    return { success: false, error: 'Dla wybranego roku wolumen tej operacji wynosi 0.' };
  }

  const effective = op.part_id ? getEffectiveVolumeForPart(op.project_id, op.part_id, year) : null;
  const fraction =
    op.project_id != null
      ? resolved.source === 'part' && effective && (effective as any).count_after_eop
        ? 1
        : getYearFractionFromSopEop(op.sop ?? '', op.eop ?? '', year)
      : 1;

  const currentWeekly = volumeToWeekly(resolved.volume_value, resolved.volume_unit, settings) * fraction;
  const moveWeekly = volumeToWeekly(volumeToMove, volumeUnit, settings) * fraction;

  if (volumeToMove <= 0) return { success: false, error: 'Wolumen musi być dodatni.' };
  if (moveWeekly > currentWeekly + 1e-6) {
    return { success: false, error: 'Wolumen do przeniesienia przekracza wolumen operacji dla wybranego roku.' };
  }

  const effectiveCycleOnTarget =
    cycleTimeSecondsOnTarget != null && cycleTimeSecondsOnTarget > 0 ? cycleTimeSecondsOnTarget : op.cycle_time_seconds;

  const isFullMove = moveWeekly >= currentWeekly - 1e-5;

  if (isFullMove) {
    db.prepare('UPDATE operations SET machine_id = ?, cycle_time_seconds = ? WHERE id = ?').run(
      targetMachineId,
      effectiveCycleOnTarget,
      operationId
    );
    return { success: true };
  }

  // Częściowy podział: zapis wolumenu per rok, żeby kalkulator i alokacja były spójne (zwłaszcza gdy bazowe pole operacji = 0)
  const remainingWeekly = currentWeekly - moveWeekly;
  const remainingBaseWeekly = fraction > 1e-9 ? remainingWeekly / fraction : remainingWeekly;

  const upsertYear = db.prepare(
    'INSERT OR REPLACE INTO operation_volume_by_year (operation_id, year, volume_value, volume_unit, source) VALUES (?, ?, ?, ?, ?)'
  );
  upsertYear.run(operationId, year, remainingBaseWeekly, 'weekly', 'allocation');

  const insertOp = db.prepare(`
    INSERT INTO operations (project_id, part_id, phase_id, machine_id, cycle_time_seconds, volume_value, volume_unit, nests_count, oee_override, capacity_percent, opf, sap, description, split_from_operation_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insResult = insertOp.run(
    op.project_id,
    op.part_id,
    op.phase_id,
    targetMachineId,
    effectiveCycleOnTarget,
    volumeToMove,
    volumeUnit,
    op.nests_count,
    op.oee_override,
    op.capacity_percent,
    op.opf,
    op.sap,
    op.description,
    operationId
  );
  const newOpId = insResult.lastInsertRowid;
  if (newOpId) {
    const volYears = db.prepare('SELECT year FROM project_volumes WHERE project_id = ? ORDER BY year').all(op.project_id) as { year: number }[];
    let yearList = volYears.map((r) => r.year);
    if (yearList.length === 0) yearList = [year];
    if (!yearList.includes(year)) yearList = [...yearList, year].sort((a, b) => a - b);
    for (const y of yearList) {
      if (y === year) upsertYear.run(newOpId, y, volumeToMove, volumeUnit, 'allocation');
      else upsertYear.run(newOpId, y, 0, 'weekly', 'allocation');
    }
  }

  return { success: true };
}

/**
 * Przed usunięciem operacji potomnej z alokacji: sumuje wolumen per rok z dziecka z wolumenem rodzica (w „bazowym” tygodniowym przepływie),
 * zapisuje w operation_volume_by_year rodzica jako weekly — zgodnie z konwencją zapisu przy podziale.
 */
export function mergeSplitChildVolumesIntoParent(parentOperationId: number, childOperationId: number): void {
  const childRows = db
    .prepare('SELECT year, volume_value, volume_unit FROM operation_volume_by_year WHERE operation_id = ? ORDER BY year')
    .all(childOperationId) as { year: number; volume_value: number; volume_unit: string }[];

  const upsert = db.prepare(
    'INSERT OR REPLACE INTO operation_volume_by_year (operation_id, year, volume_value, volume_unit, source) VALUES (?, ?, ?, ?, ?)'
  );

  for (const row of childRows) {
    const { year, volume_value: cv, volume_unit: cuRaw } = row;
    const cu = cuRaw === 'monthly' || cuRaw === 'weekly' ? cuRaw : 'annual';
    const settings = getSettingsForYear(year);
    if (!settings) continue;

    const childBaseWeekly = volumeToWeekly(cv, cu, settings);
    if (childBaseWeekly <= 1e-9) continue;

    const parentYearRow = db
      .prepare('SELECT volume_value, volume_unit FROM operation_volume_by_year WHERE operation_id = ? AND year = ?')
      .get(parentOperationId, year) as { volume_value: number; volume_unit: string } | undefined;

    let parentBaseWeekly = 0;
    if (parentYearRow) {
      const pu = parentYearRow.volume_unit === 'monthly' || parentYearRow.volume_unit === 'weekly' ? parentYearRow.volume_unit : 'annual';
      parentBaseWeekly = volumeToWeekly(parentYearRow.volume_value, pu, settings);
    }

    const mergedBaseWeekly = parentBaseWeekly + childBaseWeekly;
    upsert.run(parentOperationId, year, mergedBaseWeekly, 'weekly', 'allocation');
  }
}

/** If parent has no more split children, remove allocation overrides and return to project/detail volumes. */
export function clearParentAllocationOverridesIfNoChildren(parentOperationId: number): void {
  const hasChildren = db
    .prepare('SELECT 1 FROM operations WHERE split_from_operation_id = ? LIMIT 1')
    .get(parentOperationId);
  if (hasChildren) return;
  db.prepare('DELETE FROM operation_volume_by_year WHERE operation_id = ? AND COALESCE(source, \'manual\') = \'allocation\'').run(parentOperationId);
}
