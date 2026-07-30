/**
 * Testy jednostkowe Data preparation (uruchom: npx tsx src/services/dataPreparation/__tests__/runTests.ts).
 * Integracja z plikami z Downloads — opcjonalna (env DATA_PREP_FIXTURES=1).
 */
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import {
  parseEuNumber,
  parseDimensions,
  isS2102Formatka,
  parseRoutingBuffer,
  findShallowestMatches,
  runDataPreparation,
} from '../index.js';
import { INPUT_COLS, S2102_LARGE } from '../config.js';
import { isCellFilled, readKatowiceSheets } from '../excelIo.js';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)}`);
}

async function test_eu_numbers() {
  assertEq(parseEuNumber('1.000,000'), 1000, 'EU thousands');
  assertEq(parseEuNumber('0,500'), 0.5, 'EU decimal');
}

async function test_dimension_parse() {
  assertEq(parseDimensions('S2102 4.5kg 1F 2100x1250 /A07A')?.length ?? null, 2100, 'L');
  assertEq(parseDimensions('S2102 4.5kg 1F 2100x1250 /A07A')?.width ?? null, 1250, 'W');
  assert(!isS2102Formatka('S2102 HL KAT Phantom'), 'reject phantom');
  assert(isS2102Formatka('S2102 4.5kg 1F 2100x1250 /A07A'), 'accept with dims');
}

async function test_routing_parser() {
  const p = 'c:/Users/lniemczy/Downloads/routing.txt';
  if (!fs.existsSync(p)) {
    console.log('SKIP test_routing_parser (brak routing.txt)');
    return;
  }
  const idx = parseRoutingBuffer(fs.readFileSync(p));
  assertEq(idx.materialsWithDesc, 2833, 'materialsWithDesc');
  assertEq(idx.materialsWithComponents, 1546, 'materialsWithComponents');
}

async function test_bfs_shallowest() {
  const p = 'c:/Users/lniemczy/Downloads/routing.txt';
  if (!fs.existsSync(p)) {
    console.log('SKIP test_bfs_shallowest');
    return;
  }
  const idx = parseRoutingBuffer(fs.readFileSync(p));
  const m1 = findShallowestMatches(idx, '106220230105', 'S2102');
  assertEq(m1.length, 2, '106220230105 count');
  const dims = new Set(m1.map((m) => `${m.length}x${m.width}`));
  assert(dims.has('2100x1250') && dims.has('1200x400'), 'expected dimensions');

  const m2 = findShallowestMatches(idx, '106673340103', 'S2102');
  assertEq(m2.length, 1, '106673340103 count');
  assertEq(m2[0]?.bfsLevel, 2, 'bfs level 2');
}

async function test_no_overwrite_and_s1619_zero() {
  const downloads = 'c:/Users/lniemczy/Downloads';
  const k = path.join(downloads, 'Katowice_Data (2).xlsm');
  const r = path.join(downloads, 'routing.txt');
  const t = path.join(downloads, 'Tabela przejścia .xlsx');
  if (!fs.existsSync(k) || !fs.existsSync(r) || !fs.existsSync(t)) {
    console.log('SKIP integration fixtures');
    return;
  }
  const result = await runDataPreparation(fs.readFileSync(k), fs.readFileSync(r), fs.readFileSync(t));
  assertEq(result.stats.a_filled_1, 96, 'a_filled_1');
  assertEq(result.stats.a_filled_2, 56, 'a_filled_2');
  assertEq(result.stats.a_filled_total, 152, 'a_filled_total');
  assertEq(result.stats.a_ambiguous, 24, 'a_ambiguous');
  assertEq(result.stats.a_skipped, 412, 'a_skipped');
  assertEq(result.stats.a_no_match, 876, 'a_no_match');
  assertEq(result.stats.a_no_erp, 714, 'a_no_erp');
  assertEq(result.stats.b_filled, 0, 'b_filled / s1619_zero');
  assertEq(result.stats.b_skipped, 122, 'b_skipped');

  // no overwrite: wiersze z CR przed runem nadal mają oryginalne wartości w źródle;
  // wynikowy xlsx nie powinien zmieniać pominiętych — sprawdzamy, że skipped=412.
  const { inputRows } = readKatowiceSheets(fs.readFileSync(k));
  let crFilled = 0;
  for (let i = 3; i < inputRows.length; i++) {
    if (!inputRows[i]?.[INPUT_COLS.id]) continue;
    if (isCellFilled(inputRows, i, S2102_LARGE.machineGroup)) crFilled++;
  }
  assertEq(crFilled, 412, 'source CR filled');

  // output no macros / 1 sheet
  const wb = new ExcelJS.Workbook();
  // exceljs typings vs Node Buffer — load akceptuje ArrayBuffer/Uint8Array
  await wb.xlsx.load(result.xlsx as unknown as ArrayBuffer);
  assertEq(wb.worksheets.length, 1, 'one sheet');
  assertEq(wb.worksheets[0]?.name, 'Input', 'sheet name Input');
  assert(!(wb as { vbaProject?: unknown }).vbaProject, 'no VBA');
}

async function main() {
  const tests = [
    test_eu_numbers,
    test_dimension_parse,
    test_routing_parser,
    test_bfs_shallowest,
    test_no_overwrite_and_s1619_zero,
  ];
  for (const t of tests) {
    process.stdout.write(`• ${t.name} ... `);
    await t();
    console.log('OK');
  }
  console.log('All data preparation tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
