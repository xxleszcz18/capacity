import { db, saveDb } from '../db/connection.js';
import { allocateScenarioEntityId } from './scenarioIdReservationService.js';
import {
  getMachineCapacitiesForYear,
  getMachineLoadComputationDetails,
  resolveSettingsForYear,
  volumeToWeekly,
  resolveOperationVolumeForYear,
  getEffectiveVolumeForPart,
  getEffectiveVolumeForPartPreferContract,
  resolveWeeklyVolumeFromResolved,
  resolveOperationCycleForCalculator,
  operationHasAlternativeCycle,
  invalidateAllocationSplitIndex,
} from './capacityService.js';
import { getProductionMonthsInYear } from '../utils/sopEopFormat.js';

/** Alokacja „placeholder” — wolumen 0, ale rok w zakresie SOP–EOP (wolumeny mogą pojawić się później). */
export function canAllocateZeroVolumePlaceholder(
  sop: unknown,
  eop: unknown,
  year: number,
  resolvedVolume: number
): boolean {
  if (resolvedVolume > 1e-9) return false;
  return getProductionMonthsInYear(sop, eop, year) > 0;
}

export type TargetCycleOnAllocation = {
  cycleTimeSecondsOnTarget?: number | null;
  useAlternativeCycleOnTarget?: boolean;
};

/** Czas / gniazda / OEE operacji na maszynie docelowej po alokacji. */
export function resolveTargetCycleOnAllocation(
  op: any,
  opts: TargetCycleOnAllocation
): { ok: true; cycleSeconds: number; nests: number; oeeForResolve: number | null } | { ok: false; error: string } {
  if (opts.useAlternativeCycleOnTarget) {
    if (!operationHasAlternativeCycle(op)) {
      return { ok: false, error: 'Operacja nie ma zdefiniowanego alternatywnego czasu cyklu.' };
    }
    const alt = Number(op.alt_cycle_time_seconds);
    const nestsRaw =
      op.alt_nests_count != null && Number(op.alt_nests_count) > 0
        ? Number(op.alt_nests_count)
        : Number(op.nests_count ?? 1);
    const oee =
      op.alt_oee_override != null && Number(op.alt_oee_override) > 0
        ? Number(op.alt_oee_override)
        : op.oee_override != null
          ? Number(op.oee_override)
          : null;
    return { ok: true, cycleSeconds: alt, nests: Math.max(1, nestsRaw || 1), oeeForResolve: oee };
  }
  const manual =
    opts.cycleTimeSecondsOnTarget != null &&
    Number.isFinite(Number(opts.cycleTimeSecondsOnTarget)) &&
    Number(opts.cycleTimeSecondsOnTarget) > 0;
  if (manual) {
    return {
      ok: true,
      cycleSeconds: Number(opts.cycleTimeSecondsOnTarget),
      nests: Math.max(1, Number(op.nests_count ?? 1) || 1),
      oeeForResolve: op.oee_override != null ? Number(op.oee_override) : null,
    };
  }
  const resolved = resolveOperationCycleForCalculator(op);
  return {
    ok: true,
    cycleSeconds: resolved.cycleSeconds,
    nests: resolved.nests,
    oeeForResolve: resolved.oeeForResolve,
  };
}
import type { ScenarioBundle } from './scenarioSnapshotService.js';
import {
  parseScenarioSnapshotJson,
  pushScenarioAudit,
  resolveSettingsForScenarioYear,
  scenarioHydratedOperationsForActiveProjects,
  getEffectiveVolumeForPartScenarioPreferContract,
} from './scenarioSnapshotService.js';

