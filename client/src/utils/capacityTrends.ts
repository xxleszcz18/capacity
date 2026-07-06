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

function aggregateLoadPercent(
  machines: CapacityMachineTrend[],
  year: number,
  include: (m: CapacityMachineTrend) => boolean
): number | null {
  let req = 0;
  let avail = 0;
  for (const m of machines) {
    if (!include(m)) continue;
    const y = m.years[year];
    if (!y) continue;
    req += y.required_sec_per_week ?? 0;
    avail += y.availability_sec_per_week ?? 0;
  }
  if (avail <= 0) return req > 0 ? 100 : null;
  return Math.round((req / avail) * 100);
}

/** Obciążenie linii = suma wymaganego czasu / suma dostępności maszyn na linii. */
export function lineLoadPercent(machines: CapacityMachineTrend[], line: string, year: number): number | null {
  return aggregateLoadPercent(machines, year, (m) => lineKey(m.location) === line);
}

/** Obciążenie wielu linii (agregacja maszyn z wybranych linii). */
export function linesLoadPercent(machines: CapacityMachineTrend[], lines: string[], year: number): number | null {
  if (!lines.length) return null;
  const lineSet = new Set(lines);
  return aggregateLoadPercent(machines, year, (m) => lineSet.has(lineKey(m.location)));
}

/** Obciążenie wielu maszyn (agregacja wybranych maszyn). */
export function machinesLoadPercent(machines: CapacityMachineTrend[], machineIds: number[], year: number): number | null {
  if (!machineIds.length) return null;
  const idSet = new Set(machineIds);
  return aggregateLoadPercent(machines, year, (m) => idSet.has(m.machine_id));
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

export type AnalyticsRow = {
  year: number;
  production: number | null;
  contract: number | null;
  deltaContractMinusProd: number | null;
  scenarioProduction: number | null;
  scenarioContract: number | null;
  deltaScenarioProdMinusProd: number | null;
};

export function buildAnalyticsRow(
  year: number,
  getProduction: (year: number) => number | null,
  getContract: (year: number) => number | null,
  getScenarioProduction?: (year: number) => number | null,
  getScenarioContract?: (year: number) => number | null
): AnalyticsRow {
  const production = getProduction(year);
  const contract = getContract(year);
  const scenarioProduction = getScenarioProduction?.(year) ?? null;
  const scenarioContract = getScenarioContract?.(year) ?? null;
  const deltaContractMinusProd =
    production != null && contract != null ? Math.round((production - contract) * 10) / 10 : null;
  const deltaScenarioProdMinusProd =
    production != null && scenarioProduction != null ? Math.round((scenarioProduction - production) * 10) / 10 : null;
  return {
    year,
    production,
    contract,
    deltaContractMinusProd,
    scenarioProduction,
    scenarioContract,
    deltaScenarioProdMinusProd,
  };
}

export function buildAnalyticsRows(
  years: number[],
  getProduction: (year: number) => number | null,
  getContract: (year: number) => number | null,
  getScenarioProduction?: (year: number) => number | null,
  getScenarioContract?: (year: number) => number | null
): AnalyticsRow[] {
  return years.map((year) =>
    buildAnalyticsRow(year, getProduction, getContract, getScenarioProduction, getScenarioContract)
  );
}

/** Średnia obciążenia na wybranych latach (pomija null). */
export function averageLoad(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
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
