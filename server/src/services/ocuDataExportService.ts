import * as XLSX from 'xlsx';
import { db } from '../db/connection.js';
import { getProductionMonthsInYear } from '../utils/sopEopFormat.js';
import { inflateZipEntry, readZipEntries, rewriteZipEntries } from '../utils/zipEntryRewrite.js';

/** Excel 1-based letters → 0-based index. */
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

/** 1-based Excel column number from letter (dla ExcelJS). */
function excelCol1(letter: string): number {
  return excelColIndex(letter) + 1;
}

/** Arkusz Input: A=ID, …, E=Date Year, S=Sonar Part Code, X/AB/AC/AD/AE = Opt1cxx_*. */
const INPUT_FALLBACK = {
  year: excelCol1('E'),
  sonarCode: excelCol1('S'),
  x: excelCol1('X'),
  ab: excelCol1('AB'),
  ac: excelCol1('AC'),
  ad: excelCol1('AD'),
  ae: excelCol1('AE'),
} as const;

const TRANSITION = {
  sonar: excelColIndex('B'),
  erp: excelColIndex('C'),
  year: excelColIndex('D'),
} as const;

type InputColMap = {
  year: number;
  sonarCode: number;
  x: number;
  ab: number;
  ac: number;
  ad: number;
  ae: number;
};

function normKey(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    // unikaj notacji naukowej / ułamków z Excela
    if (Number.isInteger(v) || Math.abs(v - Math.trunc(v)) < 1e-9) return String(Math.trunc(v));
    return String(v);
  }
  let s = String(v).trim();
  if (!s) return '';
  // sap z importu często jako "106616040102.0"
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
  if (/^\d+(\.\d+)?e[+-]?\d+$/i.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return String(Math.trunc(n));
  }
  return s;
}

/** Klucz porównawczy SAP/ERP (bez .0 i spacji). */
function normSapKey(v: unknown): string {
  return normKey(v).replace(/\s+/g, '').replace(/\.0+$/, '');
}

function asYear(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const y = Math.trunc(v);
    return y >= 1900 && y <= 2200 ? y : null;
  }
  const m = String(v).trim().match(/^(19|20|21)\d{2}/);
  if (!m) return null;
  const y = Number(m[0]);
  return y >= 1900 && y <= 2200 ? y : null;
}

type TransitionRow = { sonar: string; erp: string; year: number };

function parseTransitionSheet(buffer: Buffer): TransitionRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Tabela przejścia: brak arkusza.');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null }) as unknown[][];
  if (!rows.length) throw new Error('Tabela przejścia: pusty plik.');
  const out: TransitionRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const sonar = normKey(row[TRANSITION.sonar]);
    const erp = normSapKey(row[TRANSITION.erp]);
    const year = asYear(row[TRANSITION.year]);
    if (!sonar || year == null) continue;
    out.push({ sonar: normKey(sonar), erp, year });
  }
  if (!out.length) throw new Error('Tabela przejścia: nie znaleziono wierszy z Sonar Part Code i rokiem.');
  return out;
}

