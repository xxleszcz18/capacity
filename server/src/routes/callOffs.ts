import { Router } from 'express';

import multer from 'multer';

import {

  archiveCallOffComparison,

  unarchiveCallOffComparison,

  createCallOffComparison,

  deleteCallOffComparison,

  getCallOffComparison,

  getCallOffVolumeStats,

  ensureCallOffUnmatchedReportFile,

  importSalesFcstFile,

  isCallOffArchived,

  isCallOffSourceFileAvailable,

  listCallOffComparisons,

  parseCallOffLastImport,

} from '../services/callOffService.js';

import { getCallOffSourceFilePath, getCallOffUnmatchedReportPath } from '../services/callOffFileService.js';

import { getCallOffComparisonCalculator, getCallOffPeriodBreakdown } from '../services/callOffCapacityService.js';

import { getMachineSopEopMarkersByYears } from '../services/capacityService.js';

import { parseMachineDimensionFiltersFromQuery } from '../utils/machineDimensionFilter.js';

import { parseCsvQueryParamSingleOrMulti, parseIdList } from '../utils/queryListParams.js';

import { resolveCallOffCalculatorFilters } from '../utils/callOffCalculatorFilters.js';



function parseUseContractualVolumes(v: unknown): boolean {

  return v === true || v === 'true' || v === '1' || v === 1;

}



export const callOffsRouter = Router();



const upload = multer({

  storage: multer.memoryStorage(),

  limits: { fileSize: 50 * 1024 * 1024 },

});



function parseYearRange(query: Record<string, unknown>, dateFrom: string, dateTo: string): { yearFrom: number; yearTo: number } {

  const qFrom = Number(query.yearFrom);

  const qTo = Number(query.yearTo);

  if (Number.isFinite(qFrom) && Number.isFinite(qTo) && qFrom >= 2000 && qTo <= 2100) {

    return { yearFrom: Math.min(qFrom, qTo), yearTo: Math.max(qFrom, qTo) };

  }

  const from = new Date(dateFrom);

  const to = new Date(dateTo);

  const yearFrom = from.getFullYear();

  const yearTo = to.getFullYear();

  return { yearFrom: Math.min(yearFrom, yearTo), yearTo: Math.max(yearFrom, yearTo) };

}



function parseCallOffSettingsProfile(query: Record<string, unknown>): 'capacity' | 'ocu' {

  return String(query.settingsProfile ?? '').trim() === 'ocu' ? 'ocu' : 'capacity';

}



callOffsRouter.get('/', (req, res) => {

  const archivedParam = String(req.query?.archived ?? '').toLowerCase();

  const wantArchived = archivedParam === '1' || archivedParam === 'true';

  res.json(listCallOffComparisons({ archived: wantArchived }));

});



callOffsRouter.post('/', (req, res) => {

  const body = req.body as { name?: string; date_from?: string; date_to?: string };

  const name = String(body.name ?? '').trim();

  const date_from = String(body.date_from ?? '').trim();

  const date_to = String(body.date_to ?? '').trim();

  if (!name) return res.status(400).json({ error: 'Nazwa jest wymagana' });

  if (!date_from || !date_to) return res.status(400).json({ error: 'Zakres dat jest wymagany' });

  if (new Date(date_from) > new Date(date_to)) {

    return res.status(400).json({ error: 'Data początkowa musi być przed datą końcową' });

  }

  const row = createCallOffComparison(name, date_from, date_to);

  res.status(201).json(row);

});



callOffsRouter.get('/:id(\\d+)', (req, res) => {

  const id = Number(req.params.id);

  const row = getCallOffComparison(id);

  if (!row) return res.status(404).json({ error: 'Nie znaleziono porównania' });

  const stats = getCallOffVolumeStats(id);

  const last_import = parseCallOffLastImport(row.last_import_json);
  const unmatched_report_available = ensureCallOffUnmatchedReportFile(id, last_import);

  res.json({
    ...row,
    stats,
    last_import,
    source_file_available: isCallOffSourceFileAvailable(row),
    unmatched_report_available,
  });

});



