import { formatMachineSapInternalLabel, type MachineDisplayMode } from './machineLabel';
import { maxTypeAverageLoad } from './maxTypeAverageLoad';

export type YearCapacityPoint = {
  load_percent: number;
  required_sec_per_week?: number;
  availability_sec_per_week?: number;
};

export type CapacityMachineTrend = {
  machine_id: number;
  internal_number: number;
  sap_number: string | null;
  type: string;
  location?: string | null;
  years: Record<number, YearCapacityPoint>;
};

export type CapacityTrendBundle = {
  yearFrom: number;
  yearTo: number;
  /** Lata z rzeczywistym wolumenem (np. Call offs z pliku SAP) — poza nimi serie = null. */
  dataYears?: number[];
  machines: CapacityMachineTrend[];
};

export function calendarYear(): number {
  return new Date().getFullYear();
}

export function yearsRange(yearFrom: number, yearTo: number): number[] {
  const a = Math.min(yearFrom, yearTo);
  const b = Math.max(yearFrom, yearTo);
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

export function lineKey(location: string | null | undefined): string {
  const t = String(location ?? '').trim();
  return t || '—';
}

export function uniqueLines(machines: CapacityMachineTrend[]): string[] {
  const set = new Set(machines.map((m) => lineKey(m.location)));
  return Array.from(set).sort((a, b) => {
    if (a === '—') return 1;
    if (b === '—') return -1;
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b, 'pl');
  });
}

/**
 * Agregacja wielu maszyn: max ze średnich obciążenia w ramach typu
 * (ta sama logika co trzeci wiersz podsumowania w Kalkulatorze).
 */
function aggregateLoadPercent(
  machines: CapacityMachineTrend[],
  year: number,
  include: (m: CapacityMachineTrend) => boolean
): number | null {
  const subset = machines.filter(include);
  const avg = maxTypeAverageLoad(subset, (m) => Number(m.years[year]?.load_percent ?? 0));
  return avg == null ? null : Math.round(avg);
}

/** Obciążenie linii = max średniej wg typu wśród maszyn na linii. */
export function lineLoadPercent(machines: CapacityMachineTrend[], line: string, year: number): number | null {
  return aggregateLoadPercent(machines, year, (m) => lineKey(m.location) === line);
}

/** Obciążenie wielu linii = max średniej wg typu wśród maszyn z wybranych linii. */
export function linesLoadPercent(machines: CapacityMachineTrend[], lines: string[], year: number): number | null {
  if (!lines.length) return null;
  const lineSet = new Set(lines);
  return aggregateLoadPercent(machines, year, (m) => lineSet.has(lineKey(m.location)));
}

/** Obciążenie wielu maszyn = max średniej wg typu wśród wybranych maszyn. */
export function machinesLoadPercent(machines: CapacityMachineTrend[], machineIds: number[], year: number): number | null {
  if (!machineIds.length) return null;
  const idSet = new Set(machineIds);
  return aggregateLoadPercent(machines, year, (m) => idSet.has(m.machine_id));
}

/** Obciążenie wybranych maszyn na danej linii = max średniej wg typu. */
export function selectedMachinesOnLineLoadPercent(
  machines: CapacityMachineTrend[],
  machineIds: number[] | Set<number>,
  line: string,
  year: number
): number | null {
  const idSet = machineIds instanceof Set ? machineIds : new Set(machineIds);
  if (!idSet.size) return null;
  return aggregateLoadPercent(
    machines,
    year,
    (m) => idSet.has(m.machine_id) && lineKey(m.location) === line
  );
}

export function machineLoadPercent(m: CapacityMachineTrend, year: number): number | null {
  const y = m.years[year];
  if (!y) return null;
  return y.load_percent ?? null;
}

export type TrendChartRow = { year: number; [seriesKey: string]: number | null };

export type TrendSeriesDef = {
  key: string;
  label: string;
  color: string;
  dash?: string;
  getValue: (year: number) => number | null;
};

export function buildTrendRows(years: number[], series: TrendSeriesDef[]): TrendChartRow[] {
  return years.map((year) => {
    const row: TrendChartRow = { year };
    for (const s of series) row[s.key] = s.getValue(year);
    return row;
  });
}

export function machineLabel(m: CapacityMachineTrend): string {
  const sap = m.sap_number?.trim();
  const nr = m.internal_number ?? m.machine_id;
  return sap ? `${nr} · ${sap}` : String(nr);
}

