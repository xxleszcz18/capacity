import { db } from '../db/connection.js';
import { formatDetailSapAliasLabel } from '../utils/detailLabel.js';
import { loadReferenceDisplayMode } from '../utils/referenceDisplayMode.js';
import type { MachineDimensionFilter } from '../utils/machineDimensionFilter.js';
import { appendMachineDimensionFilters } from '../utils/machineDimensionFilter.js';
import type { ScenarioBundle } from './scenarioSnapshotService.js';
import {
  getEffectiveVolumeForPartScenarioPreferContract,
  resolveSettingsForScenarioYear,
  scenarioHydratedOperationsForActiveProjects,
  effectiveOperationStatus,
} from './scenarioSnapshotService.js';
import {
  type CalculationSettingsProfile,
  getOcuDefaultTemplate,
  getOcuFallbackWorkingDaysForYear,
  getOcuSettingsForYear,
} from '../utils/ocuSettings.js';
import { getCapacityFallbackWorkingDaysForYear, getCapacityDefaultTemplate } from '../utils/capacitySettings.js';
import { mergeWorkingDaysWithDefaults, normalizeOverrideRow } from '../utils/workingDaysMerge.js';
import { parseSopEop, getProductionMonthsInYear } from '../utils/sopEopFormat.js';

function formatProjectLabel(client: string | null | undefined, name: string | null | undefined): string {
  const c = String(client ?? '').trim();
  const n = String(name ?? '').trim();
  if (c && n) return `${c} · ${n}`;
  return n || c || '—';
}

/** Maszyny RFQ w produkcji z operacją w scenariuszu w projekcie liczonym w kalkulatorze (active / ewent. RFQ). */
function scenarioLinkedRfqProductionMachineIds(snapshot: ScenarioBundle, includeRfqProjects: boolean): number[] {
  const mids = new Set<number>();
  for (const o of snapshot.operations || []) {
    const eff = effectiveOperationStatus(snapshot, o);
    if (eff === 'inactive') continue;
    if (eff === 'RFQ' && !includeRfqProjects) continue;
    if (eff !== 'active' && eff !== 'RFQ') continue;
    const mid = Number((o as any).machine_id);
    if (!Number.isFinite(mid) || mid <= 0) continue;
    const row = db.prepare('SELECT status FROM machines WHERE id = ?').get(mid) as { status: string } | undefined;
    if (row && String(row.status) === 'RFQ') mids.add(mid);
  }
  return Array.from(mids);
}

/**
 * LOGIKA OBLICZANIA OBCIĄŻENIA (load_percent) I CAPACITY
 * --------------------------------------------------------
 * 1) Dostępność maszyny [s/tydzień]:
 *    availability_sec_per_week = (working_days_year / 52) * shift_time_seconds * 60 * shifts_per_day * OEE - startup_shutdown_seconds
 *    - working_days_year: liczba dni roboczych w roku (z ustawień Dni robocze)
 *    - shift_time_seconds: czas jednej zmiany w MINUTACH (np. 450 = 7,5 h)
 *    - shifts_per_day: liczba zmian na dobę (1, 2, 3) – z ustawień
 *    - OEE: z operacji lub maszyny lub domyślny z ustawień
 *
 * 2) Wolumen na tydzień [szt/tydzień]:
 *    - Dla volume_unit = 'annual': volume_value / working_weeks_per_year (domyślnie 48 pracujących tygodni)
 *    - Dla 'monthly': (volume_value * 12) / working_weeks_per_year
 *    - Dla 'weekly': volume_value
 *
 * 3) Wymagany czas [s/tydzień] na maszynie:
 *    required_sec_per_week = suma po operacjach: (weekly_volume * (cycle_time_seconds / max(1, nests_count)))
 *    Gniazdowość (nests_count) = liczba detali z jednego cyklu – czas na sztukę = cykl / gniazd.
 *    Dla operacji można podać wolumen per rok w operation_volume_by_year – ma pierwszeństwo przed wolumenem z projektu/detalu i przed polami operacji.
 *
 * 4) Obciążenie:
 *    load_percent = round((required_sec_per_week / availability_sec_per_week) * 100)
 */

/** Calendar weeks per year (for days-per-week conversion). */
const CALENDAR_WEEKS_PER_YEAR = 52;

/** Domyślne „Dni robocze” gdy w bazie brak wpisu dla danego roku (szablon z ustawień). */
export const DEFAULT_WORKING_DAYS_SETTINGS = {
  working_days_year: 252,
  oee_factor: 0.85,
  shift_time_seconds: 450,
  startup_shutdown_seconds: 720,
  working_weeks_per_year: 48,
  shifts_per_day: 3,
} as const;

export interface WorkingDaysRow {
  id: number;
  year: number;
  working_days_year: number;
  oee_factor: number;
  shift_time_seconds: number; // czas jednej zmiany w minutach (np. 450 = 7,5 h)
  startup_shutdown_seconds: number;
  working_weeks_per_year?: number; // pracujące tygodnie w roku (np. 48)
  shifts_per_day?: number; // liczba zmian na dobę (1, 2, 3)
  /** Zgodnie z kolumną `status` w `working_days` (np. przy zapytaniach SQL). */
  status?: string;
}

export function getSettingsForYear(year: number): WorkingDaysRow | null {
  const row = db.prepare('SELECT * FROM working_days WHERE year = ? AND status = ?').get(year, 'active') as WorkingDaysRow | undefined;
  const raw = row ?? (db.prepare('SELECT * FROM working_days WHERE year = ?').get(year) as WorkingDaysRow | undefined);
  if (!raw) return null;
  return mergeWorkingDaysWithDefaults(normalizeOverrideRow(raw), getCapacityDefaultTemplate());
}

/** Gdy w bazie brak wpisu working_days dla danego roku – szablon domyślny z ustawień administracyjnych. */
export function getFallbackWorkingDaysForYear(year: number): WorkingDaysRow {
  return getCapacityFallbackWorkingDaysForYear(year);
}

export type { CalculationSettingsProfile };

export function resolveSettingsForYear(year: number, profile: CalculationSettingsProfile = 'capacity'): WorkingDaysRow {
  if (profile === 'ocu') {
    return getOcuSettingsForYear(year) ?? getOcuFallbackWorkingDaysForYear(year);
  }
  return getSettingsForYear(year) ?? getFallbackWorkingDaysForYear(year);
}

/**
 * Dostępność maszyny [s/tydzień]:
 * (dni_robocze_w_roku / 52) * (minuty_na_zmianę * 60) * liczba_zmian_na_dobę * OEE - startup_shutdown_seconds.
 * Uwzględnia liczbę zmian produkcyjnych i pracujące tygodnie tylko pośrednio przez working_days_year.
 */
export function availabilitySecondsPerWeek(settings: WorkingDaysRow, oee: number): number {
  const shiftMinutes = settings.shift_time_seconds;
  const shiftsPerDay = Math.max(1, settings.shifts_per_day ?? 1);
  const secPerWeek = (settings.working_days_year / CALENDAR_WEEKS_PER_YEAR) * shiftMinutes * 60 * shiftsPerDay * oee;
  return Math.max(0, Math.round(secPerWeek - (settings.startup_shutdown_seconds ?? 0)));
}

/** Resolve OEE: operation override > machine override > settings default. */
export function resolveOee(settings: WorkingDaysRow, machineOee: number | null, operationOee: number | null): number {
  if (operationOee != null && operationOee > 0) return operationOee;
  if (machineOee != null && machineOee > 0) return machineOee;
  return settings.oee_factor;
}

/** Zdefiniowany drugi wariant czasu (wpisany dodatni alt_cycle_time_seconds). */
export function operationHasAlternativeCycle(op: { alt_cycle_time_seconds?: number | null }): boolean {
  const a = op.alt_cycle_time_seconds;
  return a != null && Number(a) > 0;
}

