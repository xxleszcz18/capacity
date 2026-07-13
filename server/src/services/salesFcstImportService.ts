import * as XLSX from 'xlsx';
import { formatSapNumberForDisplay } from '../utils/detailLabel.js';

/** Kolumny SAP SalesFcst: AE = referencja detalu, AA = TranspPlngDate, AB = Corr.qty */
const COL_SAP_REF = 30; // AE
const COL_DATE = 26; // AA
const COL_QTY = 27; // AB

export type SalesFcstParsedRow = {
  sap_ref: string;
  volume_date: string;
  year: number;
  month: number;
  week: number;
  quantity: number;
};

export function normalizeSalesFcstSapRef(value: unknown): string {
  const raw = formatSapNumberForDisplay(value);
  const stripped = raw.replace(/^0+/, '');
  return stripped || '0';
}

/** Usuwa dwie ostatnie cyfry referencji (dopasowanie bazowe SAP). */
export function truncateSapRefLastTwo(ref: string): string | null {
  const n = normalizeSalesFcstSapRef(ref);
  if (!n || n === '0' || n.length <= 2) return null;
  const truncated = n.slice(0, -2);
  return truncated || null;
}

function parseExcelDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
    const utcDays = Math.floor(value - 25569);
    const ms = utcDays * 86400 * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isFinite(n) && n > 20000) {
    const parsed = XLSX.SSF.parse_date_code(n);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoWeekYear(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseQty(value: unknown): number {
  if (value == null || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseSalesFcstWorkbook(
  buffer: Buffer,
  dateFrom: string,
  dateTo: string
): { rows: SalesFcstParsedRow[]; skippedOutOfRange: number; skippedInvalid: number } {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { rows: [], skippedOutOfRange: 0, skippedInvalid: 0 };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: '' });
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  const rows: SalesFcstParsedRow[] = [];
  let skippedOutOfRange = 0;
  let skippedInvalid = 0;

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const sap_ref = normalizeSalesFcstSapRef(row[COL_SAP_REF]);
    if (!sap_ref || sap_ref === '0') {
      skippedInvalid++;
      continue;
    }
    const d = parseExcelDate(row[COL_DATE]);
    if (!d) {
      skippedInvalid++;
      continue;
    }
    if (d < from || d > to) {
      skippedOutOfRange++;
      continue;
    }
    const quantity = parseQty(row[COL_QTY]);
    if (quantity <= 0) continue;
    const { week } = isoWeekYear(d);
    rows.push({
      sap_ref,
      volume_date: toDateKey(d),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      week,
      quantity,
    });
  }

  return { rows, skippedOutOfRange, skippedInvalid };
}

export function isSalesFcstFilename(name: string): boolean {
  return /^SalesFcst_/i.test(String(name ?? '').trim());
}
