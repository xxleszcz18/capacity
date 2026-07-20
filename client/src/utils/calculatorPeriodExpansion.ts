export type PeriodMonthData = {
  load_percent: number;
  call_off_load_percent?: number;
  weeks: Record<
    number,
    {
      load_percent: number;
      call_off_load_percent?: number;
      detail_breakdown?: DetailBreakdownEntry[];
      call_off_detail_breakdown?: DetailBreakdownEntry[];
    }
  >;
  has_sop?: boolean;
  has_eop?: boolean;
  detail_breakdown?: DetailBreakdownEntry[];
  call_off_detail_breakdown?: DetailBreakdownEntry[];
};

export type DetailBreakdownEntry = {
  project_label?: string;
  detail_label: string;
  contribution_percent: number;
  share_percent?: number;
  volume_quantity?: number;
  has_rfq?: boolean;
};

export type PeriodBreakdownMachine = {
  machine_id: number;
  has_sop?: boolean;
  has_eop?: boolean;
  months: Record<number, PeriodMonthData>;
};

export type YearSopEopMarkers = {
  has_sop: boolean;
  has_eop: boolean;
  months: Record<number, { has_sop: boolean; has_eop: boolean }>;
};

export type MachineSopEopMarkers = {
  machine_id: number;
  years: Record<number, YearSopEopMarkers>;
};

export type TimelineColumn =
  | { kind: 'year'; year: number }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'week'; year: number; month: number; week: number };

export type VerticalExpansionRow =
  | { kind: 'month'; month: number; indent: 1 }
  | { kind: 'week'; month: number; week: number; indent: 2 };

export function periodMonthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function periodMachineMonthKey(machineId: number, month: number): string {
  return `${machineId}-${month}`;
}

export function getWeekCountInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.max(1, Math.ceil(daysInMonth / 7));
}

export function buildHorizontalTimelineColumns(
  years: number[],
  expandedYears: Set<number>,
  expandedMonths: Set<string>
): TimelineColumn[] {
  const cols: TimelineColumn[] = [];
  for (const year of years) {
    cols.push({ kind: 'year', year });
    if (!expandedYears.has(year)) continue;
    for (let month = 1; month <= 12; month++) {
      cols.push({ kind: 'month', year, month });
      if (!expandedMonths.has(periodMonthKey(year, month))) continue;
      const weekCount = getWeekCountInMonth(year, month);
      for (let week = 1; week <= weekCount; week++) {
        cols.push({ kind: 'week', year, month, week });
      }
    }
  }
  return cols;
}

/** Pionowe rozwinięcie: wiersze miesięcy/tygodni z wartościami we wszystkich latach obok siebie. */
export function getVerticalExpansionRows(
  machineId: number,
  expandedMachines: Set<number>,
  expandedMachineMonths: Set<string>,
  years: number[]
): VerticalExpansionRow[] {
  if (!expandedMachines.has(machineId)) return [];
  const rows: VerticalExpansionRow[] = [];
  for (let month = 1; month <= 12; month++) {
    rows.push({ kind: 'month', month, indent: 1 });
    const monthKey = periodMachineMonthKey(machineId, month);
    if (!expandedMachineMonths.has(monthKey)) continue;
    const maxWeeks =
      years.length > 0 ? Math.max(...years.map((year) => getWeekCountInMonth(year, month))) : getWeekCountInMonth(2020, month);
    for (let week = 1; week <= maxWeeks; week++) {
      rows.push({ kind: 'week', month, week, indent: 2 });
    }
  }
  return rows;
}

export function getTimelineColumnLoad(
  col: TimelineColumn,
  yearlyLoad: number | undefined,
  monthsData: Record<number, PeriodMonthData> | undefined
): number {
  if (col.kind === 'year') return yearlyLoad ?? 0;
  if (!monthsData) return 0;
  if (col.kind === 'month') return monthsData[col.month]?.load_percent ?? 0;
  return monthsData[col.month]?.weeks[col.week]?.load_percent ?? 0;
}

export function getTimelineColumnCallOffLoad(
  col: TimelineColumn,
  yearlyCallOffLoad: number | undefined,
  monthsData: Record<number, PeriodMonthData> | undefined
): number {
  if (col.kind === 'year') return yearlyCallOffLoad ?? 0;
  if (!monthsData) return 0;
  if (col.kind === 'month') return monthsData[col.month]?.call_off_load_percent ?? 0;
  return monthsData[col.month]?.weeks[col.week]?.call_off_load_percent ?? 0;
}

export function getVerticalCellLoad(
  _year: number,
  row: VerticalExpansionRow,
  monthsData: Record<number, PeriodMonthData> | undefined
): number {
  if (!monthsData) return 0;
  if (row.kind === 'month') return monthsData[row.month]?.load_percent ?? 0;
  return monthsData[row.month]?.weeks[row.week]?.load_percent ?? 0;
}

export function getVerticalCellCallOffLoad(
  _year: number,
  row: VerticalExpansionRow,
  monthsData: Record<number, PeriodMonthData> | undefined
): number {
  if (!monthsData) return 0;
  if (row.kind === 'month') return monthsData[row.month]?.call_off_load_percent ?? 0;
  return monthsData[row.month]?.weeks[row.week]?.call_off_load_percent ?? 0;
}

export function getYearMarkers(
  markerIndex: Map<number, Record<number, YearSopEopMarkers>> | undefined,
  machineId: number,
  year: number
): YearSopEopMarkers | undefined {
  return markerIndex?.get(machineId)?.[year];
}

export function getMonthMarkers(
  markers: YearSopEopMarkers | undefined,
  month: number
): { has_sop: boolean; has_eop: boolean } {
  return markers?.months?.[month] ?? { has_sop: false, has_eop: false };
}

export function monthAbbrev(month: number, locale: string): string {
  try {
    const d = new Date(2020, month - 1, 1);
    return new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
  } catch {
    const fallback = ['', 'Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
    return fallback[month] ?? String(month);
  }
}

/** Numer tygodnia ISO (1–53) — jak w kalendarzu / SAP CW. */
export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Tydzień kalendarzowy (ISO) dla wiadra T1…T5 w miesiącu (dni 1–7, 8–14, …).
 * Bierze dzień środkowy wiadra, żeby etykieta trafiała w ten sam CW co dane SAP.
 */
export function calendarWeekForMonthWeek(year: number, month: number, weekOfMonth: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  const w = Math.max(1, Math.floor(Number(weekOfMonth)) || 1);
  const day = Math.min(daysInMonth, (w - 1) * 7 + 4);
  return isoWeekNumber(new Date(year, month - 1, day));
}
