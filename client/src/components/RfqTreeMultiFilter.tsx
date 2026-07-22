import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { lineKey } from '../utils/capacityTrends';

export type RfqFilterOperation = {
  id: number;
  label: string;
  machine_id: number;
  location: string | null;
};
export type RfqFilterPart = { id: number; label: string; operations: RfqFilterOperation[] };
export type RfqFilterProject = { id: number; name: string; parts: RfqFilterPart[] };
export type RfqFilterClient = { client: string; projects: RfqFilterProject[] };
export type RfqFilterTree = { clients: RfqFilterClient[] };

function collectOpIdsFromPart(part: RfqFilterPart): number[] {
  return part.operations.map((o) => o.id);
}

function collectOpIdsFromProject(project: RfqFilterProject): number[] {
  return project.parts.flatMap(collectOpIdsFromPart);
}

function collectOpIdsFromClient(client: RfqFilterClient): number[] {
  return client.projects.flatMap(collectOpIdsFromProject);
}

function selectionState(ids: number[], selected: Set<number>): 'all' | 'some' | 'none' {
  if (!ids.length) return 'none';
  let n = 0;
  for (const id of ids) if (selected.has(id)) n += 1;
  if (n === 0) return 'none';
  if (n === ids.length) return 'all';
  return 'some';
}

function toggleIds(selected: number[], ids: number[], on: boolean): number[] {
  const set = new Set(selected);
  if (on) for (const id of ids) set.add(id);
  else for (const id of ids) set.delete(id);
  return [...set];
}

export function projectNamesForSelectedOps(tree: RfqFilterTree | null, selectedOpIds: number[]): string[] {
  if (!tree?.clients?.length || !selectedOpIds.length) return [];
  const selected = new Set(selectedOpIds);
  const names: string[] = [];
  const seen = new Set<number>();
  for (const c of tree.clients) {
    for (const p of c.projects) {
      const opIds = collectOpIdsFromProject(p);
      if (!opIds.some((id) => selected.has(id))) continue;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      names.push(p.name);
    }
  }
  return names;
}

/** Nazwy projektów RFQ wpływających na daną linię (po lokalizacji maszyn). */
export function projectNamesForLine(
  tree: RfqFilterTree | null,
  selectedOpIds: number[],
  line: string
): string[] {
  if (!tree?.clients?.length || !selectedOpIds.length) return [];
  const selected = new Set(selectedOpIds);
  const names: string[] = [];
  const seen = new Set<number>();
  for (const c of tree.clients) {
    for (const p of c.projects) {
      for (const part of p.parts) {
        for (const op of part.operations) {
          if (!selected.has(op.id)) continue;
          if (lineKey(op.location) !== line) continue;
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          names.push(p.name);
        }
      }
    }
  }
  return names;
}

/** Nazwy projektów RFQ wpływających na daną maszynę. */
export function projectNamesForMachine(
  tree: RfqFilterTree | null,
  selectedOpIds: number[],
  machineId: number
): string[] {
  if (!tree?.clients?.length || !selectedOpIds.length) return [];
  const selected = new Set(selectedOpIds);
  const names: string[] = [];
  const seen = new Set<number>();
  for (const c of tree.clients) {
    for (const p of c.projects) {
      for (const part of p.parts) {
        for (const op of part.operations) {
          if (!selected.has(op.id)) continue;
          if (Number(op.machine_id) !== Number(machineId)) continue;
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          names.push(p.name);
        }
      }
    }
  }
  return names;
}

/** Linie (lokalizacje) maszyn hostujących wybrane operacje RFQ. */
export function linesForSelectedRfqOps(tree: RfqFilterTree | null, selectedOpIds: number[]): string[] {
  if (!tree?.clients?.length || !selectedOpIds.length) return [];
  const selected = new Set(selectedOpIds);
  const out = new Set<string>();
  for (const c of tree.clients) {
    for (const p of c.projects) {
      for (const part of p.parts) {
        for (const op of part.operations) {
          if (!selected.has(op.id)) continue;
          const line = lineKey(op.location);
          if (line) out.add(line);
        }
      }
    }
  }
  return [...out];
}

/** ID maszyn hostujących wybrane operacje RFQ. */
export function machineIdsForSelectedRfqOps(tree: RfqFilterTree | null, selectedOpIds: number[]): number[] {
  if (!tree?.clients?.length || !selectedOpIds.length) return [];
  const selected = new Set(selectedOpIds);
  const out = new Set<number>();
  for (const c of tree.clients) {
    for (const p of c.projects) {
      for (const part of p.parts) {
        for (const op of part.operations) {
          if (!selected.has(op.id)) continue;
          const mid = Number(op.machine_id);
          if (Number.isFinite(mid) && mid > 0) out.add(mid);
        }
      }
    }
  }
  return [...out];
}

