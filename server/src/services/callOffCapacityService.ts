import {
  getMachineCapacityByYears,
  getMachineCapacitiesForYear,
  getMachineMonthlyLoadsByMonth,
  getMachinePeriodBreakdown,
  type CapacityCalculationOptions,
} from './capacityService.js';
import { loadCallOffVolumeMaps } from './callOffService.js';
import type { MachineDimensionFilter } from '../utils/machineDimensionFilter.js';
import type { MachineStatusFilterInput, CalculationSettingsProfile } from './capacityService.js';

const CALL_OFF_PROD_OPTIONS: CapacityCalculationOptions = {
  includeAssignedZeroVolumeDetailsInBreakdown: true,
};

export type CallOffCalculatorMachine = {
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
      /** Peak miesięczny SAP — dolny pasek w komórce roku w Kalkulatorze. */
      call_off_load_percent: number;
      /**
       * Data Viz: jak produkcja/kontrakt (suma req / suma avail), ale tylko miesiące z danymi SAP (bez zer).
       */
      call_off_annual_load_percent?: number;
      call_off_annual_required_sec_per_week?: number;
      call_off_annual_availability_sec_per_week?: number;
      capacity_pcs_per_week: number;
      required_sec_per_week: number;
      availability_sec_per_week?: number;
      alternative_border?: 'none' | 'unused' | 'all_alt' | 'mixed';
      detail_breakdown?: {
        project_label: string;
        detail_label: string;
        contribution_percent: number;
        share_percent: number;
        volume_quantity: number;
        has_rfq: boolean;
      }[];
      call_off_detail_breakdown?: {
        project_label: string;
        detail_label: string;
        contribution_percent: number;
        share_percent: number;
        volume_quantity: number;
        has_rfq: boolean;
      }[];
      has_rfq?: boolean;
    }
  >;
};

export type CallOffPeriodBreakdownMachine = {
  machine_id: number;
  has_sop?: boolean;
  has_eop?: boolean;
  months: Record<
    number,
    {
      load_percent: number;
      call_off_load_percent: number;
      weeks: Record<
        number,
        {
          load_percent: number;
          call_off_load_percent: number;
          detail_breakdown?: {
            project_label: string;
            detail_label: string;
            contribution_percent: number;
            share_percent: number;
            volume_quantity: number;
            has_rfq: boolean;
          }[];
          call_off_detail_breakdown?: {
            project_label: string;
            detail_label: string;
            contribution_percent: number;
            share_percent: number;
            volume_quantity: number;
            has_rfq: boolean;
          }[];
        }
      >;
      has_sop?: boolean;
      has_eop?: boolean;
      detail_breakdown?: {
        project_label: string;
        detail_label: string;
        contribution_percent: number;
        share_percent: number;
        volume_quantity: number;
        has_rfq: boolean;
      }[];
      call_off_detail_breakdown?: {
        project_label: string;
        detail_label: string;
        contribution_percent: number;
        share_percent: number;
        volume_quantity: number;
        has_rfq: boolean;
      }[];
    }
  >;
};

type DetailBreakdownRow = NonNullable<CallOffCalculatorMachine['years'][number]['call_off_detail_breakdown']>;

