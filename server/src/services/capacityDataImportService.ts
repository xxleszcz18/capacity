import * as XLSX from 'xlsx';
import { db, saveDb } from '../db/connection.js';
import { formatSapNumberForDisplay } from '../utils/detailLabel.js';
import { excelExportCell } from '../utils/excelExportCell.js';
import { parseInternalMachineNumber } from '../utils/internalMachineNumber.js';
import { ensureMachineTypesExist } from '../utils/machineTypes.js';
import { dimensionsFromImportRow } from './machineImportService.js';
import { formatSopEop } from '../utils/sopEopFormat.js';

const README_SHEET = '_INSTRUKCJA';
/** Krótka checklista tuż po instrukcji w pobranym szablonie. */
const SHEET_QUICK_PATH = 'SCIEZKA_MINIMUM';
const SHEET_MACHINES = 'Maszyny';
const SHEET_PROJECTS = 'Projekty';
const SHEET_DETAILS = 'Detale';
const SHEET_LINKS = 'Projekt_detal';
const SHEET_VOLUMES = 'Wolumeny';
/** Bez tego arkusza kalkulator nie „widzi” detalu — obciążenie jest liczone z operacji (maszyna + faza + cykl). */
const SHEET_OPERATIONS = 'Operacje';

/** Identyfikator aktualnego układu importu — endpoint diagnostyczny i nagłówki odpowiedzi. */
export const CAPACITY_DATA_IMPORT_SCHEMA_TAG = 'operacje-v2';

/** Nazwa pobieranego pliku — zmieniana przy aktualizacji struktury arkuszy (wtedy widać, że to nowy szablon). */
export const CAPACITY_DATA_IMPORT_TEMPLATE_DOWNLOAD_NAME = 'capacity_szablon_import_danych_v2.xlsx';

/** Kolejność zakładek w szablonie zwracanym przez `buildCapacityDataImportTemplateBuffer` (diagnostyka API). */
export const CAPACITY_DATA_IMPORT_TEMPLATE_SHEET_ORDER = [
  README_SHEET,
  SHEET_QUICK_PATH,
  SHEET_MACHINES,
  SHEET_PROJECTS,
  SHEET_DETAILS,
  SHEET_LINKS,
  SHEET_VOLUMES,
  SHEET_OPERATIONS,
] as const;

/** Pierwszy wiersz arkusza Maszyny — pomaga odróżnić szablon v2 od starego (`numer_sap` vs `numer_sap_maszyny`). */
export const CAPACITY_DATA_IMPORT_MACHINE_SHEET_HEADERS = [
  'numer_maszyny',
  'numer_sap_maszyny',
  'typ',
  'status',
  'szerokosc',
  'glebokosc',
  'wysokosc',
  'skok',
] as const;

const REQUIRED_SHEETS = [SHEET_MACHINES, SHEET_PROJECTS, SHEET_DETAILS, SHEET_LINKS, SHEET_VOLUMES] as const;

/** merge (domyślny): dopisz/aktualizuj z pliku, nie usuwaj rekordów spoza pliku. replace: stan bazy = zawartość pliku. */
export type CapacityDataImportMode = 'merge' | 'replace';

export type DataImportResult =
  | {
      ok: true;
      counts: {
        machines_created: number;
        machines_updated: number;
        machines_deleted: number;
        projects_created: number;
        projects_updated: number;
        projects_deleted: number;
        designations_created: number;
        designations_updated: number;
        designations_deleted: number;
        parts_created: number;
        parts_skipped: number;
        parts_deleted: number;
        volumes_upserted: number;
        volumes_deleted: number;
        operations_created: number;
        operations_updated: number;
        operations_deleted: number;
        phases_created: number;
      };
      warnings: string[];
      mode: CapacityDataImportMode;
    }
  | { ok: false; error: string };

type DataImportSyncState = {
  importedMachineInternals: Set<string>;
  importedProjectKeys: Set<string>;
  importedDesignationIds: Set<number>;
  importedPartKeys: Set<string>;
  /** Powiązania projekt–detal z arkusza Projekt_detal (nie z samych Operacji). */
  projektDetalPartKeys: Set<string>;
  importedVolumeKeys: Set<string>;
  keptOperationIds: Set<number>;
};

