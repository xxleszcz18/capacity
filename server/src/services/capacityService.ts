import { db } from '../db/connection.js';

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

export interface WorkingDaysRow {
  id: number;
  year: number;
  working_days_year: number;
  oee_factor: number;
  shift_time_seconds: number; // czas jednej zmiany w minutach (np. 450 = 7,5 h)
  startup_shutdown_seconds: number;
  working_weeks_per_year?: number; // pracujące tygodnie w roku (np. 48)
  shifts_per_day?: number; // liczba zmian na dobę (1, 2, 3)
}

export function getSettingsForYear(year: number): WorkingDaysRow | null {
  const row = db.prepare('SELECT * FROM working_days WHERE year = ? AND status = ?').get(year, 'active') as WorkingDaysRow | undefined;
  if (row) return row;
  const anyStatus = db.prepare('SELECT * FROM working_days WHERE year = ?').get(year) as WorkingDaysRow | undefined;
  if (anyStatus) return anyStatus;

  /* Lata bez osobnego wpisu (np. daleka przyszłość): użyj najbliższego szablonu z bazy,
   * żeby kalkulator i alokacja nie zwracały pustych wyników przy istniejących alternatywach. */
  let nearest = db
    .prepare(
      `SELECT * FROM working_days WHERE status = 'active' ORDER BY ABS(year - ?) ASC, year DESC LIMIT 1`
    )
    .get(year) as WorkingDaysRow | undefined;
  if (nearest) return nearest;

  nearest = db
    .prepare(`SELECT * FROM working_days ORDER BY ABS(year - ?) ASC, year DESC LIMIT 1`)
    .get(year) as WorkingDaysRow | undefined;
  return nearest ?? null;
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
  const sopMatch = String(sop || '').trim().match(/^(\d{1,2})\.(\d{4})$/);
  const eopMatch = String(eop || '').trim().match(/^(\d{1,2})\.(\d{4})$/);
  const sopYear = sopMatch ? parseInt(sopMatch[2], 10) : null;
  const eopYear = eopMatch ? parseInt(eopMatch[2], 10) : null;
  const startMonth = sopMatch ? parseInt(sopMatch[1], 10) : undefined;
  const endMonth = eopMatch ? parseInt(eopMatch[1], 10) : undefined;
  if (sopYear == null || eopYear == null || year < sopYear || year > eopYear) return 0;
  const isFirst = year === sopYear;
  const isLast = year === eopYear;
  if (isFirst && startMonth != null) return (13 - startMonth) / 12;
  if (isLast && endMonth != null) return endMonth / 12;
  return 1;
}

export type EffectiveVolumeResult = {
  volume_value: number;
  volume_unit: 'annual' | 'monthly' | 'weekly';
  count_after_eop?: boolean; // true = liczyć w kalkulatorze mimo roku po EOP (zmienione ręcznie)
};

