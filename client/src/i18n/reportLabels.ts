import { translate } from './core';
import type { Locale } from './types';
import type { TrendTableBuildOptions } from '../utils/capacityTrends';

const tr = (locale: Locale, key: string, params?: Record<string, string | number>) =>
  translate(locale, key, params);

export function localeDateTime(locale: Locale, date = new Date()): string {
  const tag = locale === 'pl' ? 'pl-PL' : locale === 'de' ? 'de-DE' : 'en-GB';
  return date.toLocaleString(tag);
}

/** Nagłówki kolumn tabel trendów / analityki (PDF i eksport). */
export function pdfTrendHeaders(locale: Locale, opts: TrendTableBuildOptions): string[] {
  const headers = [tr(locale, 'reports.trend.year')];
  if (opts.showProduction) headers.push(tr(locale, 'reports.trend.production'));
  if (opts.showContract) headers.push(tr(locale, 'reports.trend.contract'));
  if (opts.showProduction && opts.showContract) headers.push(tr(locale, 'reports.trend.deltaContractProd'));
  if (opts.hasScenario && opts.showScenarioProduction) headers.push(tr(locale, 'reports.trend.scenarioProd'));
  if (opts.hasScenario && opts.showScenarioProduction && opts.showProduction) {
    headers.push(tr(locale, 'reports.trend.deltaScenarioProd'));
  }
  if (opts.hasScenario && opts.showScenarioContract) headers.push(tr(locale, 'reports.trend.scenarioContract'));
  if (opts.hasScenario && opts.showScenarioContract && opts.showContract) {
    headers.push(tr(locale, 'reports.trend.deltaScenarioContract'));
  }
  return headers;
}

export function pdfAnalyticsHeaders(locale: Locale, hasScenario: boolean, hasCallOff = false): string[] {
  const headers = [
    tr(locale, 'reports.trend.year'),
    tr(locale, 'reports.trend.production'),
    tr(locale, 'reports.trend.contract'),
    tr(locale, 'reports.trend.deltaContractMinusProd'),
  ];
  if (hasScenario) {
    headers.push(tr(locale, 'reports.trend.scenarioProd'));
    headers.push(tr(locale, 'reports.trend.deltaScenarioMinusProd'));
  }
  if (hasCallOff) {
    headers.push(tr(locale, 'reports.trend.callOff'));
    headers.push(tr(locale, 'reports.trend.deltaCallOffMinusProd'));
  }
  return headers;
}

export type LinesOverviewLabels = {
  line: string;
  year: string;
  prod: string;
  contract: string;
  diffPp: string;
  scen: string;
  title: string;
};

export function linesOverviewLabels(locale: Locale, _opts: {
  showProduction: boolean;
  showContract: boolean;
  showScenarioProduction: boolean;
}): LinesOverviewLabels {
  return {
    line: tr(locale, 'reports.trend.line'),
    year: tr(locale, 'reports.trend.year'),
    prod: tr(locale, 'reports.trend.prodShort'),
    contract: tr(locale, 'reports.trend.contractShort'),
    diffPp: tr(locale, 'reports.trend.diffPpShort'),
    scen: tr(locale, 'reports.trend.scenShort'),
    title: tr(locale, 'reports.dataViz.linesOverviewTitle'),
  };
}

export type DataVizPdfStrings = {
  docTitle: string;
  reportDate: string;
  yearRange: string;
  machineStatus: string;
  machineType: string;
  client: string;
  scenario: string;
  seriesOnCharts: string;
  noScenario: string;
  partLinesTables: string;
  partMachinesTables: string;
  partLinesOverview: string;
  partAnalytics: string;
  objectLabel: string;
  avgProduction: string;
  avgContract: string;
  avgScenarioProd: string;
  chartLines: string;
  chartMachines: string;
  lineTitle: string;
  machineTitle: string;
  machineTitleWithLine: string;
  analyticsLine: string;
  analyticsMachine: string;
  analyticsMachineFallback: string;
  wholeFilter: string;
  wholeAllMachines: string;
  filterType: string;
  filterClient: string;
  continued: string;
};

export function getDataVizPdfStrings(locale: Locale, profile: 'capacity' | 'ocu' = 'capacity'): DataVizPdfStrings {
  const subsystem = tr(locale, profile === 'ocu' ? 'dataViz.subsystemOcu' : 'dataViz.subsystemCapacity');
  return {
    docTitle: tr(locale, 'reports.dataViz.docTitle', { subsystem }),
    reportDate: tr(locale, 'reports.dataViz.reportDate'),
    yearRange: tr(locale, 'reports.dataViz.yearRange'),
    machineStatus: tr(locale, 'reports.dataViz.machineStatus'),
    machineType: tr(locale, 'reports.dataViz.machineType'),
    client: tr(locale, 'reports.dataViz.client'),
    scenario: tr(locale, 'reports.dataViz.scenario'),
    seriesOnCharts: tr(locale, 'reports.dataViz.seriesOnCharts'),
    noScenario: tr(locale, 'dataViz.noScenario'),
    partLinesTables: tr(locale, 'reports.dataViz.partLinesTables'),
    partMachinesTables: tr(locale, 'reports.dataViz.partMachinesTables'),
    partLinesOverview: tr(locale, 'reports.dataViz.partLinesOverview'),
    partAnalytics: tr(locale, 'reports.dataViz.partAnalytics'),
    objectLabel: tr(locale, 'reports.dataViz.objectLabel'),
    avgProduction: tr(locale, 'reports.dataViz.avgProduction'),
    avgContract: tr(locale, 'reports.dataViz.avgContract'),
    avgScenarioProd: tr(locale, 'reports.dataViz.avgScenarioProd'),
    chartLines: tr(locale, 'modals.vizReport.lineCharts'),
    chartMachines: tr(locale, 'modals.vizReport.machineCharts'),
    lineTitle: tr(locale, 'reports.dataViz.lineTitle'),
    machineTitle: tr(locale, 'reports.dataViz.machineTitle'),
    machineTitleWithLine: tr(locale, 'reports.dataViz.machineTitleWithLine'),
    analyticsLine: tr(locale, 'reports.dataViz.analyticsLine'),
    analyticsMachine: tr(locale, 'reports.dataViz.analyticsMachine'),
    analyticsMachineFallback: tr(locale, 'reports.dataViz.analyticsMachineFallback'),
    wholeFilter: tr(locale, 'dataViz.wholeFilter'),
    wholeAllMachines: tr(locale, 'dataViz.wholeAllMachines'),
    filterType: tr(locale, 'reports.dataViz.filterType'),
    filterClient: tr(locale, 'reports.dataViz.filterClient'),
    continued: tr(locale, 'reports.dataViz.continued'),
  };
}