callOffsRouter.get('/:id(\\d+)/unmatched-report', (req, res) => {

  const id = Number(req.params.id);

  const row = getCallOffComparison(id);

  if (!row) return res.status(404).json({ error: 'Nie znaleziono porównania' });

  const last_import = parseCallOffLastImport(row.last_import_json);

  if (!last_import) return res.status(404).json({ error: 'Brak zapisanego raportu importu' });

  ensureCallOffUnmatchedReportFile(id, last_import);

  const filePath = getCallOffUnmatchedReportPath(id);

  if (!filePath) return res.status(404).json({ error: 'Raport niedopasowań nie istnieje na serwerze' });

  const base = row.source_filename?.replace(/\.[^.]+$/, '') || `calloff-${id}`;

  return res.download(filePath, `${base}-unmatched.csv`);

});



callOffsRouter.get('/:id(\\d+)/source-file', (req, res) => {

  const id = Number(req.params.id);

  const row = getCallOffComparison(id);

  if (!row) return res.status(404).json({ error: 'Nie znaleziono porównania' });

  if (!row.source_stored_filename) return res.status(404).json({ error: 'Brak zapisanego pliku źródłowego' });

  const filePath = getCallOffSourceFilePath(id, row.source_stored_filename);

  if (!filePath) return res.status(404).json({ error: 'Plik źródłowy nie istnieje na serwerze' });

  return res.download(filePath, row.source_filename || 'SalesFcst.xlsx');

});



callOffsRouter.post('/:id/archive', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Nieprawidłowe ID porównania' });
  if (!getCallOffComparison(id)) return res.status(404).json({ error: 'Nie znaleziono porównania' });
  try {
    archiveCallOffComparison(id);
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || 'Archiwizacja nie powiodła się' });
  }
  res.json({ ok: true });
});

callOffsRouter.post('/:id/unarchive', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Nieprawidłowe ID porównania' });
  if (!getCallOffComparison(id)) return res.status(404).json({ error: 'Nie znaleziono porównania' });
  try {
    unarchiveCallOffComparison(id);
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || 'Przywracanie nie powiodło się' });
  }
  res.json({ ok: true });
});



callOffsRouter.delete('/:id(\\d+)', (req, res) => {

  const id = Number(req.params.id);

  if (!getCallOffComparison(id)) return res.status(404).json({ error: 'Nie znaleziono porównania' });

  deleteCallOffComparison(id);

  res.status(204).end();

});



callOffsRouter.post('/:id(\\d+)/import-sales-fcst', upload.single('file'), (req, res) => {

  const id = Number(req.params.id);

  if (!getCallOffComparison(id)) return res.status(404).json({ error: 'Nie znaleziono porównania' });

  const row = getCallOffComparison(id)!;

  if (isCallOffArchived(row)) return res.status(400).json({ error: 'Porównanie jest zarchiwizowane — import wyłączony.' });

  const f = req.file;

  if (!f?.buffer?.length) return res.status(400).json({ error: 'Brak pliku (pole: file)' });

  try {

    const result = importSalesFcstFile(id, f.buffer, f.originalname ?? 'SalesFcst.xlsx');

    res.json(result);

  } catch (e: any) {

    res.status(400).json({ error: e?.message || 'Błąd importu pliku' });

  }

});



callOffsRouter.get('/:id(\\d+)/calculator', (req, res) => {

  const id = Number(req.params.id);

  const cmp = getCallOffComparison(id);

  if (!cmp) return res.status(404).json({ error: 'Nie znaleziono porównania' });



  const useContractualVolumes = parseUseContractualVolumes(req.query.useContractualVolumes);

  const { yearFrom, yearTo } = parseYearRange(req.query as Record<string, unknown>, cmp.date_from, cmp.date_to);

  const machineStatuses = parseCsvQueryParamSingleOrMulti(req.query.machineStatuses, req.query.machineStatuses);

  const dimensionFilters = parseMachineDimensionFiltersFromQuery(req.query);

  const settingsProfile = parseCallOffSettingsProfile(req.query as Record<string, unknown>);



  const machineIdsParam = req.query.machineIds as string | undefined;

  const machineIdsFromQuery = machineIdsParam?.trim() ? parseIdList(machineIdsParam, undefined) : undefined;

  const filterCtx = resolveCallOffCalculatorFilters(req.query as Record<string, unknown>, machineIdsFromQuery);



  if (filterCtx.empty) {

    return res.json({

      comparisonId: id,

      yearFrom,

      yearTo,

      date_from: cmp.date_from,

      date_to: cmp.date_to,

      machines: [],

    });

  }



  const machines = getCallOffComparisonCalculator(

    id,

    yearFrom,

    yearTo,

    filterCtx.machineIds?.length ? filterCtx.machineIds : undefined,

    filterCtx.types.length ? filterCtx.types : undefined,

    useContractualVolumes,

    machineStatuses.length ? (machineStatuses as any) : undefined,

    dimensionFilters.length ? dimensionFilters : undefined,

    settingsProfile

  );



  res.set('Cache-Control', 'no-store');

  res.json({

    comparisonId: id,

    yearFrom,

    yearTo,

    date_from: cmp.date_from,

    date_to: cmp.date_to,

    machines,

  });

});