export interface OverloadInfo {
  machine_id: number;
  internal_number: string | number;
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

/** Get candidate machines for reallocation: same nest OR in alternatives list; optionally same line (pole location = nr linii). Must be "free" (under threshold). */
export function getCandidatesForAllocation(
  machineId: number,
  year: number,
  maxLoadPercent: number = 90,
  /** Do listy wyboru (np. modal alokacji): dołącz maszyny z jawnej listy alternatyw nawet przy obciążeniu ≥ max (bez zmiany filtru gniazda). */
  includeOverloadedAlternatives: boolean = false,
  scenarioSnapshot?: ScenarioBundle | null,
  scenarioIncludeRfq: boolean = true,
  useContractualVolumes: boolean = false
): { machine_id: number; internal_number: string | number; type: string; sap_number: string | null; load_percent: number; free_capacity_sec_per_week: number }[] {
  const opsOverride =
    scenarioSnapshot != null ? scenarioHydratedOperationsForActiveProjects(scenarioSnapshot, { includeRfq: scenarioIncludeRfq }) : undefined;
  const capacities = getMachineCapacitiesForYear(
    year,
    undefined,
    undefined,
    opsOverride,
    scenarioSnapshot ?? null,
    scenarioIncludeRfq,
    useContractualVolumes
  );
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
    const result: { machine_id: number; internal_number: string | number; type: string; sap_number: string | null; load_percent: number; free_capacity_sec_per_week: number }[] = [];
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
  /* Gdy w bazie są alternatywy / gniazdo, ale wszystkie odpadły przez różny nr linii — pokaż je mimo to. */
  if (result.length === 0 && candidateIds.size > 0) {
    result = buildList(false);
  }

  if (!includeOverloadedAlternatives) return result;

  const inResult = new Set(result.map((r) => r.machine_id));
  const extra: typeof result = [];
  for (const row of altMachineIds) {
    const id = row.machine_id;
    if (inResult.has(id)) continue;
    const cap = capacities.find((c) => c.machine_id === id);
    if (!cap) continue;
    const freeSec = Math.max(0, cap.availability_sec_per_week - cap.required_sec_per_week);
    const machineRow = db.prepare('SELECT internal_number, type, sap_number FROM machines WHERE id = ?').get(id) as any;
    if (!machineRow) continue;
    extra.push({
      machine_id: id,
      internal_number: machineRow.internal_number,
      type: machineRow.type,
      sap_number: machineRow.sap_number ?? null,
      load_percent: cap.load_percent,
      free_capacity_sec_per_week: freeSec,
    });
  }
  extra.sort((a, b) => b.free_capacity_sec_per_week - a.free_capacity_sec_per_week);
  return [...result, ...extra];
}

export type AllocationLoadHint = {
  current_load_percent: number;
  /** Udział tej operacji w obciążeniu maszyny (jak w kalkulatorze). */
  op_load_percent: number;
  /** Wolumen do przeniesienia (w jednostce effective), żeby zostawić maszynę źródłową przy ~100% obciążenia (tylko ta operacja). */
  suggested_volume_to_reach_100: number;
  suggested_volume_unit: 'annual' | 'monthly' | 'weekly';
  effective_volume_value: number;
  effective_volume_unit: 'annual' | 'monthly' | 'weekly';
  load_ratio_sum: number;
  usage: number;
  op_ratio_contrib: number;
  weekly_volume_effective: number;
  working_weeks_per_year: number;
  year_fraction: number;
};

/** Udział jednej operacji w obciążeniu maszyny [%], spójny z current_load_percent. */
export function operationLoadPercentOfMachine(
  loadRatioSum: number,
  opRatioContrib: number,
  machineLoadPercent: number
): number {
  if (loadRatioSum <= 1e-12 || opRatioContrib <= 1e-12) return 0;
  return (opRatioContrib / loadRatioSum) * machineLoadPercent;
}

/**
 * Tygodniowy wolumen efektywny grupy, do którego odnosi się op_load_percent.
 * Tylko ten wolumen może służyć do przeliczeń obciążenie% ↔ wolumen (jest spójny z op_load_percent).
 */
function movableBaseWeekly(
  hint: Pick<AllocationLoadHint, 'weekly_volume_effective'>,
  groupWeeklyMovable?: number
): number {
  const group = groupWeeklyMovable ?? 0;
  if (group > 1e-9) return group;
  return hint.weekly_volume_effective > 1e-9 ? hint.weekly_volume_effective : 0;
}

/** Szacowane obciążenie maszyny po przeniesieniu wolumenu (effective weekly) z wybranej operacji. */
export function projectMachineLoadAfterTransfer(
  hint: Pick<
    AllocationLoadHint,
    'current_load_percent' | 'load_ratio_sum' | 'op_ratio_contrib' | 'weekly_volume_effective' | 'op_load_percent'
  >,
  moveWeeklyEffective: number,
  groupWeeklyMovable?: number
): number {
  const base = movableBaseWeekly(hint, groupWeeklyMovable);
  if (base <= 1e-12) return hint.current_load_percent;
  const applied = Math.min(base, Math.max(0, moveWeeklyEffective));
  const opLoadPercent =
    hint.op_load_percent > 1e-9
      ? hint.op_load_percent
      : operationLoadPercentOfMachine(hint.load_ratio_sum, hint.op_ratio_contrib, hint.current_load_percent);
  const reduction = (applied / base) * opLoadPercent;
  return Math.round(Math.max(0, hint.current_load_percent - reduction));
}

/**
 * Wolumen przeniesienia z żądania execute — spójny z effective_volume_weekly z API maszyn.
 * Gdy unit=weekly, wartość jest już tygodniowym wolumenem efektywnym dla roku (SOP/EOP), bez ponownego × fraction.
 */
export function resolveAllocationMoveWeekly(
  volumeToMove: number,
  volumeUnit: 'annual' | 'monthly' | 'weekly',
  settings: Parameters<typeof volumeToWeekly>[2],
  yearFraction: number
): { moveWeeklyEffective: number; moveBaseWeekly: number } {
  const f = yearFraction > 1e-12 ? yearFraction : 1;
  if (volumeUnit === 'weekly') {
    return {
      moveWeeklyEffective: volumeToMove,
      moveBaseWeekly: volumeToMove / f,
    };
  }
  const moveWeeklyEffective = volumeToWeekly(volumeToMove, volumeUnit, settings) * f;
  return {
    moveWeeklyEffective,
    moveBaseWeekly: moveWeeklyEffective / f,
  };
}

/**
 * Wolumen do przeniesienia, aby po alokacji na maszynie źródłowej zostało `remainingLoadPercent` obciążenia.
 */
export function computeVolumeForRemainingMachineLoad(
  hint: AllocationLoadHint,
  /** Docelowe obciążenie maszyny źródłowej po przeniesieniu [%] — „ile ma pozostać”. */
  remainingLoadPercent: number,
  groupWeeklyMovable?: number
): {
  volume: number;
  unit: AllocationLoadHint['suggested_volume_unit'];
  projected_load_percent: number;
  move_weekly_effective: number;
  insufficient: boolean;
  already_at_or_below: boolean;
} {
  const remaining = Math.min(300, Math.max(0, remainingLoadPercent));
  const current = hint.current_load_percent;
  const u = hint.suggested_volume_unit;
  const base = movableBaseWeekly(hint, groupWeeklyMovable);

  if (current <= remaining + 1e-9) {
    return {
      volume: 0,
      unit: u,
      projected_load_percent: current,
      move_weekly_effective: 0,
      insufficient: false,
      already_at_or_below: true,
    };
  }
  if (base <= 1e-9) {
    return {
      volume: 0,
      unit: u,
      projected_load_percent: current,
      move_weekly_effective: 0,
      insufficient: true,
      already_at_or_below: false,
    };
  }

  const surplusLoadPercent = current - remaining;
  const opLoadPercent =
    hint.op_load_percent > 1e-9
      ? hint.op_load_percent
      : operationLoadPercentOfMachine(hint.load_ratio_sum, hint.op_ratio_contrib, current);

  if (opLoadPercent <= 1e-9) {
    return {
      volume: 0,
      unit: u,
      projected_load_percent: current,
      move_weekly_effective: 0,
      insufficient: true,
      already_at_or_below: false,
    };
  }

  // Ułamek wolumenu grupy do przeniesienia: ile trzeba zabrać, aby zdjąć `surplus` p.p. obciążenia.
  const fractionOfGroup = Math.min(1, Math.max(0, surplusLoadPercent / opLoadPercent));
  const moveWeeklyEff = fractionOfGroup * base;

  // Cała grupa zdejmuje tylko op_load_percent p.p. — gdy to za mało, nie da się zejść do celu jedną operacją.
  const projectedIfMoveAll = Math.round(Math.max(0, current - opLoadPercent));
  const insufficient = projectedIfMoveAll > remaining + 1;
  const projected = projectMachineLoadAfterTransfer(hint, moveWeeklyEff, base);

  const fractionY = hint.year_fraction > 1e-12 ? hint.year_fraction : 1;
  const moveBaseWeekly = moveWeeklyEff / fractionY;
  let volume = 0;
  if (u === 'weekly') volume = moveBaseWeekly;
  else if (u === 'annual') volume = moveBaseWeekly * hint.working_weeks_per_year;
  else volume = (moveBaseWeekly * hint.working_weeks_per_year) / 12;

  return {
    volume: Math.round(volume * 1e6) / 1e6,
    unit: u,
    projected_load_percent: projected,
    move_weekly_effective: moveWeeklyEff,
    insufficient,
    already_at_or_below: false,
  };
}

/** @deprecated alias — używaj computeVolumeForRemainingMachineLoad */
export function computeSurplusVolumeForTargetLoad(
  hint: AllocationLoadHint,
  remainingLoadPercent: number,
  groupWeeklyMovable?: number
): { volume: number; unit: AllocationLoadHint['suggested_volume_unit']; projected_load_percent: number } {
  const r = computeVolumeForRemainingMachineLoad(hint, remainingLoadPercent, groupWeeklyMovable);
  return { volume: r.volume, unit: r.unit, projected_load_percent: r.projected_load_percent };
}

/**
 * Sugestia przeniesienia wolumenu z jednej operacji, żeby po przeniesieniu obciążenie maszyny źródłowej było ~100%
 * (wg tej samej metody co kalkulator: suma required/availability per operacja × usage).
 * Pola load_ratio_sum, op_ratio_contrib, weekly_volume_effective, usage, year_fraction służą do symulacji % po przeniesieniu (klient).
 */
export function getAllocationLoadHint(
  machineId: number,
  year: number,
  operationIds: number[],
  scenarioSnapshot?: ScenarioBundle | null,
  scenarioIncludeRfq: boolean = true,
  useContractualVolumes: boolean = false
): AllocationLoadHint | { error: string } {
  const ids = [...new Set(operationIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  if (ids.length === 0) return { error: 'Brak identyfikatorów operacji.' };

  const details = getMachineLoadComputationDetails(
    year,
    machineId,
    undefined,
    scenarioSnapshot ?? null,
    scenarioIncludeRfq,
    useContractualVolumes
  );
  if (!details) return { error: 'Brak danych capacity (ustawienia roku lub maszyna).' };

  const ops = ids.map((id) => details.op_by_id[id]).filter((o): o is NonNullable<typeof o> => o != null);
  if (ops.length === 0) return { error: 'Operacja nie należy do tej maszyny lub brak w danym roku.' };

  const { load_ratio_sum: loadRatioSum, usage, working_weeks_per_year: workWeeks } = details;
  const ratioContrib = ops.reduce((s, o) => s + o.ratio_contrib, 0);
  const weeklyVol = ops.reduce((s, o) => s + o.weekly_volume, 0);
  const primary = ops.reduce((best, o) => (o.weekly_volume > best.weekly_volume ? o : best), ops[0]);
  const fraction = primary.fraction > 1e-12 ? primary.fraction : 1;
  const u = primary.resolved_volume_unit;

  const weeklyRounded = Math.round(weeklyVol * 1e6) / 1e6;
  const baseHint: AllocationLoadHint = {
    current_load_percent: details.load_percent,
    op_load_percent: operationLoadPercentOfMachine(loadRatioSum, ratioContrib, details.load_percent),
    suggested_volume_to_reach_100: 0,
    suggested_volume_unit: u,
    effective_volume_value: primary.resolved_volume_value,
    effective_volume_unit: u,
    load_ratio_sum: loadRatioSum,
    usage,
    op_ratio_contrib: ratioContrib,
    weekly_volume_effective: weeklyRounded,
    working_weeks_per_year: workWeeks,
    year_fraction: Math.round((fraction > 1e-12 ? fraction : 1) * 1e6) / 1e6,
  };

  const to100 = computeVolumeForRemainingMachineLoad(baseHint, 100, weeklyRounded);
  baseHint.suggested_volume_to_reach_100 = to100.volume;

  return baseHint;
}

/** Execute allocation: move (or split) volume for wybrany rok — ten sam wolumen co w kalkulatorze (nadpisanie per rok > projekt/detal > pole operacji). */
export function executeAllocation(
  operationId: number,
  targetMachineId: number,
  volumeToMove: number,
  volumeUnit: 'annual' | 'monthly' | 'weekly',
  year: number,
  cycleTimeSecondsOnTarget?: number | null,
  useContractualVolumes: boolean = false,
  useAlternativeCycleOnTarget: boolean = false,
  effectiveFrom?: { month: number; week?: number } | null
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

  const settings = resolveSettingsForYear(year);

  const opYearRow = db
    .prepare(
      `SELECT volume_value, volume_unit, volume_value_before, effective_from_month, effective_from_week
       FROM operation_volume_by_year WHERE operation_id = ? AND year = ?`
    )
    .get(operationId, year) as
    | {
        volume_value: number;
        volume_unit: string;
        volume_value_before: number | null;
        effective_from_month: number | null;
        effective_from_week: number | null;
      }
    | undefined;

  /**
   * Stawka tygodniowa do przeniesienia = wolumen „po” ewentualnym wcześniejszym splitcie,
   * bez ważenia rocznego i bez punktu effectiveFrom z tego requestu (ten punkt zapisujemy osobno).
   */
  const resolved = resolveOperationVolumeForYear(
    {
      operation_id: operationId,
      project_id: op.project_id,
      part_id: op.part_id,
      volume_value: op.volume_value,
      volume_unit: op.volume_unit,
      split_from_operation_id: op.split_from_operation_id ?? null,
    },
    year,
    opYearRow?.effective_from_month != null
      ? {
          volume_value: opYearRow.volume_value,
          volume_unit: opYearRow.volume_unit,
          volume_value_before: null,
          effective_from_month: null,
          effective_from_week: null,
        }
      : opYearRow ?? null,
    null,
    useContractualVolumes,
    undefined
  );

  const zeroPlaceholder = canAllocateZeroVolumePlaceholder(op.sop, op.eop, year, resolved.volume_value);

  if (resolved.volume_value <= 0 && !zeroPlaceholder) {
    return { success: false, error: 'Dla wybranego roku wolumen tej operacji wynosi 0.' };
  }

  const weeklyResolved = zeroPlaceholder
    ? { weekly: 0, fraction: 1 }
    : resolveWeeklyVolumeFromResolved(resolved.volume_value, resolved.volume_unit, settings, {
        sop: op.sop ?? '',
        eop: op.eop ?? '',
        year,
        volume_origin: resolved.volume_origin,
        count_after_eop: resolved.count_after_eop,
        has_project: op.project_id != null,
      });
  const fraction = weeklyResolved.fraction;
  const currentWeekly = weeklyResolved.weekly;
  const { moveWeeklyEffective: moveWeekly, moveBaseWeekly } = zeroPlaceholder
    ? { moveWeeklyEffective: 0, moveBaseWeekly: 0 }
    : resolveAllocationMoveWeekly(volumeToMove, volumeUnit, settings, fraction);

  if (zeroPlaceholder) {
    if (volumeToMove > 1e-6) {
      return { success: false, error: 'Dla roku bez wolumenu można przypisać detal tylko z przeniesieniem 0.' };
    }
  } else {
    if (volumeToMove <= 0) return { success: false, error: 'Wolumen musi być dodatni.' };
    if (moveWeekly > currentWeekly + 1e-6) {
      return { success: false, error: 'Wolumen do przeniesienia przekracza wolumen operacji dla wybranego roku.' };
    }
  }

  const targetCycle = resolveTargetCycleOnAllocation(op, {
    cycleTimeSecondsOnTarget,
    useAlternativeCycleOnTarget,
  });
  if (!targetCycle.ok) return { success: false, error: targetCycle.error };
  const effectiveCycleOnTarget = targetCycle.cycleSeconds;
  const targetNests = targetCycle.nests;
  const targetOeeOverride = targetCycle.oeeForResolve;

  // Zawsze wykonujemy podział roczny (nawet przy "pełnym" przeniesieniu roku),
  // żeby nie przepinać całej operacji globalnie między maszynami.
  const remainingWeekly = currentWeekly - moveWeekly;
  const remainingBaseWeekly = fraction > 1e-9 ? remainingWeekly / fraction : remainingWeekly;
  const childVolumeValue = volumeUnit === 'weekly' ? moveBaseWeekly : volumeToMove;
  const childVolumeUnit = volumeUnit === 'weekly' ? 'weekly' : volumeUnit;

  const fromMonth =
    effectiveFrom?.month != null && Number.isFinite(Number(effectiveFrom.month))
      ? Math.min(12, Math.max(1, Math.floor(Number(effectiveFrom.month))))
      : null;
  const fromWeek =
    fromMonth != null
      ? Math.min(5, Math.max(1, Math.floor(Number(effectiveFrom?.week) || 1)))
      : null;

  /** Przy alokacji od miesiąca/tygodnia: pełna stawka (bazowa weekly) przed punktem startu. */
  const parentBeforeWeekly =
    fromMonth != null
      ? (() => {
          if (opYearRow?.effective_from_month != null && opYearRow.volume_value_before != null) {
            return Number(opYearRow.volume_value_before);
          }
          return fraction > 1e-9 ? currentWeekly / fraction : currentWeekly;
        })()
      : null;

  upsertOperationYearVolume({
    operationId,
    year,
    volumeValue: remainingBaseWeekly,
    volumeUnit: 'weekly',
    source: 'allocation',
    volumeValueBefore: parentBeforeWeekly,
    effectiveFromMonth: fromMonth,
    effectiveFromWeek: fromWeek,
  });

  const insertOp = db.prepare(`
    INSERT INTO operations (project_id, part_id, phase_id, machine_id, cycle_time_seconds, volume_value, volume_unit, nests_count, oee_override, capacity_percent, opf, sap, description, split_from_operation_id,
      alt_cycle_time_seconds, alt_nests_count, alt_oee_override, alt_comment, use_alternative_in_calculator)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insResult = insertOp.run(
    op.project_id,
    op.part_id,
    op.phase_id,
    targetMachineId,
    effectiveCycleOnTarget,
    0,
    'weekly',
    targetNests,
    targetOeeOverride,
    op.capacity_percent,
    op.opf,
    op.sap,
    op.description,
    operationId,
    null,
    null,
    null,
    null,
    0
  );
  const newOpId = insResult.lastInsertRowid;
  if (newOpId) {
    seedSplitChildYearVolumes(
      Number(newOpId),
      Number(op.project_id),
      operationId,
      year,
      childVolumeValue,
      childVolumeUnit,
      fromMonth != null
        ? { month: fromMonth, week: fromWeek ?? 1, volumeBefore: 0 }
        : null
    );
  }

  saveDb();
  invalidateAllocationSplitIndex();
  return { success: true };
}

function upsertOperationYearVolume(opts: {
  operationId: number;
  year: number;
  volumeValue: number;
  volumeUnit: string;
  source: string;
  volumeValueBefore?: number | null;
  effectiveFromMonth?: number | null;
  effectiveFromWeek?: number | null;
}): void {
  try {
    db.prepare(
      `INSERT OR REPLACE INTO operation_volume_by_year
        (operation_id, year, volume_value, volume_unit, source, volume_value_before, effective_from_month, effective_from_week)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      opts.operationId,
      opts.year,
      opts.volumeValue,
      opts.volumeUnit,
      opts.source,
      opts.volumeValueBefore ?? null,
      opts.effectiveFromMonth ?? null,
      opts.effectiveFromWeek ?? null
    );
  } catch (_) {
    db.prepare(
      'INSERT OR REPLACE INTO operation_volume_by_year (operation_id, year, volume_value, volume_unit, source) VALUES (?, ?, ?, ?, ?)'
    ).run(opts.operationId, opts.year, opts.volumeValue, opts.volumeUnit, opts.source);
  }
}

function upsertOpYearInBundle(
  bundle: ScenarioBundle,
  operationId: number,
  year: number,
  volumeValue: number,
  volumeUnit: string,
  source: string,
  effectiveFrom?: { month: number; week: number; volumeBefore: number } | null
): void {
  if (!bundle.operation_volume_by_year) bundle.operation_volume_by_year = [];
  const rows = bundle.operation_volume_by_year;
  const idx = rows.findIndex((r: any) => Number(r.operation_id) === operationId && Number(r.year) === year);
  const next: any = {
    operation_id: operationId,
    year,
    volume_value: volumeValue,
    volume_unit: volumeUnit,
    source,
    volume_value_before: effectiveFrom ? effectiveFrom.volumeBefore : null,
    effective_from_month: effectiveFrom ? effectiveFrom.month : null,
    effective_from_week: effectiveFrom ? effectiveFrom.week : null,
  };
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...next };
  } else {
    rows.push(next);
  }
}

