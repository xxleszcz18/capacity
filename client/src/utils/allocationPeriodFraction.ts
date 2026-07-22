import { getWeekCountInMonth } from './calculatorPeriodExpansion';

/** Cares alokacji w obrębie roku: cały rok albo od miesiąca/tygodnia wzwyż. */
export type AllocationPeriodScope = 'year' | 'fromMonth' | 'fromWeek';

/** Liczba tygodni w roku (wg podziału T1…Tn jak w kalkulatorze). */
export function totalWeeksInYear(year: number): number {
  let n = 0;
  for (let m = 1; m <= 12; m++) n += getWeekCountInMonth(year, m);
  return Math.max(1, n);
}

/** Liczba tygodni od wybranego tygodnia w miesiącu do końca roku (włącznie). */
export function remainingWeeksFromPeriod(
  year: number,
  startMonth: number,
  startWeekOfMonth: number = 1
): number {
  const month = Math.min(12, Math.max(1, Math.floor(startMonth) || 1));
  const weekCount = getWeekCountInMonth(year, month);
  const week = Math.min(weekCount, Math.max(1, Math.floor(startWeekOfMonth) || 1));
  let n = weekCount - week + 1;
  for (let m = month + 1; m <= 12; m++) n += getWeekCountInMonth(year, m);
  return Math.max(0, n);
}

/**
 * Ułamek wolumenu roku odpowiadający okresowi od miesiąca/tygodnia do końca roku.
 * Cały rok → 1. Używany przy alokacji (wolumeny są roczne/tygodniowe, bez osobnych bucketów miesięcznych).
 */
export function allocationRemainingYearFraction(
  year: number,
  startMonth: number,
  startWeekOfMonth: number = 1
): number {
  const total = totalWeeksInYear(year);
  const rem = remainingWeeksFromPeriod(year, startMonth, startWeekOfMonth);
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, rem / total));
}

/**
 * Ułamek do zastosowania w danym roku wykonania.
 * Częściowy okres dotyczy tylko roku kotwicy; późniejsze zaznaczone lata = 100%.
 */
export function allocationFractionForExecutionYear(
  yearItem: number,
  anchorYear: number,
  periodScope: AllocationPeriodScope,
  startMonth: number,
  startWeekOfMonth: number
): number {
  if (periodScope === 'year') return 1;
  if (yearItem > anchorYear) return 1;
  if (yearItem < anchorYear) return 0;
  const week = periodScope === 'fromWeek' ? startWeekOfMonth : 1;
  return allocationRemainingYearFraction(yearItem, startMonth, week);
}