/** 1-based column number → Excel letters (1=A … 24=X … 28=AB). */
function colLetterFrom1(col1: number): string {
  let n = col1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveInputColumns(headerRow: unknown[]): InputColMap {
  let sonar = INPUT_FALLBACK.sonarCode;
  let year = INPUT_FALLBACK.year;
  for (let i = 0; i < headerRow.length; i++) {
    const h = String(headerRow[i] ?? '')
      .trim()
      .toLowerCase();
    if (!h) continue;
    if (h === 'sonar part code' || h.includes('sonar part code')) sonar = i + 1;
    if (h === 'date year' || h.includes('date year')) year = i + 1;
  }
  return {
    year,
    sonarCode: sonar,
    x: INPUT_FALLBACK.x,
    ab: INPUT_FALLBACK.ab,
    ac: INPUT_FALLBACK.ac,
    ad: INPUT_FALLBACK.ad,
    ae: INPUT_FALLBACK.ae,
  };
}

function findInputSheetMatrix(buffer: Buffer): { rows: unknown[][]; headerRowNum: number; cols: InputColMap } {
  const wb = XLSX.read(buffer, { type: 'buffer', sheets: ['Input'], cellDates: true });
  const sheet = wb.Sheets['Input'];
  if (!sheet) throw new Error('Katowice_Data: nie znaleziono arkusza „Input”.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  if (!rows.length) throw new Error('Katowice_Data / Input: pusty arkusz.');

  let headerRowNum = 0;
  let cols: InputColMap | null = null;
  const maxScan = Math.min(25, rows.length);
  for (let i = 0; i < maxScan; i++) {
    const header = rows[i] ?? [];
    const hasSonar = header.some((c) =>
      String(c ?? '')
        .toLowerCase()
        .includes('sonar part code')
    );
    if (!hasSonar) continue;
    headerRowNum = i + 1; // 1-based Excel
    cols = resolveInputColumns(header);
    break;
  }
  if (!cols || !headerRowNum) {
    throw new Error('Katowice_Data / Input: nie znaleziono wiersza nagłówka (Sonar Part Code).');
  }
  return { rows, headerRowNum, cols };
}

type DbDetailProfile = {
  /** nests dla AC: pojedyncza liczba lub lista składowych setu */
  nestsParts: number[];
  /** AE — suma gniazd */
  nestsTotal: number;
  /** max cykl [s] ze wszystkich operacji detalu */
  maxCycleSeconds: number | null;
  /** linia (machines.location) → „waga” w roku (miesiące produkcji / wolumen) */
  lineWeightByYear: Map<number, Map<string, number>>;
};

function loadDetailProfilesBySap(yearsNeeded: number[]): Map<string, DbDetailProfile> {
  const years = yearsNeeded.length ? [...new Set(yearsNeeded)].sort((a, b) => a - b) : [];
  if (!years.length) {
    const y = new Date().getFullYear();
    years.push(y);
  }
  const map = new Map<string, DbDetailProfile>();

  type OpRow = {
    operation_id: number;
    sap_number: string | null;
    nests_count: number;
    cycle_time_seconds: number | null;
    alt_cycle_time_seconds: number | null;
    is_set: number;
    line_number: string | null;
    sop: string | null;
    eop: string | null;
  };

  const opRows = db
    .prepare(
      `SELECT
         o.id AS operation_id,
         pd.sap_number AS sap_number,
         COALESCE(o.nests_count, 1) AS nests_count,
         o.cycle_time_seconds AS cycle_time_seconds,
         o.alt_cycle_time_seconds AS alt_cycle_time_seconds,
         COALESCE(o.is_set, 0) AS is_set,
         m.location AS line_number,
         p.sop AS sop,
         p.eop AS eop
       FROM operations o
       JOIN parts pt ON pt.id = o.part_id
       LEFT JOIN part_designations pd ON pd.id = pt.designation_id
       LEFT JOIN machines m ON m.id = o.machine_id
       LEFT JOIN projects p ON p.id = pt.project_id
       WHERE pd.sap_number IS NOT NULL AND TRIM(pd.sap_number) != ''`
    )
    .all() as OpRow[];

  const setMemberRows = db
    .prepare(
      `SELECT osm.operation_id AS operation_id, COALESCE(o.nests_count, 1) AS nests_count, pd.sap_number AS member_sap
       FROM operation_set_members osm
       JOIN operations o ON o.id = osm.operation_id
       JOIN parts pt ON pt.id = osm.part_id
       LEFT JOIN part_designations pd ON pd.id = pt.designation_id
       ORDER BY osm.operation_id, osm.part_id`
    )
    .all() as { operation_id: number; nests_count: number; member_sap: string | null }[];

  const membersByOp = new Map<number, number[]>();
  const setOpsByMemberSap = new Map<string, number[]>();
  for (const row of setMemberRows) {
    const list = membersByOp.get(row.operation_id) ?? [];
    list.push(Number(row.nests_count) || 1);
    membersByOp.set(row.operation_id, list);
    const ms = normSapKey(row.member_sap);
    if (!ms) continue;
    const ops = setOpsByMemberSap.get(ms) ?? [];
    ops.push(row.operation_id);
    setOpsByMemberSap.set(ms, ops);
  }

  const volumes = db
    .prepare(`SELECT operation_id, year, volume_value FROM operation_volume_by_year`)
    .all() as { operation_id: number; year: number; volume_value: number }[];
  const volByOpYear = new Map<string, number>();
  for (const v of volumes) {
    volByOpYear.set(`${v.operation_id}|${v.year}`, Number(v.volume_value) || 0);
  }

  const ensure = (sap: string): DbDetailProfile => {
    let p = map.get(sap);
    if (!p) {
      p = {
        nestsParts: [],
        nestsTotal: 0,
        maxCycleSeconds: null,
        lineWeightByYear: new Map(),
      };
      map.set(sap, p);
    }
    return p;
  };

  const addCycle = (p: DbDetailProfile, cycle: number | null | undefined, alt: number | null | undefined) => {
    for (const c of [cycle, alt]) {
      const n = Number(c);
      if (!Number.isFinite(n) || n <= 0) continue;
      if (p.maxCycleSeconds == null || n > p.maxCycleSeconds) p.maxCycleSeconds = n;
    }
  };

  const addLineWeight = (p: DbDetailProfile, year: number, line: string, weight: number) => {
    if (!line || weight <= 0) return;
    let byLine = p.lineWeightByYear.get(year);
    if (!byLine) {
      byLine = new Map();
      p.lineWeightByYear.set(year, byLine);
    }
    byLine.set(line, (byLine.get(line) ?? 0) + weight);
  };

  // Operacje setów — indeks po id, żeby member SAP dostał ten sam profil linii/cyklu
  const setOpMeta = new Map<number, OpRow>();

  for (const op of opRows) {
    const sap = normSapKey(op.sap_number);
    if (!sap) continue;
    const p = ensure(sap);
    addCycle(p, op.cycle_time_seconds, op.alt_cycle_time_seconds);

    if (Number(op.is_set) === 1) {
      setOpMeta.set(op.operation_id, op);
      const parts = membersByOp.get(op.operation_id);
      if (parts?.length && p.nestsParts.length === 0) {
        p.nestsParts = [...parts];
        p.nestsTotal = parts.reduce((a, b) => a + b, 0);
      }
    } else if (p.nestsParts.length === 0) {
      const n = Number(op.nests_count) || 1;
      p.nestsParts = [n];
      p.nestsTotal = n;
    } else {
      // wiele operacji tego samego SAP — bierz max gniazd / zachowaj pierwszą listę
      const n = Number(op.nests_count) || 1;
      if (p.nestsParts.length === 1 && n > p.nestsParts[0]) {
        p.nestsParts = [n];
        p.nestsTotal = n;
      }
    }

    const line = normKey(op.line_number);
    // Waga: miesiące SOP–EOP w roku; fallback: wolumen roczny
    for (const year of years) {
      let w = getProductionMonthsInYear(op.sop ?? '', op.eop ?? '', year);
      if (w <= 0) {
        const vol = volByOpYear.get(`${op.operation_id}|${year}`) ?? 0;
        w = vol > 0 ? vol : 0;
      }
      if (w > 0 && line) addLineWeight(p, year, line, w);
    }
  }

  // Detale występujące tylko jako członkowie setu (bez własnej operacji-kotwicy)
  for (const [memberSap, opIds] of setOpsByMemberSap) {
    const p = ensure(memberSap);
    for (const opId of opIds) {
      const op = setOpMeta.get(opId);
      if (!op) continue;
      addCycle(p, op.cycle_time_seconds, op.alt_cycle_time_seconds);
      if (p.nestsParts.length === 0) {
        const parts = membersByOp.get(opId) ?? [Number(op.nests_count) || 1];
        p.nestsParts = [...parts];
        p.nestsTotal = parts.reduce((a, b) => a + b, 0);
      }
      const line = normKey(op.line_number);
      for (const year of years) {
        let w = getProductionMonthsInYear(op.sop ?? '', op.eop ?? '', year);
        if (w <= 0) {
          const vol = volByOpYear.get(`${opId}|${year}`) ?? 0;
          w = vol > 0 ? vol : 0;
        }
        if (w > 0 && line) addLineWeight(p, year, line, w);
      }
    }
  }

  return map;
}

function pickLineForYear(profile: DbDetailProfile | undefined, year: number | null): string | null {
  if (!profile || year == null) return null;
  const byLine = profile.lineWeightByYear.get(year);
  if (!byLine || byLine.size === 0) {
    // fallback: dowolna linia z dowolnego roku (największa waga łącznie)
    const totals = new Map<string, number>();
    for (const m of profile.lineWeightByYear.values()) {
      for (const [line, w] of m) totals.set(line, (totals.get(line) ?? 0) + w);
    }
    let best: string | null = null;
    let bestW = -1;
    for (const [line, w] of totals) {
      if (w > bestW) {
        bestW = w;
        best = line;
      }
    }
    return best;
  }
  let best: string | null = null;
  let bestW = -1;
  for (const [line, w] of byLine) {
    if (w > bestW) {
      bestW = w;
      best = line;
    }
  }
  return best;
}

export type OcuDataGenerateResult = {
  buffer: Buffer;
  filename: string;
  stats: {
    pivot_rows: number;
    filled_ab: number;
    filled_x: number;
    filled_ac: number;
    filled_ad: number;
    filled_ae: number;
    unmatched_sonar: number;
    unmatched_erp_in_db: number;
  };
};

function cellXmlValue(addr: string, value: string | number, styleId?: string): string {
  const sAttr = styleId != null && styleId !== '' ? ` s="${styleId}"` : '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${addr}"${sAttr}><v>${value}</v></c>`;
  }
  return `<c r="${addr}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function colIndexFromLetters(letters: string): number {
  let n = 0;
  const s = letters.toUpperCase();
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n;
}

/** Wstawia / podmienia komórki w XML arkusza (jedno przejście po wierszach). Zachowuje atrybut stylu s=. */
function applyCellUpdatesToSheetXml(xml: string, updates: Map<string, string | number>): string {
  if (!updates.size) return xml;

  const byRow = new Map<number, Map<string, string | number>>();
  for (const [addr, value] of updates) {
    const m = /^([A-Z]+)(\d+)$/i.exec(addr);
    if (!m) continue;
    const row = Number(m[2]);
    const letter = m[1].toUpperCase();
    let rowMap = byRow.get(row);
    if (!rowMap) {
      rowMap = new Map();
      byRow.set(row, rowMap);
    }
    rowMap.set(letter, value);
  }

  return xml.replace(/<row\b[^>]*>[\s\S]*?<\/row>/gi, (rowXml) => {
    const rm = /\br="(\d+)"/i.exec(rowXml);
    if (!rm) return rowXml;
    const rowNum = Number(rm[1]);
    const rowUpdates = byRow.get(rowNum);
    if (!rowUpdates) return rowXml;

    let next = rowXml;
    const pending = new Map(rowUpdates);

    next = next.replace(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/gi, (cell) => {
      const am = /\br="([A-Z]+)(\d+)"/i.exec(cell);
      if (!am || Number(am[2]) !== rowNum) return cell;
      const letter = am[1].toUpperCase();
      if (!pending.has(letter)) return cell;
      const value = pending.get(letter)!;
      pending.delete(letter);
      const styleId = /\bs="([^"]+)"/i.exec(cell)?.[1];
      return cellXmlValue(`${letter}${rowNum}`, value, styleId);
    });

    if (pending.size === 0) return next;

    const toInsert = [...pending.entries()]
      .sort((a, b) => colIndexFromLetters(a[0]) - colIndexFromLetters(b[0]))
      .map(([letter, value]) => cellXmlValue(`${letter}${rowNum}`, value))
      .join('');

    return next.replace(/<\/row>/i, `${toInsert}</row>`);
  });
}

const AUTO_FILTER_BLOCK =
  /<(?:[\w.-]+:)?autoFilter\b[^>]*\/>|<(?:[\w.-]+:)?autoFilter\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?autoFilter>/gi;
const SORT_STATE_BLOCK =
  /<(?:[\w.-]+:)?sortState\b[^>]*\/>|<(?:[\w.-]+:)?sortState\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?sortState>/gi;

/** Czyści kryteria filtrów (zostawia pusty autoFilter z atrybutami) i odkrywa ukryte wiersze. */
function clearFiltersAndUnhideInXml(xml: string, opts: { isTable?: boolean }): string {
  let out = xml;
  if (opts.isTable) {
    out = out.replace(AUTO_FILTER_BLOCK, (m) => {
      const open = /^(<(?:[\w.-]+:)?autoFilter\b)([^>]*)/i.exec(m);
      if (!open) return '<autoFilter/>';
      // zachowaj atrybuty (ref, xr:uid, …), usuń tylko dzieci (filterColumn)
      const attrs = open[2].replace(/\/\s*$/, '').trim();
      return attrs ? `<autoFilter ${attrs}/>` : `<autoFilter/>`;
    });
    return out;
  }

  out = out.replace(AUTO_FILTER_BLOCK, '');
  out = out.replace(SORT_STATE_BLOCK, '');
  out = out.replace(/\sfilterMode="1"/gi, '');
  out = out.replace(/\sfilterMode='1'/gi, '');
  out = out.replace(/(<row\b[^>]*?)\s+hidden="1"/gi, '$1');
  out = out.replace(/(<row\b[^>]*?)\s+hidden='1'/gi, '$1');
  return out;
}

function workbookHasMacros(buffer: Buffer): boolean {
  try {
    const { entries } = readZipEntries(buffer);
    return entries.some((e) => /vbaProject/i.test(e.name));
  } catch {
    return false;
  }
}

function katowiceOutputExt(buffer: Buffer): '.xlsm' | '.xlsx' {
  return workbookHasMacros(buffer) ? '.xlsm' : '.xlsx';
}

/**
 * Mutuje skoroszyt OOXML bez JSZip.generate (copy-through ZIP) —
 * Excel nie otwierał plików po pełnym przepisaniu dużego .xlsm.
 */
function mutateKatowicePackage(
  buffer: Buffer,
  cellUpdates: Map<string, string | number>
): { cleaned: Buffer; filled: Buffer } {
  const { entries } = readZipEntries(buffer);
  const byName = new Map(entries.map((e) => [e.name, e]));

  const wbEntry = byName.get('xl/workbook.xml');
  const relsEntry = byName.get('xl/_rels/workbook.xml.rels');
  if (!wbEntry || !relsEntry) throw new Error('Katowice_Data: brak workbook.xml / rels.');

  const wbXml = inflateZipEntry(wbEntry).toString('utf8');
  const relsXml = inflateZipEntry(relsEntry).toString('utf8');

  const sheetTag =
    wbXml.match(/<sheet\b[^>]*\bname="Input"[^>]*\/?>/i) ??
    wbXml.match(/<sheet\b[^>]*\bname='Input'[^>]*\/?>/i);
  if (!sheetTag) throw new Error('Katowice_Data: nie znaleziono arkusza „Input”.');
  const rid =
    sheetTag[0].match(/\br:id="([^"]+)"/i)?.[1] ?? sheetTag[0].match(/\br:id='([^']+)'/i)?.[1];
  if (!rid) throw new Error('Katowice_Data: brak r:id arkusza Input.');
  const rel =
    relsXml.match(new RegExp(`<Relationship\\b[^>]*\\bId="${rid}"[^>]*>`, 'i')) ??
    relsXml.match(new RegExp(`<Relationship\\b[^>]*\\bId='${rid}'[^>]*>`, 'i'));
  const target =
    rel?.[0].match(/\bTarget="([^"]+)"/i)?.[1] ?? rel?.[0].match(/\bTarget='([^']+)'/i)?.[1];
  if (!target) throw new Error('Katowice_Data: brak Target arkusza Input.');
  let inputPath = target.replace(/\\/g, '/');
  if (inputPath.startsWith('/')) inputPath = inputPath.slice(1);
  if (!inputPath.startsWith('xl/')) inputPath = `xl/${inputPath}`;

  const cleanedReplacements = new Map<string, Buffer>();
  const filledReplacements = new Map<string, Buffer>();

  for (const entry of entries) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name)) {
      const xml0 = inflateZipEntry(entry).toString('utf8');
      const cleared = clearFiltersAndUnhideInXml(xml0, { isTable: false });
      if (cleared !== xml0) cleanedReplacements.set(entry.name, Buffer.from(cleared, 'utf8'));

      if (entry.name === inputPath || entry.name.replace(/^\/+/, '') === inputPath) {
        const base = cleared;
        const patched = applyCellUpdatesToSheetXml(base, cellUpdates);
        filledReplacements.set(entry.name, Buffer.from(patched, 'utf8'));
      } else if (cleared !== xml0) {
        filledReplacements.set(entry.name, Buffer.from(cleared, 'utf8'));
      }
      continue;
    }

    if (/^xl\/tables\/table\d+\.xml$/i.test(entry.name)) {
      const xml0 = inflateZipEntry(entry).toString('utf8');
      const cleared = clearFiltersAndUnhideInXml(xml0, { isTable: true });
      if (cleared !== xml0) {
        const buf = Buffer.from(cleared, 'utf8');
        cleanedReplacements.set(entry.name, buf);
        filledReplacements.set(entry.name, buf);
      }
    }
  }

  // Input sheet musi trafić do filled nawet gdy nie było filtrów/ukryć, ale są cellUpdates
  if (cellUpdates.size && !filledReplacements.has(inputPath)) {
    const entry = byName.get(inputPath);
    if (!entry) throw new Error(`Katowice_Data: brak pliku arkusza ${inputPath}`);
    const xml0 = inflateZipEntry(entry).toString('utf8');
    const cleared = clearFiltersAndUnhideInXml(xml0, { isTable: false });
    filledReplacements.set(inputPath, Buffer.from(applyCellUpdatesToSheetXml(cleared, cellUpdates), 'utf8'));
    if (cleared !== xml0) cleanedReplacements.set(inputPath, Buffer.from(cleared, 'utf8'));
  }

  const cleaned = rewriteZipEntries(buffer, cleanedReplacements);
  const filled = rewriteZipEntries(buffer, filledReplacements);
  return { cleaned, filled };
}

async function clearWorkbookFiltersAndUnhide(buffer: Buffer): Promise<Buffer> {
  // Lekkie pliki (tabela przejścia) — copy-through też
  try {
    const { entries } = readZipEntries(buffer);
    const replacements = new Map<string, Buffer>();
    for (const entry of entries) {
      if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name)) {
        const xml0 = inflateZipEntry(entry).toString('utf8');
        const cleared = clearFiltersAndUnhideInXml(xml0, { isTable: false });
        if (cleared !== xml0) replacements.set(entry.name, Buffer.from(cleared, 'utf8'));
      } else if (/^xl\/tables\/table\d+\.xml$/i.test(entry.name)) {
        const xml0 = inflateZipEntry(entry).toString('utf8');
        const cleared = clearFiltersAndUnhideInXml(xml0, { isTable: true });
        if (cleared !== xml0) replacements.set(entry.name, Buffer.from(cleared, 'utf8'));
      }
    }
    if (!replacements.size) return buffer;
    return rewriteZipEntries(buffer, replacements);
  } catch {
    // nie-ZIP / stary .xls — oddaj bez zmian
    return buffer;
  }
}

/**
 * Uzupełnia arkusz Input (Katowice_Data): wyłącznie X, AB, AC, AD, AE.
 * Filtry wyłączane + wiersze odkrywane przed uzupełnieniem.
 * Pakiet OOXML przepisywany copy-through (bez JSZip.generate) — plik otwiera się w Excelu.
 * Zwraca ZIP: Tabela_przejscia + Katowice bez filtrów + Katowice OCU (.xlsx/.xlsm).
 */
export async function generateOcuKatowiceWorkbook(
  transitionBuffer: Buffer,
  katowiceBuffer: Buffer
): Promise<OcuDataGenerateResult> {
  const JSZip = (await import('jszip')).default;
  const ext = katowiceOutputExt(katowiceBuffer);

  const transitionNoFilter = await clearWorkbookFiltersAndUnhide(transitionBuffer);

  const transition = parseTransitionSheet(transitionNoFilter);
  const erpBySonarYear = new Map<string, string>();
  for (const row of transition) {
    erpBySonarYear.set(`${row.sonar}|${row.year}`, row.erp);
  }

  // Odczyt wartości z oryginału (ukryte wiersze też są w XML / XLSX)
  const { rows, headerRowNum, cols } = findInputSheetMatrix(katowiceBuffer);
  const yearsNeeded: number[] = transition.map((t) => t.year);
  for (let i = headerRowNum; i < rows.length; i++) {
    const y = asYear(rows[i]?.[cols.year - 1]);
    if (y != null) yearsNeeded.push(y);
  }
  const profiles = loadDetailProfilesBySap(yearsNeeded);

  const stats = {
    pivot_rows: 0,
    filled_ab: 0,
    filled_x: 0,
    filled_ac: 0,
    filled_ad: 0,
    filled_ae: 0,
    unmatched_sonar: 0,
    unmatched_erp_in_db: 0,
  };

  const cellUpdates = new Map<string, string | number>();

  for (let i = headerRowNum; i < rows.length; i++) {
    const excelRow = i + 1;
    const row = rows[i] ?? [];
    const sonar = normKey(row[cols.sonarCode - 1]);
    const year = asYear(row[cols.year - 1]);
    if (!sonar) continue;
    stats.pivot_rows++;

    const erp = year != null ? erpBySonarYear.get(`${sonar}|${year}`) : undefined;
    if (erp == null || erp === '') {
      stats.unmatched_sonar++;
      continue;
    }

    const erpNum = Number(erp);
    const abValue: string | number =
      Number.isFinite(erpNum) && String(Math.trunc(erpNum)) === erp ? erpNum : erp;
    cellUpdates.set(`${colLetterFrom1(cols.ab)}${excelRow}`, abValue);
    stats.filled_ab++;

    if (!erp || erp === '0') {
      stats.unmatched_erp_in_db++;
      continue;
    }

    const profile = profiles.get(normSapKey(erp));
    if (!profile) {
      stats.unmatched_erp_in_db++;
      continue;
    }

    const line = pickLineForYear(profile, year);
    if (line) {
      cellUpdates.set(`${colLetterFrom1(cols.x)}${excelRow}`, `L${line}`);
      stats.filled_x++;
    }

    if (profile.nestsParts.length) {
      cellUpdates.set(`${colLetterFrom1(cols.ac)}${excelRow}`, profile.nestsParts.join('+'));
      stats.filled_ac++;
    }

    if (profile.maxCycleSeconds != null && profile.maxCycleSeconds > 0) {
      cellUpdates.set(`${colLetterFrom1(cols.ad)}${excelRow}`, Math.round(3600 / profile.maxCycleSeconds));
      stats.filled_ad++;
    }

    if (profile.nestsTotal > 0) {
      cellUpdates.set(`${colLetterFrom1(cols.ae)}${excelRow}`, profile.nestsTotal);
      stats.filled_ae++;
    }
  }

  const { cleaned: katowiceNoFilter, filled: katowiceOcu } = mutateKatowicePackage(
    katowiceBuffer,
    cellUpdates
  );

  const outZip = new JSZip();
  outZip.file('Tabela_przejscia.xlsx', transitionNoFilter);
  outZip.file(`Katowice_Data_bez_filtrow${ext}`, katowiceNoFilter);
  outZip.file(`Katowice_Data_OCU${ext}`, katowiceOcu);
  const zipBuffer = await outZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    buffer: Buffer.from(zipBuffer),
    filename: 'Dane_do_OCU.zip',
    stats,
  };
}
