import type { WorkingDaysRow } from '../services/capacityService.js';
import type { WorkingDaysDefaultTemplate } from './capacitySettings.js';

export type WorkingDaysOverrideRow = {
  id: number;
  year: number;
  working_days_year: number | null;
  oee_factor: number | null;
  shift_time_seconds: number | null;
  startup_shutdown_seconds: number | null;
  working_weeks_per_year: number | null;
  shifts_per_day: number | null;
  status?: string;
};

export function parseOptionalNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseOptionalShifts(v: unknown): number | null {
  const n = parseOptionalNumber(v);
  if (n == null) return null;
  return Math.max(1, Math.min(4, Math.round(n)));
}

export function mergeWorkingDaysWithDefaults(
  row: Partial<WorkingDaysOverrideRow> & { year: number; id?: number },
  defaults: WorkingDaysDefaultTemplate
): WorkingDaysRow {
  return {
    id: row.id ?? 0,
    year: row.year,
    working_days_year: row.working_days_year ?? defaults.working_days_year,
    oee_factor: row.oee_factor ?? defaults.oee_factor,
    shift_time_seconds: row.shift_time_seconds ?? defaults.shift_time_seconds,
    startup_shutdown_seconds: row.startup_shutdown_seconds ?? defaults.startup_shutdown_seconds,
    working_weeks_per_year: row.working_weeks_per_year ?? defaults.working_weeks_per_year,
    shifts_per_day: row.shifts_per_day ?? defaults.shifts_per_day,
    status: row.status ?? 'active',
  };
}

export function normalizeOverrideRow(row: any): WorkingDaysOverrideRow {
  return {
    id: Number(row.id),
    year: Number(row.year),
    working_days_year: row.working_days_year == null ? null : Number(row.working_days_year),
    oee_factor: row.oee_factor == null ? null : Number(row.oee_factor),
    shift_time_seconds: row.shift_time_seconds == null ? null : Number(row.shift_time_seconds),
    startup_shutdown_seconds: row.startup_shutdown_seconds == null ? null : Number(row.startup_shutdown_seconds),
    working_weeks_per_year: row.working_weeks_per_year == null ? null : Number(row.working_weeks_per_year),
    shifts_per_day: row.shifts_per_day == null ? null : Number(row.shifts_per_day),
    status: row.status != null ? String(row.status) : 'active',
  };
}
