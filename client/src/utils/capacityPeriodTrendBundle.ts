import type { CapacityMachineTrend, CapacityTrendBundle } from './capacityTrends';
import type { VizTimelinePeriod } from './dataVizPeriodRange';

type PeriodBreakdownMachine = {
  machine_id: number;
  months: Record<
    number,
    {
      load_percent: number;
      call_off_load_percent?: number;
      weeks?: Record<number, { load_percent: number; call_off_load_percent?: number }>;
    }
  >;
};

type PeriodBreakdownResponse = {
  year: number;
  machines: PeriodBreakdownMachine[];
};

type LoadField = 'load_percent' | 'call_off_load_percent';

function loadForPeriod(
  machine: PeriodBreakdownMachine | undefined,
  period: VizTimelinePeriod,
  mode: 'month' | 'week',
  field: LoadField
): number | null {
  if (!machine) return null;
  const monthRow = machine.months?.[period.month!];
  if (!monthRow) return null;
  if (mode === 'month') {
    const v = Number(monthRow[field]);
    return Number.isFinite(v) ? Math.round(v) : null;
  }
  const w = monthRow.weeks?.[period.week!];
  if (!w) return null;
  const v = Number(w[field]);
  return Number.isFinite(v) ? Math.round(v) : null;
}

function buildFromBreakdown(
  meta: CapacityTrendBundle,
  breakdownByYear: Map<number, PeriodBreakdownResponse>,
  periods: VizTimelinePeriod[],
  mode: 'month' | 'week',
  field: LoadField
): CapacityTrendBundle {
  const machines: CapacityMachineTrend[] = meta.machines.map((m) => {
    const years: CapacityMachineTrend['years'] = {};
    for (const period of periods) {
      const bd = breakdownByYear.get(period.year);
      const row = bd?.machines.find((x) => x.machine_id === m.machine_id);
      const load = loadForPeriod(row, period, mode, field);
      if (load != null) {
        years[period.id] = { load_percent: load };
      }
    }
    return { ...m, years };
  });

  const yearFrom = periods.length ? Math.min(...periods.map((p) => p.year)) : meta.yearFrom;
  const yearTo = periods.length ? Math.max(...periods.map((p) => p.year)) : meta.yearTo;

  return {
    yearFrom,
    yearTo,
    machines,
  };
}

/** Produkcja / kontrakt z period-breakdown. */
export function buildPeriodTrendBundle(
  meta: CapacityTrendBundle,
  breakdownByYear: Map<number, PeriodBreakdownResponse>,
  periods: VizTimelinePeriod[],
  mode: 'month' | 'week'
): CapacityTrendBundle {
  return buildFromBreakdown(meta, breakdownByYear, periods, mode, 'load_percent');
}

/** Call offs z period-breakdown (bez dataYears — klucze osi = id okresu). */
export function buildCallOffPeriodTrendBundle(
  meta: CapacityTrendBundle,
  breakdownByYear: Map<number, PeriodBreakdownResponse>,
  periods: VizTimelinePeriod[],
  mode: 'month' | 'week'
): CapacityTrendBundle {
  return buildFromBreakdown(meta, breakdownByYear, periods, mode, 'call_off_load_percent');
}