/** Czas / gniazda / OEE wg wyboru „podstawowy vs alternatywa” dla kalkulatora i alokacji. */
export function resolveOperationCycleForCalculator(op: any): {
  cycleSeconds: number;
  nests: number;
  oeeForResolve: number | null;
  usesAlternativeInCalculator: boolean;
} {
  const hasAlt = operationHasAlternativeCycle(op);
  const useAlt = hasAlt && (Number(op.use_alternative_in_calculator) === 1 || op.use_alternative_in_calculator === true);
  const cycleSeconds = useAlt ? Number(op.alt_cycle_time_seconds) : Number(op.cycle_time_seconds);
  const nestsRaw = useAlt
    ? op.alt_nests_count != null && Number(op.alt_nests_count) > 0
      ? Number(op.alt_nests_count)
      : Number(op.nests_count ?? 1)
    : Number(op.nests_count ?? 1);
  const nests = Math.max(1, nestsRaw || 1);
  const oeeForResolve =
    useAlt && op.alt_oee_override != null && Number(op.alt_oee_override) > 0
      ? Number(op.alt_oee_override)
      : op.oee_override != null
        ? Number(op.oee_override)
        : null;
  return { cycleSeconds, nests, oeeForResolve, usesAlternativeInCalculator: !!useAlt };
}

/**
 * Konwersja wolumenu na szt/tydzień.
 * Dla annual: volume / working_weeks_per_year (np. 48).
 * Dla monthly: (volume * 12) / working_weeks_per_year.
 */
export function volumeToWeekly(volumeValue: number, volumeUnit: 'annual' | 'monthly' | 'weekly', settings: WorkingDaysRow): number {
  const workWeeks = Math.max(1, settings.working_weeks_per_year ?? 48);
  if (volumeUnit === 'weekly') return volumeValue;
  if (volumeUnit === 'annual') return volumeValue / workWeeks;
  if (volumeUnit === 'monthly') return (volumeValue * 12) / workWeeks;
  return volumeValue / workWeeks;
}

/**
 * Ułamek roku dla capacity: pierwszy rok od startMonth, ostatni do endMonth (SOP/EOP w formacie MM.YYYY).
 */
export function getYearFractionFromSopEop(sop: string, eop: string, year: number): number {
  const months = getProductionMonthsInYear(sop, eop, year);
  if (months <= 0) return 0;
  return months / 12;
}

export type VolumeEntryOrigin = 'default_all_years' | 'manual_year';

export function normalizeVolumeOrigin(raw: unknown): VolumeEntryOrigin {
  return String(raw ?? '').trim() === 'default_all_years' ? 'default_all_years' : 'manual_year';
}

/**
 * Tygodniowy wolumen efektywny dla operacji w roku.
 * - default_all_years + rok niepełny: annual × (miesiące/12) ÷ tygodnie robocze (dotychczasowa logika).
 * - manual_year + rok niepełny + jednostka roczna: wpisana wartość ÷ miesiące produkcyjne → miesięczna, potem na tygodniową.
 * - manual_year + rok pełny: bez korekty SOP/EOP.
 */
export function resolveWeeklyVolumeFromResolved(
  volumeValue: number,
  volumeUnit: 'annual' | 'monthly' | 'weekly',
  settings: WorkingDaysRow,
  opts: {
    sop?: string;
    eop?: string;
    year: number;
    volume_origin: VolumeEntryOrigin;
    count_after_eop?: boolean;
    has_project?: boolean;
  }
): { weekly: number; fraction: number; production_months: number } {
  const sop = opts.sop ?? '';
  const eop = opts.eop ?? '';
  const prodMonths = getProductionMonthsInYear(sop, eop, opts.year);
  const isPartial = prodMonths > 0 && prodMonths < 12;

  if (opts.count_after_eop || !opts.has_project) {
    return {
      weekly: volumeToWeekly(volumeValue, volumeUnit, settings),
      fraction: 1,
      production_months: prodMonths || 12,
    };
  }

  if (opts.volume_origin === 'manual_year') {
    if (isPartial && volumeUnit === 'annual') {
      const monthly = volumeValue / prodMonths;
      return {
        weekly: volumeToWeekly(monthly, 'monthly', settings),
        fraction: 1,
        production_months: prodMonths,
      };
    }
    return {
      weekly: volumeToWeekly(volumeValue, volumeUnit, settings),
      fraction: 1,
      production_months: prodMonths || 12,
    };
  }

  const fraction = getYearFractionFromSopEop(sop, eop, opts.year);
  return {
    weekly: volumeToWeekly(volumeValue, volumeUnit, settings) * fraction,
    fraction,
    production_months: prodMonths || 12,
  };
}

export type EffectiveVolumeResult = {
  volume_value: number;
  volume_unit: 'annual' | 'monthly' | 'weekly';
  count_after_eop?: boolean; // true = liczyć w kalkulatorze mimo roku po EOP (zmienione ręcznie)
  volume_origin?: VolumeEntryOrigin;
};

/** Zwraca skuteczny wolumen dla detalu w danym roku (projekt → tryb detalu → własna wartość). Gdy brak: null = użyj volume_value/volume_unit z operacji. */
export function getEffectiveVolumeForPart(
  projectId: number,
  partId: number,
  year: number
): EffectiveVolumeResult | null {
  let pv: { volume_value: number; volume_unit: string; include_in_calculator_after_eop?: number; volume_origin?: string } | undefined;
  let projectEop: string | null = null;
  let part: { volume_mode: string; volume_share_percent: number | null; default_volume_value?: number | null; default_volume_unit?: string | null } | undefined;
  let partVol: { volume_value: number; volume_unit: string; volume_origin?: string } | undefined;
  try {
    pv = db.prepare('SELECT volume_value, volume_unit, COALESCE(include_in_calculator_after_eop, 0) AS include_in_calculator_after_eop, volume_origin FROM project_volumes WHERE project_id = ? AND year = ?').get(projectId, year) as any;
    const proj = db.prepare('SELECT eop FROM projects WHERE id = ?').get(projectId) as { eop: string } | undefined;
    projectEop = proj?.eop ?? null;
    part = db.prepare('SELECT volume_mode, volume_share_percent, default_volume_value, default_volume_unit FROM parts WHERE id = ?').get(partId) as any;
    partVol = db.prepare('SELECT volume_value, volume_unit, volume_origin FROM part_volume_by_year WHERE part_id = ? AND year = ?').get(partId, year) as any;
  } catch (_) {
    return null;
  }
  const eopYear = parseSopEop(projectEop)?.year ?? null;
  const isAfterEop = eopYear != null && year > eopYear;
  const countAfterEop = isAfterEop && pv && Number(pv.include_in_calculator_after_eop) === 1;

  const volumeOriginFromRow = (row: { volume_origin?: string } | undefined, fallback: VolumeEntryOrigin): VolumeEntryOrigin =>
    normalizeVolumeOrigin(row?.volume_origin ?? fallback);

  const mode = part?.volume_mode ?? 'project';
  if (mode === 'override') {
    if (partVol)
      return {
        volume_value: partVol.volume_value,
        volume_unit: partVol.volume_unit as any,
        count_after_eop: countAfterEop || undefined,
        volume_origin: volumeOriginFromRow(partVol, 'manual_year'),
      };
    if (part?.default_volume_value != null && part?.default_volume_unit) {
      const u = ['annual', 'monthly', 'weekly'].includes(part.default_volume_unit) ? part.default_volume_unit : 'annual';
      return {
        volume_value: Number(part.default_volume_value),
        volume_unit: u as any,
        count_after_eop: countAfterEop || undefined,
        volume_origin: 'default_all_years',
      };
    }
  }
  if (mode === 'project' && pv) {
    return {
      volume_value: pv.volume_value,
      volume_unit: pv.volume_unit as any,
      count_after_eop: countAfterEop || undefined,
      volume_origin: volumeOriginFromRow(pv, 'manual_year'),
    };
  }
  if (mode === 'share' && pv) {
    let sharePct: number | null = null;
    try {
      const row = db.prepare('SELECT share_percent FROM part_volume_share_by_year WHERE part_id = ? AND year = ?').get(partId, year) as { share_percent: number } | undefined;
      if (row != null) sharePct = row.share_percent;
    } catch (_) {}
    if (sharePct == null) sharePct = part?.volume_share_percent ?? null;
    if (sharePct != null) {
      const share = Math.max(0, Math.min(100, Number(sharePct))) / 100;
      return {
        volume_value: pv.volume_value * share,
        volume_unit: pv.volume_unit as any,
        count_after_eop: countAfterEop || undefined,
        volume_origin: volumeOriginFromRow(pv, 'manual_year'),
      };
    }
  }
  return null;
}