export default function RfqTreeMultiFilter({
  tree,
  selected,
  onChange,
  noneLabel,
  clearLabel,
  emptyLabel,
  loadingLabel,
  searchPlaceholder,
  style,
}: {
  tree: RfqFilterTree | null;
  selected: number[];
  onChange: (next: number[]) => void;
  noneLabel: string;
  clearLabel: string;
  emptyLabel: string;
  loadingLabel: string;
  searchPlaceholder: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedClients, setExpandedClients] = useState<Set<string>>(() => new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(() => new Set());
  const [expandedParts, setExpandedParts] = useState<Set<number>>(() => new Set());
  const wrapRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn, true);
    return () => document.removeEventListener('mousedown', fn, true);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const summary = useMemo(() => {
    if (!selected.length) return noneLabel;
    const names = projectNamesForSelectedOps(tree, selected);
    if (names.length === 1) return names[0];
    if (names.length > 1) return `${names.length}: ${names.slice(0, 2).join(', ')}${names.length > 2 ? '…' : ''}`;
    return String(selected.length);
  }, [selected, tree, noneLabel]);

  const q = query.trim().toLowerCase();
  const visibleClients = useMemo(() => {
    const clients = tree?.clients ?? [];
    if (!q) return clients;
    return clients
      .map((c) => {
        const projects = c.projects
          .map((p) => {
            const parts = p.parts
              .map((part) => {
                const operations = part.operations.filter(
                  (op) =>
                    op.label.toLowerCase().includes(q) ||
                    part.label.toLowerCase().includes(q) ||
                    p.name.toLowerCase().includes(q) ||
                    c.client.toLowerCase().includes(q)
                );
                if (
                  operations.length ||
                  part.label.toLowerCase().includes(q) ||
                  p.name.toLowerCase().includes(q) ||
                  c.client.toLowerCase().includes(q)
                ) {
                  return {
                    ...part,
                    operations: operations.length ? operations : part.operations,
                  };
                }
                return null;
              })
              .filter((x): x is RfqFilterPart => x != null);
            if (parts.length || p.name.toLowerCase().includes(q) || c.client.toLowerCase().includes(q)) {
              return { ...p, parts: parts.length ? parts : p.parts };
            }
            return null;
          })
          .filter((x): x is RfqFilterProject => x != null);
        if (projects.length || c.client.toLowerCase().includes(q)) {
          return { ...c, projects: projects.length ? projects : c.projects };
        }
        return null;
      })
      .filter((x): x is RfqFilterClient => x != null);
  }, [tree, q]);

  const toggleExpand = <T,>(set: Set<T>, key: T, setter: (n: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const renderCheckbox = (ids: number[], label: string) => {
    const state = selectionState(ids, selectedSet);
    return (
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 6,
          padding: '2px 0',
          fontSize: 12,
          cursor: 'pointer',
          lineHeight: 1.35,
        }}
      >
        <input
          type="checkbox"
          checked={state === 'all'}
          ref={(el) => {
            if (el) el.indeterminate = state === 'some';
          }}
          onChange={() => onChange(toggleIds(selected, ids, state !== 'all'))}
          style={{ marginTop: 2 }}
        />
        <span>{label}</span>
      </label>
    );
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', minWidth: 160, ...style }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '4px 8px',
          fontSize: 12,
          border: '1px solid #bdbdbd',
          borderRadius: 4,
          background: selected.length > 0 ? '#e8f5e9' : '#fff',
          cursor: 'pointer',
          lineHeight: 1.35,
        }}
      >
        {summary}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 4000,
            left: 0,
            minWidth: 280,
            maxWidth: 420,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #bdbdbd',
            borderRadius: 6,
            padding: '8px 10px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ width: '100%', marginBottom: 8, padding: '4px 6px', fontSize: 12, boxSizing: 'border-box' }}
            autoFocus
          />
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              style={{
                display: 'block',
                width: '100%',
                marginBottom: 8,
                padding: '4px 6px',
                fontSize: 12,
                border: '1px solid #ccc',
                borderRadius: 4,
                background: '#fafafa',
                cursor: 'pointer',
              }}
            >
              {clearLabel}
            </button>
          )}
          {!tree ? (
            <p style={{ margin: 0, fontSize: 13, color: '#666' }}>{loadingLabel}</p>
          ) : visibleClients.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: '#666' }}>{emptyLabel}</p>
          ) : (
            visibleClients.map((c) => {
              const clientIds = collectOpIdsFromClient(c);
              const clientOpen = expandedClients.has(c.client) || Boolean(q);
              return (
                <div key={c.client} style={{ marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                    <button
                      type="button"
                      aria-expanded={clientOpen}
                      onClick={() => toggleExpand(expandedClients, c.client, setExpandedClients)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: 11,
                        padding: '2px 4px',
                        lineHeight: 1.35,
                      }}
                    >
                      {clientOpen ? '▼' : '▶'}
                    </button>
                    <div style={{ flex: 1 }}>{renderCheckbox(clientIds, c.client)}</div>
                  </div>
                  {clientOpen &&
                    c.projects.map((p) => {
                      const projectIds = collectOpIdsFromProject(p);
                      const projectOpen = expandedProjects.has(p.id) || Boolean(q);
                      return (
                        <div key={p.id} style={{ marginLeft: 12, marginTop: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                            <button
                              type="button"
                              aria-expanded={projectOpen}
                              onClick={() => toggleExpand(expandedProjects, p.id, setExpandedProjects)}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: 11,
                                padding: '2px 4px',
                              }}
                            >
                              {projectOpen ? '▼' : '▶'}
                            </button>
                            <div style={{ flex: 1 }}>{renderCheckbox(projectIds, p.name)}</div>
                          </div>
                          {projectOpen &&
                            p.parts.map((part) => {
                              const partIds = collectOpIdsFromPart(part);
                              const partOpen = expandedParts.has(part.id) || Boolean(q);
                              return (
                                <div key={part.id} style={{ marginLeft: 12, marginTop: 2 }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                                    <button
                                      type="button"
                                      aria-expanded={partOpen}
                                      onClick={() => toggleExpand(expandedParts, part.id, setExpandedParts)}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        fontSize: 11,
                                        padding: '2px 4px',
                                      }}
                                    >
                                      {partOpen ? '▼' : '▶'}
                                    </button>
                                    <div style={{ flex: 1 }}>{renderCheckbox(partIds, part.label)}</div>
                                  </div>
                                  {partOpen &&
                                    part.operations.map((op) => (
                                      <div key={op.id} style={{ marginLeft: 28 }}>
                                        {renderCheckbox([op.id], op.label)}
                                      </div>
                                    ))}
                                </div>
                              );
                            })}
                        </div>
                      );
                    })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