function ensureSplitChildYearCoverageScenario(bundle: ScenarioBundle, operationId: number): void {
  const ops = bundle.operations || [];
  const op = ops.find((o: any) => Number(o.id) === operationId) as any;
  if (!op || op.split_from_operation_id == null) return;

  let yearList = yearsForSplitChildScenario(bundle, Number(op.project_id), Number(op.split_from_operation_id), new Date().getFullYear());
  const ov = bundle.operation_volume_by_year || [];
  for (const v of ov.filter((row: any) => Number(row.operation_id) === operationId)) {
    const y = Number(v.year);
    if (Number.isInteger(y) && !yearList.includes(y)) yearList.push(y);
  }
  yearList = [...new Set(yearList)].sort((a, b) => a - b);
  if (yearList.length === 0) return;

  if (!bundle.operation_volume_by_year) bundle.operation_volume_by_year = [];
  const ovRows = bundle.operation_volume_by_year;
  for (const y of yearList) {
    const has = ovRows.some((v: any) => Number(v.operation_id) === operationId && Number(v.year) === y);
    if (!has) ovRows.push({ operation_id: operationId, year: y, volume_value: 0, volume_unit: 'weekly', source: 'allocation' });
  }
}

/** Alokacja zapisana wyłącznie w snapshotcie scenariusza (bez zmian w tabelach produkcyjnych). */
export function executeAllocationInScenario(
  scenarioId: number,
  operationId: number,
  targetMachineId: number,
  volumeToMove: number,
  volumeUnit: 'annual' | 'monthly' | 'weekly',
  year: number,
  cycleTimeSecondsOnTarget?: number | null,
  actor: string = 'system',
  useContractualVolumes: boolean = false,
  useAlternativeCycleOnTarget: boolean = false,
  effectiveFrom?: { month: number; week?: number } | null
): { success: boolean; error?: string } {
  const row = db.prepare('SELECT snapshot FROM scenarios WHERE id = ?').get(scenarioId) as { snapshot: string } | undefined;
  if (!row) return { success: false, error: 'Scenariusz nie znaleziony' };
  let bundle: ScenarioBundle;
  try {
    bundle = parseScenarioSnapshotJson(row.snapshot);
  } catch {
    return { success: false, error: 'Niepoprawny snapshot scenariusza' };
  }

  const ops = bundle.operations || [];
  const op = ops.find((o: any) => Number(o.id) === operationId) as any;
  if (!op) return { success: false, error: 'Operation not found' };

  const proj = (bundle.projects || []).find((p: any) => Number(p.id) === Number(op.project_id));
  const sop = proj?.sop ?? '';
  const eop = proj?.eop ?? '';

  const ovRows = bundle.operation_volume_by_year || [];
  const opYearRow = ovRows.find((v: any) => Number(v.operation_id) === operationId && Number(v.year) === year) as
    | {
        volume_value: number;
        volume_unit: string;
        volume_value_before?: number | null;
        effective_from_month?: number | null;
        effective_from_week?: number | null;
      }
    | undefined;

  const settings = resolveSettingsForScenarioYear(year, bundle) ?? resolveSettingsForYear(year);

  const resolved = resolveOperationVolumeForYear(
    {
      operation_id: operationId,
      project_id: op.project_id,
      part_id: op.part_id,
      volume_value: op.volume_value,
      volume_unit: op.volume_unit,
      split_from_operation_id: op.split_from_operation_id ?? null,
    },
    year,
    opYearRow?.effective_from_month != null
      ? {
          volume_value: opYearRow.volume_value,
          volume_unit: opYearRow.volume_unit,
          volume_value_before: null,
          effective_from_month: null,
          effective_from_week: null,
        }
      : opYearRow ?? null,
    bundle,
    useContractualVolumes,
    undefined
  );

  const zeroPlaceholder = canAllocateZeroVolumePlaceholder(sop, eop, year, resolved.volume_value);

  if (resolved.volume_value <= 0 && !zeroPlaceholder) {
    return { success: false, error: 'Dla wybranego roku wolumen tej operacji wynosi 0.' };
  }

  const weeklyResolved = zeroPlaceholder
    ? { weekly: 0, fraction: 1 }
    : resolveWeeklyVolumeFromResolved(resolved.volume_value, resolved.volume_unit, settings, {
        sop: String(sop),
        eop: String(eop),
        year,
        volume_origin: resolved.volume_origin,
        count_after_eop: resolved.count_after_eop,
        has_project: op.project_id != null,
      });
  const fraction = weeklyResolved.fraction;
  const currentWeekly = weeklyResolved.weekly;
  const { moveWeeklyEffective: moveWeekly, moveBaseWeekly } = zeroPlaceholder
    ? { moveWeeklyEffective: 0, moveBaseWeekly: 0 }
    : resolveAllocationMoveWeekly(volumeToMove, volumeUnit, settings, fraction);

  if (zeroPlaceholder) {
    if (volumeToMove > 1e-6) {
      return { success: false, error: 'Dla roku bez wolumenu można przypisać detal tylko z przeniesieniem 0.' };
    }
  } else {
    if (volumeToMove <= 0) return { success: false, error: 'Wolumen musi być dodatni.' };
    if (moveWeekly > currentWeekly + 1e-6) {
      return { success: false, error: 'Wolumen do przeniesienia przekracza wolumen operacji dla wybranego roku.' };
    }
  }

  const targetCycle = resolveTargetCycleOnAllocation(op, {
    cycleTimeSecondsOnTarget,
    useAlternativeCycleOnTarget,
  });
  if (!targetCycle.ok) return { success: false, error: targetCycle.error };
  const effectiveCycleOnTarget = targetCycle.cycleSeconds;
  const targetNests = targetCycle.nests;
  const targetOeeOverride = targetCycle.oeeForResolve;

  const remainingWeekly = currentWeekly - moveWeekly;
  const remainingBaseWeekly = fraction > 1e-9 ? remainingWeekly / fraction : remainingWeekly;
  const childVolumeValue = volumeUnit === 'weekly' ? moveBaseWeekly : volumeToMove;
  const childVolumeUnit = volumeUnit === 'weekly' ? 'weekly' : volumeUnit;

  const fromMonth =
    effectiveFrom?.month != null && Number.isFinite(Number(effectiveFrom.month))
      ? Math.min(12, Math.max(1, Math.floor(Number(effectiveFrom.month))))
      : null;
  const fromWeek =
    fromMonth != null
      ? Math.min(5, Math.max(1, Math.floor(Number(effectiveFrom?.week) || 1)))
      : null;
  const parentBeforeWeekly =
    fromMonth != null
      ? opYearRow?.effective_from_month != null && opYearRow.volume_value_before != null
        ? Number(opYearRow.volume_value_before)
        : fraction > 1e-9
          ? currentWeekly / fraction
          : currentWeekly
      : null;
  const parentEffective =
    fromMonth != null
      ? { month: fromMonth, week: fromWeek ?? 1, volumeBefore: parentBeforeWeekly ?? currentWeekly }
      : null;

  upsertOpYearInBundle(bundle, operationId, year, remainingBaseWeekly, 'weekly', 'allocation', parentEffective);

  const newOpId = allocateScenarioEntityId('operation', scenarioId, bundle);
  const newOp: any = {
    ...op,
    id: newOpId,
    machine_id: targetMachineId,
    cycle_time_seconds: effectiveCycleOnTarget,
    volume_value: 0,
    volume_unit: 'weekly',
    nests_count: targetNests,
    oee_override: targetOeeOverride,
    split_from_operation_id: operationId,
    alt_cycle_time_seconds: null,
    alt_nests_count: null,
    alt_oee_override: null,
    alt_comment: null,
    use_alternative_in_calculator: 0,
  };
  bundle.operations = [...ops, newOp];

  const childEffective =
    fromMonth != null ? { month: fromMonth, week: fromWeek ?? 1, volumeBefore: 0 } : null;
  const yearList = yearsForSplitChildScenario(bundle, Number(op.project_id), operationId, year);
  for (const y of yearList) {
    if (y === year) upsertOpYearInBundle(bundle, newOpId, y, childVolumeValue, childVolumeUnit, 'allocation', childEffective);
    else upsertOpYearInBundle(bundle, newOpId, y, 0, 'weekly', 'allocation');
  }
  ensureSplitChildYearCoverageScenario(bundle, newOpId);

  pushScenarioAudit(bundle, {
    author: actor || 'system',
    note_type: 'auto',
    note: `Automatyczna zmiana: alokacja — część wolumenu operacji #${operationId} przeniesiona na maszynę #${targetMachineId}, utworzono operację #${newOpId}, rok ${year}.`,
    project_id: op.project_id != null ? Number(op.project_id) : null,
    machine_id: targetMachineId,
    part_id: op.part_id != null ? Number(op.part_id) : null,
    operation_id: newOpId,
  });

  try {
    db.prepare(`UPDATE scenarios SET snapshot = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(bundle), scenarioId);
  } catch {
    db.prepare('UPDATE scenarios SET snapshot = ? WHERE id = ?').run(JSON.stringify(bundle), scenarioId);
  }
  saveDb();
  invalidateAllocationSplitIndex();
  return { success: true };
}

/**
 * Przed usunięciem operacji potomnej z alokacji: sumuje wolumen per rok z dziecka z wolumenem rodzica (w „bazowym” tygodniowym przepływie),
 * zapisuje w operation_volume_by_year rodzica jako weekly — zgodnie z konwencją zapisu przy podziale.
 */
/** Najwyższy przodek w łańcuchu alokacji (split_from → … → NULL). */
export function findAllocationTreeRootOperationId(operationId: number): number {
  let id = operationId;
  for (let i = 0; i < 10000; i++) {
    const row = db
      .prepare('SELECT split_from_operation_id FROM operations WHERE id = ?')
      .get(id) as { split_from_operation_id: number | null } | undefined;
    if (!row) return operationId;
    if (row.split_from_operation_id == null) return id;
    id = row.split_from_operation_id;
  }
  return operationId;
}

export function mergeSplitChildVolumesIntoParent(parentOperationId: number, childOperationId: number): void {
  const childRows = db
    .prepare(
      `SELECT year, volume_value, volume_unit, volume_value_before, effective_from_month, effective_from_week
       FROM operation_volume_by_year WHERE operation_id = ? ORDER BY year`
    )
    .all(childOperationId) as {
    year: number;
    volume_value: number;
    volume_unit: string;
    volume_value_before: number | null;
    effective_from_month: number | null;
    effective_from_week: number | null;
  }[];

  for (const row of childRows) {
    const { year, volume_value: cv, volume_unit: cuRaw } = row;
    const cu = cuRaw === 'monthly' || cuRaw === 'weekly' ? cuRaw : 'annual';
    const settings = resolveSettingsForYear(year);

    const childAfterWeekly = volumeToWeekly(cv, cu, settings);
    const childBeforeWeekly =
      row.effective_from_month != null && row.volume_value_before != null
        ? volumeToWeekly(Number(row.volume_value_before), cu, settings)
        : childAfterWeekly;
    if (childAfterWeekly <= 1e-9 && childBeforeWeekly <= 1e-9) continue;

    const parentYearRow = db
      .prepare(
        `SELECT volume_value, volume_unit, volume_value_before, effective_from_month, effective_from_week
         FROM operation_volume_by_year WHERE operation_id = ? AND year = ?`
      )
      .get(parentOperationId, year) as
      | {
          volume_value: number;
          volume_unit: string;
          volume_value_before: number | null;
          effective_from_month: number | null;
          effective_from_week: number | null;
        }
      | undefined;

    let parentAfterWeekly = 0;
    let parentBeforeWeekly = 0;
    let fromMonth: number | null = null;
    let fromWeek: number | null = null;
    if (parentYearRow) {
      const pu =
        parentYearRow.volume_unit === 'monthly' || parentYearRow.volume_unit === 'weekly'
          ? parentYearRow.volume_unit
          : 'annual';
      parentAfterWeekly = volumeToWeekly(parentYearRow.volume_value, pu, settings);
      parentBeforeWeekly =
        parentYearRow.effective_from_month != null && parentYearRow.volume_value_before != null
          ? volumeToWeekly(Number(parentYearRow.volume_value_before), pu, settings)
          : parentAfterWeekly;
      fromMonth = parentYearRow.effective_from_month;
      fromWeek = parentYearRow.effective_from_week;
    }
    if (row.effective_from_month != null) {
      fromMonth = fromMonth ?? row.effective_from_month;
      fromWeek = fromWeek ?? row.effective_from_week ?? 1;
    }

    const mergedAfter = parentAfterWeekly + childAfterWeekly;
    const mergedBefore = parentBeforeWeekly + childBeforeWeekly;
    if (fromMonth != null && Math.abs(mergedBefore - mergedAfter) > 1e-6) {
      upsertOperationYearVolume({
        operationId: parentOperationId,
        year,
        volumeValue: mergedAfter,
        volumeUnit: 'weekly',
        source: 'allocation',
        volumeValueBefore: mergedBefore,
        effectiveFromMonth: fromMonth,
        effectiveFromWeek: fromWeek ?? 1,
      });
    } else {
      upsertOperationYearVolume({
        operationId: parentOperationId,
        year,
        volumeValue: mergedAfter,
        volumeUnit: 'weekly',
        source: 'allocation',
      });
    }
  }
  ensureSplitChildYearCoverage(parentOperationId);
}

/** If parent has no more split children, remove allocation overrides and return to project/detail volumes. */
export function clearParentAllocationOverridesIfNoChildren(parentOperationId: number): void {
  const parentRow = db
    .prepare('SELECT id, split_from_operation_id FROM operations WHERE id = ?')
    .get(parentOperationId) as { id: number; split_from_operation_id: number | null } | undefined;
  if (!parentRow) return;
  // Critical safeguard: never clear yearly allocation overrides for a split child.
  // Child operations must keep their year-scoped allocation rows even if they currently
  // have no own descendants, otherwise they fallback to base volume for all years.
  if (parentRow.split_from_operation_id != null) return;

  const hasChildren = db
    .prepare('SELECT 1 FROM operations WHERE split_from_operation_id = ? LIMIT 1')
    .get(parentOperationId);
  if (hasChildren) return;
  db.prepare('DELETE FROM operation_volume_by_year WHERE operation_id = ? AND COALESCE(source, \'manual\') = \'allocation\'').run(parentOperationId);
}

/**
 * For split children, missing year rows are dangerous: calculator falls back to operation base volume
 * for those years. This guard backfills missing years with explicit 0 weekly rows.
 */
function yearsForSplitChildDb(projectId: number, parentOperationId: number, allocationYear: number): number[] {
  const years = new Set<number>([allocationYear]);
  for (const r of db.prepare('SELECT year FROM project_volumes WHERE project_id = ?').all(projectId) as { year: number }[]) {
    const y = Number(r.year);
    if (Number.isInteger(y)) years.add(y);
  }
  const ovRows = db
    .prepare(
      `SELECT DISTINCT year FROM operation_volume_by_year
       WHERE operation_id = ? OR operation_id IN (SELECT id FROM operations WHERE project_id = ?)`
    )
    .all(parentOperationId, projectId) as { year: number }[];
  for (const r of ovRows) {
    const y = Number(r.year);
    if (Number.isInteger(y)) years.add(y);
  }
  return [...years].sort((a, b) => a - b);
}

function seedSplitChildYearVolumes(
  childOperationId: number,
  projectId: number,
  parentOperationId: number,
  allocationYear: number,
  yearVolumeValue: number,
  yearVolumeUnit: string,
  effectiveFrom?: { month: number; week: number; volumeBefore: number } | null
): void {
  const yearList = yearsForSplitChildDb(projectId, parentOperationId, allocationYear);
  for (const y of yearList) {
    if (y === allocationYear) {
      upsertOperationYearVolume({
        operationId: childOperationId,
        year: y,
        volumeValue: yearVolumeValue,
        volumeUnit: yearVolumeUnit,
        source: 'allocation',
        volumeValueBefore: effectiveFrom ? effectiveFrom.volumeBefore : null,
        effectiveFromMonth: effectiveFrom ? effectiveFrom.month : null,
        effectiveFromWeek: effectiveFrom ? effectiveFrom.week : null,
      });
    } else {
      upsertOperationYearVolume({
        operationId: childOperationId,
        year: y,
        volumeValue: 0,
        volumeUnit: 'weekly',
        source: 'allocation',
      });
    }
  }
  ensureSplitChildYearCoverage(childOperationId);
}

function yearsForSplitChildScenario(
  bundle: ScenarioBundle,
  projectId: number,
  parentOperationId: number,
  allocationYear: number
): number[] {
  const years = new Set<number>([allocationYear]);
  for (const r of (bundle.project_volumes || []).filter((v: any) => Number(v.project_id) === projectId)) {
    const y = Number((r as any).year);
    if (Number.isInteger(y)) years.add(y);
  }
  const ops = bundle.operations || [];
  const projectOpIds = new Set(ops.filter((o: any) => Number(o.project_id) === projectId).map((o: any) => Number(o.id)));
  projectOpIds.add(parentOperationId);
  for (const v of bundle.operation_volume_by_year || []) {
    if (projectOpIds.has(Number((v as any).operation_id))) {
      const y = Number((v as any).year);
      if (Number.isInteger(y)) years.add(y);
    }
  }
  return [...years].sort((a, b) => a - b);
}

export function ensureSplitChildYearCoverage(operationId: number): void {
  const op = db
    .prepare('SELECT id, project_id, split_from_operation_id FROM operations WHERE id = ?')
    .get(operationId) as { id: number; project_id: number; split_from_operation_id: number | null } | undefined;
  if (!op || op.split_from_operation_id == null) return;

  const parentId = Number(op.split_from_operation_id);
  const anchorRow = db
    .prepare(
      'SELECT year FROM operation_volume_by_year WHERE operation_id = ? AND volume_value > 1e-9 ORDER BY year DESC LIMIT 1'
    )
    .get(operationId) as { year: number } | undefined;
  const anchorYear =
    anchorRow != null && Number.isInteger(Number(anchorRow.year)) ? Number(anchorRow.year) : new Date().getFullYear();
  let yearList = yearsForSplitChildDb(Number(op.project_id), parentId, anchorYear);
  const existing = db
    .prepare('SELECT year FROM operation_volume_by_year WHERE operation_id = ? ORDER BY year')
    .all(operationId) as { year: number }[];
  for (const r of existing) {
    const y = Number(r.year);
    if (Number.isInteger(y)) yearList.push(y);
  }
  yearList = [...new Set(yearList)].sort((a, b) => a - b);
  if (yearList.length === 0) return;

  const hasYearStmt = db.prepare('SELECT 1 FROM operation_volume_by_year WHERE operation_id = ? AND year = ? LIMIT 1');
  const ins = db.prepare(
    'INSERT OR REPLACE INTO operation_volume_by_year (operation_id, year, volume_value, volume_unit, source) VALUES (?, ?, ?, ?, ?)'
  );
  for (const y of yearList) {
    const has = hasYearStmt.get(operationId, y);
    if (!has) ins.run(operationId, y, 0, 'weekly', 'allocation');
  }
}