/** Wolumeny kontraktowe z DB; brak danych kontraktowych dla trybu/roku → null (wtedy fallback do produkcji). */
export function getEffectiveVolumeForPartContract(projectId: number, partId: number, year: number): EffectiveVolumeResult | null {
  let pvc: { volume_value: number; volume_unit: string; include_in_calculator_after_eop?: number; volume_origin?: string } | undefined;
  let pvProd: { volume_value: number; volume_unit: string; include_in_calculator_after_eop?: number; volume_origin?: string } | undefined;
  let projectEop: string | null = null;
  let part: {
    contract_volume_mode?: string;
    contract_volume_share_percent?: number | null;
    contract_default_volume_value?: number | null;
    contract_default_volume_unit?: string | null;
  } | undefined;
  let partVolC: { volume_value: number; volume_unit: string; volume_origin?: string } | undefined;
  try {
    pvc = db
      .prepare(
        'SELECT volume_value, volume_unit, COALESCE(include_in_calculator_after_eop, 0) AS include_in_calculator_after_eop, volume_origin FROM project_volumes_contract WHERE project_id = ? AND year = ?'
      )
      .get(projectId, year) as any;
    pvProd = db
      .prepare(
        'SELECT volume_value, volume_unit, COALESCE(include_in_calculator_after_eop, 0) AS include_in_calculator_after_eop, volume_origin FROM project_volumes WHERE project_id = ? AND year = ?'
      )
      .get(projectId, year) as any;
    const proj = db.prepare('SELECT eop FROM projects WHERE id = ?').get(projectId) as { eop: string } | undefined;
    projectEop = proj?.eop ?? null;
    part = db
      .prepare(
        'SELECT contract_volume_mode, contract_volume_share_percent, contract_default_volume_value, contract_default_volume_unit FROM parts WHERE id = ?'
      )
      .get(partId) as any;
    partVolC = db
      .prepare('SELECT volume_value, volume_unit, volume_origin FROM part_volume_contract_by_year WHERE part_id = ? AND year = ?')
      .get(partId, year) as any;
  } catch (_) {
    return null;
  }
  const eopYear = parseSopEop(projectEop)?.year ?? null;
  const isAfterEop = eopYear != null && year > eopYear;
  const pvForEop = pvc ?? pvProd;
  const countAfterEop = isAfterEop && pvForEop && Number(pvForEop.include_in_calculator_after_eop) === 1;

  const volumeOriginFromRow = (row: { volume_origin?: string } | undefined, fallback: VolumeEntryOrigin): VolumeEntryOrigin =>
    normalizeVolumeOrigin(row?.volume_origin ?? fallback);

  const mode = part?.contract_volume_mode ?? 'project';
  if (mode === 'override') {
    if (partVolC) {
      return {
        volume_value: partVolC.volume_value,
        volume_unit: partVolC.volume_unit as any,
        count_after_eop: countAfterEop || undefined,
        volume_origin: volumeOriginFromRow(partVolC, 'manual_year'),
      };
    }
    if (part?.contract_default_volume_value != null && part?.contract_default_volume_unit) {
      const u = ['annual', 'monthly', 'weekly'].includes(part.contract_default_volume_unit) ? part.contract_default_volume_unit : 'annual';
      return {
        volume_value: Number(part.contract_default_volume_value),
        volume_unit: u as any,
        count_after_eop: countAfterEop || undefined,
        volume_origin: 'default_all_years',
      };
    }
    return { volume_value: 0, volume_unit: 'annual', count_after_eop: countAfterEop || undefined, volume_origin: 'manual_year' };
  }
  if (mode === 'project' && pvc && Number(pvc.volume_value) > 0) {
    return {
      volume_value: pvc.volume_value,
      volume_unit: pvc.volume_unit as any,
      count_after_eop: countAfterEop || undefined,
      volume_origin: volumeOriginFromRow(pvc, 'manual_year'),
    };
  }
  if (mode === 'share' && pvc && Number(pvc.volume_value) > 0) {
    let sharePct: number | null = null;
    try {
      const row = db
        .prepare('SELECT share_percent FROM part_volume_contract_share_by_year WHERE part_id = ? AND year = ?')
        .get(partId, year) as { share_percent: number } | undefined;
      if (row != null) sharePct = row.share_percent;
    } catch (_) {}
    if (sharePct == null) sharePct = part?.contract_volume_share_percent ?? null;
    if (sharePct != null) {
      const share = Math.max(0, Math.min(100, Number(sharePct))) / 100;
      return {
        volume_value: pvc.volume_value * share,
        volume_unit: pvc.volume_unit as any,
        count_after_eop: countAfterEop || undefined,
        volume_origin: volumeOriginFromRow(pvc, 'manual_year'),
      };
    }
  }
  return null;
}

/** Przy włączonych wolumenach kontraktowych: kontrakt, a gdy brak — produkcja. */
export function getEffectiveVolumeForPartPreferContract(
  projectId: number,
  partId: number,
  year: number,
  useContractual: boolean
): EffectiveVolumeResult | null {
  if (!useContractual) return getEffectiveVolumeForPart(projectId, partId, year);
  return getEffectiveVolumeForPartContract(projectId, partId, year) ?? getEffectiveVolumeForPart(projectId, partId, year);
}

export type OperationVolumeSource = 'operation_year' | 'part' | 'operation_base';

/** Ten sam wolumen co w kalkulatorze obciążenia dla operacji w danym roku: nadpisanie per rok > projekt/detal > pole operacji. */
export function resolveOperationVolumeForYear(
  op: {
    operation_id: number;
    project_id: number | null;
    part_id: number | null;
    volume_value: number;
    volume_unit: string;
    /** Operacja-dziecko po alokacji — wolumen wyłącznie z operation_volume_by_year (brak wiersza = 0). */
    split_from_operation_id?: number | null;
  },
  year: number,
  opYearOverride?: { volume_value: number; volume_unit: string } | null,
  scenarioSnapshot?: ScenarioBundle | null,
  useContractualVolumes: boolean = false
): {
  volume_value: number;
  volume_unit: 'annual' | 'monthly' | 'weekly';
  source: OperationVolumeSource;
  volume_origin: VolumeEntryOrigin;
  count_after_eop?: boolean;
} {
  const asUnit = (u: string): 'annual' | 'monthly' | 'weekly' =>
    u === 'monthly' || u === 'weekly' ? u : 'annual';

  if (op.split_from_operation_id != null) {
    if (opYearOverride) {
      return {
        volume_value: opYearOverride.volume_value,
        volume_unit: asUnit(opYearOverride.volume_unit),
        source: 'operation_year',
        volume_origin: 'manual_year',
      };
    }
    return { volume_value: 0, volume_unit: 'weekly', source: 'operation_year', volume_origin: 'manual_year' };
  }

  if (opYearOverride) {
    return {
      volume_value: opYearOverride.volume_value,
      volume_unit: asUnit(opYearOverride.volume_unit),
      source: 'operation_year',
      volume_origin: 'manual_year',
    };
  }
  if (op.project_id && op.part_id) {
    const effective = scenarioSnapshot
      ? getEffectiveVolumeForPartScenarioPreferContract(op.project_id, op.part_id, year, scenarioSnapshot, useContractualVolumes)
      : getEffectiveVolumeForPartPreferContract(op.project_id, op.part_id, year, useContractualVolumes);
    if (effective) {
      return {
        volume_value: effective.volume_value,
        volume_unit: asUnit(effective.volume_unit),
        source: 'part',
        volume_origin: effective.volume_origin ?? 'manual_year',
        count_after_eop: effective.count_after_eop,
      };
    }
  }
  return {
    volume_value: op.volume_value,
    volume_unit: asUnit(op.volume_unit),
    source: 'operation_base',
    volume_origin: 'manual_year',
  };
}

