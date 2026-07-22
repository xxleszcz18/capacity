export type DimFilterOp = '' | 'gte' | 'lte';
export type DimFilterRow = { op: DimFilterOp; value: string };
export type DimFiltersState = { width: DimFilterRow; depth: DimFilterRow; height: DimFilterRow; stroke: DimFilterRow };

export const EMPTY_DIM_FILTER: DimFilterRow = { op: '', value: '' };
export const EMPTY_DIM_FILTERS: DimFiltersState = {
  width: { ...EMPTY_DIM_FILTER },
  depth: { ...EMPTY_DIM_FILTER },
  height: { ...EMPTY_DIM_FILTER },
  stroke: { ...EMPTY_DIM_FILTER },
};

export function dimFilterActive(row: DimFilterRow): boolean {
  if (row.op !== 'gte' && row.op !== 'lte') return false;
  const n = Number(String(row.value).trim().replace(',', '.'));
  return row.value.trim() !== '' && Number.isFinite(n);
}

export function buildDimensionApiParams(dims: DimFiltersState): {
  widthOp?: 'gte' | 'lte';
  widthValue?: number;
  depthOp?: 'gte' | 'lte';
  depthValue?: number;
  heightOp?: 'gte' | 'lte';
  heightValue?: number;
  strokeOp?: 'gte' | 'lte';
  strokeValue?: number;
} {
  const out: ReturnType<typeof buildDimensionApiParams> = {};
  const pairs: { key: keyof DimFiltersState; prefix: 'width' | 'depth' | 'height' | 'stroke' }[] = [
    { key: 'width', prefix: 'width' },
    { key: 'depth', prefix: 'depth' },
    { key: 'height', prefix: 'height' },
    { key: 'stroke', prefix: 'stroke' },
  ];
  for (const { key, prefix } of pairs) {
    const row = dims[key];
    if (!dimFilterActive(row)) continue;
    const val = Number(String(row.value).trim().replace(',', '.'));
    out[`${prefix}Op`] = row.op as 'gte' | 'lte';
    out[`${prefix}Value`] = val;
  }
  return out;
}

export function formatDimFilterSummary(dims: DimFiltersState, t: (k: string) => string): string {
  const parts: string[] = [];
  const labels: { key: keyof DimFiltersState; labelKey: string }[] = [
    { key: 'width', labelKey: 'calculator.dimWidth' },
    { key: 'depth', labelKey: 'calculator.dimDepth' },
    { key: 'height', labelKey: 'calculator.dimHeight' },
    { key: 'stroke', labelKey: 'calculator.dimStroke' },
  ];
  for (const { key, labelKey } of labels) {
    const row = dims[key];
    if (!dimFilterActive(row)) continue;
    const opLbl = row.op === 'gte' ? '≥' : '≤';
    parts.push(`${t(labelKey)} ${opLbl} ${row.value.trim()} mm`);
  }
  return parts.length ? parts.join('; ') : '';
}

export function hasActiveDimFilters(dims: DimFiltersState): boolean {
  return (['width', 'depth', 'height', 'stroke'] as const).some((k) => dimFilterActive(dims[k]));
}

export function dimFiltersEqual(a: DimFiltersState, b: DimFiltersState): boolean {
  return (['width', 'depth', 'height', 'stroke'] as const).every(
    (k) => a[k].op === b[k].op && a[k].value === b[k].value
  );
}

/** Stable key of API-relevant dimension filters (ignores incomplete op-without-value rows). */
export function dimensionApiParamsKey(dims: DimFiltersState): string {
  return JSON.stringify(buildDimensionApiParams(dims));
}

type MachineDimFields = {
  width_mm?: number | null;
  depth_mm?: number | null;
  height_mm?: number | null;
  stroke_mm?: number | null;
};

/** Client-side safety net when API returns width_mm/… on machines. */
export function machineMatchesDimFilters(machine: MachineDimFields, dims: DimFiltersState): boolean {
  const pairs: { key: keyof DimFiltersState; field: keyof MachineDimFields }[] = [
    { key: 'width', field: 'width_mm' },
    { key: 'depth', field: 'depth_mm' },
    { key: 'height', field: 'height_mm' },
    { key: 'stroke', field: 'stroke_mm' },
  ];
  for (const { key, field } of pairs) {
    const row = dims[key];
    if (!dimFilterActive(row)) continue;
    const raw = machine[field];
    if (raw == null || raw === ('' as unknown)) return false;
    const n = Number(raw);
    if (!Number.isFinite(n)) return false;
    const threshold = Number(String(row.value).trim().replace(',', '.'));
    if (row.op === 'gte' && n < threshold) return false;
    if (row.op === 'lte' && n > threshold) return false;
  }
  return true;
}

/** True when machine payload includes dimension fields (new API). */
export function machineHasDimFields(machine: MachineDimFields): boolean {
  return (
    Object.prototype.hasOwnProperty.call(machine, 'width_mm') ||
    Object.prototype.hasOwnProperty.call(machine, 'depth_mm') ||
    Object.prototype.hasOwnProperty.call(machine, 'height_mm') ||
    Object.prototype.hasOwnProperty.call(machine, 'stroke_mm')
  );
}

export type MachineDimLookup = Map<
  number,
  { width_mm: number | null; depth_mm: number | null; height_mm: number | null; stroke_mm: number | null }
>;

/** Merge dimension columns onto calculator rows (when API omits them) and apply active filters. */
export function filterMachinesByDimensionFilters<T extends { machine_id?: number } & MachineDimFields>(
  machines: T[],
  dims: DimFiltersState,
  dimLookup?: MachineDimLookup | null
): T[] {
  if (!hasActiveDimFilters(dims)) return machines;
  return machines.filter((m) => {
    let row: MachineDimFields = m;
    if (!machineHasDimFields(m) && dimLookup && m.machine_id != null) {
      const extra = dimLookup.get(Number(m.machine_id));
      if (extra) row = { ...m, ...extra };
    }
    return machineMatchesDimFilters(row, dims);
  });
}

export function buildMachineDimLookup(
  rows: {
    id?: number;
    machine_id?: number;
    width_mm?: number | null;
    depth_mm?: number | null;
    height_mm?: number | null;
    stroke_mm?: number | null;
  }[]
): MachineDimLookup {
  const map: MachineDimLookup = new Map();
  for (const r of rows) {
    const id = Number(r.id ?? r.machine_id);
    if (!Number.isFinite(id)) continue;
    map.set(id, {
      width_mm: r.width_mm != null && Number.isFinite(Number(r.width_mm)) ? Number(r.width_mm) : null,
      depth_mm: r.depth_mm != null && Number.isFinite(Number(r.depth_mm)) ? Number(r.depth_mm) : null,
      height_mm: r.height_mm != null && Number.isFinite(Number(r.height_mm)) ? Number(r.height_mm) : null,
      stroke_mm: r.stroke_mm != null && Number.isFinite(Number(r.stroke_mm)) ? Number(r.stroke_mm) : null,
    });
  }
  return map;
}
