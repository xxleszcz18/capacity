import type { AnalyticsRow, CapacityMachineTrend } from './capacityTrends';
import {
  buildAnalyticsRow,
  lineKey,
  lineLoadPercent,
  machineLabel,
  machineLoadPercent,
} from './capacityTrends';
import { excelExportCell } from './excelExportCell';
import type { BreakdownDetailLevel } from './visualizationReportOptions';
import { pdfAnalyticsHeaders } from '../i18n/reportLabels';
import type { Locale } from '../i18n/types';

export type AnalyticsTableDataContext = {
  scope: 'plant' | 'line' | 'machine';
  analyticsLines: string[];
  analyticsMachineIds: number[];
  lines: string[];
  machinesProd: CapacityMachineTrend[];
  contractMachines: CapacityMachineTrend[];
  scenProdMachines?: CapacityMachineTrend[];
  scenContractMachines?: CapacityMachineTrend[];
};

export type AnalyticsExcelLabels = {
  year: string;
  line: string;
  machine: string;
  formatLine: (line: string) => string;
};

export type AnalyticsExcelDepth = 'year' | 'line' | 'machine';

/** Map poziomu szczegółowości eksportu na hierarchię analityki (rok → linia → maszyna). */
export function analyticsExcelDepth(
  detailLevel: BreakdownDetailLevel,
  scope: AnalyticsTableDataContext['scope']
): AnalyticsExcelDepth {
  if (scope === 'machine') return 'year';
  if (detailLevel === 'year') return 'year';
  if (detailLevel === 'client') return scope === 'plant' ? 'line' : 'machine';
  return 'machine';
}

export function machinesOnLine(line: string, machinesProd: CapacityMachineTrend[]): CapacityMachineTrend[] {
  return [...machinesProd.filter((m) => lineKey(m.location) === line)].sort((a, b) =>
    machineLabel(a).localeCompare(machineLabel(b), 'pl')
  );
}

export function analyticsRowForLine(year: number, line: string, ctx: AnalyticsTableDataContext): AnalyticsRow {
  return buildAnalyticsRow(
    year,
    (y) => lineLoadPercent(ctx.machinesProd, line, y),
    (y) => lineLoadPercent(ctx.contractMachines, line, y),
    ctx.scenProdMachines ? (y) => lineLoadPercent(ctx.scenProdMachines!, line, y) : undefined,
    ctx.scenContractMachines ? (y) => lineLoadPercent(ctx.scenContractMachines!, line, y) : undefined
  );
}

export function analyticsRowForMachine(year: number, m: CapacityMachineTrend, ctx: AnalyticsTableDataContext): AnalyticsRow {
  const cm = ctx.contractMachines.find((x) => x.machine_id === m.machine_id);
  const sm = ctx.scenProdMachines?.find((x) => x.machine_id === m.machine_id);
  const scm = ctx.scenContractMachines?.find((x) => x.machine_id === m.machine_id);
  return buildAnalyticsRow(
    year,
    (y) => machineLoadPercent(m, y),
    (y) => (cm ? machineLoadPercent(cm, y) : null),
    sm ? (y) => machineLoadPercent(sm, y) : undefined,
    scm ? (y) => machineLoadPercent(scm, y) : undefined
  );
}

function analyticsRowToCells(row: AnalyticsRow, hasScenario: boolean): (string | number | null)[] {
  const cells: (string | number | null)[] = [
    excelExportCell(row.production),
    excelExportCell(row.contract),
    excelExportCell(row.deltaContractMinusProd),
  ];
  if (hasScenario) {
    cells.push(excelExportCell(row.scenarioProduction), excelExportCell(row.deltaScenarioProdMinusProd));
  }
  return cells;
}

function analyticsExcelHeaders(
  locale: Locale,
  hasScenario: boolean,
  depth: AnalyticsExcelDepth,
  scope: AnalyticsTableDataContext['scope'],
  colLabels: AnalyticsExcelLabels
): string[] {
  if (depth === 'year') return pdfAnalyticsHeaders(locale, hasScenario);

  const valueHeaders = pdfAnalyticsHeaders(locale, hasScenario).slice(1);
  const prefix: string[] = [colLabels.year];
  if (depth === 'line' || (depth === 'machine' && scope === 'plant')) prefix.push(colLabels.line);
  if (depth === 'machine') prefix.push(colLabels.machine);
  return [...prefix, ...valueHeaders];
}

function linesForContext(ctx: AnalyticsTableDataContext): string[] {
  if (ctx.scope === 'line') return ctx.analyticsLines.length ? ctx.analyticsLines : [];
  return ctx.lines;
}

export function buildAnalyticsExcelSection(input: {
  locale: Locale;
  yearRows: AnalyticsRow[];
  hasScenario: boolean;
  detailLevel: BreakdownDetailLevel;
  context: AnalyticsTableDataContext;
  colLabels: AnalyticsExcelLabels;
}): { headers: string[]; rows: (string | number | null)[][] } {
  const depth = analyticsExcelDepth(input.detailLevel, input.context.scope);
  const headers = analyticsExcelHeaders(input.locale, input.hasScenario, depth, input.context.scope, input.colLabels);
  const out: (string | number | null)[][] = [];
  const ctx = input.context;
  const formatLine = input.colLabels.formatLine;

  for (const yearRow of input.yearRows) {
    const year = yearRow.year;
    out.push([...hierarchyPrefix(depth, ctx.scope, year, '', ''), ...analyticsRowToCells(yearRow, input.hasScenario)]);

    if (depth === 'year') continue;

    for (const line of linesForContext(ctx)) {
      const lineRow = analyticsRowForLine(year, line, ctx);

      if (depth === 'line' && ctx.scope === 'plant') {
        out.push([...hierarchyPrefix(depth, ctx.scope, year, formatLine(line), ''), ...analyticsRowToCells(lineRow, input.hasScenario)]);
        continue;
      }

      if (depth === 'machine') {
        if (ctx.scope === 'plant') {
          out.push([...hierarchyPrefix(depth, ctx.scope, year, formatLine(line), ''), ...analyticsRowToCells(lineRow, input.hasScenario)]);
        }
        for (const m of machinesOnLine(line, ctx.machinesProd)) {
          const machineRow = analyticsRowForMachine(year, m, ctx);
          out.push([
            ...hierarchyPrefix(depth, ctx.scope, year, ctx.scope === 'plant' ? formatLine(line) : '', machineLabel(m)),
            ...analyticsRowToCells(machineRow, input.hasScenario),
          ]);
        }
      }
    }
  }

  return { headers, rows: out };
}

function hierarchyPrefix(
  depth: AnalyticsExcelDepth,
  scope: AnalyticsTableDataContext['scope'],
  year: number,
  line: string,
  machine: string
): (string | number | null)[] {
  if (depth === 'year') return [excelExportCell(year)];
  if (depth === 'line') return [excelExportCell(year), line];
  if (scope === 'plant') return [excelExportCell(year), line, machine];
  return [excelExportCell(year), machine];
}
