import { useCallback, useState, type CSSProperties } from 'react';

export type SortDirection = 'asc' | 'desc';

export const SORTABLE_TH_BASE: CSSProperties = {
  padding: '0.75rem',
  textAlign: 'left',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};

export function sortIndicator(active: boolean, dir: SortDirection): string {
  if (!active) return '';
  return dir === 'asc' ? ' ↑' : ' ↓';
}

export function useTableSort<T extends string>(defaultCol: T, defaultDir: SortDirection = 'asc') {
  const [sortCol, setSortCol] = useState<T>(defaultCol);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultDir);
  const toggle = useCallback(
    (col: T) => {
      if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortCol(col);
        setSortDir('asc');
      }
    },
    [sortCol]
  );
  const mark = useCallback((col: T) => sortIndicator(sortCol === col, sortDir), [sortCol, sortDir]);
  return { sortCol, sortDir, toggle, mark };
}

export function sortRows<T, C extends string>(
  rows: T[],
  sortCol: C,
  sortDir: SortDirection,
  getValue: (row: T, col: C) => string | number
): T[] {
  const mul = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = getValue(a, sortCol);
    const vb = getValue(b, sortCol);
    if (typeof va === 'number' && typeof vb === 'number') return mul * (va - vb);
    return mul * String(va).localeCompare(String(vb), 'pl', { numeric: true, sensitivity: 'base' });
  });
}