/** Wspólny wiersz dual-bar (produkcja / kontrakt [/ Call offs / scenariusze…]) — maszyna lub linia na osi X. */
export type DualLoadBarRow = {
  key: string;
  /** Pełna etykieta (tooltip). */
  label: string;
  /** Krótka etykieta osi X (nr maszyny albo nr linii). */
  shortLabel: string;
  production: number | null;
  contract: number | null;
  /** Pojedynczy Call offs (kompatybilność wsteczna). */
  callOff?: number | null;
  /** Dodatkowe serie (Call offs, scenariusze): dataKey → wartość %. */
  seriesValues?: Record<string, number | null>;
  machineCount?: number;
};

/** Źródło dodatkowej serii na wykresie słupkowym (Call offs / scenariusz). */
export type BarSeriesSource = {
  key: string;
  machines: CapacityMachineTrend[];
  dataYears?: number[] | null;
};

/** @deprecated Użyj BarSeriesSource */
export type CallOffBarSource = BarSeriesSource;

function barSeriesValuesForYear(
  sources: BarSeriesSource[],
  year: number,
  getLoad: (machines: CapacityMachineTrend[]) => number | null
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const src of sources) {
    const yearOk = !src.dataYears?.length || src.dataYears.includes(year);
    out[src.key] = yearOk && src.machines.length ? getLoad(src.machines) : null;
  }
  return out;
}

/**
 * Mapuje odpowiedź kalkulatora Call offs na bundle trendów:
 * load_percent = jak produkcja (req/avail), tylko miesiące z danymi SAP (call_off_annual_*),
 * required_sec / availability do agregacji linii.
 * Punkty tylko w latach z wolumenem w pliku (`volumeYears`) — poza nimi null.
 */
export function callOffCalculatorToTrendBundle(res: {
  yearFrom: number;
  yearTo: number;
  date_from?: string;
  date_to?: string;
  volumeYears?: number[];
  machines: Array<{
    machine_id: number;
    internal_number: string | number;
    sap_number: string | null;
    type: string;
    location?: string | null;
    years: Record<
      number,
      {
        call_off_load_percent?: number;
        call_off_annual_load_percent?: number;
        call_off_annual_required_sec_per_week?: number;
        call_off_annual_availability_sec_per_week?: number;
        availability_sec_per_week?: number;
        required_sec_per_week?: number;
        call_off_detail_breakdown?: unknown[];
      }
    >;
  }>;
}): CapacityTrendBundle {
  const volumeYearSet = new Set(
    (res.volumeYears ?? [])
      .map((y) => Number(y))
      .filter((y) => Number.isFinite(y) && y >= 2000 && y <= 2100)
  );

  // Fallback: jeśli API nie podało volumeYears, wywnioskuj z lat z dodatnim obciążeniem SAP (roczne lub peak).
  if (volumeYearSet.size === 0) {
    for (const m of res.machines ?? []) {
      for (const [yearKey, yd] of Object.entries(m.years ?? {})) {
        const year = Number(yearKey);
        const annual = Number(yd.call_off_annual_load_percent ?? 0);
        const peak = Number(yd.call_off_load_percent ?? 0);
        const pct = annual > 0 ? annual : peak;
        if (Number.isFinite(year) && Number.isFinite(pct) && pct > 0) volumeYearSet.add(year);
      }
    }
  }

  // Ostateczny fallback: zakres dat porównania (nie zakres filtrów wizualizacji).
  if (volumeYearSet.size === 0 && res.date_from && res.date_to) {
    const a = new Date(res.date_from).getFullYear();
    const b = new Date(res.date_to).getFullYear();
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let y = lo; y <= hi; y++) volumeYearSet.add(y);
    }
  }

  const dataYears = Array.from(volumeYearSet).sort((a, b) => a - b);

  return {
    yearFrom: res.yearFrom,
    yearTo: res.yearTo,
    dataYears,
    machines: res.machines.map((m) => {
      const years: CapacityMachineTrend['years'] = {};
      for (const [yearKey, yd] of Object.entries(m.years ?? {})) {
        const year = Number(yearKey);
        if (!Number.isFinite(year) || !volumeYearSet.has(year)) continue;

        const annualRaw = yd.call_off_annual_load_percent;
        const hasAnnual = annualRaw != null && Number.isFinite(Number(annualRaw));
        const callOffPct = hasAnnual ? Number(annualRaw) : Number(yd.call_off_load_percent ?? 0);
        if (!Number.isFinite(callOffPct) || callOffPct <= 0) continue;

        const availAnnual = Number(yd.call_off_annual_availability_sec_per_week ?? 0);
        const reqAnnual = Number(yd.call_off_annual_required_sec_per_week ?? 0);
        const availFallback = Number(yd.availability_sec_per_week ?? 0);
        const avail = availAnnual > 0 ? availAnnual : availFallback;
        const req =
          reqAnnual > 0
            ? reqAnnual
            : avail > 0
              ? Math.round((callOffPct / 100) * avail)
              : 0;
        years[year] = {
          load_percent: callOffPct,
          availability_sec_per_week: avail,
          required_sec_per_week: req,
        };
      }
      return {
        machine_id: m.machine_id,
        internal_number: m.internal_number as number,
        sap_number: m.sap_number,
        type: m.type,
        location: m.location,
        years,
      };
    }),
  };
}