/** Zwraca skuteczny wolumen dla detalu w danym roku (projekt → tryb detalu → własna wartość). Gdy brak: null = użyj volume_value/volume_unit z operacji. */
export function getEffectiveVolumeForPart(
  projectId: number,
  partId: number,
  year: number
): EffectiveVolumeResult | null {
  let pv: { volume_value: number; volume_unit: string; include_in_calculator_after_eop?: number } | undefined;
  let projectEop: string | null = null;
  let part: { volume_mode: string; volume_share_percent: number | null; default_volume_value?: number | null; default_volume_unit?: string | null } | undefined;
  let partVol: { volume_value: number; volume_unit: string } | undefined;
  try {
    pv = db.prepare('SELECT volume_value, volume_unit, COALESCE(include_in_calculator_after_eop, 0) AS include_in_calculator_after_eop FROM project_volumes WHERE project_id = ? AND year = ?').get(projectId, year) as any;
    const proj = db.prepare('SELECT eop FROM projects WHERE id = ?').get(projectId) as { eop: string } | undefined;
    projectEop = proj?.eop ?? null;
    part = db.prepare('SELECT volume_mode, volume_share_percent, default_volume_value, default_volume_unit FROM parts WHERE id = ?').get(partId) as any;
    partVol = db.prepare('SELECT volume_value, volume_unit FROM part_volume_by_year WHERE part_id = ? AND year = ?').get(partId, year) as any;
  } catch (_) {
    return null;
  }
  const eopMatch = projectEop ? projectEop.trim().match(/^\d{1,2}\.(\d{4})$/) : null;
  const eopYear = eopMatch ? parseInt(eopMatch[1], 10) : null;
  const isAfterEop = eopYear != null && year > eopYear;
  const countAfterEop = isAfterEop && pv && (pv.include_in_calculator_after_eop === 1 || pv.include_in_calculator_after_eop === true);

  const mode = part?.volume_mode ?? 'project';
  if (mode === 'override') {
    if (partVol) return { volume_value: partVol.volume_value, volume_unit: partVol.volume_unit as any, count_after_eop: countAfterEop || undefined };
    if (part?.default_volume_value != null && part?.default_volume_unit) {
      const u = ['annual', 'monthly', 'weekly'].includes(part.default_volume_unit) ? part.default_volume_unit : 'annual';
      return { volume_value: Number(part.default_volume_value), volume_unit: u as any, count_after_eop: countAfterEop || undefined };
    }
  }
  if (mode === 'project' && pv) {
    return { volume_value: pv.volume_value, volume_unit: pv.volume_unit as any, count_after_eop: countAfterEop || undefined };
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
      return { volume_value: pv.volume_value * share, volume_unit: pv.volume_unit as any, count_after_eop: countAfterEop || undefined };
    }
  }
  return null;
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
  },
  year: number,
  opYearOverride?: { volume_value: number; volume_unit: string } | null
): { volume_value: number; volume_unit: 'annual' | 'monthly' | 'weekly'; source: OperationVolumeSource } {
  const asUnit = (u: string): 'annual' | 'monthly' | 'weekly' =>
    u === 'monthly' || u === 'weekly' ? u : 'annual';

  if (opYearOverride) {
    return {
      volume_value: opYearOverride.volume_value,
      volume_unit: asUnit(opYearOverride.volume_unit),
      source: 'operation_year',
    };
  }
  if (op.project_id && op.part_id) {
    const effective = getEffectiveVolumeForPart(op.project_id, op.part_id, year);
    if (effective) {
      return {
        volume_value: effective.volume_value,
        volume_unit: asUnit(effective.volume_unit),
        source: 'part',
      };
    }
  }
  return {
    volume_value: op.volume_value,
    volume_unit: asUnit(op.volume_unit),
    source: 'operation_base',
  };
}

export interface MachineCapacityRow {
  machine_id: number;
  internal_number: number;
  type: string;
  sap_number: string | null;
  oee_override: number | null;
  year: number;
  availability_sec_per_week: number;
  required_sec_per_week: number;
  capacity_pcs_per_week: number;
  load_percent: number;
  utilization_percent: number;
}