export interface MachineCapacityRow {
  machine_id: number;
  internal_number: string | number;
  type: string;
  sap_number: string | null;
  oee_override: number | null;
  year: number;
  availability_sec_per_week: number;
  required_sec_per_week: number;
  capacity_pcs_per_week: number;
  load_percent: number;
  utilization_percent: number;
  /** Oznaczenie kafelka % w kalkulatorze (operacje z alternatywą na maszynie w tym roku). */
  alternative_border?: 'none' | 'unused' | 'all_alt' | 'mixed';
  /** Udział detali w obciążeniu tej maszyny (dla tooltipa w kalkulatorze). */
  detail_breakdown?: { project_label: string; detail_label: string; contribution_percent: number; share_percent: number; has_rfq: boolean }[];
  /** Czy w tym roku na tej maszynie liczy się przynajmniej jedna operacja z projektu RFQ. */
  has_rfq?: boolean;
  /** Status maszyny w bazie (np. RFQ) — do znacznika w kalkulatorze scenariusza. */
  machine_status?: string | null;
  /** Nr linii (kolumna location). */
  location?: string | null;
}

/** Optional operations override for scenario: array of { machine_id, cycle_time_seconds, volume_value, volume_unit, nests_count, oee_override, capacity_percent } */
export type CalculatorMachineStatusFilter = 'active' | 'inactive' | 'RFQ' | 'all';

export type MachineStatusFilterInput = CalculatorMachineStatusFilter | CalculatorMachineStatusFilter[];

function normalizeMachineTypes(machineType?: string | string[]): string[] {
  if (Array.isArray(machineType)) return machineType.filter((t) => t && t !== 'Wszystkie');
  if (machineType && machineType !== 'Wszystkie' && machineType !== '') return [machineType];
  return [];
}

function normalizeMachineStatusFilters(filter?: MachineStatusFilterInput): CalculatorMachineStatusFilter[] {
  if (Array.isArray(filter)) {
    return [...new Set(filter.filter((f) => f && f !== 'all'))] as CalculatorMachineStatusFilter[];
  }
  if (!filter || filter === 'all') return [];
  return [filter];
}

function buildMachineStatusWhere(
  filters: CalculatorMachineStatusFilter[],
  scenarioRfqs: number[],
): { clause: string; params: (string | number)[] } {
  if (filters.length === 0) return { clause: '1=1', params: [] };
  const unique = [...new Set(filters)];
  if (unique.length === 1 && unique[0] === 'active' && scenarioRfqs.length > 0) {
    return {
      clause: `(m.status = 'active' OR (m.status = 'RFQ' AND m.id IN (${scenarioRfqs.map(() => '?').join(',')})))`,
      params: scenarioRfqs,
    };
  }
  return {
    clause: `m.status IN (${unique.map(() => '?').join(',')})`,
    params: unique,
  };
}