/** Obciążenie Call offs — null poza latami z wolumenem w pliku (ważne przy agregacji linii). */
export function callOffLoadPercent(
  bundle: CapacityTrendBundle | null | undefined,
  year: number,
  scope: { kind: 'machine'; machine: CapacityMachineTrend } | { kind: 'line'; line: string } | { kind: 'lines'; lines: string[] } | { kind: 'machines'; machineIds: number[] } | { kind: 'plant' }
): number | null {
  if (!bundle?.machines?.length) return null;
  if (bundle.dataYears?.length && !bundle.dataYears.includes(year)) return null;
  switch (scope.kind) {
    case 'machine':
      return machineLoadPercent(scope.machine, year);
    case 'line':
      return lineLoadPercent(bundle.machines, scope.line, year);
    case 'lines':
      return linesLoadPercent(bundle.machines, scope.lines, year);
    case 'machines':
      return machinesLoadPercent(bundle.machines, scope.machineIds, year);
    case 'plant':
      return aggregateLoadPercent(bundle.machines, year, () => true);
    default:
      return null;
  }
}

/** Słupki: jedna pozycja na zaznaczoną maszynę. */
export function buildMachineBarRows(
  machinesProd: CapacityMachineTrend[],
  machinesContract: CapacityMachineTrend[],
  selectedMachineIds: number[] | Set<number>,
  year: number,
  labelMode: MachineDisplayMode = 'internal',
  extraSources?: BarSeriesSource[] | null
): DualLoadBarRow[] {
  const idSet = selectedMachineIds instanceof Set ? selectedMachineIds : new Set(selectedMachineIds);
  const contractById = new Map(machinesContract.map((m) => [m.machine_id, m]));
  const sources = extraSources ?? [];
  return machinesProd
    .filter((m) => idSet.has(m.machine_id))
    .slice()
    .sort((a, b) => {
      const na = Number(a.internal_number);
      const nb = Number(b.internal_number);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return String(a.internal_number).localeCompare(String(b.internal_number), 'pl');
    })
    .map((m) => {
      const c = contractById.get(m.machine_id);
      const axisLabel = formatMachineSapInternalLabel(m, labelMode);
      const seriesValues = barSeriesValuesForYear(sources, year, (machines) => {
        const co = machines.find((x) => x.machine_id === m.machine_id);
        return co ? machineLoadPercent(co, year) : null;
      });
      const firstCallOffKey = sources.find((s) => s.key.startsWith('callOff_'))?.key;
      return {
        key: String(m.machine_id),
        label: axisLabel,
        shortLabel: axisLabel,
        production: machineLoadPercent(m, year),
        contract: c ? machineLoadPercent(c, year) : null,
        callOff: firstCallOffKey != null ? seriesValues[firstCallOffKey] ?? null : null,
        seriesValues: sources.length > 0 ? seriesValues : undefined,
      };
    });
}

/** Słupki: jedna pozycja na zaznaczoną linię (agregacja maszyn na linii). */
export function buildLineBarRows(
  machinesProd: CapacityMachineTrend[],
  machinesContract: CapacityMachineTrend[],
  selectedLines: string[] | Set<string>,
  year: number,
  extraSources?: BarSeriesSource[] | null
): DualLoadBarRow[] {
  const lineSet = selectedLines instanceof Set ? selectedLines : new Set(selectedLines);
  const lines = uniqueLines(machinesProd).filter((line) => lineSet.has(line));
  const sources = extraSources ?? [];
  return lines.map((line) => {
    const machineCount = machinesProd.filter((m) => lineKey(m.location) === line).length;
    const seriesValues = barSeriesValuesForYear(sources, year, (machines) =>
      lineLoadPercent(machines, line, year)
    );
    const firstCallOffKey = sources.find((s) => s.key.startsWith('callOff_'))?.key;
    return {
      key: line,
      label: line,
      shortLabel: line,
      production: lineLoadPercent(machinesProd, line, year),
      contract: lineLoadPercent(machinesContract, line, year),
      callOff: firstCallOffKey != null ? seriesValues[firstCallOffKey] ?? null : null,
      seriesValues: sources.length > 0 ? seriesValues : undefined,
      machineCount,
    };
  });
}