callOffsRouter.get('/:id(\\d+)/calculator/period-breakdown', (req, res) => {

  const id = Number(req.params.id);

  const cmp = getCallOffComparison(id);

  if (!cmp) return res.status(404).json({ error: 'Nie znaleziono porównania' });



  const year = Number(req.query.year);

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {

    return res.status(400).json({ error: 'Invalid year' });

  }



  const useContractualVolumes = parseUseContractualVolumes(req.query.useContractualVolumes);

  const machineStatuses = parseCsvQueryParamSingleOrMulti(req.query.machineStatuses, req.query.machineStatuses);

  const dimensionFilters = parseMachineDimensionFiltersFromQuery(req.query);

  const settingsProfile = parseCallOffSettingsProfile(req.query as Record<string, unknown>);



  const machineIdsParam = req.query.machineIds as string | undefined;

  const machineIdsFromQuery = machineIdsParam?.trim() ? parseIdList(machineIdsParam, undefined) : undefined;

  const filterCtx = resolveCallOffCalculatorFilters(req.query as Record<string, unknown>, machineIdsFromQuery);



  if (filterCtx.empty) {

    return res.json({ year, machines: [] });

  }



  const machines = getCallOffPeriodBreakdown(

    id,

    year,

    filterCtx.machineIds?.length ? filterCtx.machineIds : undefined,

    filterCtx.types.length ? filterCtx.types : undefined,

    useContractualVolumes,

    machineStatuses.length ? (machineStatuses as any) : undefined,

    dimensionFilters.length ? dimensionFilters : undefined,

    settingsProfile

  );



  res.set('Cache-Control', 'no-store');

  res.json({ year, machines });

});



callOffsRouter.get('/:id(\\d+)/calculator/sop-eop-markers', (req, res) => {

  const id = Number(req.params.id);

  const cmp = getCallOffComparison(id);

  if (!cmp) return res.status(404).json({ error: 'Nie znaleziono porównania' });



  const { yearFrom, yearTo } = parseYearRange(req.query as Record<string, unknown>, cmp.date_from, cmp.date_to);

  const machineStatuses = parseCsvQueryParamSingleOrMulti(req.query.machineStatuses, req.query.machineStatuses);

  const dimensionFilters = parseMachineDimensionFiltersFromQuery(req.query);



  const machineIdsParam = req.query.machineIds as string | undefined;

  const machineIdsFromQuery = machineIdsParam?.trim() ? parseIdList(machineIdsParam, undefined) : undefined;

  const filterCtx = resolveCallOffCalculatorFilters(req.query as Record<string, unknown>, machineIdsFromQuery);



  if (filterCtx.empty) {

    return res.json({ yearFrom, yearTo, machines: [] });

  }



  const machines = getMachineSopEopMarkersByYears(

    yearFrom,

    yearTo,

    filterCtx.machineIds?.length ? filterCtx.machineIds : undefined,

    filterCtx.types.length ? filterCtx.types : undefined,

    undefined,

    null,

    undefined,

    machineStatuses.length ? (machineStatuses as any) : undefined,

    dimensionFilters.length ? dimensionFilters : undefined

  );



  res.set('Cache-Control', 'no-store');

  res.json({ yearFrom, yearTo, machines });

});