function syncDatabaseToImportedFile(
  state: DataImportSyncState,
  counts: Extract<DataImportResult, { ok: true }>['counts'],
): void {
  const { importedMachineInternals, importedProjectKeys, importedDesignationIds, importedPartKeys, importedVolumeKeys, keptOperationIds } =
    state;

  const keptOpIds = [...keptOperationIds];
  if (keptOpIds.length === 0) {
    try {
      db.prepare('DELETE FROM operation_set_members').run();
    } catch {
      /* ignore */
    }
    try {
      db.prepare('DELETE FROM operation_volume_by_year').run();
    } catch {
      /* ignore */
    }
    const r = db.prepare('DELETE FROM operations').run();
    counts.operations_deleted = r.changes;
  } else {
    const ph = keptOpIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM operations WHERE split_from_operation_id IS NOT NULL AND split_from_operation_id NOT IN (${ph})`).run(...keptOpIds);
    const r = db.prepare(`DELETE FROM operations WHERE split_from_operation_id IS NULL AND id NOT IN (${ph})`).run(...keptOpIds);
    counts.operations_deleted = r.changes;
  }

  const allParts = db.prepare('SELECT id, project_id, designation_id FROM parts WHERE designation_id IS NOT NULL').all() as {
    id: number;
    project_id: number;
    designation_id: number;
  }[];

  for (const p of allParts) {
    const partKey = `${p.project_id}:${p.designation_id}`;
    if (!importedPartKeys.has(partKey)) continue;
    const volYears = db.prepare('SELECT year FROM part_volume_by_year WHERE part_id = ?').all(p.id) as { year: number }[];
    for (const { year } of volYears) {
      const vk = `${p.id}:${year}`;
      if (importedVolumeKeys.has(vk)) continue;
      db.prepare('DELETE FROM part_volume_by_year WHERE part_id = ? AND year = ?').run(p.id, year);
      try {
        db.prepare('DELETE FROM part_volume_contract_by_year WHERE part_id = ? AND year = ?').run(p.id, year);
      } catch {
        /* tabela opcjonalna */
      }
      try {
        db.prepare('DELETE FROM part_volume_share_by_year WHERE part_id = ? AND year = ?').run(p.id, year);
      } catch {
        /* ignore */
      }
      try {
        db.prepare('DELETE FROM part_volume_contract_share_by_year WHERE part_id = ? AND year = ?').run(p.id, year);
      } catch {
        /* ignore */
      }
      counts.volumes_deleted++;
    }
  }

  for (const p of allParts) {
    const partKey = `${p.project_id}:${p.designation_id}`;
    if (importedPartKeys.has(partKey)) continue;
    const r = db.prepare('DELETE FROM parts WHERE id = ?').run(p.id);
    if (r.changes > 0) counts.parts_deleted++;
  }

  for (const d of db.prepare('SELECT id FROM part_designations').all() as { id: number }[]) {
    if (importedDesignationIds.has(d.id)) continue;
    const ref = db.prepare('SELECT 1 AS x FROM parts WHERE designation_id = ? LIMIT 1').get(d.id) as { x: number } | undefined;
    if (ref) continue;
    const r = db.prepare('DELETE FROM part_designations WHERE id = ?').run(d.id);
    if (r.changes > 0) counts.designations_deleted++;
  }

  for (const pr of db.prepare('SELECT id, client, name FROM projects').all() as { id: number; client: string; name: string }[]) {
    if (importedProjectKeys.has(projectKey(pr.client, pr.name))) continue;
    const r = db.prepare('DELETE FROM projects WHERE id = ?').run(pr.id);
    if (r.changes > 0) counts.projects_deleted++;
  }

  for (const m of db.prepare('SELECT internal_number FROM machines').all() as { internal_number: string }[]) {
    if (importedMachineInternals.has(m.internal_number)) continue;
    const r = db.prepare('DELETE FROM machines WHERE internal_number = ?').run(m.internal_number);
    if (r.changes > 0) counts.machines_deleted++;
  }
}

function cellStr(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  return String(v).trim();
}

function cellNum(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cellInternalMachineNumber(v: unknown): string | null {
  const parsed = parseInternalMachineNumber(v);
  return parsed.ok ? parsed.value : null;
}

function normalizeSap(v: unknown): string {
  return formatSapNumberForDisplay(v);
}

function identLooksLikeExcelScientificString(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  return /[eE][+-]?\d+/.test(raw.trim());
}

/** Ostrzeżenia: brak Projekt_detal / Wolumeny → kalkulator ~0% mimo operacji na maszynie. */
function warnCalculatorVolumeContext(
  rowTag: string,
  projectId: number,
  partId: number,
  partKey: string,
  sapLabel: string,
  volFromExcelEmpty: boolean,
  syncState: DataImportSyncState,
  warnings: string[]
): void {
  if (!syncState.projektDetalPartKeys.has(partKey)) {
    warnings.push(
      `${rowTag}: detal SAP „${sapLabel}” nie ma wiersza w arkuszu Projekt_detal — dodaj powiązanie (klient, nazwa_projektu, nr_sap_detalu).`
    );
  }
  const partVolN = Number(
    (db.prepare('SELECT COUNT(*) AS c FROM part_volume_by_year WHERE part_id = ?').get(partId) as { c: number }).c ?? 0
  );
  const projVolN = Number(
    (db.prepare('SELECT COUNT(*) AS c FROM project_volumes WHERE project_id = ?').get(projectId) as { c: number }).c ?? 0
  );
  if (partVolN === 0 && projVolN === 0) {
    warnings.push(
      `${rowTag}: brak wolumenów dla detalu SAP „${sapLabel}” w arkuszu Wolumeny — kalkulator pokaże ~0% na tej maszynie. W Wolumeny i Operacje musi być ten sam nr SAP.`
    );
  } else if (volFromExcelEmpty) {
    warnings.push(
      `${rowTag}: wolumen_szablon w Operacje jest 0/pusty — do obciążenia używane są wolumeny z arkusza Wolumeny (nie pole operacji).`
    );
  }
}

function projectKey(client: string, name: string): string {
  return `${client.trim().toLowerCase()}\x00${name.trim().toLowerCase()}`;
}

/** Projekty o danej nazwie (bez klienta) — do uzupełnienia pustej komórki „klient”. */
function projectIdsByNameOnly(projectName: string, projectByKey: Map<string, number>): { clientKey: string; id: number }[] {
  const nameLc = projectName.trim().toLowerCase();
  if (!nameLc) return [];
  const out: { clientKey: string; id: number }[] = [];
  for (const [k, id] of projectByKey) {
    const sep = k.indexOf('\x00');
    if (sep < 0) continue;
    const namePart = k.slice(sep + 1);
    if (namePart === nameLc) out.push({ clientKey: k.slice(0, sep), id });
  }
  return out;
}

function resolveProjectIdForOperationImport(
  row: Record<string, unknown>,
  projectByKey: Map<string, number>,
  warnings: string[],
  rowTag: string
): number | null {
  const client = cellStr(row.klient ?? row.client);
  const name = cellStr(row.nazwa_projektu ?? row.name);
  if (!name) {
    warnings.push(`${rowTag}: brak nazwa_projektu.`);
    return null;
  }
  if (client) {
    const id = projectByKey.get(projectKey(client, name));
    if (id != null) return id;
    warnings.push(`${rowTag}: brak projektu „${client} — ${name}”.`);
    return null;
  }
  const matches = projectIdsByNameOnly(name, projectByKey);
  if (matches.length === 1) {
    const inferredClient = matches[0].clientKey;
    warnings.push(
      `${rowTag}: uzupełniono klienta „${inferredClient}” (pusta komórka klient — w bazie jest jeden projekt o nazwie „${name}”).`
    );
    return matches[0].id;
  }
  if (matches.length > 1) {
    warnings.push(
      `${rowTag}: pominięto — brak klienta, a w bazie jest kilka projektów „${name}” (różni klienci). Wpisz klienta w kolumnie klient.`
    );
    return null;
  }
  warnings.push(`${rowTag}: brak projektu „${name}” — wpisz klienta i nazwa_projektu jak w arkuszu Projekty.`);
  return null;
}

/** Wiersz operacji ma komplet danych do importu (w tym rozpoznany projekt). */
function operationRowReadyForImport(row: Record<string, unknown>, projectByKey: Map<string, number>): boolean {
  const name = cellStr(row.nazwa_projektu ?? row.name);
  const internal = cellInternalMachineNumber(row.numer_maszyny ?? row.internal_number);
  const phaseNorm = phaseNormFromOperationRow(row);
  const cycleRaw = cellNum(row.czas_cykl_s ?? row.cycle_time_seconds ?? row.cykl_s);
  if (!name || !phaseNorm || internal == null) return false;
  if (cycleRaw == null || cycleRaw <= 0) return false;
  const client = cellStr(row.klient ?? row.client);
  if (client) return projectByKey.has(projectKey(client, name));
  return projectIdsByNameOnly(name, projectByKey).length === 1;
}

function normalizeMachineStatus(raw: unknown): 'active' | 'inactive' | 'RFQ' {
  const s = cellStr(raw).toLowerCase();
  if (s === 'inactive' || s === 'nieaktywny' || s === 'nieaktywna') return 'inactive';
  if (s === 'rfq') return 'RFQ';
  return 'active';
}

function normalizeProjectStatus(raw: unknown): 'active' | 'inactive' | 'RFQ' {
  const s = cellStr(raw).toLowerCase();
  if (s === 'inactive' || s === 'nieaktywny') return 'inactive';
  if (s === 'rfq') return 'RFQ';
  return 'active';
}

function normalizeVolumeUnit(raw: unknown): 'annual' | 'monthly' | 'weekly' | null {
  const s = cellStr(raw).toLowerCase();
  if (!s || s === 'annual' || s === 'roczny' || s === 'rok' || s === 'r') return 'annual';
  if (s === 'monthly' || s === 'miesieczny' || s === 'miesięczny' || s === 'm') return 'monthly';
  if (s === 'weekly' || s === 'tygodniowy' || s === 't') return 'weekly';
  return null;
}

/** Jak w formularzu operacji: Nr SAP lub Alias detalu. */
function normalizeDetailPick(raw: unknown): 'sap' | 'alias' {
  const s = cellStr(raw).toLowerCase();
  if (s === 'alias' || s === 'a') return 'alias';
  return 'sap';
}

/** Pojedynczy detal vs set (wiele detali). */
function normalizeOperationKind(raw: unknown): 'single' | 'set' {
  const s = cellStr(raw).toLowerCase();
  if (!s) return 'single';
  if (s === 'set' || s === 'zestaw' || s === 's' || s.includes('2+') || s === 'wiele') return 'set';
  return 'single';
}

function splitDetailTokens(raw: string): string[] {
  return raw
    .split(/[;,|]\s*|\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** OEE jak w UI [%]; wartość w (0,1] traktuj jako ułamek (np. 0,85). */
function parseOeeOverride(raw: unknown): number | null {
  const n = cellNum(raw);
  if (n == null || n <= 0) return null;
  if (n <= 1) return Math.min(1, Math.max(0, n));
  return Math.min(1, Math.max(0, n / 100));
}

function rebalanceCapacityPercentOnInsert(machineId: number, projectId: number, newOpCapacityPercent: number): number {
  const existing = db
    .prepare('SELECT id, capacity_percent FROM operations WHERE machine_id = ? AND project_id = ?')
    .all(machineId, projectId) as { id: number; capacity_percent: number }[];
  const currentSum = existing.reduce((s, r) => s + r.capacity_percent, 0);
  const wouldBeTotal = currentSum + newOpCapacityPercent;
  if (Math.abs(wouldBeTotal - 100) <= 0.01) return newOpCapacityPercent;
  if (wouldBeTotal <= 100) return newOpCapacityPercent;
  const n = existing.length + 1;
  const perOp = Math.round((100 / n) * 100) / 100;
  db.prepare('UPDATE operations SET capacity_percent = ? WHERE machine_id = ? AND project_id = ?').run(perOp, machineId, projectId);
  return perOp;
}

function findMatchingSetOperation(projectId: number, machineId: number, phaseId: number, sortedPartIds: number[]): number | undefined {
  const rows = db
    .prepare(
      `SELECT o.id FROM operations o
       WHERE o.project_id = ? AND o.machine_id = ? AND o.phase_id = ?
         AND COALESCE(o.is_set, 0) = 1 AND o.split_from_operation_id IS NULL`
    )
    .all(projectId, machineId, phaseId) as { id: number }[];
  const key = sortedPartIds.join(',');
  for (const r of rows) {
    const mids = db.prepare('SELECT part_id FROM operation_set_members WHERE operation_id = ? ORDER BY part_id').all(r.id) as { part_id: number }[];
    if (mids.map((m) => m.part_id).join(',') === key) return r.id;
  }
  return undefined;
}

function oeePercentDisplay(oee: number | null | undefined): number | '' {
  if (oee == null || !Number.isFinite(Number(oee))) return '';
  return Math.round(Number(oee) * 100);
}

/** Normalizacja nazwy fazy z Excela (spacje, NBSP) — klucz bez rozróżniania wielkości liter. */
function normalizePhaseNameForImport(raw: unknown): { display: string; key: string } | null {
  const display = cellStr(raw)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const key = display.toLowerCase();
  if (!key) return null;
  return { display, key };
}

function phaseIdFromRow(row: Record<string, unknown> | undefined): number | null {
  if (row == null) return null;
  const id = Number(row.id ?? row.ID);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Nazwa fazy wyłącznie z kolumny fazy (nazwa_fazy / skrót nazwa_faz) — nie z innych pól wiersza. */
function phaseNormFromOperationRow(row: Record<string, unknown>): { display: string; key: string } | null {
  const candidates: unknown[] = [row.nazwa_fazy, row.nazwa_faz, row.nazwa_faze, row.faza_procesu, row.phase_name];
  for (const c of candidates) {
    const norm = normalizePhaseNameForImport(c);
    if (norm) return norm;
  }
  return null;
}

function reloadPhaseByNameLc(phaseByNameLc: Map<string, number>): void {
  phaseByNameLc.clear();
  for (const ph of db.prepare('SELECT id, name FROM process_phases').all() as { id?: unknown; name: string }[]) {
    const norm = normalizePhaseNameForImport(ph.name);
    const id = phaseIdFromRow(ph);
    if (norm && id != null) phaseByNameLc.set(norm.key, id);
  }
}

/** Wstawia brakujące fazy tylko z wierszy operacji, które przejdą import (nie z pustych wierszy arkusza). */
function ensurePhasesFromOperationRows(
  rows: Record<string, unknown>[],
  projectByKey: Map<string, number>,
  phaseByNameLc: Map<string, number>,
  counts: Extract<DataImportResult, { ok: true }>['counts'],
  warnings: string[]
): void {
  const insertPhase = db.prepare('INSERT INTO process_phases (name) VALUES (?)');
  const pending: { key: string; display: string }[] = [];

  for (const row of rows) {
    if (!operationRowReadyForImport(row, projectByKey)) continue;
    const norm = phaseNormFromOperationRow(row);
    if (!norm || phaseByNameLc.has(norm.key)) continue;
    if (pending.some((p) => p.key === norm.key)) continue;
    pending.push(norm);
  }
  if (pending.length === 0) return;

  const beforeKeys = new Set(phaseByNameLc.keys());
  for (const { display } of pending) {
    try {
      insertPhase.run(display);
    } catch {
      /* np. UNIQUE */
    }
  }
  reloadPhaseByNameLc(phaseByNameLc);

  const created: string[] = [];
  const failed: string[] = [];
  for (const { key, display } of pending) {
    if (!phaseByNameLc.has(key)) {
      failed.push(display);
      continue;
    }
    if (!beforeKeys.has(key)) {
      counts.phases_created++;
      created.push(display);
    }
  }
  if (created.length > 0) {
    warnings.push(`Dodano fazy procesu z arkusza Operacje: ${created.join(', ')}.`);
  }
  if (failed.length > 0) {
    warnings.push(`Nie udało się dodać faz: ${failed.join(', ')}.`);
  }
}

function lookupDesignationIdForImport(
  pick: 'sap' | 'alias',
  raw: string,
  designationBySap: Map<string, number>,
  designationByAliasLc: Map<string, number>
): number | null {
  if (pick === 'sap') {
    const sap = normalizeSap(raw);
    if (!sap) return null;
    return designationBySap.get(sap.toLowerCase()) ?? null;
  }
  const a = raw.trim().toLowerCase();
  if (!a) return null;
  return designationByAliasLc.get(a) ?? null;
}

function defaultMachineType(): string {
  const row = db.prepare('SELECT name FROM machine_types ORDER BY name LIMIT 1').get() as { name?: string } | undefined;
  if (row?.name) return String(row.name);
  return 'Import';
}

function sheetRows(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  if (!wb.SheetNames.includes(name)) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], {
    defval: null,
    raw: true,
  } as XLSX.Sheet2JSONOpts);
}

function buildQuickPathAoa(): (string | number | null)[][] {
  return [
    ['Ścieżka minimum — żeby detal pojawił się w kalkulatorze'],
    [],
    ['Bez wiersza w arkuszu „Operacje” kalkulator pokazuje 0% obciążenia (wolumeny same w sobie nie liczą czasu na maszynie).'],
    [],
    ['Krok', 'Arkusz', 'Uzupełnij'],
    ['1', 'Projekty', 'klient, nazwa_projektu — ta sama para we wszystkich arkuszach'],
    ['2', 'Detale', 'nr_sap — bez końcówki .0 z Excela (system i tak normalizuje)'],
    ['3', 'Projekt_detal', 'klient, nazwa_projektu, nr_sap_detalu — powiązanie projektu z detalem'],
    [
      '4',
      'Wolumeny',
      'jak wyżej — po imporcie detal ma „Własna wartość” (prod. i kontrakt) oraz wpisy roczne z Excela',
    ],
    [
      '5',
      'Operacje',
      'jak formularz: tryb pojedynczy|set, wybor_po sap|alias, identyfikator_detalu lub detale_set + detal_zrodlowy_wolumenu, numer_maszyny, nazwa_fazy, czas_cykl_s, gniazda, opcjonalnie oee_procent',
    ],
    ['—', 'Maszyny', 'tylko gdy dodajesz nową maszynę: numer_maszyny, typ, status'],
    [],
    ['Nazwy faz (kolumna nazwa_fazy lub skrócony nagłówek nazwa_faz): brakujące fazy są dodawane automatycznie przed importem operacji.'],
  ];
}

function buildReadmeAoa(): (string | number | null)[][] {
  let phasesLine = '(brak faz w bazie — ustawienia faz)';
  try {
    const phases = db.prepare('SELECT name FROM process_phases ORDER BY id').all() as { name: string }[];
    if (phases.length) phasesLine = phases.map((p) => p.name).join(', ');
  } catch {
    /* ignore */
  }

  return [
    [
      `Capacity — import danych wejściowych (Excel) · szablon ${CAPACITY_DATA_IMPORT_SCHEMA_TAG} — arkusz „Operacje” jak formularz operacji w aplikacji`,
    ],
    [],
    ['Dlaczego sam Excel ze „Wolumenami” nie pokazuje się w kalkulatorze?'],
    [
      'Kalkulator liczy obciążenie maszyn wyłącznie z operacji: detal musi mieć co najmniej jeden wiersz w arkuszu „Operacje” (maszyna + faza procesu + czas cyklu). Arkusz „Wolumeny” ustala ile sztuk rocznie; bez operacji obciążenie = 0%.',
    ],
    [],
    ['Minimalna ścieżka dla NOWEGO detalu (wszystkie arkusze oprócz Maszyny, jeśli maszyna już jest w bazie)'],
    ['1. Projekty — klient + nazwa_projektu'],
    ['2. Detale — nr_sap (ten sam format co w SAP; Excel bez końcówki .0)'],
    ['3. Projekt_detal — ta sama para klient/projekt co wyżej + nr_sap_detalu'],
    ['4. Wolumeny — klient, projekt, nr_sap_detalu, rok, wartosc, jednostka (np. annual)'],
    [
      '5. Operacje — jeden arkusz jak formularz operacji: tryb (pojedynczy/set), wybor_po (sap|alias), identyfikator lub detale_set, maszyna wewnętrzna, faza, cykl, gniazda, opcjonalnie OEE %, wolumen szablonowy, udział %, sap/opis operacji',
    ],
    [],
    ['Fazy procesu (process_phases) — istniejące w bazie lub nowe z Excela (tworzone automatycznie przy imporcie operacji):'],
    [phasesLine],
    [],
    ['Przeznaczenie'],
    ['Uzupełnij arkusze i wgraj plik w Administracja → Ustawienia administracyjne → Import danych wejściowych.'],
    [
      'Import domyślnie DODAJE i AKTUALIZUJE dane z pliku (rekordy już w bazie, których nie ma w Excelu, pozostają). Operacje z arkusza „Operacje” są tworzone, gdy nie ma ich w systemie; brakujące fazy procesu mogą zostać dodane automatycznie. Opcjonalnie w UI można włączyć tryb „zastąp całą bazę” (usuwa rekordy spoza pliku). Przed importem system tworzy automatyczną kopię bazy.',
    ],
    [],
    ['Arkusze (nie zmieniaj nazw arkuszy ani nagłówków w pierwszym wierszu)'],
    ['• Maszyny — numer_maszyny (wym.), numer_sap_maszyny, typ, status, opcjonalnie szerokosc, glebokosc, wysokosc, skok [mm]'],
    ['• Projekty — klient, nazwa_projektu (wym.), sop, eop, status'],
    ['• Detale — nr_sap (wym.), alias, free_text'],
    ['• Projekt_detal — klient, nazwa_projektu, nr_sap_detalu (powiązanie projektu z detalem)'],
    ['• Wolumeny — klient, nazwa_projektu, nr_sap_detalu, rok, wartosc, jednostka (annual / monthly / weekly; domyślnie annual)'],
    ['• Operacje — jedna zakładka: jak przy dodawaniu operacji (projekt + tryb pojedynczy lub set + SAP lub Alias + maszyna + faza + cykl + gniazda + opcjonalnie OEE %, udział obciążenia %, tekst SAP/opis); dopasowanie detalu i zestawów po stronie serwera'],
    [],
    ['Kolejność przetwarzania'],
    ['Maszyny → Projekty → Detale → Projekt_detal → Wolumeny → Operacje'],
    [],
    ['Uwagi'],
    ['• Projekt identyfikowany po parze klient + nazwa_projektu (bez rozróżniania wielkości liter).'],
    ['• Detal identyfikowany po nr_sap (normalizacja jak w aplikacji — bez .0 z Excela).'],
    [
      '• Wolumeny (arkusz Wolumeny) zapisują wartości w widoku „Własna wartość” zarówno dla produkcji, jak i kontraktu (tabele part_volume_by_year oraz part_volume_contract_by_year); ustawiany jest tryb override dla obu.',
    ],
    ['• Wolumen zapisywany jest dla części (projekt + detal); można najpierw dodać wiersz w Projekt_detal lub pozwolić, aby utworzyła go pierwsza operacja/wolumen.'],
    ['• Stary układ bez nowych kolumn: wystarczy nr_sap_detalu zamiast identyfikator_detalu (domyślnie wybor_po=sap, tryb=pojedynczy).'],
    [
      '• Dopasowanie operacji: pojedyncza — ten sam projekt + detal + maszyna + faza; set — ta sama kombinacja projekt + maszyna + faza oraz identyczna lista detali (kolejny import nadpisuje cykl, gniazda, OEE, wolumen szablonowy, członków setu).',
    ],
    ['• Potwierdzenie importu: wpisz IMPORTUJ_DANE'],
  ];
}

/** Szablon z aktualnymi danymi w czytelnych kolumnach. */
export function buildCapacityDataImportTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildReadmeAoa()), README_SHEET);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildQuickPathAoa()), SHEET_QUICK_PATH);

  const machines = db
    .prepare(
      `SELECT internal_number, sap_number, type, status, width_mm, depth_mm, height_mm, stroke_mm FROM machines ORDER BY internal_number`
    )
    .all() as {
    internal_number: string;
    sap_number: string | null;
    type: string;
    status: string;
    width_mm: number | null;
    depth_mm: number | null;
    height_mm: number | null;
    stroke_mm: number | null;
  }[];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['numer_maszyny', 'numer_sap_maszyny', 'typ', 'status', 'szerokosc', 'glebokosc', 'wysokosc', 'skok'],
      ...machines.map((m) => [
        excelExportCell(m.internal_number) ?? '',
        excelExportCell(m.sap_number) ?? '',
        m.type,
        m.status ?? 'active',
        m.width_mm ?? '',
        m.depth_mm ?? '',
        m.height_mm ?? '',
        m.stroke_mm ?? '',
      ]),
    ]),
    SHEET_MACHINES
  );

  const projects = db.prepare(`SELECT client, name, sop, eop, status FROM projects ORDER BY client, name`).all() as {
    client: string;
    name: string;
    sop: string;
    eop: string;
    status: string;
  }[];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['klient', 'nazwa_projektu', 'sop', 'eop', 'status'],
      ...projects.map((p) => [p.client, p.name, formatSopEop(p.sop), formatSopEop(p.eop), p.status ?? 'active']),
    ]),
    SHEET_PROJECTS
  );

  const designations = db
    .prepare(`SELECT sap_number, alias, free_text FROM part_designations ORDER BY COALESCE(sap_number, alias)`)
    .all() as { sap_number: string | null; alias: string | null; free_text: string | null }[];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['nr_sap', 'alias', 'free_text'],
      ...designations.map((d) => [excelExportCell(d.sap_number) ?? '', d.alias ?? '', d.free_text ?? '']),
    ]),
    SHEET_DETAILS
  );

  const links = db
    .prepare(
      `
    SELECT pr.client, pr.name AS project_name, pd.sap_number AS nr_sap
    FROM parts pt
    JOIN projects pr ON pr.id = pt.project_id
    LEFT JOIN part_designations pd ON pd.id = pt.designation_id
    ORDER BY pr.client, pr.name, pd.sap_number
  `
    )
    .all() as { client: string; project_name: string; nr_sap: string | null }[];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['klient', 'nazwa_projektu', 'nr_sap_detalu'],
      ...links.map((r) => [r.client, r.project_name, excelExportCell(r.nr_sap) ?? '']),
    ]),
    SHEET_LINKS
  );

  const volumes = db
    .prepare(
      `
    SELECT pr.client, pr.name AS project_name, pd.sap_number AS nr_sap, v.year, v.volume_value, v.volume_unit
    FROM part_volume_by_year v
    JOIN parts pt ON pt.id = v.part_id
    JOIN projects pr ON pr.id = pt.project_id
    LEFT JOIN part_designations pd ON pd.id = pt.designation_id
    ORDER BY pr.client, pr.name, v.year
  `
    )
    .all() as {
    client: string;
    project_name: string;
    nr_sap: string | null;
    year: number;
    volume_value: number;
    volume_unit: string;
  }[];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['klient', 'nazwa_projektu', 'nr_sap_detalu', 'rok', 'wartosc', 'jednostka'],
      ...volumes.map((r) => [
        r.client,
        r.project_name,
        excelExportCell(r.nr_sap) ?? '',
        excelExportCell(r.year) ?? '',
        excelExportCell(r.volume_value) ?? '',
        r.volume_unit,
      ]),
    ]),
    SHEET_VOLUMES
  );

  const OPERATIONS_HEADERS = [
    'klient',
    'nazwa_projektu',
    'tryb',
    'wybor_po',
    'identyfikator_detalu',
    'detale_set',
    'detal_zrodlowy_wolumenu',
    'numer_maszyny',
    'nazwa_fazy',
    'czas_cykl_s',
    'gniazda',
    'oee_procent',
    'wolumen_szablon',
    'jednostka',
    'udzial_obciazenia_procent',
    'sap_operacji',
    'opis',
  ];

  const designationForPartStmt = db.prepare(`
    SELECT pd.sap_number AS nr_sap, pd.alias AS alias_det
    FROM parts pt
    LEFT JOIN part_designations pd ON pd.id = pt.designation_id
    WHERE pt.id = ?
  `);

  const singleOps = db
    .prepare(
      `
    SELECT pr.client, pr.name AS project_name, pd.sap_number AS nr_sap, pd.alias AS alias_det,
           m.internal_number AS numer_maszyny,
           ph.name AS nazwa_fazy, o.cycle_time_seconds AS czas_cykl_s, o.nests_count AS gniazda,
           o.volume_value AS wolumen_szablon, o.volume_unit AS jednostka,
           o.oee_override AS oee_override, o.capacity_percent AS cap_pct, o.sap AS sap_operacji, o.description AS opis
    FROM operations o
    JOIN projects pr ON pr.id = o.project_id
    JOIN parts pt ON pt.id = o.part_id
    LEFT JOIN part_designations pd ON pd.id = pt.designation_id
    JOIN machines m ON m.id = o.machine_id
    JOIN process_phases ph ON ph.id = o.phase_id
    WHERE o.split_from_operation_id IS NULL AND COALESCE(o.is_set, 0) = 0
    ORDER BY pr.client, pr.name, pd.sap_number, m.internal_number, ph.name
  `
    )
    .all() as {
    client: string;
    project_name: string;
    nr_sap: string | null;
    alias_det: string | null;
    numer_maszyny: string;
    nazwa_fazy: string;
    czas_cykl_s: number;
    gniazda: number;
    wolumen_szablon: number;
    jednostka: string;
    oee_override: number | null;
    cap_pct: number;
    sap_operacji: string | null;
    opis: string | null;
  }[];

  const operationSheetRows: (string | number | null)[][] = [];

  for (const r of singleOps) {
    const sap = normalizeSap(r.nr_sap);
    const wybor = sap ? 'sap' : 'alias';
    const identRaw = sap || cellStr(r.alias_det);
    operationSheetRows.push([
      r.client,
      r.project_name,
      'pojedynczy',
      wybor,
      identRaw ? (wybor === 'sap' ? (excelExportCell(sap) ?? identRaw) : identRaw) : '',
      '',
      '',
      excelExportCell(r.numer_maszyny) ?? '',
      r.nazwa_fazy,
      excelExportCell(r.czas_cykl_s) ?? '',
      excelExportCell(r.gniazda) ?? '',
      oeePercentDisplay(r.oee_override),
      excelExportCell(r.wolumen_szablon) ?? '',
      r.jednostka,
      excelExportCell(r.cap_pct) ?? '',
      r.sap_operacji ?? '',
      r.opis ?? '',
    ]);
  }

  const setOps = db
    .prepare(
      `
    SELECT o.id AS op_id, pr.client, pr.name AS project_name,
           m.internal_number AS numer_maszyny,
           ph.name AS nazwa_fazy, o.cycle_time_seconds AS czas_cykl_s, o.nests_count AS gniazda,
           o.volume_value AS wolumen_szablon, o.volume_unit AS jednostka,
           o.oee_override AS oee_override, o.capacity_percent AS cap_pct, o.sap AS sap_operacji, o.description AS opis,
           o.part_id AS volume_part_id
    FROM operations o
    JOIN projects pr ON pr.id = o.project_id
    JOIN machines m ON m.id = o.machine_id
    JOIN process_phases ph ON ph.id = o.phase_id
    WHERE o.split_from_operation_id IS NULL AND COALESCE(o.is_set, 0) = 1
    ORDER BY pr.client, pr.name, o.id
  `
    )
    .all() as {
    op_id: number;
    client: string;
    project_name: string;
    numer_maszyny: string;
    nazwa_fazy: string;
    czas_cykl_s: number;
    gniazda: number;
    wolumen_szablon: number;
    jednostka: string;
    oee_override: number | null;
    cap_pct: number;
    sap_operacji: string | null;
    opis: string | null;
    volume_part_id: number;
  }[];

  const memberPartIdsStmt = db.prepare(
    `SELECT part_id FROM operation_set_members WHERE operation_id = ? ORDER BY part_id`
  );

  for (const r of setOps) {
    const pRows = memberPartIdsStmt.all(r.op_id) as { part_id: number }[];
    const tokens: string[] = [];
    let volTok = '';
    let anySap = false;
    for (const { part_id } of pRows) {
      const dl = designationForPartStmt.get(part_id) as { nr_sap: string | null; alias_det: string | null } | undefined;
      const sap = normalizeSap(dl?.nr_sap ?? '');
      const piece = sap || cellStr(dl?.alias_det ?? '');
      if (sap) anySap = true;
      tokens.push(piece);
      if (part_id === r.volume_part_id) volTok = piece;
    }
    const wybor = anySap ? 'sap' : 'alias';
    operationSheetRows.push([
      r.client,
      r.project_name,
      'set',
      wybor,
      '',
      tokens.join('; '),
      volTok,
      excelExportCell(r.numer_maszyny) ?? '',
      r.nazwa_fazy,
      excelExportCell(r.czas_cykl_s) ?? '',
      excelExportCell(r.gniazda) ?? '',
      oeePercentDisplay(r.oee_override),
      excelExportCell(r.wolumen_szablon) ?? '',
      r.jednostka,
      excelExportCell(r.cap_pct) ?? '',
      r.sap_operacji ?? '',
      r.opis ?? '',
    ]);
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([OPERATIONS_HEADERS, ...operationSheetRows]), SHEET_OPERATIONS);

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function importCapacityDataFromBuffer(
  buf: Buffer,
  options?: { mode?: CapacityDataImportMode }
): DataImportResult {
  const mode: CapacityDataImportMode = options?.mode === 'replace' ? 'replace' : 'merge';
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'buffer' });
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Niepoprawny plik Excel.' };
  }

  const missing = REQUIRED_SHEETS.filter((s) => !wb.SheetNames.includes(s));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Brak wymaganych arkuszy: ${missing.join(', ')}. Pobierz szablon „Import danych wejściowych”.`,
    };
  }

  const counts = {
    machines_created: 0,
    machines_updated: 0,
    machines_deleted: 0,
    projects_created: 0,
    projects_updated: 0,
    projects_deleted: 0,
    designations_created: 0,
    designations_updated: 0,
    designations_deleted: 0,
    parts_created: 0,
    parts_skipped: 0,
    parts_deleted: 0,
    volumes_upserted: 0,
    volumes_deleted: 0,
    operations_created: 0,
    operations_updated: 0,
    operations_deleted: 0,
    phases_created: 0,
  };
  const warnings: string[] = [];

  const syncState: DataImportSyncState = {
    importedMachineInternals: new Set(),
    importedProjectKeys: new Set(),
    importedDesignationIds: new Set(),
    importedPartKeys: new Set(),
    projektDetalPartKeys: new Set(),
    importedVolumeKeys: new Set(),
    keptOperationIds: new Set(),
  };

  const projectByKey = new Map<string, number>();
  for (const p of db.prepare('SELECT id, client, name FROM projects').all() as { id: number; client: string; name: string }[]) {
    projectByKey.set(projectKey(p.client, p.name), p.id);
  }

  const designationBySap = new Map<string, number>();
  for (const d of db.prepare('SELECT id, sap_number FROM part_designations').all() as { id: number; sap_number: string | null }[]) {
    const sap = normalizeSap(d.sap_number);
    if (sap) designationBySap.set(sap.toLowerCase(), d.id);
  }

  const designationByAliasLc = new Map<string, number>();
  for (const d of db
    .prepare(`SELECT id, alias FROM part_designations WHERE alias IS NOT NULL AND LENGTH(TRIM(alias)) > 0`)
    .all() as { id: number; alias: string }[]) {
    designationByAliasLc.set(d.alias.trim().toLowerCase(), d.id);
  }

  const partByProjectDes = new Map<string, number>();
  for (const r of db
    .prepare('SELECT id, project_id, designation_id FROM parts WHERE designation_id IS NOT NULL')
    .all() as { id: number; project_id: number; designation_id: number }[]) {
    partByProjectDes.set(`${r.project_id}:${r.designation_id}`, r.id);
  }

  const insertMachine = db.prepare(
    `INSERT INTO machines (internal_number, sap_number, type, oee_override, status, location, machine_usage, width_mm, depth_mm, height_mm, stroke_mm)
     VALUES (?, ?, ?, NULL, ?, NULL, 1, ?, ?, ?, ?)`
  );
  const updateMachine = db.prepare(
    `UPDATE machines SET sap_number = ?, type = ?, status = ?, width_mm = ?, depth_mm = ?, height_mm = ?, stroke_mm = ? WHERE internal_number = ?`
  );
  const insertProject = db.prepare(
    `INSERT INTO projects (client, name, sop, eop, status) VALUES (?, ?, ?, ?, ?)`
  );
  const updateProject = db.prepare(
    `UPDATE projects SET client = ?, name = ?, sop = ?, eop = ?, status = ? WHERE id = ?`
  );
  const insertDesignation = db.prepare(
    `INSERT INTO part_designations (designation, sap_number, alias, free_text) VALUES (?, ?, ?, ?)`
  );
  const updateDesignation = db.prepare(
    `UPDATE part_designations SET designation = ?, alias = ?, free_text = ? WHERE id = ?`
  );
  const insertPart = db.prepare(
    `INSERT INTO parts (project_id, designation, side, designation_id) VALUES (?, ?, NULL, ?)`
  );
  const upsertVolume = db.prepare(
    `INSERT INTO part_volume_by_year (part_id, year, volume_value, volume_unit) VALUES (?, ?, ?, ?)
     ON CONFLICT(part_id, year) DO UPDATE SET volume_value = excluded.volume_value, volume_unit = excluded.volume_unit`
  );
  const upsertVolumeContract = db.prepare(
    `INSERT INTO part_volume_contract_by_year (part_id, year, volume_value, volume_unit) VALUES (?, ?, ?, ?)
     ON CONFLICT(part_id, year) DO UPDATE SET volume_value = excluded.volume_value, volume_unit = excluded.volume_unit`
  );
  const markPartVolumeOwnOverride = db.prepare(
    `UPDATE parts SET volume_mode = 'override', contract_volume_mode = 'override' WHERE id = ?`
  );

  const findOperationNatural = db.prepare(`
    SELECT id FROM operations
    WHERE project_id = ? AND part_id = ? AND machine_id = ? AND phase_id = ?
      AND split_from_operation_id IS NULL AND COALESCE(is_set, 0) = 0
    LIMIT 1
  `);
  const insertOperationFull = db.prepare(`
    INSERT INTO operations (project_id, part_id, phase_id, machine_id, cycle_time_seconds, volume_value, volume_unit, nests_count, oee_override, capacity_percent, opf, sap, description, is_set,
      alt_cycle_time_seconds, alt_nests_count, alt_oee_override, alt_comment, use_alternative_in_calculator)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 0)
  `);
  const updateOperationFull = db.prepare(`
    UPDATE operations SET cycle_time_seconds = ?, nests_count = ?, volume_value = ?, volume_unit = ?, oee_override = ?, capacity_percent = ?, sap = ?, description = ?
    WHERE id = ?
  `);
  const deleteSetMembers = db.prepare('DELETE FROM operation_set_members WHERE operation_id = ?');
  const insertSetMember = db.prepare(
    'INSERT INTO operation_set_members (operation_id, part_id, quantity_per_set) VALUES (?, ?, 1)'
  );

  const selectMachineByInternal = db.prepare('SELECT id FROM machines WHERE internal_number = ?');

  const phaseByNameLc = new Map<string, number>();
  for (const ph of db.prepare('SELECT id, name FROM process_phases').all() as { id: number; name: string }[]) {
    const norm = normalizePhaseNameForImport(ph.name);
    if (norm) phaseByNameLc.set(norm.key, ph.id);
  }
  const defaultType = defaultMachineType();

  try {
    db.prepare('BEGIN TRANSACTION').run();

    const machineRows = sheetRows(wb, SHEET_MACHINES);
    const typesToEnsure: string[] = [];
    for (const row of machineRows) {
      const internal = cellInternalMachineNumber(row.numer_maszyny ?? row.internal_number);
      if (internal == null) continue;
      const rowType = cellStr(row.typ ?? row.type);
      typesToEnsure.push(rowType || defaultType);
    }
    const addedMachineTypes = ensureMachineTypesExist(typesToEnsure);
    if (addedMachineTypes.length > 0) {
      warnings.push(`Dodano typy maszyn z arkusza Maszyny: ${addedMachineTypes.join(', ')}.`);
    }

    for (let i = 0; i < machineRows.length; i++) {
      const row = machineRows[i];
      const internal = cellInternalMachineNumber(row.numer_maszyny ?? row.internal_number);
      if (internal == null) continue;
      const sap = normalizeSap(row.numer_sap_maszyny ?? row.sap_number) || String(internal);
      let type = cellStr(row.typ ?? row.type);
      if (!type) type = defaultType;
      const status = normalizeMachineStatus(row.status);
      const dims = dimensionsFromImportRow(row);
      const existing = db.prepare('SELECT id, width_mm, depth_mm, height_mm, stroke_mm FROM machines WHERE internal_number = ?').get(internal) as
        | { id: number; width_mm: number | null; depth_mm: number | null; height_mm: number | null; stroke_mm: number | null }
        | undefined;
      syncState.importedMachineInternals.add(internal);
      if (existing) {
        updateMachine.run(
          sap,
          type,
          status,
          dims.width_mm !== undefined ? dims.width_mm : existing.width_mm,
          dims.depth_mm !== undefined ? dims.depth_mm : existing.depth_mm,
          dims.height_mm !== undefined ? dims.height_mm : existing.height_mm,
          dims.stroke_mm !== undefined ? dims.stroke_mm : existing.stroke_mm,
          internal
        );
        counts.machines_updated++;
      } else {
        insertMachine.run(internal, sap, type, status, dims.width_mm ?? null, dims.depth_mm ?? null, dims.height_mm ?? null, dims.stroke_mm ?? null);
        counts.machines_created++;
      }
    }

    const projectRows = sheetRows(wb, SHEET_PROJECTS);
    for (let i = 0; i < projectRows.length; i++) {
      const row = projectRows[i];
      const client = cellStr(row.klient ?? row.client);
      const name = cellStr(row.nazwa_projektu ?? row.name);
      if (!client || !name) continue;
      const sop = formatSopEop(row.sop ?? '1.2025');
      const eop = formatSopEop(row.eop ?? '12.2036');
      const status = normalizeProjectStatus(row.status);
      const key = projectKey(client, name);
      syncState.importedProjectKeys.add(key);
      const existingId = projectByKey.get(key);
      if (existingId != null) {
        updateProject.run(client, name, sop, eop, status, existingId);
        counts.projects_updated++;
      } else {
        const r = insertProject.run(client, name, sop, eop, status);
        const id = Number(r.lastInsertRowid);
        projectByKey.set(key, id);
        counts.projects_created++;
      }
    }

    const detailRows = sheetRows(wb, SHEET_DETAILS);
    for (let i = 0; i < detailRows.length; i++) {
      const row = detailRows[i];
      const sap = normalizeSap(row.nr_sap ?? row.sap_number);
      if (!sap) continue;
      const alias = cellStr(row.alias) || null;
      const freeText = cellStr(row.free_text) || null;
      const designation = sap || alias || freeText || '-';
      const sapKey = sap.toLowerCase();
      const existingId = designationBySap.get(sapKey);
      if (existingId != null) {
        updateDesignation.run(designation, alias, freeText, existingId);
        syncState.importedDesignationIds.add(existingId);
        counts.designations_updated++;
        if (alias) designationByAliasLc.set(alias.trim().toLowerCase(), existingId);
      } else {
        const r = insertDesignation.run(designation, sap, alias, freeText);
        const id = Number(r.lastInsertRowid);
        designationBySap.set(sapKey, id);
        syncState.importedDesignationIds.add(id);
        if (alias) designationByAliasLc.set(alias.trim().toLowerCase(), id);
        counts.designations_created++;
      }
    }

    const linkRows = sheetRows(wb, SHEET_LINKS);
    for (let i = 0; i < linkRows.length; i++) {
      const row = linkRows[i];
      const client = cellStr(row.klient ?? row.client);
      const name = cellStr(row.nazwa_projektu ?? row.name);
      const sap = normalizeSap(row.nr_sap_detalu ?? row.nr_sap);
      if (!client || !name || !sap) continue;
      const projectId = projectByKey.get(projectKey(client, name));
      if (projectId == null) {
        warnings.push(`Projekt_detal wiersz ${i + 2}: brak projektu „${client} — ${name}”.`);
        continue;
      }
      const designationId = designationBySap.get(sap.toLowerCase());
      if (designationId == null) {
        warnings.push(`Projekt_detal wiersz ${i + 2}: brak detalu SAP „${sap}”.`);
        continue;
      }
      const pk = `${projectId}:${designationId}`;
      syncState.importedPartKeys.add(pk);
      syncState.projektDetalPartKeys.add(pk);
      if (partByProjectDes.has(pk)) {
        counts.parts_skipped++;
        continue;
      }
      const r = insertPart.run(projectId, sap, designationId);
      const partId = Number(r.lastInsertRowid);
      partByProjectDes.set(pk, partId);
      counts.parts_created++;
    }

    const volumeImportOwnPartIds = new Set<number>();
    const volumeRows = sheetRows(wb, SHEET_VOLUMES);
    for (let i = 0; i < volumeRows.length; i++) {
      const row = volumeRows[i];
      const client = cellStr(row.klient ?? row.client);
      const name = cellStr(row.nazwa_projektu ?? row.name);
      const sap = normalizeSap(row.nr_sap_detalu ?? row.nr_sap);
      const year = cellNum(row.rok ?? row.year);
      const value = cellNum(row.wartosc ?? row.volume_value);
      if (!client || !name || !sap || year == null || value == null) continue;
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        warnings.push(`Wolumeny wiersz ${i + 2}: nieprawidłowy rok.`);
        continue;
      }
      const unit = normalizeVolumeUnit(row.jednostka ?? row.volume_unit);
      if (!unit) {
        warnings.push(`Wolumeny wiersz ${i + 2}: jednostka musi być annual, monthly lub weekly.`);
        continue;
      }
      const projectId = projectByKey.get(projectKey(client, name));
      if (projectId == null) {
        warnings.push(`Wolumeny wiersz ${i + 2}: brak projektu „${client} — ${name}”.`);
        continue;
      }
      const designationId = designationBySap.get(sap.toLowerCase());
      if (designationId == null) {
        warnings.push(`Wolumeny wiersz ${i + 2}: brak detalu SAP „${sap}”.`);
        continue;
      }
      let partId = partByProjectDes.get(`${projectId}:${designationId}`);
      if (partId == null) {
        const r = insertPart.run(projectId, sap, designationId);
        partId = Number(r.lastInsertRowid);
        partByProjectDes.set(`${projectId}:${designationId}`, partId);
        counts.parts_created++;
      }
      syncState.importedPartKeys.add(`${projectId}:${designationId}`);
      syncState.importedVolumeKeys.add(`${partId}:${year}`);
      upsertVolume.run(partId, year, value, unit);
      upsertVolumeContract.run(partId, year, value, unit);
      volumeImportOwnPartIds.add(partId);
      counts.volumes_upserted++;
    }
    for (const pid of volumeImportOwnPartIds) {
      markPartVolumeOwnOverride.run(pid);
    }

    if (wb.SheetNames.includes(SHEET_OPERATIONS)) {
      designationByAliasLc.clear();
      for (const d of db
        .prepare(`SELECT id, alias FROM part_designations WHERE alias IS NOT NULL AND LENGTH(TRIM(alias)) > 0`)
        .all() as { id: number; alias: string }[]) {
        designationByAliasLc.set(d.alias.trim().toLowerCase(), d.id);
      }

      const operationRows = sheetRows(wb, SHEET_OPERATIONS);
      ensurePhasesFromOperationRows(operationRows, projectByKey, phaseByNameLc, counts, warnings);

      for (let i = 0; i < operationRows.length; i++) {
        const row = operationRows[i];
        const rowTag = `Operacje wiersz ${i + 2}`;
        if (!operationRowReadyForImport(row, projectByKey)) {
          const hasAny =
            cellStr(row.klient ?? row.client) ||
            cellStr(row.nazwa_projektu ?? row.name) ||
            cellInternalMachineNumber(row.numer_maszyny ?? row.internal_number) != null ||
            phaseNormFromOperationRow(row) != null ||
            cellStr(row.identyfikator_detalu ?? row.identyfikator ?? '');
          if (hasAny) {
            warnings.push(
              `${rowTag}: pominięto — uzupełnij klient (lub jednoznaczną nazwa_projektu), numer_maszyny, nazwa_fazy i czas_cykl_s > 0.`
            );
          }
          continue;
        }

        const internal = cellInternalMachineNumber(row.numer_maszyny ?? row.internal_number)!;
        const phaseNorm = phaseNormFromOperationRow(row)!;

        const cycleRaw = cellNum(row.czas_cykl_s ?? row.cycle_time_seconds ?? row.cykl_s);
        if (cycleRaw == null || cycleRaw <= 0) {
          warnings.push(`${rowTag}: ustaw czas cyklu (czas_cykl_s) większy od zera.`);
          continue;
        }
        const cycleSeconds = Math.max(1, Math.round(cycleRaw));

        let nests = cellNum(row.gniazda ?? row.nests_count ?? row.nests);
        if (nests == null || nests <= 0) nests = 1;
        nests = Math.max(1, Math.round(nests));

        const volRaw = cellNum(row.wolumen_szablon ?? row.volume_value);
        const volFromExcelEmpty = volRaw == null || volRaw <= 0;
        let volVal = volFromExcelEmpty ? 1 : volRaw;
        const volUnitResolved = normalizeVolumeUnit(row.jednostka ?? row.volume_unit ?? row.jednostka_szablonu) ?? 'annual';

        const oeeOverride = parseOeeOverride(row.oee_procent ?? row.oee_pct ?? row.oee);

        let capPct = cellNum(row.udzial_obciazenia_procent ?? row.capacity_percent ?? row.capacity_pct);
        if (capPct == null || capPct <= 0) capPct = 100;
        capPct = Math.min(100, Math.max(0.01, capPct));

        const sapOp = cellStr(row.sap_operacji ?? row.operation_sap) || null;
        const descOp = cellStr(row.opis ?? row.description) || null;

        const wyborPo = normalizeDetailPick(row.wybor_po ?? row.wybór_po ?? row.wybor_detalu);
        const tryb = normalizeOperationKind(row.tryb ?? row.tryb_operacji ?? row.rodzaj);

        const hasNewCols = Boolean(
          cellStr(row.tryb) ||
            cellStr(row.wybor_po) ||
            cellStr(row.identyfikator_detalu) ||
            cellStr(row.identyfikator) ||
            cellStr(row.detale_set ?? row.detale_w_secie) ||
            cellStr(row.detal_zrodlowy_wolumenu ?? row.detal_zrodlowy) ||
            cellNum(row.oee_procent ?? row.oee_pct ?? row.oee) != null ||
            cellStr(row.sap_operacji) ||
            cellStr(row.opis)
        );
        const legacySapOnly = normalizeSap(row.nr_sap_detalu ?? row.nr_sap);

        const projectId = resolveProjectIdForOperationImport(row, projectByKey, warnings, rowTag);
        if (projectId == null) continue;

        const machineRow = selectMachineByInternal.get(internal) as { id: number } | undefined;
        if (!machineRow) {
          warnings.push(`${rowTag}: brak maszyny o numer_maszyny ${internal}.`);
          continue;
        }
        const phaseId = phaseByNameLc.get(phaseNorm.key);
        if (phaseId == null) {
          warnings.push(`${rowTag}: brak fazy „${phaseNorm.display}” w bazie po imporcie — wiersz pominięty.`);
          continue;
        }

        const ensurePart = (pick: 'sap' | 'alias', token: string): number | null => {
          const desId = lookupDesignationIdForImport(pick, token, designationBySap, designationByAliasLc);
          if (desId == null) {
            warnings.push(`${rowTag}: brak detalu (${pick}: „${token}”) — dopisz arkusz Detale.`);
            return null;
          }
          const pk = `${projectId}:${desId}`;
          let pid = partByProjectDes.get(pk);
          if (pid == null) {
            const label = pick === 'sap' ? normalizeSap(token) : token.trim();
            const ins = insertPart.run(projectId, label || '-', desId);
            pid = Number(ins.lastInsertRowid);
            partByProjectDes.set(pk, pid);
            syncState.importedPartKeys.add(pk);
            counts.parts_created++;
          }
          syncState.importedPartKeys.add(pk);
          return pid;
        };

        if (tryb === 'set') {
          const listRaw = cellStr(row.detale_set ?? row.detale_w_secie ?? '');
          const tokens = splitDetailTokens(listRaw);
          const volSrcRaw = cellStr(row.detal_zrodlowy_wolumenu ?? row.detal_zrodlowy ?? '');
          if (tokens.length < 2) {
            warnings.push(`${rowTag}: tryb „set” wymaga co najmniej 2 pozycji w detale_set (separator ; lub ,).`);
            continue;
          }
          const partIds: number[] = [];
          let membersOk = true;
          for (const tok of tokens) {
            const pid = ensurePart(wyborPo, tok);
            if (pid == null) {
              membersOk = false;
              break;
            }
            partIds.push(pid);
          }
          if (!membersOk) continue;

          const sortedIds = [...new Set(partIds)].sort((a, b) => a - b);
          if (sortedIds.length < 2) {
            warnings.push(`${rowTag}: po deduplikacji zostało mniej niż 2 detale — sprawdź detale_set.`);
            continue;
          }

          const volTok = volSrcRaw || tokens[0];
          const volumePartId = ensurePart(wyborPo, volTok);
          if (volumePartId == null) continue;
          if (!sortedIds.includes(volumePartId)) {
            warnings.push(`${rowTag}: detal_zrodlowy_wolumenu musi być jednym z detali w secie.`);
            continue;
          }

          const existingSetOpId = findMatchingSetOperation(projectId, machineRow.id, phaseId, sortedIds);
          if (existingSetOpId != null) {
            updateOperationFull.run(cycleSeconds, nests, volVal, volUnitResolved, oeeOverride, capPct, sapOp, descOp, existingSetOpId);
            deleteSetMembers.run(existingSetOpId);
            for (const pid of sortedIds) insertSetMember.run(existingSetOpId, pid);
            syncState.keptOperationIds.add(existingSetOpId);
            counts.operations_updated++;
          } else {
            const capIns = rebalanceCapacityPercentOnInsert(machineRow.id, projectId, capPct);
            const insOp = insertOperationFull.run(
              projectId,
              volumePartId,
              phaseId,
              machineRow.id,
              cycleSeconds,
              volVal,
              volUnitResolved,
              nests,
              oeeOverride,
              capIns,
              0,
              sapOp,
              descOp,
              1
            );
            const newOpId = Number(insOp.lastInsertRowid);
            for (const pid of sortedIds) insertSetMember.run(newOpId, pid);
            syncState.keptOperationIds.add(newOpId);
            counts.operations_created++;
          }
        } else {
          let ident = cellStr(row.identyfikator_detalu ?? row.identyfikator ?? '');
          if (!ident && !hasNewCols && legacySapOnly) ident = legacySapOnly;
          if (!ident) ident = normalizeSap(row.nr_sap_detalu ?? row.nr_sap);
          if (!ident && wyborPo === 'alias') ident = cellStr(row.alias_detalu ?? '');
          if (!ident) {
            warnings.push(`${rowTag}: pominięto — brak identyfikator_detalu (lub nr_sap_detalu w starym układzie).`);
            continue;
          }
          if (identLooksLikeExcelScientificString(row.identyfikator_detalu ?? row.identyfikator)) {
            warnings.push(
              `${rowTag}: identyfikator_detalu w notacji wykładniczej (${cellStr(row.identyfikator_detalu ?? row.identyfikator)}) — ustaw w Excelu format TEKST z pełnym nr SAP (inaczej zły detal i brak wolumenów).`
            );
          }

          const partId = ensurePart(wyborPo, ident);
          if (partId == null) continue;

          const desIdForWarn = lookupDesignationIdForImport(wyborPo, ident, designationBySap, designationByAliasLc);
          const sapLabel = wyborPo === 'sap' ? normalizeSap(ident) : ident.trim();
          if (desIdForWarn != null) {
            const partKey = `${projectId}:${desIdForWarn}`;
            warnCalculatorVolumeContext(
              rowTag,
              projectId,
              partId,
              partKey,
              sapLabel,
              volFromExcelEmpty,
              syncState,
              warnings
            );
          }

          const existingOpRow = findOperationNatural.get(projectId, partId, machineRow.id, phaseId) as { id: number } | undefined;
          if (existingOpRow) {
            updateOperationFull.run(cycleSeconds, nests, volVal, volUnitResolved, oeeOverride, capPct, sapOp, descOp, existingOpRow.id);
            syncState.keptOperationIds.add(existingOpRow.id);
            counts.operations_updated++;
          } else {
            const capIns = rebalanceCapacityPercentOnInsert(machineRow.id, projectId, capPct);
            const ins = insertOperationFull.run(
              projectId,
              partId,
              phaseId,
              machineRow.id,
              cycleSeconds,
              volVal,
              volUnitResolved,
              nests,
              oeeOverride,
              capIns,
              0,
              sapOp,
              descOp,
              0
            );
            syncState.keptOperationIds.add(Number(ins.lastInsertRowid));
            counts.operations_created++;
          }
        }
      }
    }

    if (mode === 'replace') {
      syncDatabaseToImportedFile(syncState, counts);
    }

    db.prepare('COMMIT').run();
    saveDb();
    return { ok: true, counts, warnings: warnings.slice(0, 50), mode };
  } catch (e: any) {
    try {
      db.prepare('ROLLBACK').run();
    } catch {
      /* ignore */
    }
    return { ok: false, error: e?.message || 'Błąd importu danych' };
  }
}
