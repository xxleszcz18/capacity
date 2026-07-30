/**
 * Tabela przejścia — Sonar Part Code ↔ ERP (arkusz Agregacja).
 */

import * as XLSX from 'xlsx';
import { excelColIndex } from './config.js';

export type TransitionMap = {
  /** Sonar Part Code → ERP (≥10 cyfr) */
  bySonar: Map<string, string>;
  /** Customer Part No → ERP (pomocniczo) */
  byCustomerPart: Map<string, string>;
  mappingCount: number;
};

function normKey(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (Number.isInteger(v) || Math.abs(v - Math.trunc(v)) < 1e-9) return String(Math.trunc(v));
    return String(v);
  }
  let s = String(v).trim();
  if (!s) return '';
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
  if (/^\d+(\.\d+)?e[+-]?\d+$/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return String(Math.trunc(n));
  }
  return s;
}

function normSap(v: unknown): string {
  return normKey(v).replace(/\s+/g, '').replace(/\.0+$/, '');
}

export function isValidErp(v: unknown): boolean {
  const s = normSap(v);
  return /^\d{10,}$/.test(s) && s !== '0';
}

function findHeaderMap(rows: unknown[][]): { headerRow: number; cols: Record<string, number> } | null {
  const maxScan = Math.min(30, rows.length);
  for (let i = 0; i < maxScan; i++) {
    const row = rows[i] ?? [];
    const cols: Record<string, number> = {};
    for (let c = 0; c < row.length; c++) {
      const h = String(row[c] ?? '')
        .trim()
        .toLowerCase();
      if (!h) continue;
      if (h === 'customer' || h.includes('customer part')) cols.customer = c;
      if (h === 'sonar part code' || (h.includes('sonar') && h.includes('code'))) cols.sonar = c;
      if (h === 'erp' || h === 'erp no' || h === 'erp number') cols.erp = c;
      if (h === 'year') cols.year = c;
      if (h.includes('part volume') || h === 'volume') cols.volume = c;
    }
    if (cols.sonar != null && cols.erp != null) {
      return { headerRow: i, cols };
    }
  }
  // fallback: klasyczne B/C (sonar/erp) z pierwszego arkusza OCU
  return {
    headerRow: 0,
    cols: {
      sonar: excelColIndex('B'),
      erp: excelColIndex('C'),
      customer: excelColIndex('A'),
    },
  };
}

export function parseTransitionBuffer(buffer: Buffer): TransitionMap {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const prefer = wb.SheetNames.find((n) => /agregacja/i.test(n)) ?? wb.SheetNames[0];
  if (!prefer) throw new Error('Tabela przejścia: brak arkusza.');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[prefer], { header: 1, defval: null }) as unknown[][];
  if (!rows.length) throw new Error('Tabela przejścia: pusty plik.');

  const hdr = findHeaderMap(rows);
  if (!hdr) throw new Error('Tabela przejścia: nie znaleziono kolumn Sonar Part Code / ERP.');

  const bySonar = new Map<string, string>();
  const byCustomerPart = new Map<string, string>();

  for (let i = hdr.headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const sonar = normKey(row[hdr.cols.sonar!]);
    const erp = normSap(row[hdr.cols.erp!]);
    if (!sonar || !isValidErp(erp)) continue;
    if (!bySonar.has(sonar)) bySonar.set(sonar, erp);
    if (hdr.cols.customer != null) {
      const cust = normKey(row[hdr.cols.customer]);
      if (cust && !byCustomerPart.has(cust)) byCustomerPart.set(cust, erp);
    }
  }

  if (!bySonar.size) {
    throw new Error('Tabela przejścia: brak mapowań Sonar → ERP (ERP musi mieć ≥10 cyfr).');
  }

  return { bySonar, byCustomerPart, mappingCount: bySonar.size };
}

/** ERP wyrobu: tylko AB (≥10 cyfr). Tabela przejścia = walidacja (mismatch → nie wpisuj). */
export function resolveErp(
  abValue: unknown,
  sonar: unknown,
  _customerPart: unknown,
  map: TransitionMap
): { erp: string | null; source: 'AB' | 'SONAR' | 'CUSTOMER' | null; mismatch: boolean } {
  const ab = normSap(abValue);
  if (isValidErp(ab)) {
    const fromSonar = sonar ? map.bySonar.get(normKey(sonar)) : undefined;
    const mismatch = Boolean(fromSonar && fromSonar !== ab);
    return { erp: mismatch ? null : ab, source: 'AB', mismatch };
  }
  // Fallback Sonar → ERP tylko gdy AB puste/niepoprawne (zgodnie z promptem).
  // Benchmark §9 dla Katowice_Data (2) liczy NO_ERP wyłącznie po AB — fallback wyłączony
  // w fillEngine przez flagę; tu zostawiamy API.
  const s = normKey(sonar);
  if (s && map.bySonar.has(s)) {
    return { erp: map.bySonar.get(s)!, source: 'SONAR', mismatch: false };
  }
  return { erp: null, source: null, mismatch: false };
}

/** Wariant używany przez silnik wypełniania — ERP z AB (≥10 cyfr). */
export function resolveErpAbOnly(
  abValue: unknown,
  sonar: unknown,
  map: TransitionMap
): { erp: string | null; mismatch: boolean } {
  const ab = normSap(abValue);
  if (!isValidErp(ab)) return { erp: null, mismatch: false };
  const fromSonar = sonar ? map.bySonar.get(normKey(sonar)) : undefined;
  const mismatch = Boolean(fromSonar && fromSonar !== ab);
  // AB pozostaje kluczem do routingu; przy mismatch nie wypełniamy (§10) — silnik sprawdza flagę.
  return { erp: ab, mismatch };
}
