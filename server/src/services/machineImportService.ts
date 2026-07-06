import * as XLSX from 'xlsx';
import { db, saveDb } from '../db/connection.js';
import { excelExportCell } from '../utils/excelExportCell.js';
import { formatSapNumberForDisplay } from '../utils/detailLabel.js';
import { parseInternalMachineNumber } from '../utils/internalMachineNumber.js';
import { normalizeMachineLineLocationOrOne } from '../utils/machineLineLocation.js';
import { ensureMachineTypesExist } from '../utils/machineTypes.js';

function defaultMachineType(): string {
  const row = db.prepare('SELECT name FROM machine_types ORDER BY name LIMIT 1').get() as { name?: string } | undefined;
  if (row?.name) return String(row.name);
  return 'Import';
}

export const MACHINES_IMPORT_CONFIRM = 'IMPORTUJ_MASZYNY';

export const MACHINES_IMPORT_SHEET = 'Maszyny';

export const MACHINES_IMPORT_HEADERS = [
  'internal_number',
  'sap_number',
  'type',
  'oee_override',
  'status',
  'location',
  'machine_usage',
  'width_mm',
  'depth_mm',
  'height_mm',
  'stroke_mm',
] as const;

export type MachinesImportResult =
  | {
      ok: true;
      created: number;
      updated: number;
      skipped: number;
      errors: string[];
      types_added: string[];
    }
  | { ok: false; error: string };

function cellStr(v: unknown): string {
  if (v === undefined || v === null) return '';
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

function cellNumIfPresent(v: unknown): number | null | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  return cellNum(v);
}

function cellInternal(v: unknown): string | null {
  const parsed = parseInternalMachineNumber(v);
  return parsed.ok ? parsed.value : null;
}

function firstPresentNum(row: Record<string, unknown>, keys: string[]): number | null | undefined {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(row, k)) {
      const n = cellNumIfPresent(row[k]);
      if (n !== undefined) return n;
    }
  }
  return undefined;
}

export function dimensionsFromImportRow(row: Record<string, unknown>): {
  width_mm: number | null | undefined;
  depth_mm: number | null | undefined;
  height_mm: number | null | undefined;
  stroke_mm: number | null | undefined;
} {
  return {
    width_mm: firstPresentNum(row, ['width_mm', 'szerokosc', 'szerokość', 'width']),
    depth_mm: firstPresentNum(row, ['depth_mm', 'glebokosc', 'głębokość', 'depth']),
    height_mm: firstPresentNum(row, ['height_mm', 'wysokosc', 'wysokość', 'height']),
    stroke_mm: firstPresentNum(row, ['stroke_mm', 'skok', 'stroke']),
  };
}

function normalizeMachineStatus(raw: unknown, fallback: 'active' | 'inactive' | 'RFQ' = 'active'): 'active' | 'inactive' | 'RFQ' {
  const s = String(raw ?? fallback).trim().toLowerCase();
  if (s === 'inactive') return 'inactive';
  if (s === 'rfq') return 'RFQ';
  return 'active';
}

function clampMachineUsage(v: unknown): number {
  const n = Number(v);
  if (Number.isNaN(n)) return 1;
  const clamped = Math.max(0, Math.min(1, n));
  return Math.round(clamped * 10) / 10;
}

function machineSheetRows(wb: XLSX.WorkBook): Record<string, unknown>[] {
  const preferred = [MACHINES_IMPORT_SHEET, 'machines', 'Machines'];
  for (const name of preferred) {
    if (wb.SheetNames.includes(name)) {
      return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: null, raw: true });
    }
  }
  const first = wb.SheetNames[0];
  if (!first) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[first], { defval: null, raw: true });
}

