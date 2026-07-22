export type MachineDimensionField = 'width_mm' | 'depth_mm' | 'height_mm' | 'stroke_mm';
export type MachineDimensionOp = 'gte' | 'lte';

export type MachineDimensionFilter = {
  field: MachineDimensionField;
  op: MachineDimensionOp;
  value: number;
};

const QUERY_KEYS: { prefix: string; field: MachineDimensionField }[] = [
  { prefix: 'width', field: 'width_mm' },
  { prefix: 'depth', field: 'depth_mm' },
  { prefix: 'height', field: 'height_mm' },
  { prefix: 'stroke', field: 'stroke_mm' },
];

function firstQueryValue(raw: unknown): unknown {
  return Array.isArray(raw) ? raw[0] : raw;
}

function parseOp(raw: unknown): MachineDimensionOp | null {
  const s = String(firstQueryValue(raw) ?? '')
    .trim()
    .toLowerCase();
  if (
    s === 'gte' ||
    s === '>=' ||
    s === '≥' ||
    s === 'ge' ||
    s === 'gt' ||
    s === '>' ||
    s === 'wieksze' ||
    s === 'większe' ||
    s === 'wiecej' ||
    s === 'więcej'
  ) {
    return 'gte';
  }
  if (
    s === 'lte' ||
    s === '<=' ||
    s === '≤' ||
    s === 'le' ||
    s === 'lt' ||
    s === '<' ||
    s === 'mniejsze' ||
    s === 'mniej'
  ) {
    return 'lte';
  }
  return null;
}

function parseValue(raw: unknown): number | null {
  const v = firstQueryValue(raw);
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Odczyt filtrów wymiarów z query string (widthOp/widthValue, depthOp/depthValue, …). */
export function parseMachineDimensionFiltersFromQuery(query: Record<string, unknown>): MachineDimensionFilter[] {
  const out: MachineDimensionFilter[] = [];
  for (const { prefix, field } of QUERY_KEYS) {
    const op = parseOp(query[`${prefix}Op`]);
    const value = parseValue(query[`${prefix}Value`]);
    if (op != null && value != null) out.push({ field, op, value });
  }
  return out;
}

export function appendMachineDimensionFilters(filters: MachineDimensionFilter[] | undefined): {
  clause: string;
  params: number[];
} {
  if (!filters?.length || !Array.isArray(filters)) return { clause: '1=1', params: [] };
  const allowed = new Set<MachineDimensionField>(['width_mm', 'depth_mm', 'height_mm', 'stroke_mm']);
  const parts: string[] = [];
  const params: number[] = [];
  for (const f of filters) {
    if (!f || typeof f !== 'object') continue;
    if (!allowed.has(f.field)) continue;
    if (f.op !== 'gte' && f.op !== 'lte') continue;
    const value = Number(f.value);
    if (!Number.isFinite(value)) continue;
    const cmp = f.op === 'gte' ? '>=' : '<=';
    parts.push(`m.${f.field} IS NOT NULL AND m.${f.field} ${cmp} ?`);
    params.push(value);
  }
  if (!parts.length) return { clause: '1=1', params: [] };
  return { clause: parts.join(' AND '), params };
}