export function getMachineCapacitiesForYear(
  year: number,
  machineIds?: number[],
  machineType?: string | string[],
  operationsOverride?: any[],
  scenarioSnapshot?: ScenarioBundle | null,
  /** Gdy kalkulator scenariusza (snapshot + override): czy projekty RFQ liczą się do doboru maszyn RFQ. */
  scenarioIncludeRfqProjects?: boolean,
  /** Wolumeny kontraktowe z fallbackiem do produkcyjnych (kalkulator / alokacja). */
  useContractualVolumes?: boolean,
  /** Filtr statusu maszyny w kalkulatorze; `active` = dotychczasowa logika (active + RFQ ze scenariusza gdy dotyczy). */
  machineStatusFilter?: MachineStatusFilterInput,
  /** Filtry wymiarów maszyny (szerokość, głębokość, wysokość, skok). */
  dimensionFilters?: MachineDimensionFilter[],
  /** Profil ustawień (Capacity / OCU); w scenariuszu zawsze Capacity. */
  settingsProfile?: CalculationSettingsProfile
): MachineCapacityRow[] {
  const useContract = useContractualVolumes === true;
  const effectiveProfile: CalculationSettingsProfile = scenarioSnapshot != null ? 'capacity' : (settingsProfile ?? 'capacity');
  const settings =
    scenarioSnapshot != null
      ? resolveSettingsForScenarioYear(year, scenarioSnapshot) ?? resolveSettingsForYear(year, 'capacity')
      : resolveSettingsForYear(year, effectiveProfile);
  const refMode = loadReferenceDisplayMode();

  const scenarioRfqs =
    scenarioSnapshot != null && operationsOverride != null
      ? scenarioLinkedRfqProductionMachineIds(scenarioSnapshot, scenarioIncludeRfqProjects !== false)
      : [];

  const msList = normalizeMachineStatusFilters(machineStatusFilter);
  const effectiveStatuses: CalculatorMachineStatusFilter[] =
    msList.length > 0 ? msList : machineStatusFilter === undefined ? ['active'] : [];
  const statusWhere = buildMachineStatusWhere(effectiveStatuses, scenarioRfqs);

  let machinesSql = `
    SELECT m.id AS machine_id, m.internal_number, m.type, m.sap_number, m.oee_override, m.status AS machine_status, m.location, COALESCE(m.machine_usage, 1) AS machine_usage
    FROM machines m
    WHERE ${statusWhere.clause}
  `;
  const params: (number | string)[] = [...statusWhere.params];
  if (machineIds?.length) {
    machinesSql += ` AND m.id IN (${machineIds.map(() => '?').join(',')})`;
    params.push(...machineIds);
  }
  const types = normalizeMachineTypes(machineType);
  if (types.length === 1) {
    machinesSql += ' AND m.type = ?';
    params.push(types[0]);
  } else if (types.length > 1) {
    machinesSql += ` AND m.type IN (${types.map(() => '?').join(',')})`;
    params.push(...types);
  }
  if (dimensionFilters?.length) {
    const dim = appendMachineDimensionFilters(dimensionFilters);
    if (dim.clause !== '1=1') {
      machinesSql += ` AND (${dim.clause})`;
      params.push(...dim.params);
    }
  }
  machinesSql += ' ORDER BY m.internal_number';

  const machines = db.prepare(machinesSql).all(...params) as any[];

  const operations = operationsOverride ?? (db.prepare(`
    SELECT o.id AS operation_id, o.project_id, o.part_id, o.machine_id, o.cycle_time_seconds, o.volume_value, o.volume_unit, o.nests_count, o.oee_override, o.capacity_percent,
           o.alt_cycle_time_seconds, o.alt_nests_count, o.alt_oee_override, o.use_alternative_in_calculator, o.split_from_operation_id,
           p.sop, p.eop, p.status AS project_status, p.client AS project_client, p.name AS project_name,
           pd.sap_number AS detail_sap_number,
           pd.alias AS detail_alias,
           pd.free_text AS detail_free_text,
           pt.designation AS detail_designation
    FROM operations o
    JOIN projects p ON p.id = o.project_id
    JOIN parts pt ON pt.id = o.part_id
    LEFT JOIN part_designations pd ON pd.id = pt.designation_id
    WHERE p.status = 'active'
  `).all() as any[]);

  const volumeMap = (() => {
    if (scenarioSnapshot != null) {
      const rows = (scenarioSnapshot.operation_volume_by_year || []).filter((v: any) => Number(v.year) === year) as {
        operation_id: number;
        year: number;
        volume_value: number;
        volume_unit: string;
      }[];
      return new Map(rows.map((v) => [Number(v.operation_id), v]));
    }
    const volumeByYear = db
      .prepare('SELECT operation_id, year, volume_value, volume_unit FROM operation_volume_by_year WHERE year = ?')
      .all(year) as { operation_id: number; year: number; volume_value: number; volume_unit: string }[];
    return new Map(volumeByYear.map((v) => [v.operation_id, v]));
  })();

  return machines.map((m) => {
    const machineOps = operations.filter((o: any) => o.machine_id === m.machine_id);
    let totalRequiredSec = 0;
    let loadRatioSum = 0; // suma (wymagany_czas / dostępność_z_OEE_dla_tej_operacji)
    let altBorderRelevant = 0;
    let altBorderUsed = 0;
    let altBorderUnused = 0;
    const detailContributionSec = new Map<
      string,
      { project_label: string; detail_label: string; requiredSec: number; hasRfq: boolean }
    >();
    let hasRfq = false;

    for (const op of machineOps) {
      const opKey = Number(op.operation_id ?? op.id);
      if (!Number.isFinite(opKey)) continue;
      const opVolumeOverride = volumeMap.get(opKey);
      const resolved = resolveOperationVolumeForYear(
        {
          operation_id: opKey,
          project_id: op.project_id,
          part_id: op.part_id,
          volume_value: op.volume_value,
          volume_unit: op.volume_unit,
          split_from_operation_id: op.split_from_operation_id,
        },
        year,
        opVolumeOverride,
        scenarioSnapshot ?? null,
        useContract
      );
      const volValue = resolved.volume_value;
      const volUnit = resolved.volume_unit;
      const weeklyResolved = resolveWeeklyVolumeFromResolved(volValue, volUnit, settings, {
        sop: op.sop ?? '',
        eop: op.eop ?? '',
        year,
        volume_origin: resolved.volume_origin,
        count_after_eop: resolved.count_after_eop,
        has_project: op.project_id != null,
      });
      let weeklyVol = weeklyResolved.weekly;
      const fraction = weeklyResolved.fraction;
      const { cycleSeconds, nests, oeeForResolve, usesAlternativeInCalculator } = resolveOperationCycleForCalculator(op);
      const requiredSecOp = weeklyVol * (cycleSeconds / nests);
      totalRequiredSec += requiredSecOp;
      if (String(op.project_status ?? '').toUpperCase() === 'RFQ' && weeklyVol > 1e-9) {
        hasRfq = true;
      }
      if (operationHasAlternativeCycle(op) && weeklyVol > 1e-9) {
        altBorderRelevant++;
        if (usesAlternativeInCalculator) altBorderUsed++;
        else altBorderUnused++;
      }
      if (requiredSecOp > 1e-9) {
        const detailLabel = formatDetailSapAliasLabel(
          {
            sap_number: op.detail_sap_number,
            alias: op.detail_alias,
            free_text: op.detail_free_text,
            designation: op.detail_designation,
            id: op.part_id,
          },
          refMode
        );
        const projectLabel = formatProjectLabel(op.project_client, op.project_name);
        const contribKey = `${Number(op.project_id)}|${detailLabel}`;
        const isOpRfq = String(op.project_status ?? '').toUpperCase() === 'RFQ';
        const existing = detailContributionSec.get(contribKey);
        if (existing) {
          existing.requiredSec += requiredSecOp;
          if (isOpRfq) existing.hasRfq = true;
        } else {
          detailContributionSec.set(contribKey, {
            project_label: projectLabel,
            detail_label: detailLabel,
            requiredSec: requiredSecOp,
            hasRfq: isOpRfq,
          });
        }
      }
      const oeeOp = resolveOee(settings, m.oee_override, oeeForResolve);
      const availabilitySecOp = availabilitySecondsPerWeek(settings, oeeOp);
      if (availabilitySecOp > 0) {
        loadRatioSum += requiredSecOp / availabilitySecOp;
      }
    }

    // Machine usage 0..1: np. 0.5 = podwaja effective capacity (obciążenie maleje dwukrotnie).
    const usage = Math.max(0.1, Math.min(1, m.machine_usage ?? 1));
    const oeeMachine = resolveOee(settings, m.oee_override, null);
    const availabilitySecBase = availabilitySecondsPerWeek(settings, oeeMachine);
    const availabilitySec = availabilitySecBase * (1 / usage);
    const loadPercent =
      availabilitySec > 0
        ? Math.round((totalRequiredSec / availabilitySec) * 100)
        : totalRequiredSec > 0
          ? 100
          : 0;
    const capacityPcsWeek = 0;

    let alternative_border: 'none' | 'unused' | 'all_alt' | 'mixed' = 'none';
    if (altBorderRelevant > 0) {
      if (altBorderUsed === altBorderRelevant) alternative_border = 'all_alt';
      else if (altBorderUnused === altBorderRelevant) alternative_border = 'unused';
      else alternative_border = 'mixed';
    }
    const detail_breakdown = Array.from(detailContributionSec.values())
      .map(({ project_label, detail_label, requiredSec, hasRfq }) => {
        const contribution_percent =
          availabilitySec > 0 ? Math.round((requiredSec / availabilitySec) * 10000) / 100 : 0;
        const share_percent = totalRequiredSec > 0 ? Math.round((requiredSec / totalRequiredSec) * 10000) / 100 : 0;
        return { project_label, detail_label, contribution_percent, share_percent, has_rfq: hasRfq };
      })
      .sort((a, b) => b.contribution_percent - a.contribution_percent)
      .slice(0, 12);

    return {
      machine_id: m.machine_id,
      internal_number: m.internal_number,
      type: m.type,
      sap_number: m.sap_number,
      oee_override: m.oee_override,
      machine_status: m.machine_status ?? null,
      location: m.location != null ? String(m.location).trim() || null : null,
      year,
      availability_sec_per_week: availabilitySec,
      required_sec_per_week: Math.round(totalRequiredSec),
      capacity_pcs_per_week: capacityPcsWeek,
      load_percent: loadPercent,
      utilization_percent: loadPercent,
      alternative_border,
      detail_breakdown,
      has_rfq: hasRfq,
    };
  });
}

