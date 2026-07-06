import * as XLSX from 'xlsx';
import type { AnalyticsRow, TrendTableBuildOptions } from './capacityTrends';
import { deltaPp } from './capacityTrends';
import { excelExportCell } from './excelExportCell';
import type { Locale } from '../i18n/types';
import { linesOverviewLabels, pdfAnalyticsHeaders, pdfTrendHeaders } from '../i18n/reportLabels';

export type ExcelTableSection = {
  sheetTitle: string;
  headers: string[];
  rows: (string | number | null)[][];
};

export type VisualizationExcelInput = {
  locale: Locale;
  docTitle: string;
  metaRows: [string, string][];
  lineSections: ExcelTableSection[];
  machineSections: ExcelTableSection[];
  linesOverview?: ExcelTableSection;
  analyticsSection?: ExcelTableSection & {
    objectLabel: string;
    objectName: string;
    avgProduction: number | null;
    avgContract: number | null;
    avgScenarioProduction?: number | null;
    avgProductionLabel: string;
    avgContractLabel: string;
    avgScenarioProdLabel: string;
  };
  infoSheetLabel: string;
};

function sanitizeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31);
  if (!base) base = 'Arkusz';
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    const suffix = ` ${n}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    n++;
  }
  used.add(candidate);
  return candidate;
}

function appendSheet(wb: XLSX.WorkBook, name: string, used: Set<string>, rows: (string | number | null)[][]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(name, used));
}

export function buildNumericTrendSection(
  locale: Locale,
  years: number[],
  getProduction: (year: number) => number | null,
  getContract: (year: number) => number | null,
  getScenarioProduction: ((year: number) => number | null) | undefined,
  getScenarioContract: ((year: number) => number | null) | undefined,
  opts: TrendTableBuildOptions
): { headers: string[]; rows: (string | number | null)[][] } {
  const headers = pdfTrendHeaders(locale, opts);
  const rows = years.map((year) => {
    const production = getProduction(year);
    const contract = getContract(year);
    const scenarioProduction = getScenarioProduction?.(year) ?? null;
    const scenarioContract = getScenarioContract?.(year) ?? null;
    const cells: (string | number | null)[] = [excelExportCell(year)];
    if (opts.showProduction) cells.push(excelExportCell(production));
    if (opts.showContract) cells.push(excelExportCell(contract));
    if (opts.showProduction && opts.showContract) cells.push(excelExportCell(deltaPp(contract, production)));
    if (opts.hasScenario && opts.showScenarioProduction) cells.push(excelExportCell(scenarioProduction));
    if (opts.hasScenario && opts.showScenarioProduction && opts.showProduction) {
      cells.push(excelExportCell(deltaPp(production, scenarioProduction)));
    }
    if (opts.hasScenario && opts.showScenarioContract) cells.push(excelExportCell(scenarioContract));
    if (opts.hasScenario && opts.showScenarioContract && opts.showContract) {
      cells.push(excelExportCell(deltaPp(contract, scenarioContract)));
    }
    return cells;
  });
  return { headers, rows };
}

export function buildNumericAnalyticsSection(
  locale: Locale,
  rows: AnalyticsRow[],
  hasScenario: boolean
): { headers: string[]; rows: (string | number | null)[][] } {
  const headers = pdfAnalyticsHeaders(locale, hasScenario);
  const body = rows.map((r) => {
    const line: (string | number | null)[] = [
      excelExportCell(r.year),
      excelExportCell(r.production),
      excelExportCell(r.contract),
      excelExportCell(r.deltaContractMinusProd),
    ];
    if (hasScenario) {
      line.push(excelExportCell(r.scenarioProduction), excelExportCell(r.deltaScenarioProdMinusProd));
    }
    return line;
  });
  return { headers, rows: body };
}

export function buildNumericLinesOverviewSection(input: {
  locale: Locale;
  lines: string[];
  years: number[];
  getProduction: (line: string, year: number) => number | null;
  getContract: (line: string, year: number) => number | null;
  getScenarioProduction?: (line: string, year: number) => number | null;
  showProduction: boolean;
  showContract: boolean;
  showScenarioProduction: boolean;
}): ExcelTableSection {
  const lab = linesOverviewLabels(input.locale, {
    showProduction: input.showProduction,
    showContract: input.showContract,
    showScenarioProduction: input.showScenarioProduction,
  });
  const headers: string[] = [lab.line, lab.year];
  if (input.showProduction) headers.push(lab.prod);
  if (input.showContract) headers.push(lab.contract);
  if (input.showProduction && input.showContract) headers.push(lab.diffPp);
  if (input.showScenarioProduction && input.getScenarioProduction) headers.push(lab.scen);

  const rows: (string | number | null)[][] = [];
  for (const line of input.lines) {
    for (const year of input.years) {
      const p = input.getProduction(line, year);
      const k = input.getContract(line, year);
      const cells: (string | number | null)[] = [line, excelExportCell(year)];
      if (input.showProduction) cells.push(excelExportCell(p));
      if (input.showContract) cells.push(excelExportCell(k));
      if (input.showProduction && input.showContract) cells.push(excelExportCell(deltaPp(k, p)));
      if (input.showScenarioProduction && input.getScenarioProduction) {
        cells.push(excelExportCell(input.getScenarioProduction(line, year)));
      }
      rows.push(cells);
    }
  }

  return { sheetTitle: lab.title, headers, rows };
}

export function downloadCapacityVisualizationExcel(input: VisualizationExcelInput): void {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  const infoRows: (string | number | null)[][] = [[input.docTitle], [], ...input.metaRows.map(([label, value]) => [label, value])];
  appendSheet(wb, input.infoSheetLabel, used, infoRows);

  for (const sec of input.lineSections) {
    appendSheet(wb, sec.sheetTitle, used, [sec.headers, ...sec.rows]);
  }
  for (const sec of input.machineSections) {
    appendSheet(wb, sec.sheetTitle, used, [sec.headers, ...sec.rows]);
  }
  if (input.linesOverview) {
    appendSheet(wb, input.linesOverview.sheetTitle, used, [input.linesOverview.headers, ...input.linesOverview.rows]);
  }
  if (input.analyticsSection) {
    const rows: (string | number | null)[][] = [[input.analyticsSection.objectLabel, input.analyticsSection.objectName]];
    const avgParts: string[] = [];
    if (input.analyticsSection.avgProduction != null) {
      avgParts.push(`${input.analyticsSection.avgProductionLabel}: ${input.analyticsSection.avgProduction}%`);
    }
    if (input.analyticsSection.avgContract != null) {
      avgParts.push(`${input.analyticsSection.avgContractLabel}: ${input.analyticsSection.avgContract}%`);
    }
    if (input.analyticsSection.avgScenarioProduction != null) {
      avgParts.push(`${input.analyticsSection.avgScenarioProdLabel}: ${input.analyticsSection.avgScenarioProduction}%`);
    }
    if (avgParts.length) rows.push([avgParts.join(' | ')]);
    rows.push([]);
    rows.push(input.analyticsSection.headers);
    rows.push(...input.analyticsSection.rows);
    appendSheet(wb, input.analyticsSection.sheetTitle, used, rows);
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').slice(0, 12);
  XLSX.writeFile(wb, `capacity-wizualizacja-${stamp}.xlsx`);
}
