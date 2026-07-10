import { db } from '../db/connection.js';

export type VolumeEntryOrigin = 'default_all_years' | 'manual_year';

export type EffectiveVolumeResult = {
  volume_value: number;
  volume_unit: 'annual' | 'monthly' | 'weekly';
  count_after_eop?: boolean;
  volume_origin?: VolumeEntryOrigin;
};

type ProjectVolumeRow = {
  volume_value: number;
  volume_unit: string;
  include_in_calculator_after_eop?: number;
  volume_origin?: string;
};

type PartRow = {
  volume_mode: string;
  volume_share_percent: number | null;
  default_volume_value?: number | null;
  default_volume_unit?: string | null;
  contract_volume_mode?: string;
  contract_volume_share_percent?: number | null;
  contract_default_volume_value?: number | null;
  contract_default_volume_unit?: string | null;
};

type PartVolumeRow = {
  volume_value: number;
  volume_unit: string;
  volume_origin?: string;
};

export type VolumePrefetchMaps = {
  projectVolumes: Map<string, ProjectVolumeRow>;
  projectVolumesContract: Map<string, ProjectVolumeRow>;
  projectEop: Map<number, string>;
  parts: Map<number, PartRow>;
  partVolumeByYear: Map<string, PartVolumeRow>;
  partVolumeContractByYear: Map<string, PartVolumeRow>;
  partShareByYear: Map<string, number>;
  partContractShareByYear: Map<string, number>;
};

function pvKey(projectId: number, year: number): string {
  return `${projectId}:${year}`;
}

function partYearKey(partId: number, year: number): string {
  return `${partId}:${year}`;
}

function emptyPrefetch(): VolumePrefetchMaps {
  return {
    projectVolumes: new Map(),
    projectVolumesContract: new Map(),
    projectEop: new Map(),
    parts: new Map(),
    partVolumeByYear: new Map(),
    partVolumeContractByYear: new Map(),
    partShareByYear: new Map(),
    partContractShareByYear: new Map(),
  };
}

