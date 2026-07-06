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
