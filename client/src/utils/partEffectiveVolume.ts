import { sopEopYearsRange } from './sopEopFormat';

export type PartVolumeContext = {
  volume_mode?: string;
  volume_share_percent?: number | null;
  default_volume_value?: number | null;
  default_volume_unit?: string | null;
  volume_by_year?: { year: number; volume_value: number; volume_unit?: string }[];
  volume_share_by_year?: { year: number; share_percent: number }[];
};

export type ProjectVolumeContext = {
  sop?: string;
  eop?: string;
  project_volumes?: { year: number; volume_value: number; volume_unit?: string }[];
};

/** Skuteczny wolumen roczny detalu w danym roku (jak w kalkulatorze — bez operation override). */
export function getPartEffectiveVolumeForYear(
  part: PartVolumeContext,
  project: ProjectVolumeContext,
  year: number
): number | null {
  const mode = part.volume_mode ?? 'project';

  if (mode === 'override') {
    const row = part.volume_by_year?.find((r) => Number(r.year) === year);
    if (row != null && Number.isFinite(Number(row.volume_value))) return Number(row.volume_value);
    if (part.default_volume_value != null) {
      const v = Number(part.default_volume_value);
      return Number.isFinite(v) ? v : null;
    }
    return null;
  }

  const pv = project.project_volumes?.find((r) => Number(r.year) === year);
  if (pv == null || !Number.isFinite(Number(pv.volume_value))) return null;

  if (mode === 'project') return Number(pv.volume_value);

  if (mode === 'share') {
    let sharePct: number | null =
      part.volume_share_by_year?.find((r) => Number(r.year) === year)?.share_percent ?? null;
    if (sharePct == null) sharePct = part.volume_share_percent ?? null;
    if (sharePct == null) return null;
    return Number(pv.volume_value) * (Math.max(0, Math.min(100, Number(sharePct))) / 100);
  }

  return null;
}

/** Czy detal ma dodatni skuteczny wolumen w co najmniej jednym roku SOP–EOP projektu. */
export function partHasPositiveVolumeInSopEopRange(part: PartVolumeContext, project: ProjectVolumeContext): boolean {
  const { years } = sopEopYearsRange(project.sop ?? '', project.eop ?? '');
  if (years.length === 0) return false;
  return years.some((y) => {
    const v = getPartEffectiveVolumeForYear(part, project, y);
    return v != null && v > 0;
  });
}

export function sopEopYearsLabel(project: ProjectVolumeContext): string {
  const { years } = sopEopYearsRange(project.sop ?? '', project.eop ?? '');
  if (years.length === 0) return '—';
  if (years.length === 1) return String(years[0]);
  return `${years[0]}–${years[years.length - 1]}`;
}