/** Szczegóły pod kątem symulacji alokacji (jedna maszyna): suma loadRatio i wkład wybranej operacji. */
export function getMachineLoadComputationDetails(
  year: number,
  machineId: number,
  operationsOverride?: any[],
  scenarioSnapshot?: ScenarioBundle | null,
  /** Gdy snapshot scenariusza i brak override: czy uwzględniać projekty RFQ (false = jak kalkulator produkcyjny, np. scenariusz zarchiwizowany). */
  scenarioIncludeRfq: boolean = true,
  useContractualVolumes: boolean = false,
  settingsProfile?: CalculationSettingsProfile
): {
  load_ratio_sum: number;
  usage: number;
  load_percent: number;
  availability_sec_per_week: number;
  required_sec_per_week: number;
  working_weeks_per_year: number;
  op_by_id: Record<
    number,
    {
      ratio_contrib: number;
      weekly_volume: number;
      resolved_volume_value: number;
      resolved_volume_unit: 'annual' | 'monthly' | 'weekly';
      fraction: number;
    }
  >;
} | null {
  const useContract = useContractualVolumes === true;
  const effectiveProfile: CalculationSettingsProfile = scenarioSnapshot != null ? 'capacity' : (settingsProfile ?? 'capacity');
  const settings =
    scenarioSnapshot != null
      ? resolveSettingsForScenarioYear(year, scenarioSnapshot) ?? resolveSettingsForYear(year, 'capacity')
      : resolveSettingsForYear(year, effectiveProfile);

  const mCandidate = db
    .prepare(`
    SELECT m.id AS machine_id, m.internal_number, m.type, m.oee_override, m.status, COALESCE(m.machine_usage, 1) AS machine_usage
    FROM machines m
    WHERE m.id = ?
  `)
    .get(machineId) as any;
  if (!mCandidate) return null;
  const st = String(mCandidate.status ?? 'active');
  if (st === 'inactive') return null;
  if (st === 'RFQ') {
    if (!scenarioSnapshot || !operationsOverride) return null;
    const allow = scenarioLinkedRfqProductionMachineIds(scenarioSnapshot, scenarioIncludeRfq);
    if (!allow.includes(machineId)) return null;
  }
  const m = mCandidate;

  const operations =
    operationsOverride ??
    (scenarioSnapshot != null
      ? scenarioHydratedOperationsForActiveProjects(scenarioSnapshot, { includeRfq: scenarioIncludeRfq })
      : (db.prepare(`
    SELECT o.id AS operation_id, o.project_id, o.part_id, o.machine_id, o.cycle_time_seconds, o.volume_value, o.volume_unit, o.nests_count, o.oee_override, o.capacity_percent,
           o.alt_cycle_time_seconds, o.alt_nests_count, o.alt_oee_override, o.use_alternative_in_calculator, o.split_from_operation_id,
           p.sop, p.eop
    FROM operations o
    JOIN projects p ON p.id = o.project_id
    WHERE p.status = 'active'
  `).all() as any[]));

  const volumeMap = (() => {
    if (scenarioSnapshot != null) {
      const rows = (scenarioSnapshot.operation_volume_by_year || []).filter((v: any) => Number(v.year) === year) as {
        operation_id: number;
        year: number;
        volume_value: number;
        volume_unit: string;
      }[];
      return new Map(rows.map((v) => [Number(v.operation_id), v]));
    }
    const volumeByYear = db.prepare('SELECT operation_id, year, volume_value, volume_unit FROM operation_volume_by_year WHERE year = ?').all(year) as {
      operation_id: number;
      year: number;
      volume_value: number;
      volume_unit: string;
    }[];
    return new Map(volumeByYear.map((v) => [v.operation_id, v]));
  })();

  const machineOps = operations.filter((o: any) => o.machine_id === m.machine_id);
  let totalRequiredSec = 0;
  let loadRatioSum = 0;
  const opById: Record<
    number,
    {
      ratio_contrib: number;
      weekly_volume: number;
      resolved_volume_value: number;
      resolved_volume_unit: 'annual' | 'monthly' | 'weekly';
      fraction: number;
    }
  > = {};

  for (const op of machineOps) {
    const opKey = Number(op.operation_id ?? op.id);
    if (!Number.isFinite(opKey)) continue;
    const opVolumeOverride = volumeMap.get(opKey);
    const resolved = resolveOperationVolumeForYear(
      {
        operation_id: opKey,
        project_id: op.project_id,
        part_id: op.part_id,
        volume_value: op.volume_value,
        volume_unit: op.volume_unit,
        split_from_operation_id: op.split_from_operation_id,
      },
      year,
      opVolumeOverride ?? null,
      scenarioSnapshot ?? null,
      useContract
    );
    const volValue = resolved.volume_value;
    const volUnit = resolved.volume_unit;
    const weeklyResolved = resolveWeeklyVolumeFromResolved(volValue, volUnit, settings, {
      sop: op.sop ?? '',
      eop: op.eop ?? '',
      year,
      volume_origin: resolved.volume_origin,
      count_after_eop: resolved.count_after_eop,
      has_project: op.project_id != null,
    });
    const weeklyVol = weeklyResolved.weekly;
    const fraction = weeklyResolved.fraction;
    const { cycleSeconds, nests, oeeForResolve } = resolveOperationCycleForCalculator(op);
    const requiredSecOp = weeklyVol * (cycleSeconds / nests);
    totalRequiredSec += requiredSecOp;
    const oeeOp = resolveOee(settings, m.oee_override, oeeForResolve);
    const availabilitySecOp = availabilitySecondsPerWeek(settings, oeeOp);
    const ratioContrib = availabilitySecOp > 0 ? requiredSecOp / availabilitySecOp : 0;
    loadRatioSum += ratioContrib;
    opById[opKey] = {
      ratio_contrib: ratioContrib,
      weekly_volume: weeklyVol,
      resolved_volume_value: volValue,
      resolved_volume_unit: volUnit,
      fraction,
    };
  }

  const usage = Math.max(0.1, Math.min(1, m.machine_usage ?? 1));
  const oeeMachine = resolveOee(settings, m.oee_override, null);
  const availabilitySecBase = availabilitySecondsPerWeek(settings, oeeMachine);
  const availabilitySec = availabilitySecBase * (1 / usage);
  const loadPercent =
    availabilitySec > 0
      ? Math.round((totalRequiredSec / availabilitySec) * 100)
      : totalRequiredSec > 0
        ? 100
        : 0;

  return {
    load_ratio_sum: loadRatioSum,
    usage,
    load_percent: loadPercent,
    availability_sec_per_week: availabilitySec,
    required_sec_per_week: Math.round(totalRequiredSec),
    working_weeks_per_year: Math.max(1, settings.working_weeks_per_year ?? 48),
    op_by_id: opById,
  };
}

export function getMachineCapacityByYears(
  yearFrom: number,
  yearTo: number,
  machineIds?: number[],
  machineType?: string | string[],
  operationsOverride?: any[],
  scenarioSnapshot?: ScenarioBundle | null,
  scenarioIncludeRfqProjects?: boolean,
  useContractualVolumes?: boolean,
  machineStatusFilter?: MachineStatusFilterInput,
  dimensionFilters?: MachineDimensionFilter[],
  settingsProfile?: CalculationSettingsProfile
): {
  machine_id: number;
  internal_number: string | number;
  sap_number: string | null;
  type: string;
  machine_status: string | null;
  location: string | null;
  years: Record<
    number,
    {
      load_percent: number;
      capacity_pcs_per_week: number;
      required_sec_per_week: number;
      availability_sec_per_week?: number;
      alternative_border?: 'none' | 'unused' | 'all_alt' | 'mixed';
    }
  >;
}[] {
  const machineMap = new Map<
    number,
    {
      internal_number: string | number;
      sap_number: string | null;
      type: string;
      machine_status: string | null;
      location: string | null;
      years: Record<number, any>;
    }
  >();

  for (let y = yearFrom; y <= yearTo; y++) {
    const rows = getMachineCapacitiesForYear(
      y,
      machineIds,
      machineType,
      operationsOverride,
      scenarioSnapshot ?? null,
      scenarioIncludeRfqProjects,
      useContractualVolumes,
      machineStatusFilter,
      dimensionFilters,
      settingsProfile
    );
    for (const r of rows) {
      if (!machineMap.has(r.machine_id)) {
        machineMap.set(r.machine_id, {
          internal_number: r.internal_number,
          sap_number: r.sap_number ?? null,
          type: r.type,
          machine_status: r.machine_status != null ? String(r.machine_status) : null,
          location: r.location != null ? String(r.location).trim() || null : null,
          years: {},
        });
      }
      const ent = machineMap.get(r.machine_id)!;
      ent.years[r.year] = {
        load_percent: r.load_percent,
        capacity_pcs_per_week: r.capacity_pcs_per_week,
        required_sec_per_week: r.required_sec_per_week,
        availability_sec_per_week: r.availability_sec_per_week,
        alternative_border: r.alternative_border,
        detail_breakdown: r.detail_breakdown ?? [],
        has_rfq: Boolean(r.has_rfq),
      };
    }
  }

  return Array.from(machineMap.entries()).map(([machine_id, v]) => ({
    machine_id,
    internal_number: v.internal_number,
    sap_number: v.sap_number,
    type: v.type,
    machine_status: v.machine_status,
    location: v.location,
    years: v.years,
  }));
}