/** Optional operations override for scenario: array of { machine_id, cycle_time_seconds, volume_value, volume_unit, nests_count, oee_override, capacity_percent } */
export function getMachineCapacitiesForYear(
  year: number,
  machineIds?: number[],
  machineType?: string,
  operationsOverride?: any[]
): MachineCapacityRow[] {
  const settings = getSettingsForYear(year);
  if (!settings) return [];

  let machinesSql = `
    SELECT m.id AS machine_id, m.internal_number, m.type, m.sap_number, m.oee_override, COALESCE(m.machine_usage, 1) AS machine_usage
    FROM machines m
    WHERE m.status = 'active'
  `;
  const params: (number | string)[] = [];
  if (machineIds?.length) {
    machinesSql += ` AND m.id IN (${machineIds.map(() => '?').join(',')})`;
    params.push(...machineIds);
  }
  if (machineType && machineType !== 'Wszystkie' && machineType !== '') {
    machinesSql += ' AND m.type = ?';
    params.push(machineType);
  }
  machinesSql += ' ORDER BY m.internal_number';

  const machines = db.prepare(machinesSql).all(...params) as any[];

  const operations = operationsOverride ?? (db.prepare(`
    SELECT o.id AS operation_id, o.project_id, o.part_id, o.machine_id, o.cycle_time_seconds, o.volume_value, o.volume_unit, o.nests_count, o.oee_override, o.capacity_percent,
           p.sop, p.eop
    FROM operations o
    JOIN projects p ON p.id = o.project_id
    WHERE p.status IN ('active', 'RFQ')
  `).all() as any[]);

  const volumeByYear = db.prepare('SELECT operation_id, year, volume_value, volume_unit FROM operation_volume_by_year WHERE year = ?').all(year) as { operation_id: number; year: number; volume_value: number; volume_unit: string }[];
  const volumeMap = new Map(volumeByYear.map((v) => [v.operation_id, v]));

  return machines.map((m) => {
    const machineOps = operations.filter((o: any) => o.machine_id === m.machine_id);
    let totalRequiredSec = 0;
    let loadRatioSum = 0; // suma (wymagany_czas / dostępność_z_OEE_dla_tej_operacji)

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
        },
        year,
        opVolumeOverride
      );
      const volValue = resolved.volume_value;
      const volUnit = resolved.volume_unit;
      const effective = op.project_id && op.part_id ? getEffectiveVolumeForPart(op.project_id, op.part_id, year) : null;
      let weeklyVol = volumeToWeekly(volValue, volUnit, settings);
      // Zawsze stosuj ułamek roku (SOP/EOP) dla operacji z projektem – brak EOP = 0 (nie liczy się poza zakresem)
      if (op.project_id != null) {
        const fraction =
          resolved.source === 'part' && effective && (effective as any).count_after_eop
            ? 1
            : getYearFractionFromSopEop(op.sop ?? '', op.eop ?? '', year);
        weeklyVol *= fraction;
      }
      // Gniazdowość: z jednego cyklu wychodzi nests_count detali, więc czas na sztukę = cykl / gniazd
      const nests = Math.max(1, op.nests_count ?? 1);
      const requiredSecOp = weeklyVol * (op.cycle_time_seconds / nests);
      totalRequiredSec += requiredSecOp;
      // OEE: nastawa indywidualna (operacja) ma pierwszeństwo przed maszyną i ustawieniami
      const oeeOp = resolveOee(settings, m.oee_override, op.oee_override ?? null);
      const availabilitySecOp = availabilitySecondsPerWeek(settings, oeeOp);
      if (availabilitySecOp > 0) loadRatioSum += requiredSecOp / availabilitySecOp;
    }

    // Machine usage 0..1: np. 0.5 = podwaja effective capacity (obciążenie maleje dwukrotnie).
    const usage = Math.max(0.1, Math.min(1, m.machine_usage ?? 1));
    const oeeMachine = resolveOee(settings, m.oee_override, null);
    const availabilitySecBase = availabilitySecondsPerWeek(settings, oeeMachine);
    const availabilitySec = availabilitySecBase * (1 / usage);
    const loadPercent = loadRatioSum > 0 ? Math.round(loadRatioSum * 100 * usage) : (availabilitySec > 0 ? Math.round((totalRequiredSec / availabilitySec) * 100) : 0);
    const capacityPcsWeek = 0;

    return {
      machine_id: m.machine_id,
      internal_number: m.internal_number,
      type: m.type,
      sap_number: m.sap_number,
      oee_override: m.oee_override,
      year,
      availability_sec_per_week: availabilitySec,
      required_sec_per_week: Math.round(totalRequiredSec),
      capacity_pcs_per_week: capacityPcsWeek,
      load_percent: loadPercent,
      utilization_percent: loadPercent,
    };
  });
}

export function getMachineCapacityByYears(
  yearFrom: number,
  yearTo: number,
  machineIds?: number[],
  machineType?: string,
  operationsOverride?: any[]
): { machine_id: number; internal_number: number; type: string; years: Record<number, { load_percent: number; capacity_pcs_per_week: number; required_sec_per_week: number }> }[] {
  const machineMap = new Map<number, { internal_number: number; type: string; years: Record<number, any> }>();

  for (let y = yearFrom; y <= yearTo; y++) {
    const rows = getMachineCapacitiesForYear(y, machineIds, machineType, operationsOverride);
    for (const r of rows) {
      if (!machineMap.has(r.machine_id)) {
        machineMap.set(r.machine_id, { internal_number: r.internal_number, type: r.type, years: {} });
      }
      const ent = machineMap.get(r.machine_id)!;
      ent.years[r.year] = {
        load_percent: r.load_percent,
        capacity_pcs_per_week: r.capacity_pcs_per_week,
        required_sec_per_week: r.required_sec_per_week,
        availability_sec_per_week: r.availability_sec_per_week,
      };
    }
  }

  return Array.from(machineMap.entries()).map(([machine_id, v]) => ({
    machine_id,
    internal_number: v.internal_number,
    type: v.type,
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
