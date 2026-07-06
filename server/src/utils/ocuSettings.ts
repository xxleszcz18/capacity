import { db } from '../db/connection.js';
import type { WorkingDaysRow } from '../services/capacityService.js';
import { mergeWorkingDaysWithDefaults, normalizeOverrideRow } from './workingDaysMerge.js';

const FALLBACK_DEFAULTS = {
  working_days_year: 252,
  oee_factor: 0.85,
  shift_time_seconds: 450,
  startup_shutdown_seconds: 720,
  working_weeks_per_year: 48,
  shifts_per_day: 3,
} as const;

export type CalculationSettingsProfile = 'capacity' | 'ocu';

const OCU_DEFAULT_KEYS = {
  working_days_year: 'ocu_default_working_days_year',
  oee_factor: 'ocu_default_oee_factor',
  shift_time_seconds: 'ocu_default_shift_time_seconds',
  startup_shutdown_seconds: 'ocu_default_startup_shutdown_seconds',
  working_weeks_per_year: 'ocu_default_working_weeks_per_year',
  shifts_per_day: 'ocu_default_shifts_per_day',
} as const;

function getAdminSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(key) as { value?: string } | undefined;
  return row?.value != null ? String(row.value) : null;
}

export function isOcuEnabled(): boolean {
  const raw = getAdminSetting('ocu_enabled');
  return raw === '1' || raw === 'true';
}

export function parseCalculationSettingsProfile(
  raw: unknown,
  opts?: { scenarioActive?: boolean; ocuEnabled?: boolean }
): CalculationSettingsProfile {
  if (opts?.scenarioActive) return 'capacity';
  if (!opts?.ocuEnabled && opts?.ocuEnabled !== undefined ? !opts.ocuEnabled : !isOcuEnabled()) return 'capacity';
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'ocu' ? 'ocu' : 'capacity';
}

export function getOcuSettingsForYear(year: number): WorkingDaysRow | null {
  const row = db.prepare('SELECT * FROM working_days_ocu WHERE year = ? AND status = ?').get(year, 'active') as WorkingDaysRow | undefined;
  const raw = row ?? (db.prepare('SELECT * FROM working_days_ocu WHERE year = ?').get(year) as WorkingDaysRow | undefined);
  if (!raw) return null;
  return mergeWorkingDaysWithDefaults(normalizeOverrideRow(raw), getOcuDefaultTemplate());
}

export function getOcuDefaultTemplate(): {
  working_days_year: number;
  oee_factor: number;
  shift_time_seconds: number;
  startup_shutdown_seconds: number;
  working_weeks_per_year: number;
  shifts_per_day: number;
} {
  const num = (key: keyof typeof OCU_DEFAULT_KEYS, fallback: number) => {
    const raw = getAdminSetting(OCU_DEFAULT_KEYS[key]);
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

export function getOcuFallbackWorkingDaysForYear(year: number): WorkingDaysRow {
  return {
    id: 0,
    year,
    ...getOcuDefaultTemplate(),
    status: 'active',
  };
}

export function saveOcuDefaultTemplate(body: Partial<ReturnType<typeof getOcuDefaultTemplate>>): void {
  const upsert = db.prepare('INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const entries: [keyof typeof OCU_DEFAULT_KEYS, number][] = [
    ['working_days_year', body.working_days_year ?? getOcuDefaultTemplate().working_days_year],
    ['oee_factor', body.oee_factor ?? getOcuDefaultTemplate().oee_factor],
    ['shift_time_seconds', body.shift_time_seconds ?? getOcuDefaultTemplate().shift_time_seconds],
    ['startup_shutdown_seconds', body.startup_shutdown_seconds ?? getOcuDefaultTemplate().startup_shutdown_seconds],
    ['working_weeks_per_year', body.working_weeks_per_year ?? getOcuDefaultTemplate().working_weeks_per_year],
    ['shifts_per_day', body.shifts_per_day ?? getOcuDefaultTemplate().shifts_per_day],
  ];
  for (const [field, value] of entries) {
    upsert.run(OCU_DEFAULT_KEYS[field], String(value));
  }
}
