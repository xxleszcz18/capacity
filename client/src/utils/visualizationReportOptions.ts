export type ReportScope = 'selected' | 'all';

export type LineChartsMode = 'separate' | 'combined';

export type MachineChartsMode = 'separate' | 'combined';

export type ReportGenerationMode = 'currentView' | 'advanced' | 'excelData';

export type BreakdownDetailLevel = 'year' | 'client' | 'project' | 'detail';

export type ChartGridCols = 1 | 2 | 3;

export type VisualizationReportOptions = {
  mode: ReportGenerationMode;
  lineTables: boolean;
  lineTablesScope: ReportScope;
  machineTables: boolean;
  machineTablesScope: ReportScope;
  linesOverview: boolean;
  analyticsTable: boolean;
  lineCharts: boolean;
  lineChartsMode: LineChartsMode;
  lineChartsScope: ReportScope;
  machineCharts: boolean;
  machineChartsMode: MachineChartsMode;
  machineChartsScope: ReportScope;
  analyticsChart: boolean;
  /** Układ wykresów (osobne) w raporcie zaawansowanym. */
  chartGridCols: ChartGridCols;
  /** Szczegółowość rozbicia w tabelach danych (raport zaawansowany). */
  breakdownDetailLevel: BreakdownDetailLevel;
  /** Podsumowanie analityki (średnie obciążenia). */
  analyticsSummary: boolean;
};

export const DEFAULT_VISUALIZATION_REPORT_OPTIONS: VisualizationReportOptions = {
  mode: 'currentView',
  lineTables: true,
  lineTablesScope: 'selected',
  machineTables: true,
  machineTablesScope: 'selected',
  linesOverview: true,
  analyticsTable: true,
  lineCharts: true,
  lineChartsMode: 'combined',
  lineChartsScope: 'selected',
  machineCharts: true,
  machineChartsMode: 'combined',
  machineChartsScope: 'selected',
  analyticsChart: true,
  chartGridCols: 1,
  breakdownDetailLevel: 'year',
  analyticsSummary: true,
};

export type CurrentViewContext = {
  tab: 'lines' | 'machines' | 'analytics';
  lineChartCombined: boolean;
  machineChartCombined: boolean;
  chartGridCols: ChartGridCols;
  selectedLineCount: number;
  selectedMachineCount: number;
};

export function buildCurrentViewReportOptions(ctx: CurrentViewContext): VisualizationReportOptions {
  const empty: VisualizationReportOptions = {
    mode: 'currentView',
    lineTables: false,
    lineTablesScope: 'selected',
    machineTables: false,
    machineTablesScope: 'selected',
    linesOverview: false,
    analyticsTable: false,
    lineCharts: false,
    lineChartsMode: 'separate',
    lineChartsScope: 'selected',
    machineCharts: false,
    machineChartsMode: 'separate',
    machineChartsScope: 'selected',
    analyticsChart: false,
    chartGridCols: ctx.chartGridCols,
    breakdownDetailLevel: 'detail',
    analyticsSummary: true,
  };

  if (ctx.tab === 'lines' && ctx.selectedLineCount > 0) {
    return {
      ...empty,
      lineCharts: true,
      lineChartsScope: 'selected',
      lineChartsMode: ctx.lineChartCombined ? 'combined' : 'separate',
      lineTables: true,
      lineTablesScope: 'selected',
    };
  }

  if (ctx.tab === 'machines' && ctx.selectedMachineCount > 0) {
    return {
      ...empty,
      machineCharts: true,
      machineChartsScope: 'selected',
      machineChartsMode: ctx.machineChartCombined ? 'combined' : 'separate',
      machineTables: true,
      machineTablesScope: 'selected',
    };
  }

  if (ctx.tab === 'analytics') {
    return {
      ...empty,
      analyticsTable: true,
      analyticsChart: true,
      analyticsSummary: true,
    };
  }

  return empty;
}

export function buildCurrentViewExcelOptions(ctx: CurrentViewContext): VisualizationReportOptions {
  const base: VisualizationReportOptions = {
    mode: 'excelData',
    lineTables: false,
    lineTablesScope: 'selected',
    machineTables: false,
    machineTablesScope: 'selected',
    linesOverview: false,
    analyticsTable: false,
    lineCharts: false,
    lineChartsMode: 'separate',
    lineChartsScope: 'selected',
    machineCharts: false,
    machineChartsMode: 'separate',
    machineChartsScope: 'selected',
    analyticsChart: false,
    chartGridCols: ctx.chartGridCols,
    breakdownDetailLevel: 'detail',
    analyticsSummary: true,
  };

  if (ctx.tab === 'lines' && ctx.selectedLineCount > 0) {
    return { ...base, lineTables: true, lineTablesScope: 'selected' };
  }
  if (ctx.tab === 'machines' && ctx.selectedMachineCount > 0) {
    return { ...base, machineTables: true, machineTablesScope: 'selected' };
  }
  if (ctx.tab === 'analytics') {
    return { ...base, analyticsTable: true };
  }
  return base;
}

export function countExcelDataSections(opts: VisualizationReportOptions): number {
  let n = 0;
  if (opts.lineTables) n++;
  if (opts.machineTables) n++;
  if (opts.linesOverview) n++;
  if (opts.analyticsTable) n++;
  return n;
}

export function countReportSections(opts: VisualizationReportOptions): number {
  if (opts.mode === 'currentView') return 1;
  if (opts.mode === 'excelData') return countExcelDataSections(opts);
  let n = 0;
  if (opts.lineTables) n++;
  if (opts.machineTables) n++;
  if (opts.linesOverview) n++;
  if (opts.analyticsTable) n++;
  if (opts.analyticsSummary && opts.analyticsTable) n++;
  if (opts.lineCharts) n++;
  if (opts.machineCharts) n++;
  if (opts.analyticsChart) n++;
  return n;
}

export function canGenerateReport(opts: VisualizationReportOptions, ctx: CurrentViewContext): boolean {
  if (opts.mode === 'currentView') {
    if (ctx.tab === 'lines') return ctx.selectedLineCount > 0;
    if (ctx.tab === 'machines') return ctx.selectedMachineCount > 0;
    return true;
  }
  if (opts.mode === 'excelData') return countExcelDataSections(opts) > 0;
  return countReportSections(opts) > 0;
}
