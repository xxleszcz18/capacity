/**
 * Silnik Zadania A (S2102) i B (S1619) + raporty + samoweryfikacja.
 */

import {
  FALLBACK_CONSTANTS,
  FillStatus,
  INPUT_COLS,
  S1619_ALWAYS_YELLOW,
  S1619_COLS,
  S2102_ALWAYS_YELLOW,
  S2102_LARGE,
  S2102_SMALL,
} from './config.js';
import { findShallowestMatches, sortByAreaDesc, type MatchedMaterial } from './bomMatcher.js';
import {
  isCellFilled,
  parseCostcenterConstants,
  readKatowiceSheets,
  toCsv,
  writeInputWorkbook,
  type CellMatrix,
  type CellWrite,
  type CostcenterConstants,
} from './excelIo.js';
import type { RoutingIndex } from './routingParser.js';
import { parseRoutingBuffer } from './routingParser.js';
import { parseTransitionBuffer, resolveErpAbOnly } from './transitionMap.js';

function baseQtyForMaterial(routing: RoutingIndex, materialNumber: string): number | null {
  const ops = routing.operations.get(String(materialNumber).trim()) ?? [];
  for (const op of ops) {
    if (op.baseQty != null && Number.isFinite(op.baseQty) && op.baseQty > 0) return op.baseQty;
  }
  return null;
}

export type ReportRow = {
  rowExcel: number;
  task: 'A' | 'B';
  status: FillStatus;
  client: string;
  customerPart: string;
  sonar: string;
  name: string;
  erp: string;
  material: string;
  materialDesc: string;
  dimensions: string;
  bfsLevel: string;
  note?: string;
};

export type DiscrepancyRow = {
  rowExcel: number;
  client: string;
  sonar: string;
  name: string;
  erp: string;
  excelCw: string;
  excelDi: string;
  routingLarge: string;
  routingSmall: string;
  type: string;
};

export type DataPrepStats = {
  routing_materials_with_desc: number;
  routing_materials_with_components: number;
  transition_mappings: number;
  input_data_rows: number;
  // Zadanie A
  a_filled_1: number;
  a_filled_2: number;
  a_filled_total: number;
  a_ambiguous: number;
  a_skipped: number;
  a_no_match: number;
  a_no_erp: number;
  // Zadanie B
  b_filled: number;
  b_ambiguous: number;
  b_skipped: number;
  b_no_match: number;
  b_no_erp: number;
  b_note: string;
  // samoweryfikacja
  verify_agree: number;
  verify_disagree: number;
  verify_no_match: number;
};

export type DataPrepResult = {
  xlsx: Buffer;
  xlsxFilename: string;
  fillReportCsv: Buffer;
  discrepancyCsv: Buffer;
  stats: DataPrepStats;
};

function cellStr(rows: CellMatrix, r0: number, c0: number): string {
  const v = rows[r0]?.[c0];
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (Number.isInteger(v) || Math.abs(v - Math.trunc(v)) < 1e-9) return String(Math.trunc(v));
    return String(v);
  }
  return String(v).trim();
}

function asMaterialNumber(n: string): number | string {
  if (/^\d+$/.test(n)) {
    const x = Number(n);
    if (Number.isFinite(x)) return x;
  }
  return n;
}

function dimStr(m: MatchedMaterial): string {
  if (m.length != null && m.width != null) return `${m.length}x${m.width}`;
  return '';
}

function pushWrite(
  writes: CellWrite[],
  row1: number,
  col0: number,
  value: string | number | null,
  yellow?: boolean,
  comment?: string
) {
  writes.push({
    row1,
    col1: col0 + 1,
    value,
    yellow: Boolean(yellow),
    comment,
  });
}