export function getNestCapacitiesForYear(year: number): { nest_id: number; nest_name: string | null; machines: MachineCapacityRow[] }[] {
  const nests = db.prepare('SELECT id, name FROM nests').all() as { id: number; name: string | null }[];
  const result: { nest_id: number; nest_name: string | null; machines: MachineCapacityRow[] }[] = [];

  for (const nest of nests) {
    const machineIds = db.prepare('SELECT machine_id FROM nest_machines WHERE nest_id = ?').all(nest.id) as { machine_id: number }[];
    const ids = machineIds.map((m) => m.machine_id);
    if (ids.length === 0) continue;
    const machines = getMachineCapacitiesForYear(year, ids);
    result.push({ nest_id: nest.id, nest_name: nest.name, machines });
  }
  return result;
}

function lineKeyFromLocation(location: string | null | undefined): string {
  const t = String(location ?? '').trim();
  return t || '—';
}

export type CapacityBreakdownDetail = {
  detail_label: string;
  load_percent: number;
  share_percent: number;
  has_rfq: boolean;
};

export type CapacityBreakdownProject = {
  project_id: number;
  project_name: string;
  load_percent: number;
  share_percent: number;
  details: CapacityBreakdownDetail[];
};

export type CapacityBreakdownClient = {
  client: string;
  load_percent: number;
  share_percent: number;
  projects: CapacityBreakdownProject[];
};

export type CapacityBreakdownSeries = {
  load_percent: number | null;
  clients: CapacityBreakdownClient[];
};

export type CapacityBreakdownSeriesKey = 'production' | 'contract' | 'scenario_production' | 'scenario_contract';

type BreakdownScope = { kind: 'line'; line: string } | { kind: 'machine'; machineId: number };

type BreakdownOpts = {
  machineIds?: number[];
  machineType?: string | string[];
  operationsOverride?: any[];
  scenarioSnapshot?: ScenarioBundle | null;
  scenarioIncludeRfqProjects?: boolean;
  useContractualVolumes?: boolean;
  machineStatusFilter?: MachineStatusFilterInput;
  dimensionFilters?: MachineDimensionFilter[];
  settingsProfile?: CalculationSettingsProfile;
};

function scenarioProjectLookup(snapshot: ScenarioBundle | null | undefined): Map<number, { client: string; name: string }> {
  const map = new Map<number, { client: string; name: string }>();
  if (!snapshot?.projects) return map;
  for (const p of snapshot.projects) {
    map.set(Number(p.id), { client: String(p.client ?? ''), name: String(p.name ?? '') });
  }
  return map;
}

function loadOperationsForBreakdown(operationsOverride?: any[]): any[] {
  if (operationsOverride) return operationsOverride;
  return db.prepare(`
    SELECT o.id AS operation_id, o.project_id, o.part_id, o.machine_id, o.cycle_time_seconds, o.volume_value, o.volume_unit, o.nests_count, o.oee_override, o.capacity_percent,
           o.alt_cycle_time_seconds, o.alt_nests_count, o.alt_oee_override, o.use_alternative_in_calculator, o.split_from_operation_id,
           p.client AS project_client, p.name AS project_name,
           p.sop, p.eop, p.status AS project_status,
           pd.sap_number AS detail_sap_number,
           pd.alias AS detail_alias,
           pd.free_text AS detail_free_text,
           pt.designation AS detail_designation
    FROM operations o
    JOIN projects p ON p.id = o.project_id
    JOIN parts pt ON pt.id = o.part_id
    LEFT JOIN part_designations pd ON pd.id = pt.designation_id
    WHERE p.status = 'active'
  `).all() as any[];
}

function resolveScopeMachineIds(
  scope: BreakdownScope,
  opts: Pick<BreakdownOpts, 'machineIds' | 'machineType' | 'machineStatusFilter' | 'dimensionFilters' | 'scenarioSnapshot' | 'scenarioIncludeRfqProjects'>
): number[] {
  const msList = normalizeMachineStatusFilters(opts.machineStatusFilter);
  const effectiveStatuses: CalculatorMachineStatusFilter[] =
    msList.length > 0 ? msList : opts.machineStatusFilter === undefined ? ['active'] : [];
  const scenarioRfqs =
    opts.scenarioSnapshot != null
      ? scenarioLinkedRfqProductionMachineIds(opts.scenarioSnapshot, opts.scenarioIncludeRfqProjects !== false)
      : [];
  const statusWhere = buildMachineStatusWhere(effectiveStatuses, scenarioRfqs);

  let machinesSql = `
    SELECT m.id AS machine_id, m.location
    FROM machines m
    WHERE ${statusWhere.clause}
  `;
  const params: (number | string)[] = [...statusWhere.params];
  if (opts.machineIds?.length) {
    machinesSql += ` AND m.id IN (${opts.machineIds.map(() => '?').join(',')})`;
    params.push(...opts.machineIds);
  }
  const types = normalizeMachineTypes(opts.machineType);
  if (types.length === 1) {
    machinesSql += ' AND m.type = ?';
    params.push(types[0]);
  } else if (types.length > 1) {
    machinesSql += ` AND m.type IN (${types.map(() => '?').join(',')})`;
    params.push(...types);
  }
  if (opts.dimensionFilters?.length) {
    const dim = appendMachineDimensionFilters(opts.dimensionFilters);
    if (dim.clause !== '1=1') {
      machinesSql += ` AND (${dim.clause})`;
      params.push(...dim.params);
    }
  }

  const machines = db.prepare(machinesSql).all(...params) as { machine_id: number; location: string | null }[];
  return machines
    .filter((m) => {
      if (scope.kind === 'machine') return m.machine_id === scope.machineId;
      return lineKeyFromLocation(m.location) === scope.line;
    })
    .map((m) => m.machine_id);
}

function scopeTotalsFromRows(rows: MachineCapacityRow[]): {
  requiredSec: number;
  availabilitySec: number;
  loadPercent: number | null;
} {
  if (!rows.length) return { requiredSec: 0, availabilitySec: 0, loadPercent: null };
  let req = 0;
  let avail = 0;
  for (const r of rows) {
    req += r.required_sec_per_week ?? 0;
    avail += r.availability_sec_per_week ?? 0;
  }
  if (avail <= 0) return { requiredSec: req, availabilitySec: avail, loadPercent: req > 0 ? 100 : null };
  return {
    requiredSec: req,
    availabilitySec: avail,
    loadPercent: Math.round((req / avail) * 100),
  };
}

function scopeLoadPercentFromRows(rows: MachineCapacityRow[], _scope: BreakdownScope): number | null {
  return scopeTotalsFromRows(rows).loadPercent;
}

type BreakdownAccum = {
  totalRequiredSec: number;
  clients: Map<
    string,
    {
      requiredSec: number;
      projects: Map<
        number,
        {
          project_name: string;
          requiredSec: number;
          details: Map<string, { requiredSec: number; hasRfq: boolean }>;
        }
      >;
    }
  >;
};

