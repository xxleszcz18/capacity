/**
 * Stałe i mapowania kolumn dla modułu Data preparation (S2102 / S1619).
 */

/** Excel letter → 0-based index. */
export function excelColIndex(letter: string): number {
  const s = String(letter).trim().toUpperCase();
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 65 || c > 90) continue;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** Excel letter → 1-based column (ExcelJS). */
export function excelCol1(letter: string): number {
  return excelColIndex(letter) + 1;
}

export const YELLOW_FILL = 'FFFF00';
export const BFS_MAX_DEPTH = 6;

/** Kolumny identyfikujące wiersz Input (0-based). */
export const INPUT_COLS = {
  id: excelColIndex('A'),
  client: excelColIndex('C'),
  customerPart: excelColIndex('D'),
  sonar: excelColIndex('S'),
  sonarName: excelColIndex('T'),
  erpAb: excelColIndex('AB'),
} as const;

/** Zadanie B — S1619 (AF–AN), 0-based. */
export const S1619_COLS = {
  machineGroup: excelColIndex('AF'), // AF
  costCenter: excelColIndex('AG'), // AG
  capacity: excelColIndex('AH'), // AH
  oeeActual: excelColIndex('AI'), // AI
  oeeTarget: excelColIndex('AJ'), // AJ
  erpNo: excelColIndex('AK'), // AK
  cavities: excelColIndex('AL'), // AL
  unitPerHour: excelColIndex('AM'), // AM
  lanes: excelColIndex('AN'), // AN
} as const;

/** Zadanie A — S2102 większa formatka CR–DC. */
export const S2102_LARGE = {
  machineGroup: excelColIndex('CR'),
  costCenter: excelColIndex('CS'),
  capacity: excelColIndex('CT'),
  oeeActual: excelColIndex('CU'),
  oeeTarget: excelColIndex('CV'),
  erpNo: excelColIndex('CW'),
  cavities: excelColIndex('CX'),
  unitPerHour: excelColIndex('CY'),
  lanes: excelColIndex('CZ'),
  moulded: excelColIndex('DA'),
  length: excelColIndex('DB'),
  width: excelColIndex('DC'),
} as const;

/** Zadanie A — S2102 mniejsza formatka DD–DO. */
export const S2102_SMALL = {
  machineGroup: excelColIndex('DD'),
  costCenter: excelColIndex('DE'),
  capacity: excelColIndex('DF'),
  oeeActual: excelColIndex('DG'),
  oeeTarget: excelColIndex('DH'),
  erpNo: excelColIndex('DI'),
  cavities: excelColIndex('DJ'),
  unitPerHour: excelColIndex('DK'),
  lanes: excelColIndex('DL'),
  moulded: excelColIndex('DM'),
  length: excelColIndex('DN'),
  width: excelColIndex('DO'),
} as const;

/** Pola zawsze żółte (brak pokrycia w routingu) — bez Base Qty (CY/DK). */
export const S2102_ALWAYS_YELLOW = [
  'cavities',
  'lanes',
  'moulded',
] as const;

export const S1619_ALWAYS_YELLOW = [
  'costCenter',
  'oeeActual',
  'oeeTarget',
  'cavities',
  'unitPerHour',
  'lanes',
] as const;

/** Fallback stałych (walidacja / gdy brak wiersza w Costcenter+OEE). */
export const FALLBACK_CONSTANTS = {
  B03: {
    costCenter: 'L57',
    machineGroup: 'B03_Heavy Layer',
    capacity: 120,
    oeeActual: 0.83,
    oeeTarget: 0.85,
  },
  C16: {
    machineGroup: 'C16_P1 flat cutting (2 Systems)',
    capacity: 108.75,
    /** cost center / OEE zależą od L32 vs L33 — zostawiane żółte gdy niepewne */
  },
} as const;

export const INPUT_SHEET_NAME = 'Input';
export const COSTCENTER_SHEET_NAME = 'Input Costcenter +OEE';

export type FillStatus =
  | 'FILLED_1'
  | 'FILLED_2'
  | 'FILLED_MATERIAL'
  | 'AMBIGUOUS'
  | 'SKIPPED'
  | 'NO_MATCH'
  | 'NO_ERP';
