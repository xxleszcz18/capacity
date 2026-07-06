import { db } from '../db/connection.js';
import type { WorkingDaysRow } from '../services/capacityService.js';

const FALLBACK_DEFAULTS = {
  working_days_year: 252,
  oee_factor: 0.85,
  shift_time_seconds: 450,
  startup_shutdown_seconds: 720,
  working_weeks_per_year: 48,
  shifts_per_day: 3,
} as const;

export type WorkingDaysDefaultTemplate = {
  working_days_year: number;
  oee_factor: number;
  shift_time_seconds: number;
  startup_shutdown_seconds: number;
  working_weeks_per_year: number;
  shifts_per_day: number;
};

const CAPACITY_DEFAULT_KEYS = {
  working_days_year: 'capacity_default_working_days_year',
  oee_factor: 'capacity_default_oee_factor',
  shift_time_seconds: 'capacity_default_shift_time_seconds',
  startup_shutdown_seconds: 'capacity_default_startup_shutdown_seconds',
  working_weeks_per_year: 'capacity_default_working_weeks_per_year',
  shifts_per_day: 'capacity_default_shifts_per_day',
} as const;

function getAdminSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(key) as { value?: string } | undefined;
  return row?.value != null ? String(row.value) : null;
}

export function getCapacityDefaultTemplate(): WorkingDaysDefaultTemplate {
  const num = (key: keyof typeof CAPACITY_DEFAULT_KEYS, fallback: number) => {
    const raw = getAdminSetting(CAPACITY_DEFAULT_KEYS[key]);
    const n = raw != null ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    working_days_year: num('working_days_year', FALLBACK_DEFAULTS.working_days_year),
    oee_factor: num('oee_factor', FALLBACK_DEFAULTS.oee_factor),
    shift_time_seconds: num('shift_time_seconds', FALLBACK_DEFAULTS.shift_time_seconds),
    startup_shutdown_seconds: num('startup_shutdown_seconds', FALLBACK_DEFAULTS.startup_shutdown_seconds),
    working_weeks_per_year: num('working_weeks_per_year', FALLBACK_DEFAULTS.working_weeks_per_year),
    shifts_per_day: num('shifts_per_day', FALLBACK_DEFAULTS.shifts_per_day),
  };
}

export function getCapacityFallbackWorkingDaysForYear(year: number): WorkingDaysRow {
  return {
    id: 0,
    year,
    ...getCapacityDefaultTemplate(),
    status: 'active',
  };
}

export function saveCapacityDefaultTemplate(body: Partial<WorkingDaysDefaultTemplate>): void {
  const current = getCapacityDefaultTemplate();
  const upsert = db.prepare('INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const entries: [keyof typeof CAPACITY_DEFAULT_KEYS, number][] = [
    ['working_days_year', body.working_days_year ?? current.working_days_year],
    ['oee_factor', body.oee_factor ?? current.oee_factor],
    ['shift_time_seconds', body.shift_time_seconds ?? current.shift_time_seconds],
    ['startup_shutdown_seconds', body.startup_shutdown_seconds ?? current.startup_shutdown_seconds],
    ['working_weeks_per_year', body.working_weeks_per_year ?? current.working_weeks_per_year],
    ['shifts_per_day', body.shifts_per_day ?? current.shifts_per_day],
  ];
  for (const [field, value] of entries) {
    upsert.run(CAPACITY_DEFAULT_KEYS[field], String(value));
  }
}