function accumulateScopeBreakdown(
  year: number,
  scopeMachineIds: Set<number>,
  opts: BreakdownOpts
): BreakdownAccum {
  const useContract = opts.useContractualVolumes === true;
  const effectiveProfile: CalculationSettingsProfile =
    opts.scenarioSnapshot != null ? 'capacity' : (opts.settingsProfile ?? 'capacity');
  const settings =
    opts.scenarioSnapshot != null
      ? resolveSettingsForScenarioYear(year, opts.scenarioSnapshot) ?? resolveSettingsForYear(year, 'capacity')
      : resolveSettingsForYear(year, effectiveProfile);
  const refMode = loadReferenceDisplayMode();
  const projectLookup = scenarioProjectLookup(opts.scenarioSnapshot);
  const operations = loadOperationsForBreakdown(opts.operationsOverride);
  const volumeMap = (() => {
    if (opts.scenarioSnapshot != null) {
      const rows = (opts.scenarioSnapshot.operation_volume_by_year || []).filter((v: any) => Number(v.year) === year) as {
        operation_id: number;
        year: number;
        volume_value: number;
        volume_unit: string;
      }[];
      return new Map(rows.map((v) => [Number(v.operation_id), v]));
    }
    const volumeByYear = db
      .prepare('SELECT operation_id, year, volume_value, volume_unit FROM operation_volume_by_year WHERE year = ?')
      .all(year) as { operation_id: number; year: number; volume_value: number; volume_unit: string }[];
    return new Map(volumeByYear.map((v) => [v.operation_id, v]));
  })();

  const accum: BreakdownAccum = { totalRequiredSec: 0, clients: new Map() };

  for (const op of operations) {
    const machineId = Number(op.machine_id);
    if (!scopeMachineIds.has(machineId)) continue;

    const opKey = Number(op.operation_id ?? op.id);
    if (!Number.isFinite(opKey)) continue;
    const opVolumeOverride = volumeMap.get(opKey);
    const resolved = resolveOperationVolumeForYear(
      {
        operation_id: opKey,
        project_id: op.project_id,
        part_id: op.part_id,
        volume_value: op.volume_value,
        volume_unit: op.volume_unit,
        split_from_operation_id: op.split_from_operation_id,
      },
      year,
      opVolumeOverride,
      opts.scenarioSnapshot ?? null,
      useContract
    );
    const volValue = resolved.volume_value;
    const volUnit = resolved.volume_unit;
    const weeklyResolved = resolveWeeklyVolumeFromResolved(volValue, volUnit, settings, {
      sop: op.sop ?? '',
      eop: op.eop ?? '',
      year,
      volume_origin: resolved.volume_origin,
      count_after_eop: resolved.count_after_eop,
      has_project: op.project_id != null,
    });
    const weeklyVol = weeklyResolved.weekly;
    if (weeklyVol <= 1e-9) continue;

    const { cycleSeconds, nests } = resolveOperationCycleForCalculator(op);
    const requiredSecOp = weeklyVol * (cycleSeconds / nests);
    if (requiredSecOp <= 1e-9) continue;

    const lookup = projectLookup.get(Number(op.project_id));
    const client = String(op.project_client ?? lookup?.client ?? '—').trim() || '—';
    const projectName = String(op.project_name ?? lookup?.name ?? '—').trim() || '—';
    const projectId = Number(op.project_id);
    const detailLabel = formatDetailSapAliasLabel(
      {
        sap_number: op.detail_sap_number,
        alias: op.detail_alias,
        free_text: op.detail_free_text,
        designation: op.detail_designation,
        id: op.part_id,
      },
      refMode
    );
    const hasRfq = String(op.project_status ?? '').toUpperCase() === 'RFQ';

    accum.totalRequiredSec += requiredSecOp;

    if (!accum.clients.has(client)) {
      accum.clients.set(client, { requiredSec: 0, projects: new Map() });
    }
    const clientNode = accum.clients.get(client)!;
    clientNode.requiredSec += requiredSecOp;

    if (!clientNode.projects.has(projectId)) {
      clientNode.projects.set(projectId, { project_name: projectName, requiredSec: 0, details: new Map() });
    }
    const projectNode = clientNode.projects.get(projectId)!;
    projectNode.requiredSec += requiredSecOp;

    const detailNode = projectNode.details.get(detailLabel) ?? { requiredSec: 0, hasRfq: false };
    detailNode.requiredSec += requiredSecOp;
    if (hasRfq) detailNode.hasRfq = true;
    projectNode.details.set(detailLabel, detailNode);
  }

  return accum;
}

function finalizeBreakdownTree(
  accum: BreakdownAccum,
  scopeAvailabilitySec: number,
  scopeRequiredSec: number
): CapacityBreakdownSeries {
  const total = accum.totalRequiredSec;
  const scopeLoadPercent =
    scopeAvailabilitySec > 0
      ? Math.round((scopeRequiredSec / scopeAvailabilitySec) * 100)
      : scopeRequiredSec > 0
        ? 100
        : null;
  const toLoad = (sec: number) => {
    if (scopeAvailabilitySec <= 0) return sec > 0 ? 100 : 0;
    return Math.round((sec / scopeAvailabilitySec) * 10000) / 100;
  };
  const toShare = (sec: number) => (total > 0 ? Math.round((sec / total) * 10000) / 100 : 0);

  const clients = [...accum.clients.entries()]
    .map(([client, c]) => ({
      client,
      load_percent: toLoad(c.requiredSec),
      share_percent: toShare(c.requiredSec),
      projects: [...c.projects.entries()]
        .map(([project_id, p]) => ({
          project_id,
          project_name: p.project_name,
          load_percent: toLoad(p.requiredSec),
          share_percent: toShare(p.requiredSec),
          details: [...p.details.entries()]
            .map(([detail_label, d]) => ({
              detail_label,
              load_percent: toLoad(d.requiredSec),
              share_percent: toShare(d.requiredSec),
              has_rfq: d.hasRfq,
            }))
            .sort((a, b) => b.load_percent - a.load_percent),
        }))
        .sort((a, b) => b.load_percent - a.load_percent),
    }))
    .sort((a, b) => b.load_percent - a.load_percent);

  return { load_percent: scopeLoadPercent, clients };
}

function buildScopeBreakdownSeries(
  year: number,
  scope: BreakdownScope,
  scopeMachineIds: number[],
  opts: BreakdownOpts
): CapacityBreakdownSeries {
  if (!scopeMachineIds.length) return { load_percent: null, clients: [] };
  const capacityRows = getMachineCapacitiesForYear(
    year,
    scopeMachineIds,
    opts.machineType,
    opts.operationsOverride,
    opts.scenarioSnapshot ?? null,
    opts.scenarioIncludeRfqProjects,
    opts.useContractualVolumes,
    opts.machineStatusFilter,
    opts.dimensionFilters,
    opts.settingsProfile
  );
  const scopeTotals = scopeTotalsFromRows(capacityRows);
  const accum = accumulateScopeBreakdown(year, new Set(scopeMachineIds), opts);
  return finalizeBreakdownTree(accum, scopeTotals.availabilitySec, scopeTotals.requiredSec);
}

export function getCapacityScopeBreakdown(
  year: number,
  scope: BreakdownScope,
  opts: BreakdownOpts,
  seriesKeys: CapacityBreakdownSeriesKey[]
): Partial<Record<CapacityBreakdownSeriesKey, CapacityBreakdownSeries>> {
  const scopeMachineIds = resolveScopeMachineIds(scope, opts);
  const out: Partial<Record<CapacityBreakdownSeriesKey, CapacityBreakdownSeries>> = {};

  const base: BreakdownOpts = {
    machineIds: opts.machineIds,
    machineType: opts.machineType,
    machineStatusFilter: opts.machineStatusFilter,
    dimensionFilters: opts.dimensionFilters,
    settingsProfile: opts.settingsProfile,
    scenarioIncludeRfqProjects: opts.scenarioIncludeRfqProjects,
  };

  for (const key of seriesKeys) {
    let variant: BreakdownOpts;
    if (key === 'production') {
      variant = { ...base, useContractualVolumes: false, scenarioSnapshot: null, operationsOverride: undefined };
    } else if (key === 'contract') {
      variant = { ...base, useContractualVolumes: true, scenarioSnapshot: null, operationsOverride: undefined };
    } else if (key === 'scenario_production') {
      variant = {
        ...base,
        useContractualVolumes: false,
        scenarioSnapshot: opts.scenarioSnapshot ?? null,
        operationsOverride: opts.operationsOverride,
      };
    } else {
      variant = {
        ...base,
        useContractualVolumes: true,
        scenarioSnapshot: opts.scenarioSnapshot ?? null,
        operationsOverride: opts.operationsOverride,
      };
    }
    out[key] = buildScopeBreakdownSeries(year, scope, scopeMachineIds, variant);
  }

  return out;
}
