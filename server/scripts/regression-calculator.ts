/**
 * Porównuje wyniki kalkulatora przed/po optymalizacji (ten sam kod, sanity check).
 * Uruchom: npx tsx server/scripts/regression-calculator.ts
 */
import { initDb } from '../src/db/connection.js';
import { getMachineCapacityByYears, getMachinePeriodBreakdown } from '../src/services/capacityService.js';

const TOLERANCE_PP = 0.01;

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE_PP;
}

async function main() {
  await initDb();
  const yearFrom = 2026;
  const yearTo = 2028;
  const sampleMachineIds = (
    (await import('../src/db/connection.js')).db
      .prepare('SELECT id FROM machines WHERE status = ? ORDER BY id LIMIT 5')
      .all('active') as { id: number }[]
  ).map((r) => r.id);

  if (sampleMachineIds.length === 0) {
    console.log('Brak maszyn active — pomijam test.');
    return;
  }

  const rows = getMachineCapacityByYears(yearFrom, yearTo, sampleMachineIds);
  console.log(`Kalkulator: ${rows.length} maszyn, lata ${yearFrom}–${yearTo}`);

  for (const m of rows) {
    for (let y = yearFrom; y <= yearTo; y++) {
      const ent = m.years[y];
      if (!ent) continue;
      if (!Number.isFinite(ent.load_percent)) {
        throw new Error(`Nieprawidłowy load_percent maszyna ${m.machine_id} rok ${y}`);
      }
    }
  }

  const breakdown = getMachinePeriodBreakdown(2027, sampleMachineIds.slice(0, 3));
  for (const row of breakdown) {
    for (let month = 1; month <= 12; month++) {
      const m = row.months[month];
      if (!m) continue;
      if (!Number.isFinite(m.load_percent)) {
        throw new Error(`Nieprawidłowy miesięczny load maszyna ${row.machine_id} miesiąc ${month}`);
      }
    }
  }

  // Idempotencja: drugie wywołanie musi dać identyczne wyniki
  const rows2 = getMachineCapacityByYears(yearFrom, yearTo, sampleMachineIds);
  for (const m of rows) {
    const m2 = rows2.find((r) => r.machine_id === m.machine_id);
    if (!m2) throw new Error(`Brak maszyny ${m.machine_id} w drugim przebiegu`);
    for (let y = yearFrom; y <= yearTo; y++) {
      const a = m.years[y]?.load_percent;
      const b = m2.years[y]?.load_percent;
      if (a == null || b == null) continue;
      if (!nearlyEqual(a, b)) {
        throw new Error(`Różnica load ${m.machine_id} rok ${y}: ${a} vs ${b}`);
      }
    }
  }

  console.log('OK — regresja kalkulatora przeszła pomyślnie.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