export type AnalyticsRow = {
  year: number;
  production: number | null;
  contract: number | null;
  deltaContractMinusProd: number | null;
  scenarioProduction: number | null;
  scenarioContract: number | null;
  deltaScenarioProdMinusProd: number | null;
  callOff: number | null;
  deltaCallOffMinusProd: number | null;
};

export function buildAnalyticsRow(
  year: number,
  getProduction: (year: number) => number | null,
  getContract: (year: number) => number | null,
  getScenarioProduction?: (year: number) => number | null,
  getScenarioContract?: (year: number) => number | null,
  getCallOff?: (year: number) => number | null
): AnalyticsRow {
  const production = getProduction(year);
  const contract = getContract(year);
  const scenarioProduction = getScenarioProduction?.(year) ?? null;
  const scenarioContract = getScenarioContract?.(year) ?? null;
  const callOff = getCallOff?.(year) ?? null;
  const deltaContractMinusProd =
    production != null && contract != null ? Math.round((production - contract) * 10) / 10 : null;
  const deltaScenarioProdMinusProd =
    production != null && scenarioProduction != null ? Math.round((scenarioProduction - production) * 10) / 10 : null;
  const deltaCallOffMinusProd =
    production != null && callOff != null ? Math.round((callOff - production) * 10) / 10 : null;
  return {
    year,
    production,
    contract,
    deltaContractMinusProd,
    scenarioProduction,
    scenarioContract,
    deltaScenarioProdMinusProd,
    callOff,
    deltaCallOffMinusProd,
  };
}

export function buildAnalyticsRows(
  years: number[],
  getProduction: (year: number) => number | null,
  getContract: (year: number) => number | null,
  getScenarioProduction?: (year: number) => number | null,
  getScenarioContract?: (year: number) => number | null,
  getCallOff?: (year: number) => number | null
): AnalyticsRow[] {
  return years.map((year) =>
    buildAnalyticsRow(year, getProduction, getContract, getScenarioProduction, getScenarioContract, getCallOff)
  );
}

/** Średnia obciążenia na wybranych latach (pomija null; opcjonalnie zera). */
export function averageLoad(
  values: (number | null)[],
  opts?: { skipZeros?: boolean }
): number | null {
  const nums = values.filter((v): v is number => {
    if (v == null || !Number.isFinite(v)) return false;
    if (opts?.skipZeros && v === 0) return false;
    return true;
  });
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

/** Różnica w punktach procentowych (b − a). */
export function deltaPp(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Math.round((b - a) * 10) / 10;
}

export function fmtDeltaPp(v: number | null): string {
  if (v == null) return '-';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v} p.p.`;
}

export function fmtPctCell(v: number | null): string {
  return v != null ? `${v}%` : '-';
}

export type TrendTableBuildOptions = {
  showProduction: boolean;
  showContract: boolean;
  hasScenario: boolean;
  showScenarioProduction: boolean;
  showScenarioContract: boolean;
};

/** Wiersze tabeli trendu z kolumnami różnic (Δ) między parami serii. */
export function buildTrendTableWithDeltas(
  years: number[],
  getProduction: (year: number) => number | null,
  getContract: (year: number) => number | null,
  getScenarioProduction: ((year: number) => number | null) | undefined,
  getScenarioContract: ((year: number) => number | null) | undefined,
  opts: TrendTableBuildOptions,
  headers: string[]
): { headers: string[]; rows: string[][] } {

  const rows = years.map((year) => {
    const production = getProduction(year);
    const contract = getContract(year);
    const scenarioProduction = getScenarioProduction?.(year) ?? null;
    const scenarioContract = getScenarioContract?.(year) ?? null;
    const cells: string[] = [String(year)];
    if (opts.showProduction) cells.push(fmtPctCell(production));
    if (opts.showContract) cells.push(fmtPctCell(contract));
    if (opts.showProduction && opts.showContract) cells.push(fmtDeltaPp(deltaPp(contract, production)));
    if (opts.hasScenario && opts.showScenarioProduction) cells.push(fmtPctCell(scenarioProduction));
    if (opts.hasScenario && opts.showScenarioProduction && opts.showProduction) {
      cells.push(fmtDeltaPp(deltaPp(production, scenarioProduction)));
    }
    if (opts.hasScenario && opts.showScenarioContract) cells.push(fmtPctCell(scenarioContract));
    if (opts.hasScenario && opts.showScenarioContract && opts.showContract) {
      cells.push(fmtDeltaPp(deltaPp(contract, scenarioContract)));
    }
    return cells;
  });

  return { headers, rows };
}

/** Paleta kolorów dla wielu serii na jednym wykresie porównawczym (domyślnie Autoneum). */
export { AUTONEUM_COMPARE_PALETTE as COMPARE_CHART_PALETTE } from './dataVizColors';
