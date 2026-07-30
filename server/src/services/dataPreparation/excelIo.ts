/**
 * Bezpieczny odczyt Input + Costcenter oraz zapis wynikowego .xlsx (bez makr).
 */

import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import {
  COSTCENTER_SHEET_NAME,
  FALLBACK_CONSTANTS,
  INPUT_SHEET_NAME,
  YELLOW_FILL,
} from './config.js';

export type CellMatrix = unknown[][];

export type CostcenterConstants = {
  b03: {
    costCenter: string;
    machineGroup: string;
    capacity: number;
    oeeActual: number;
    oeeTarget: number;
  };
  c16: {
    machineGroup: string;
    capacity: number;
  };
};

export type YellowCell = { row1: number; col1: number; comment?: string };

export type CellWrite = {
  row1: number;
  col1: number;
  value: string | number | null;
  yellow?: boolean;
  comment?: string;
};

function sheetToMatrix(wb: XLSX.WorkBook, name: string): CellMatrix {
  const sheet = wb.Sheets[name];
  if (!sheet) throw new Error(`Katowice_Data: nie znaleziono arkusza „${name}”.`);
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
}

/**
 * Czyta tylko wskazane arkusze (unikaj pełnego load Pivot / Hilfstabelle).
 * sheetjs nadal ładuje sharedStrings — dla Input (~12 MB XML) to akceptowalne.
 */
export function readKatowiceSheets(buffer: Buffer): {
  inputRows: CellMatrix;
  costcenterRows: CellMatrix | null;
} {
  const names = [INPUT_SHEET_NAME, COSTCENTER_SHEET_NAME];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, {
      type: 'buffer',
      sheets: names,
      cellDates: false,
      cellStyles: false,
      bookVBA: false,
      bookFiles: false,
    });
  } catch (e: any) {
    throw new Error(
      `Nie udało się odczytać Katowice_Data (pamięć / uszkodzony plik): ${e?.message || e}`
    );
  }
  if (!wb.Sheets[INPUT_SHEET_NAME]) {
    // fallback: spróbuj znaleźć arkusz z „Input” w nazwie (bez Costcenter)
    const alt = wb.SheetNames.find((n) => /^input$/i.test(n.trim()));
    if (!alt) {
      // pełny odczyt tylko listy arkuszy
      const meta = XLSX.read(buffer, { type: 'buffer', bookSheets: true });
      throw new Error(
        `Katowice_Data: brak arkusza „Input”. Dostępne: ${(meta.SheetNames || []).slice(0, 20).join(', ')}`
      );
    }
  }
  const inputRows = sheetToMatrix(wb, INPUT_SHEET_NAME);
  let costcenterRows: CellMatrix | null = null;
  if (wb.Sheets[COSTCENTER_SHEET_NAME]) {
    costcenterRows = sheetToMatrix(wb, COSTCENTER_SHEET_NAME);
  }
  return { inputRows, costcenterRows };
}

function asNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Odczyt stałych B03/C16 z zakładki Input Costcenter +OEE (nagłówki ok. wiersza 7). */
export function parseCostcenterConstants(rows: CellMatrix | null): CostcenterConstants {
  const fallback: CostcenterConstants = {
    b03: { ...FALLBACK_CONSTANTS.B03 },
    c16: {
      machineGroup: FALLBACK_CONSTANTS.C16.machineGroup,
      capacity: FALLBACK_CONSTANTS.C16.capacity,
    },
  };
  if (!rows?.length) return fallback;

  let headerRow = 6; // 0-based ≈ Excel 7
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i] ?? [];
    const joined = row.map((c) => String(c ?? '').toLowerCase()).join('|');
    if (joined.includes('cost') && (joined.includes('group') || joined.includes('oee'))) {
      headerRow = i;
      break;
    }
  }

  let b03: CostcenterConstants['b03'] | null = null;
  let c16Cap: number | null = null;
  let c16Group: string | null = null;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const costCenter = String(row[1] ?? '').trim(); // B
    const groupName = String(row[2] ?? '').trim(); // C
    const capacity = asNum(row[8]); // I
    const oeeAct = asNum(row[9]); // J
    const oeeTgt = asNum(row[10]); // K

    if (/B03_Heavy Layer/i.test(groupName) || costCenter === 'L57') {
      if (!b03 && capacity != null && oeeAct != null && oeeTgt != null) {
        b03 = {
          costCenter: costCenter || 'L57',
          machineGroup: groupName || FALLBACK_CONSTANTS.B03.machineGroup,
          capacity,
          oeeActual: oeeAct,
          oeeTarget: oeeTgt,
        };
      }
    }
    if (/C16_P1 flat cutting/i.test(groupName)) {
      if (capacity != null) c16Cap = capacity;
      if (groupName) c16Group = groupName;
    }
  }

  return {
    b03: b03 ?? fallback.b03,
    c16: {
      machineGroup: c16Group ?? fallback.c16.machineGroup,
      capacity: c16Cap ?? fallback.c16.capacity,
    },
  };
}

function cellIsFilled(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'number') return Number.isFinite(v);
  const s = String(v).trim();
  if (!s) return false;
  // Katowice_Data używa „-” jako placeholdera pustej komórki
  if (s === '-' || s === '–' || s === '—' || s.toLowerCase() === 'n/a') return false;
  return true;
}

export function isCellFilled(rows: CellMatrix, row0: number, col0: number): boolean {
  return cellIsFilled(rows[row0]?.[col0]);
}

/** Buduje nowy skoroszyt z jedną zakładką Input + żółte flagi / komentarze. */
export async function writeInputWorkbook(
  sourceRows: CellMatrix,
  writes: CellWrite[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Autoneum Capacity — Data preparation';
  const ws = wb.addWorksheet(INPUT_SHEET_NAME);

  const yellowFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${YELLOW_FILL}` },
  };

  // skopiuj wartości
  for (let r = 0; r < sourceRows.length; r++) {
    const row = sourceRows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (v == null || v === '') continue;
      ws.getCell(r + 1, c + 1).value = v as ExcelJS.CellValue;
    }
  }

  for (const w of writes) {
    const cell = ws.getCell(w.row1, w.col1);
    if (w.value !== undefined) {
      cell.value = w.value as ExcelJS.CellValue;
    }
    if (w.yellow) {
      cell.fill = yellowFill;
    }
    if (w.comment) {
      cell.note = w.comment;
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const lines = rows.map((r) => r.map(csvEscape).join(';'));
  return '\ufeff' + lines.join('\r\n') + '\r\n';
}