export function buildMachinesImportTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new();
  const rows = db
    .prepare(
      `SELECT internal_number, sap_number, type, oee_override, status, location, COALESCE(machine_usage, 1) AS machine_usage,
              width_mm, depth_mm, height_mm, stroke_mm
       FROM machines ORDER BY internal_number`
    )
    .all() as {
    internal_number: string | null;
    sap_number: string | null;
    type: string;
    oee_override: number | null;
    status: string;
    location: string | null;
    machine_usage: number;
    width_mm: number | null;
    depth_mm: number | null;
    height_mm: number | null;
    stroke_mm: number | null;
  }[];

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [...MACHINES_IMPORT_HEADERS],
      ...rows.map((m) => [
        excelExportCell(m.internal_number) ?? '',
        excelExportCell(m.sap_number) ?? '',
        m.type,
        m.oee_override ?? '',
        m.status ?? 'active',
        excelExportCell(m.location) ?? '',
        m.machine_usage ?? 1,
        m.width_mm ?? '',
        m.depth_mm ?? '',
        m.height_mm ?? '',
        m.stroke_mm ?? '',
      ]),
    ]),
    MACHINES_IMPORT_SHEET
  );

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function importMachinesFromBuffer(buffer: Buffer): MachinesImportResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    return { ok: false, error: 'Nie udało się odczytać pliku Excel (.xlsx).' };
  }

  const sheetRows = machineSheetRows(wb);
  if (sheetRows.length === 0) {
    return { ok: false, error: 'Brak wierszy danych w arkuszu maszyn (oczekiwany arkusz „Maszyny” lub pierwszy arkusz).' };
  }

  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const typesToEnsure: string[] = [];
  for (const row of sheetRows) {
    const internal = cellInternal(row.numer_maszyny ?? row.internal_number);
    if (internal == null) continue;
    const rowType = cellStr(row.typ ?? row.type);
    typesToEnsure.push(rowType || defaultMachineType());
  }
  const typesAdded = ensureMachineTypesExist(typesToEnsure);

  const selectByInternal = db.prepare('SELECT * FROM machines WHERE internal_number = ?');
  const selectById = db.prepare('SELECT * FROM machines WHERE id = ?');
  const insertStmt = db.prepare(
    `INSERT INTO machines (internal_number, sap_number, type, oee_override, status, location, machine_usage, width_mm, depth_mm, height_mm, stroke_mm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const updateStmt = db.prepare(
    `UPDATE machines SET internal_number = ?, sap_number = ?, type = ?, oee_override = ?, status = ?, location = ?, machine_usage = ?,
      width_mm = ?, depth_mm = ?, height_mm = ?, stroke_mm = ?
     WHERE id = ?`
  );

  const defaultType = defaultMachineType();

  try {
    db.prepare('BEGIN TRANSACTION').run();

    for (let i = 0; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      const rowNum = i + 2;
      let internal = cellInternal(row.numer_maszyny ?? row.internal_number);
      const idRaw = cellNum(row.id);
      const sapRaw = row.numer_sap_maszyny ?? row.sap_number;
      const sap = sapRaw != null && String(sapRaw).trim() !== '' ? formatSapNumberForDisplay(sapRaw) : null;
      let type = cellStr(row.typ ?? row.type);
      if (!type) type = defaultType;
      const status = normalizeMachineStatus(row.status);
      const oee = cellNumIfPresent(row.oee_override);
      const locationRaw = row.location ?? row.nr_linii ?? row.linia;
      const location = locationRaw !== undefined && locationRaw !== null && String(locationRaw).trim() !== ''
        ? normalizeMachineLineLocationOrOne(locationRaw)
        : undefined;
      const usageRaw = cellNumIfPresent(row.machine_usage);
      const dims = dimensionsFromImportRow(row);

      let existing: Record<string, unknown> | undefined;
      if (internal != null) {
        existing = selectByInternal.get(internal) as Record<string, unknown> | undefined;
      } else if (idRaw != null && Number.isInteger(idRaw) && idRaw > 0) {
        existing = selectById.get(idRaw) as Record<string, unknown> | undefined;
        if (existing) internal = existing.internal_number != null ? String(existing.internal_number) : null;
      }

      if (internal == null && !existing) {
        errors.push(`Wiersz ${rowNum}: brak numer_maszyny / internal_number (wymagany przy nowej maszynie).`);
        skipped++;
        continue;
      }

      if (!existing) {
        if (!sap) {
          errors.push(`Wiersz ${rowNum} (nr ${internal}): brak numer_sap_maszyny / sap_number przy tworzeniu maszyny.`);
          skipped++;
          continue;
        }
        try {
          insertStmt.run(
            internal,
            sap,
            type,
            oee ?? null,
            status,
            location ?? null,
            usageRaw ?? 1,
            dims.width_mm ?? null,
            dims.depth_mm ?? null,
            dims.height_mm ?? null,
            dims.stroke_mm ?? null
          );
          created++;
        } catch (e: unknown) {
          errors.push(`Wiersz ${rowNum} (nr ${internal}): ${e instanceof Error ? e.message : 'błąd zapisu'}`);
          skipped++;
        }
        continue;
      }

      const ex = existing!;
      const nextSap = sap ?? (ex.sap_number != null ? String(ex.sap_number) : null);
      const nextOee = oee !== undefined ? oee : (ex.oee_override != null ? Number(ex.oee_override) : null);
      const nextLocation = location !== undefined ? location : (ex.location != null ? String(ex.location) : null);
      const nextUsage = usageRaw !== undefined ? clampMachineUsage(usageRaw) : clampMachineUsage(ex.machine_usage ?? 1);
      const nextWidth = dims.width_mm !== undefined ? dims.width_mm : (ex.width_mm != null ? Number(ex.width_mm) : null);
      const nextDepth = dims.depth_mm !== undefined ? dims.depth_mm : (ex.depth_mm != null ? Number(ex.depth_mm) : null);
      const nextHeight = dims.height_mm !== undefined ? dims.height_mm : (ex.height_mm != null ? Number(ex.height_mm) : null);
      const nextStroke = dims.stroke_mm !== undefined ? dims.stroke_mm : (ex.stroke_mm != null ? Number(ex.stroke_mm) : null);

      try {
        updateStmt.run(
          internal,
          nextSap,
          type,
          nextOee,
          status,
          nextLocation,
          nextUsage,
          nextWidth,
          nextDepth,
          nextHeight,
          nextStroke,
          Number(ex.id)
        );
        updated++;
      } catch (e: unknown) {
        errors.push(`Wiersz ${rowNum} (nr ${internal}): ${e instanceof Error ? e.message : 'błąd aktualizacji'}`);
        skipped++;
      }
    }

    db.prepare('COMMIT').run();
  } catch (e: unknown) {
    try {
      db.prepare('ROLLBACK').run();
    } catch {
      /* ignore */
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Import maszyn nie powiódł się.' };
  }

  saveDb();
  return { ok: true, created, updated, skipped, errors, types_added: typesAdded };
}