/** Detale z Capacity bez wolumenu SAP w okresie — dopisz jako 0%, żeby prognoza pokazywała skład maszyny. */
function mergeAssignedDetailsIntoCallOffBreakdown(
  callOffDetails: DetailBreakdownRow | undefined,
  baseDetails: DetailBreakdownRow | undefined
): DetailBreakdownRow {
  const co = [...(callOffDetails ?? [])];
  const seen = new Set(co.map((d) => `${d.project_label}\0${d.detail_label}`));
  for (const d of baseDetails ?? []) {
    const key = `${d.project_label}\0${d.detail_label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    co.push({
      project_label: d.project_label,
      detail_label: d.detail_label,
      contribution_percent: 0,
      share_percent: 0,
      volume_quantity: 0,
      has_rfq: d.has_rfq,
    });
  }
  return co.sort((a, b) => b.contribution_percent - a.contribution_percent);
}

type MonthLoad = { load_percent: number; detail_breakdown: DetailBreakdownRow };

function findPeakSapMonth(months: Map<number, MonthLoad>): { month: number; sap: MonthLoad } {
  let bestMonth = 1;
  let best: MonthLoad = { load_percent: 0, detail_breakdown: [] };
  for (let m = 1; m <= 12; m++) {
    const row = months.get(m) ?? { load_percent: 0, detail_breakdown: [] };
    if (row.load_percent > best.load_percent) {
      best = row;
      bestMonth = m;
    }
  }
  return { month: bestMonth, sap: best };
}

type VizAgg = {
  required_sec: number;
  availability_sec: number;
  load_percent: number;
};

/**
 * Jak produkcja/kontrakt: obciążenie = suma wymaganego czasu / suma dostępności,
 * ale tylko z miesięcy z danymi SAP (load/req > 0) — bez rozcieńczania zerami.
 */
function aggregateCallOffMonthsSkippingZeros(
  year: number,
  machineIds: number[] | undefined,
  machineType: string | string[] | undefined,
  useContractualVolumes: boolean | undefined,
  machineStatusFilter: MachineStatusFilterInput | undefined,
  dimensionFilters: MachineDimensionFilter[] | undefined,
  settingsProfile: CalculationSettingsProfile | undefined,
  callOffVolumes: NonNullable<ReturnType<typeof loadCallOffVolumeMaps>>
): Map<number, VizAgg> {
  const agg = new Map<number, { required_sec: number; availability_sec: number }>();

  for (let month = 1; month <= 12; month++) {
    const monthRows = getMachineCapacitiesForYear(
      year,
      machineIds,
      machineType,
      undefined,
      null,
      undefined,
      useContractualVolumes,
      machineStatusFilter,
      dimensionFilters,
      settingsProfile,
      month,
      undefined,
      callOffVolumes,
      'monthly',
      CALL_OFF_PROD_OPTIONS
    );
    for (const row of monthRows) {
      const req = Number(row.required_sec_per_week ?? 0);
      const avail = Number(row.availability_sec_per_week ?? 0);
      const load = Number(row.load_percent ?? 0);
      if (load <= 1e-9 && req <= 1e-9) continue;
      if (avail <= 0) continue;
      const prev = agg.get(row.machine_id) ?? { required_sec: 0, availability_sec: 0 };
      prev.required_sec += req;
      prev.availability_sec += avail;
      agg.set(row.machine_id, prev);
    }
  }

  const out = new Map<number, VizAgg>();
  for (const [machineId, v] of agg) {
    const load_percent =
      v.availability_sec > 0 ? Math.round((v.required_sec / v.availability_sec) * 100) : 0;
    out.set(machineId, {
      required_sec: Math.round(v.required_sec),
      availability_sec: Math.round(v.availability_sec),
      load_percent,
    });
  }
  return out;
}

export function getCallOffComparisonCalculator(
  comparisonId: number,
  yearFrom: number,
  yearTo: number,
  machineIds?: number[],
  machineType?: string | string[],
  useContractualVolumes?: boolean,
  machineStatusFilter?: MachineStatusFilterInput,
  dimensionFilters?: MachineDimensionFilter[],
  settingsProfile?: CalculationSettingsProfile
): CallOffCalculatorMachine[] {
  const callOffVolumes = loadCallOffVolumeMaps(comparisonId);

  const baseMachines = getMachineCapacityByYears(
    yearFrom,
    yearTo,
    machineIds,
    machineType,
    undefined,
    null,
    undefined,
    useContractualVolumes,
    machineStatusFilter,
    dimensionFilters,
    settingsProfile,
    null,
    CALL_OFF_PROD_OPTIONS
  );

  /** Rok → maszyna → peak (Kalkulator) oraz agregacja bez zer (Data Viz). */
  const sapPeakByYear = new Map<number, Map<number, MonthLoad>>();
  const sapVizByYear = new Map<number, Map<number, VizAgg>>();

  for (let y = yearFrom; y <= yearTo; y++) {
    const sapByMonth = getMachineMonthlyLoadsByMonth(
      y,
      machineIds,
      machineType,
      undefined,
      null,
      undefined,
      useContractualVolumes,
      machineStatusFilter,
      dimensionFilters,
      settingsProfile,
      callOffVolumes,
      CALL_OFF_PROD_OPTIONS
    );

    const peakMap = new Map<number, MonthLoad>();
    for (const [machineId, sapMonths] of sapByMonth) {
      const { sap: peak } = findPeakSapMonth(sapMonths);
      peakMap.set(machineId, peak);
    }
    sapPeakByYear.set(y, peakMap);

    sapVizByYear.set(
      y,
      aggregateCallOffMonthsSkippingZeros(
        y,
        machineIds,
        machineType,
        useContractualVolumes,
        machineStatusFilter,
        dimensionFilters,
        settingsProfile,
        callOffVolumes
      )
    );
  }

  return baseMachines.map((m) => {
    const years: CallOffCalculatorMachine['years'] = {};
    for (const [yearKey, yData] of Object.entries(m.years)) {
      const year = Number(yearKey);
      const peak = sapPeakByYear.get(year)?.get(m.machine_id);
      const viz = sapVizByYear.get(year)?.get(m.machine_id);
      years[year] = {
        ...yData,
        call_off_load_percent: peak?.load_percent ?? 0,
        call_off_annual_load_percent: viz?.load_percent ?? 0,
        call_off_annual_required_sec_per_week: viz?.required_sec ?? 0,
        call_off_annual_availability_sec_per_week: viz?.availability_sec ?? 0,
        call_off_detail_breakdown: peak?.detail_breakdown ?? [],
      };
    }
    return { ...m, years };
  });
}

export function getCallOffPeriodBreakdown(
  comparisonId: number,
  year: number,
  machineIds?: number[],
  machineType?: string | string[],
  useContractualVolumes?: boolean,
  machineStatusFilter?: MachineStatusFilterInput,
  dimensionFilters?: MachineDimensionFilter[],
  settingsProfile?: CalculationSettingsProfile
): CallOffPeriodBreakdownMachine[] {
  const callOffVolumes = loadCallOffVolumeMaps(comparisonId);

  const base = getMachinePeriodBreakdown(
    year,
    machineIds,
    machineType,
    undefined,
    null,
    undefined,
    useContractualVolumes,
    machineStatusFilter,
    dimensionFilters,
    settingsProfile,
    null,
    { includeAssignedZeroVolumeDetailsInBreakdown: true }
  );

  const callOff = getMachinePeriodBreakdown(
    year,
    machineIds,
    machineType,
    undefined,
    null,
    undefined,
    useContractualVolumes,
    machineStatusFilter,
    dimensionFilters,
    settingsProfile,
    callOffVolumes,
    { includeAssignedZeroVolumeDetailsInBreakdown: true }
  );

  const callOffByMachine = new Map(callOff.map((m) => [m.machine_id, m]));

  return base.map((m) => {
    const coM = callOffByMachine.get(m.machine_id);
    const months: CallOffPeriodBreakdownMachine['months'] = {};
    for (const [monthKey, md] of Object.entries(m.months)) {
      const month = Number(monthKey);
      const coMd = coM?.months?.[month];
      const weeks: CallOffPeriodBreakdownMachine['months'][number]['weeks'] = {};
      for (const [weekKey, wd] of Object.entries(md.weeks)) {
        const week = Number(weekKey);
        const coWeek = coMd?.weeks?.[week];
        weeks[week] = {
          load_percent: wd.load_percent,
          call_off_load_percent: coWeek?.load_percent ?? 0,
          detail_breakdown: wd.detail_breakdown ?? [],
          call_off_detail_breakdown: mergeAssignedDetailsIntoCallOffBreakdown(
            coWeek?.detail_breakdown,
            wd.detail_breakdown
          ),
        };
      }
      months[month] = {
        load_percent: md.load_percent,
        call_off_load_percent: coMd?.load_percent ?? 0,
        weeks,
        has_sop: md.has_sop,
        has_eop: md.has_eop,
        detail_breakdown: md.detail_breakdown ?? [],
        call_off_detail_breakdown: mergeAssignedDetailsIntoCallOffBreakdown(
          coMd?.detail_breakdown,
          md.detail_breakdown
        ),
      };
    }
    return {
      machine_id: m.machine_id,
      has_sop: m.has_sop,
      has_eop: m.has_eop,
      months,
    };
  });
}