function applyS2102Block(
  writes: CellWrite[],
  row1: number,
  block: typeof S2102_LARGE,
  consts: CostcenterConstants['b03'],
  mat: MatchedMaterial,
  routing: RoutingIndex,
  yellowUncertainCols = true
) {
  pushWrite(writes, row1, block.machineGroup, consts.machineGroup);
  pushWrite(writes, row1, block.costCenter, consts.costCenter);
  pushWrite(writes, row1, block.capacity, consts.capacity);
  pushWrite(writes, row1, block.oeeActual, consts.oeeActual);
  pushWrite(writes, row1, block.oeeTarget, consts.oeeTarget);
  pushWrite(writes, row1, block.erpNo, asMaterialNumber(mat.materialNumber));
  const baseQty = baseQtyForMaterial(routing, mat.materialNumber);
  if (baseQty != null) {
    pushWrite(writes, row1, block.unitPerHour, baseQty);
  } else {
    pushWrite(writes, row1, block.unitPerHour, null, yellowUncertainCols);
  }
  for (const key of S2102_ALWAYS_YELLOW) {
    pushWrite(writes, row1, block[key], null, yellowUncertainCols);
  }
  pushWrite(writes, row1, block.length, mat.length);
  pushWrite(writes, row1, block.width, mat.width);
}

function reportLine(r: ReportRow): (string | number)[] {
  return [
    r.rowExcel,
    r.task,
    r.status,
    r.client,
    r.customerPart,
    r.sonar,
    r.name,
    r.erp,
    r.material,
    r.materialDesc,
    r.dimensions,
    r.bfsLevel,
  ];
}

function baseMeta(rows: CellMatrix, r0: number, erp: string) {
  return {
    client: cellStr(rows, r0, INPUT_COLS.client),
    customerPart: cellStr(rows, r0, INPUT_COLS.customerPart),
    sonar: cellStr(rows, r0, INPUT_COLS.sonar),
    name: cellStr(rows, r0, INPUT_COLS.sonarName),
    erp,
  };
}

function normMatNum(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v === 0) return ''; // placeholder „puste” w Excelu
    return String(Math.trunc(v));
  }
  const s = String(v)
    .trim()
    .replace(/\s+/g, '')
    .replace(/\.0+$/, '');
  if (!s || s === '-' || s === '0') return '';
  return s;
}

/** Porównanie CW/DI człowieka z wynikiem BFS (samoweryfikacja). */
function verifyS2102Row(
  rows: CellMatrix,
  r0: number,
  matches: MatchedMaterial[]
): { agree: boolean; type: string; large: string; small: string } | null {
  if (!isCellFilled(rows, r0, S2102_LARGE.machineGroup)) return null;
  const sorted = sortByAreaDesc(matches);
  const excelCw = normMatNum(rows[r0]?.[S2102_LARGE.erpNo]);
  const excelDi = normMatNum(rows[r0]?.[S2102_SMALL.erpNo]);
  const large = sorted[0]?.materialNumber ?? '';
  const small = sorted.length >= 2 ? sorted[1]?.materialNumber ?? '' : '';
  if (!excelCw) {
    return { agree: false, type: 'EMPTY_CW', large, small };
  }
  if (!matches.length) {
    return { agree: false, type: 'NO_ROUTING_MATCH', large: '', small: '' };
  }
  const nums = sorted.map((m) => m.materialNumber);

  // Gdy DI puste: zgodność, jeśli CW jest którymkolwiek kandydatem BFS (człowiek często wpisuje 1 formatkę).
  if (!excelDi) {
    const ok = nums.includes(excelCw);
    if (ok) return { agree: true, type: 'OK', large, small };
    return {
      agree: false,
      type: nums.length ? 'MATERIAL_NOT_IN_ROUTING' : 'NO_ROUTING_MATCH',
      large,
      small,
    };
  }

  if (sorted.length === 1) {
    const ok = excelCw === large;
    return { agree: ok, type: ok ? 'OK' : 'MISMATCH', large, small: '' };
  }

  if (sorted.length === 2) {
    if (excelCw === large && excelDi === small) return { agree: true, type: 'OK', large, small };
    if (excelCw === small && excelDi === large) return { agree: false, type: 'LH_RH_SWAP', large, small };
    if (!nums.includes(excelCw) || !nums.includes(excelDi)) {
      return { agree: false, type: 'MATERIAL_NOT_IN_ROUTING', large, small };
    }
    return { agree: false, type: 'VARIANT_OR_OTHER', large, small };
  }

  const ok = nums.includes(excelCw) && nums.includes(excelDi);
  return { agree: ok, type: ok ? 'OK' : 'MULTI_CANDIDATE', large, small };
}