function loadParts(partIds: number[], maps: VolumePrefetchMaps): void {
  const missing = partIds.filter((id) => !maps.parts.has(id));
  if (missing.length === 0) return;
  const ph = missing.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT id, volume_mode, volume_share_percent, default_volume_value, default_volume_unit,
              contract_volume_mode, contract_volume_share_percent, contract_default_volume_value, contract_default_volume_unit
       FROM parts WHERE id IN (${ph})`
    )
    .all(...missing) as (PartRow & { id: number })[];
  for (const r of rows) maps.parts.set(r.id, r);
}

function loadProjectEops(projectIds: number[], maps: VolumePrefetchMaps): void {
  const missing = projectIds.filter((id) => !maps.projectEop.has(id));
  if (missing.length === 0) return;
  const ph = missing.map(() => '?').join(',');
  const rows = db.prepare(`SELECT id, eop FROM projects WHERE id IN (${ph})`).all(...missing) as { id: number; eop: string }[];
  for (const r of rows) maps.projectEop.set(r.id, r.eop);
}

/** Ładuje wolumeny projektu/detalu dla jednego roku do map (produkcja + kontrakt). */
export function buildVolumePrefetchForYear(
  year: number,
  projectIds: number[],
  partIds: number[]
): VolumePrefetchMaps {
  const maps = emptyPrefetch();
  const uniqueProjects = [...new Set(projectIds.filter((id) => id > 0))];
  const uniqueParts = [...new Set(partIds.filter((id) => id > 0))];
  if (uniqueProjects.length === 0 && uniqueParts.length === 0) return maps;

  loadProjectEops(uniqueProjects, maps);
  loadParts(uniqueParts, maps);

  if (uniqueProjects.length > 0) {
    const ph = uniqueProjects.map(() => '?').join(',');
    try {
      const rows = db
        .prepare(
          `SELECT project_id, volume_value, volume_unit, COALESCE(include_in_calculator_after_eop, 0) AS include_in_calculator_after_eop, volume_origin
           FROM project_volumes WHERE year = ? AND project_id IN (${ph})`
        )
        .all(year, ...uniqueProjects) as (ProjectVolumeRow & { project_id: number })[];
      for (const r of rows) maps.projectVolumes.set(pvKey(r.project_id, year), r);
    } catch (_) {}
    try {
      const rows = db
        .prepare(
          `SELECT project_id, volume_value, volume_unit, COALESCE(include_in_calculator_after_eop, 0) AS include_in_calculator_after_eop, volume_origin
           FROM project_volumes_contract WHERE year = ? AND project_id IN (${ph})`
        )
        .all(year, ...uniqueProjects) as (ProjectVolumeRow & { project_id: number })[];
      for (const r of rows) maps.projectVolumesContract.set(pvKey(r.project_id, year), r);
    } catch (_) {}
  }

  if (uniqueParts.length > 0) {
    const ph = uniqueParts.map(() => '?').join(',');
    try {
      const rows = db
        .prepare(`SELECT part_id, volume_value, volume_unit, volume_origin FROM part_volume_by_year WHERE year = ? AND part_id IN (${ph})`)
        .all(year, ...uniqueParts) as (PartVolumeRow & { part_id: number })[];
      for (const r of rows) maps.partVolumeByYear.set(partYearKey(r.part_id, year), r);
    } catch (_) {}
    try {
      const rows = db
        .prepare(
          `SELECT part_id, volume_value, volume_unit, volume_origin FROM part_volume_contract_by_year WHERE year = ? AND part_id IN (${ph})`
        )
        .all(year, ...uniqueParts) as (PartVolumeRow & { part_id: number })[];
      for (const r of rows) maps.partVolumeContractByYear.set(partYearKey(r.part_id, year), r);
    } catch (_) {}
    try {
      const rows = db
        .prepare(`SELECT part_id, share_percent FROM part_volume_share_by_year WHERE year = ? AND part_id IN (${ph})`)
        .all(year, ...uniqueParts) as { part_id: number; share_percent: number }[];
      for (const r of rows) maps.partShareByYear.set(partYearKey(r.part_id, year), r.share_percent);
    } catch (_) {}
    try {
      const rows = db
        .prepare(`SELECT part_id, share_percent FROM part_volume_contract_share_by_year WHERE year = ? AND part_id IN (${ph})`)
        .all(year, ...uniqueParts) as { part_id: number; share_percent: number }[];
      for (const r of rows) maps.partContractShareByYear.set(partYearKey(r.part_id, year), r.share_percent);
    } catch (_) {}
  }

  return maps;
}

/** Prefetch wolumenów dla zakresu lat. */
export function buildVolumePrefetchForYearRange(
  yearFrom: number,
  yearTo: number,
  projectIds: number[],
  partIds: number[]
): Map<number, VolumePrefetchMaps> {
  const byYear = new Map<number, VolumePrefetchMaps>();
  for (let y = yearFrom; y <= yearTo; y++) {
    byYear.set(y, buildVolumePrefetchForYear(y, projectIds, partIds));
  }
  return byYear;
}

export function collectProjectPartIdsFromOperations(operations: { project_id?: number | null; part_id?: number | null }[]): {
  projectIds: number[];
  partIds: number[];
} {
  const projectSet = new Set<number>();
  const partSet = new Set<number>();
  for (const o of operations) {
    const pid = Number(o.project_id);
    const partId = Number(o.part_id);
    if (Number.isFinite(pid) && pid > 0) projectSet.add(pid);
    if (Number.isFinite(partId) && partId > 0) partSet.add(partId);
  }
  return { projectIds: [...projectSet], partIds: [...partSet] };
}

function volumeOriginFromRow(
  row: { volume_origin?: string } | undefined,
  fallback: VolumeEntryOrigin,
  normalize: (raw: unknown) => VolumeEntryOrigin
): VolumeEntryOrigin {
  return normalize(row?.volume_origin ?? fallback);
}

/** Lookup produkcyjny — ta sama logika co getEffectiveVolumeForPart, bez SQL. */
export function lookupEffectiveVolumeForPart(
  projectId: number,
  partId: number,
  year: number,
  maps: VolumePrefetchMaps,
  parseSopEop: (v: unknown) => { month: number; year: number } | null,
  normalize: (raw: unknown) => VolumeEntryOrigin
): EffectiveVolumeResult | null {
  const pv = maps.projectVolumes.get(pvKey(projectId, year));
  const projectEop = maps.projectEop.get(projectId) ?? null;
  const part = maps.parts.get(partId);
  const partVol = maps.partVolumeByYear.get(partYearKey(partId, year));

  const eopYear = parseSopEop(projectEop)?.year ?? null;
  const isAfterEop = eopYear != null && year > eopYear;
  const countAfterEop = isAfterEop && pv && Number(pv.include_in_calculator_after_eop) === 1;

  const mode = part?.volume_mode ?? 'project';
  if (mode === 'override') {
    if (partVol)
      return {
        volume_value: partVol.volume_value,
        volume_unit: partVol.volume_unit as EffectiveVolumeResult['volume_unit'],
        count_after_eop: countAfterEop || undefined,
        volume_origin: volumeOriginFromRow(partVol, 'manual_year', normalize),
      };
    if (part?.default_volume_value != null && part?.default_volume_unit) {
      const u = ['annual', 'monthly', 'weekly'].includes(part.default_volume_unit) ? part.default_volume_unit : 'annual';
      return {
        volume_value: Number(part.default_volume_value),
        volume_unit: u as EffectiveVolumeResult['volume_unit'],
        count_after_eop: countAfterEop || undefined,
        volume_origin: 'default_all_years',
      };
    }
  }
  if (mode === 'project' && pv) {
    return {
      volume_value: pv.volume_value,
      volume_unit: pv.volume_unit as EffectiveVolumeResult['volume_unit'],
      count_after_eop: countAfterEop || undefined,
      volume_origin: volumeOriginFromRow(pv, 'manual_year', normalize),
    };
  }
  if (mode === 'share' && pv) {
    let sharePct: number | null = maps.partShareByYear.get(partYearKey(partId, year)) ?? null;
    if (sharePct == null) sharePct = part?.volume_share_percent ?? null;
    if (sharePct != null) {
      const share = Math.max(0, Math.min(100, Number(sharePct))) / 100;
      return {
        volume_value: pv.volume_value * share,
        volume_unit: pv.volume_unit as EffectiveVolumeResult['volume_unit'],
        count_after_eop: countAfterEop || undefined,
        volume_origin: volumeOriginFromRow(pv, 'manual_year', normalize),
      };
    }
  }
  return null;
}

/** Lookup kontraktowy — ta sama logika co getEffectiveVolumeForPartContract, bez SQL. */
export function lookupEffectiveVolumeForPartContract(
  projectId: number,
  partId: number,
  year: number,
  maps: VolumePrefetchMaps,
  parseSopEop: (v: unknown) => { month: number; year: number } | null,
  normalize: (raw: unknown) => VolumeEntryOrigin
): EffectiveVolumeResult | null {
  const pvc = maps.projectVolumesContract.get(pvKey(projectId, year));
  const pvProd = maps.projectVolumes.get(pvKey(projectId, year));
  const projectEop = maps.projectEop.get(projectId) ?? null;
  const part = maps.parts.get(partId);
  const partVolC = maps.partVolumeContractByYear.get(partYearKey(partId, year));

  const eopYear = parseSopEop(projectEop)?.year ?? null;
  const isAfterEop = eopYear != null && year > eopYear;
  const pvForEop = pvc ?? pvProd;
  const countAfterEop = isAfterEop && pvForEop && Number(pvForEop.include_in_calculator_after_eop) === 1;

  const mode = part?.contract_volume_mode ?? 'project';
  if (mode === 'override') {
    if (partVolC) {
      return {
        volume_value: partVolC.volume_value,
        volume_unit: partVolC.volume_unit as EffectiveVolumeResult['volume_unit'],
        count_after_eop: countAfterEop || undefined,
        volume_origin: volumeOriginFromRow(partVolC, 'manual_year', normalize),
      };
    }
    if (part?.contract_default_volume_value != null && part?.contract_default_volume_unit) {
      const u = ['annual', 'monthly', 'weekly'].includes(part.contract_default_volume_unit)
        ? part.contract_default_volume_unit
        : 'annual';
      return {
        volume_value: Number(part.contract_default_volume_value),
        volume_unit: u as EffectiveVolumeResult['volume_unit'],
        count_after_eop: countAfterEop || undefined,
        volume_origin: 'default_all_years',
      };
    }
    return { volume_value: 0, volume_unit: 'annual', count_after_eop: countAfterEop || undefined, volume_origin: 'manual_year' };
  }
  if (mode === 'project' && pvc && Number(pvc.volume_value) > 0) {
    return {
      volume_value: pvc.volume_value,
      volume_unit: pvc.volume_unit as EffectiveVolumeResult['volume_unit'],
      count_after_eop: countAfterEop || undefined,
      volume_origin: volumeOriginFromRow(pvc, 'manual_year', normalize),
    };
  }
  if (mode === 'share' && pvc && Number(pvc.volume_value) > 0) {
    let sharePct: number | null = maps.partContractShareByYear.get(partYearKey(partId, year)) ?? null;
    if (sharePct == null) sharePct = part?.contract_volume_share_percent ?? null;
    if (sharePct != null) {
      const share = Math.max(0, Math.min(100, Number(sharePct))) / 100;
      return {
        volume_value: pvc.volume_value * share,
        volume_unit: pvc.volume_unit as EffectiveVolumeResult['volume_unit'],
        count_after_eop: countAfterEop || undefined,
        volume_origin: volumeOriginFromRow(pvc, 'manual_year', normalize),
      };
    }
  }
  return null;
}

export function lookupEffectiveVolumeForPartPreferContract(
  projectId: number,
  partId: number,
  year: number,
  maps: VolumePrefetchMaps,
  useContractual: boolean,
  parseSopEop: (v: unknown) => { month: number; year: number } | null,
  normalize: (raw: unknown) => VolumeEntryOrigin
): EffectiveVolumeResult | null {
  if (!useContractual) return lookupEffectiveVolumeForPart(projectId, partId, year, maps, parseSopEop, normalize);
  return (
    lookupEffectiveVolumeForPartContract(projectId, partId, year, maps, parseSopEop, normalize) ??
    lookupEffectiveVolumeForPart(projectId, partId, year, maps, parseSopEop, normalize)
  );
}
