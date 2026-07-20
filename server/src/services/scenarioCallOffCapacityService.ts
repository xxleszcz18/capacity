import type { ScenarioBundle } from './scenarioSnapshotService.js';
import { getMachineCapacityByYears, getMachineMonthlyPeakLoads, getMachinePeriodBreakdown } from './capacityService.js';
import type { MachineDimensionFilter } from '../utils/machineDimensionFilter.js';
import type { MachineStatusFilterInput, CalculationSettingsProfile } from './capacityService.js';
import { loadCallOffVolumeMaps } from './callOffService.js';

type DetailBreakdownRow = {
  project_label: string;
  detail_label: string;
  contribution_percent: number;
  share_percent: number;
  volume_quantity: number;
  has_rfq: boolean;
}[];

/** Kalkulator scenariusza z wolumenami SAP z Call off (zastępują produkcyjne). */
export function getScenarioCallOffCalculator(
  comparisonId: number,
  yearFrom: number,
  yearTo: number,
  machineIds: number[] | undefined,
  machineType: string | string[] | undefined,
  operationsOverride: any[] | undefined,
  scenarioSnapshot: ScenarioBundle | null,
  scenarioIncludeRfqProjects: boolean | undefined,
  useContractualVolumes: boolean | undefined,
  machineStatusFilter: MachineStatusFilterInput | undefined,
  dimensionFilters: MachineDimensionFilter[] | undefined,
  settingsProfile: CalculationSettingsProfile | undefined
) {
  const callOffVolumes = loadCallOffVolumeMaps(comparisonId);

  const baseMachines = getMachineCapacityByYears(
    yearFrom,
    yearTo,
    machineIds,
    machineType,
    operationsOverride,
    scenarioSnapshot,
    scenarioIncludeRfqProjects,
    useContractualVolumes,
    machineStatusFilter,
    dimensionFilters,
    settingsProfile,
    null
  );

  const yearPeakByMachine = new Map<number, Map<number, { load_percent: number; detail_breakdown: DetailBreakdownRow }>>();
  for (let y = yearFrom; y <= yearTo; y++) {
    const peaks = getMachineMonthlyPeakLoads(
      y,
      machineIds,
      machineType,
      operationsOverride,
      scenarioSnapshot,
      scenarioIncludeRfqProjects,
      useContractualVolumes,
      machineStatusFilter,
      dimensionFilters,
      settingsProfile,
      callOffVolumes
    );
    for (const [machineId, peak] of peaks) {
      if (!yearPeakByMachine.has(machineId)) yearPeakByMachine.set(machineId, new Map());
      yearPeakByMachine.get(machineId)!.set(y, peak);
    }
  }

  return baseMachines.map((m) => {
    const peaksByYear = yearPeakByMachine.get(m.machine_id);
    const years: typeof m.years = {};
    for (const [yearKey, yData] of Object.entries(m.years)) {
      const year = Number(yearKey);
      const peak = peaksByYear?.get(year);
      years[year] = {
        ...yData,
        load_percent: peak?.load_percent ?? 0,
        detail_breakdown: peak?.detail_breakdown ?? [],
      };
    }
    return { ...m, years };
  });
}

export function getScenarioCallOffPeriodBreakdown(
  comparisonId: number,
  year: number,
  machineIds: number[] | undefined,
  machineType: string | string[] | undefined,
  operationsOverride: any[] | undefined,
  scenarioSnapshot: ScenarioBundle | null,
  scenarioIncludeRfqProjects: boolean | undefined,
  useContractualVolumes: boolean | undefined,
  machineStatusFilter: MachineStatusFilterInput | undefined,
  dimensionFilters: MachineDimensionFilter[] | undefined,
  settingsProfile: CalculationSettingsProfile | undefined
) {
  const callOffVolumes = loadCallOffVolumeMaps(comparisonId);
  return getMachinePeriodBreakdown(
    year,
    machineIds,
    machineType,
    operationsOverride,
    scenarioSnapshot,
    scenarioIncludeRfqProjects,
    useContractualVolumes,
    machineStatusFilter,
    dimensionFilters,
    settingsProfile,
    callOffVolumes,
    { includeAssignedZeroVolumeDetailsInBreakdown: true }
  );
}
