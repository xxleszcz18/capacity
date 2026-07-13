import { getMachineCapacityByYears, getMachinePeriodBreakdown } from './capacityService.js';
import { loadCallOffVolumeMaps } from './callOffService.js';
import type { MachineDimensionFilter } from '../utils/machineDimensionFilter.js';
import type { MachineStatusFilterInput, CalculationSettingsProfile } from './capacityService.js';

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
      call_off_load_percent: number;
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

/** Najwyższe miesięczne obciążenie SAP w roku (zamiast uśrednionego rocznego). */
function peakCallOffMonthInYear(
  months: Record<number, { load_percent: number; detail_breakdown?: DetailBreakdownRow }>
): { load_percent: number; detail_breakdown: DetailBreakdownRow } {
  let peakLoad = 0;
  let peakBreakdown: DetailBreakdownRow = [];
  for (let month = 1; month <= 12; month++) {
    const load = months[month]?.load_percent ?? 0;
    if (load > peakLoad) {
      peakLoad = load;
      peakBreakdown = months[month]?.detail_breakdown ?? [];
    }
  }
  return { load_percent: peakLoad, detail_breakdown: peakBreakdown };
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
    null
  );

  const callOffYearPeak = new Map<number, Map<number, { load_percent: number; detail_breakdown: DetailBreakdownRow }>>();
  for (let y = yearFrom; y <= yearTo; y++) {
    const callOffPeriod = getMachinePeriodBreakdown(
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
      callOffVolumes
    );
    for (const row of callOffPeriod) {
      const peak = peakCallOffMonthInYear(row.months);
      if (!callOffYearPeak.has(row.machine_id)) callOffYearPeak.set(row.machine_id, new Map());
      callOffYearPeak.get(row.machine_id)!.set(y, peak);
    }
  }

  return baseMachines.map((m) => {
    const peaksByYear = callOffYearPeak.get(m.machine_id);
    const years: CallOffCalculatorMachine['years'] = {};
    for (const [yearKey, yData] of Object.entries(m.years)) {
      const year = Number(yearKey);
      const peak = peaksByYear?.get(year);
      years[year] = {
        ...yData,
        call_off_load_percent: peak?.load_percent ?? 0,
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
    null
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
    callOffVolumes
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
          call_off_detail_breakdown: coWeek?.detail_breakdown ?? [],
        };
      }
      months[month] = {
        load_percent: md.load_percent,
        call_off_load_percent: coMd?.load_percent ?? 0,
        weeks,
        has_sop: md.has_sop,
        has_eop: md.has_eop,
        detail_breakdown: md.detail_breakdown ?? [],
        call_off_detail_breakdown: coMd?.detail_breakdown ?? [],
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