export async function runDataPreparation(
  katowiceBuffer: Buffer,
  routingBuffer: Buffer,
  transitionBuffer: Buffer
): Promise<DataPrepResult> {
  const routing = parseRoutingBuffer(routingBuffer);
  const transition = parseTransitionBuffer(transitionBuffer);
  const { inputRows, costcenterRows } = readKatowiceSheets(katowiceBuffer);
  const consts = parseCostcenterConstants(costcenterRows);

  // dane od wiersza 4 (Excel) = index 3; nagłówki w wierszu 3 = index 2
  const dataStart0 = 3;
  const writes: CellWrite[] = [];
  const report: ReportRow[] = [];
  const discrepancies: DiscrepancyRow[] = [];

  const stats: DataPrepStats = {
    routing_materials_with_desc: routing.materialsWithDesc,
    routing_materials_with_components: routing.materialsWithComponents,
    transition_mappings: transition.mappingCount,
    input_data_rows: 0,
    a_filled_1: 0,
    a_filled_2: 0,
    a_filled_total: 0,
    a_ambiguous: 0,
    a_skipped: 0,
    a_no_match: 0,
    a_no_erp: 0,
    b_filled: 0,
    b_ambiguous: 0,
    b_skipped: 0,
    b_no_match: 0,
    b_no_erp: 0,
    b_note:
      'S1619: przy obecnym eksporcie routingu brak niewypełnionych wierszy z S1619 w strukturze wyrobu (materiały „for XXX” są osierocone). Uzupełniono 0. Wymagany kompletniejszy eksport SAP.',
    verify_agree: 0,
    verify_disagree: 0,
    verify_no_match: 0,
  };

  for (let r0 = dataStart0; r0 < inputRows.length; r0++) {
    const id = cellStr(inputRows, r0, INPUT_COLS.id);
    if (!id) continue;
    stats.input_data_rows++;
    const rowExcel = r0 + 1;
    const metaBase = baseMeta(inputRows, r0, '');

    const resolved = resolveErpAbOnly(
      inputRows[r0]?.[INPUT_COLS.erpAb],
      inputRows[r0]?.[INPUT_COLS.sonar],
      transition
    );

    // --- Zadanie A ---
    const crFilled = isCellFilled(inputRows, r0, S2102_LARGE.machineGroup);
    if (crFilled) {
      stats.a_skipped++;
      report.push({
        ...metaBase,
        rowExcel,
        task: 'A',
        status: 'SKIPPED',
        erp: resolved.erp ?? '',
        material: '',
        materialDesc: '',
        dimensions: '',
        bfsLevel: '',
      });
      // samoweryfikacja na wypełnionych
      if (resolved.erp) {
        const matches = findShallowestMatches(routing, resolved.erp, 'S2102');
        const v = verifyS2102Row(inputRows, r0, matches);
        if (v) {
          if (v.type === 'EMPTY_CW') {
            // Człowiek wypełnił B03, ale bez numeru w CW — pomiń w samoweryfikacji.
            stats.verify_no_match++;
          } else if (v.agree) {
            stats.verify_agree++;
          } else {
            stats.verify_disagree++;
            discrepancies.push({
              rowExcel,
              client: metaBase.client,
              sonar: metaBase.sonar,
              name: metaBase.name,
              erp: resolved.erp,
              excelCw: cellStr(inputRows, r0, S2102_LARGE.erpNo),
              excelDi: cellStr(inputRows, r0, S2102_SMALL.erpNo),
              routingLarge: v.large,
              routingSmall: v.small,
              type: v.type,
            });
          }
        } else if (!matches.length) {
          stats.verify_no_match++;
        }
      }
    } else if (!resolved.erp) {
      stats.a_no_erp++;
      report.push({
        ...metaBase,
        rowExcel,
        task: 'A',
        status: 'NO_ERP',
        erp: '',
        material: '',
        materialDesc: '',
        dimensions: '',
        bfsLevel: '',
      });
    } else if (resolved.mismatch) {
      // Rozbieżność AB vs Tabela przejścia — nie wpisuj, żółte, zaraportuj jako NO_MATCH (brak bezpiecznego wpisu).
      stats.a_no_match++;
      pushWrite(writes, rowExcel, S2102_LARGE.erpNo, null, true, 'Rozbieżność AB vs Tabela przejścia — nie wpisano');
      pushWrite(writes, rowExcel, S2102_SMALL.erpNo, null, true, 'Rozbieżność AB vs Tabela przejścia — nie wpisano');
      report.push({
        ...metaBase,
        rowExcel,
        task: 'A',
        status: 'NO_MATCH',
        erp: resolved.erp,
        material: '',
        materialDesc: '',
        dimensions: '',
        bfsLevel: '',
        note: 'AB_TRANSITION_MISMATCH',
      });
    } else {
      const matches = sortByAreaDesc(findShallowestMatches(routing, resolved.erp, 'S2102'));
      const meta = { ...metaBase, erp: resolved.erp };
      if (matches.length === 0) {
        stats.a_no_match++;
        report.push({
          ...meta,
          rowExcel,
          task: 'A',
          status: 'NO_MATCH',
          material: '',
          materialDesc: '',
          dimensions: '',
          bfsLevel: '',
        });
      } else if (matches.length >= 3) {
        stats.a_ambiguous++;
        const cand = matches.map((m) => `${m.materialNumber} (${dimStr(m)})`).join(', ');
        pushWrite(
          writes,
          rowExcel,
          S2102_LARGE.erpNo,
          null,
          true,
          `Niepewne (≥3 S2102): ${cand}`
        );
        pushWrite(
          writes,
          rowExcel,
          S2102_SMALL.erpNo,
          null,
          true,
          `Niepewne (≥3 S2102): ${cand}`
        );
        report.push({
          ...meta,
          rowExcel,
          task: 'A',
          status: 'AMBIGUOUS',
          material: matches.map((m) => m.materialNumber).join('|'),
          materialDesc: matches.map((m) => m.description).join('|'),
          dimensions: matches.map(dimStr).join('|'),
          bfsLevel: String(matches[0]?.bfsLevel ?? ''),
        });
      } else if (matches.length === 1) {
        applyS2102Block(writes, rowExcel, S2102_LARGE, consts.b03, matches[0]!, routing);
        stats.a_filled_1++;
        stats.a_filled_total++;
        report.push({
          ...meta,
          rowExcel,
          task: 'A',
          status: 'FILLED_1',
          material: matches[0]!.materialNumber,
          materialDesc: matches[0]!.description,
          dimensions: dimStr(matches[0]!),
          bfsLevel: String(matches[0]!.bfsLevel),
        });
      } else {
        applyS2102Block(writes, rowExcel, S2102_LARGE, consts.b03, matches[0]!, routing);
        applyS2102Block(writes, rowExcel, S2102_SMALL, consts.b03, matches[1]!, routing);
        stats.a_filled_2++;
        stats.a_filled_total++;
        report.push({
          ...meta,
          rowExcel,
          task: 'A',
          status: 'FILLED_2',
          material: `${matches[0]!.materialNumber}|${matches[1]!.materialNumber}`,
          materialDesc: `${matches[0]!.description}|${matches[1]!.description}`,
          dimensions: `${dimStr(matches[0]!)}|${dimStr(matches[1]!)}`,
          bfsLevel: String(matches[0]!.bfsLevel),
        });
      }
    }

    // --- Zadanie B ---
    const afFilled = isCellFilled(inputRows, r0, S1619_COLS.machineGroup);
    if (afFilled) {
      stats.b_skipped++;
      report.push({
        ...metaBase,
        rowExcel,
        task: 'B',
        status: 'SKIPPED',
        erp: resolved.erp ?? '',
        material: '',
        materialDesc: '',
        dimensions: '',
        bfsLevel: '',
      });
    } else if (!resolved.erp) {
      stats.b_no_erp++;
      report.push({
        ...metaBase,
        rowExcel,
        task: 'B',
        status: 'NO_ERP',
        erp: '',
        material: '',
        materialDesc: '',
        dimensions: '',
        bfsLevel: '',
      });
    } else if (resolved.mismatch) {
      stats.b_no_match++;
      report.push({
        ...metaBase,
        rowExcel,
        task: 'B',
        status: 'NO_MATCH',
        erp: resolved.erp,
        material: '',
        materialDesc: '',
        dimensions: '',
        bfsLevel: '',
        note: 'AB_TRANSITION_MISMATCH',
      });
    } else {
      const matches = findShallowestMatches(routing, resolved.erp, 'S1619');
      const meta = { ...metaBase, erp: resolved.erp };
      if (matches.length === 0) {
        stats.b_no_match++;
        report.push({
          ...meta,
          rowExcel,
          task: 'B',
          status: 'NO_MATCH',
          material: '',
          materialDesc: '',
          dimensions: '',
          bfsLevel: '',
        });
      } else if (matches.length >= 2) {
        stats.b_ambiguous++;
        const cand = matches.map((m) => m.materialNumber).join(', ');
        pushWrite(
          writes,
          rowExcel,
          S1619_COLS.erpNo,
          null,
          true,
          `Niepewne (≥2 S1619): ${cand}`
        );
        report.push({
          ...meta,
          rowExcel,
          task: 'B',
          status: 'AMBIGUOUS',
          material: matches.map((m) => m.materialNumber).join('|'),
          materialDesc: matches.map((m) => m.description).join('|'),
          dimensions: matches.map(dimStr).join('|'),
          bfsLevel: String(matches[0]?.bfsLevel ?? ''),
        });
      } else {
        const m = matches[0]!;
        pushWrite(writes, rowExcel, S1619_COLS.machineGroup, consts.c16.machineGroup);
        pushWrite(writes, rowExcel, S1619_COLS.capacity, consts.c16.capacity);
        pushWrite(
          writes,
          rowExcel,
          S1619_COLS.erpNo,
          String(m.materialNumber), // tekst — nie kod kalkulacyjny
          true,
          'Brak kodu kalkulacyjnego - wpisano numer materiału. Kod nadaje uzytkownik.'
        );
        for (const key of S1619_ALWAYS_YELLOW) {
          pushWrite(writes, rowExcel, S1619_COLS[key], null, true);
        }
        stats.b_filled++;
        report.push({
          ...meta,
          rowExcel,
          task: 'B',
          status: 'FILLED_MATERIAL',
          material: m.materialNumber,
          materialDesc: m.description,
          dimensions: dimStr(m),
          bfsLevel: String(m.bfsLevel),
        });
      }
    }
  }

  const xlsx = await writeInputWorkbook(inputRows, writes);

  const fillCsv = toCsv([
    [
      'wiersz',
      'zadanie',
      'status',
      'klient',
      'nr_czesci',
      'sonar',
      'nazwa',
      'ERP_wyrobu',
      'material',
      'opis_materialu',
      'wymiary',
      'poziom_BFS',
    ],
    ...report.map(reportLine),
  ]);

  const discCsv = toCsv([
    [
      'wiersz',
      'klient',
      'sonar',
      'nazwa',
      'ERP',
      'excel_CW',
      'excel_DI',
      'routing_large',
      'routing_small',
      'typ',
    ],
    ...discrepancies.map((d) => [
      d.rowExcel,
      d.client,
      d.sonar,
      d.name,
      d.erp,
      d.excelCw,
      d.excelDi,
      d.routingLarge,
      d.routingSmall,
      d.type,
    ]),
  ]);

  return {
    xlsx,
    xlsxFilename: 'Input_S2102_S1619.xlsx',
    fillReportCsv: Buffer.from(fillCsv, 'utf8'),
    discrepancyCsv: Buffer.from(discCsv, 'utf8'),
    stats,
  };
}

/** Eksporty pomocnicze do testów. */
export const __testables = {
  findShallowestMatches,
  sortByAreaDesc,
  parseRoutingBuffer,
  parseTransitionBuffer,
  FALLBACK_CONSTANTS,
};
