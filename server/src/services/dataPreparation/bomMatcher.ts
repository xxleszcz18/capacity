/**
 * BFS „najpłytszy poziom” po strukturze materiałowej z routing.txt.
 */

import { BFS_MAX_DEPTH } from './config.js';
import {
  isS1619,
  isS2102Formatka,
  parseDimensions,
  resolveMaterialDescription,
  type RoutingComponent,
  type RoutingIndex,
} from './routingParser.js';

export type MatchedMaterial = {
  materialNumber: string;
  description: string;
  length: number | null;
  width: number | null;
  area: number | null;
  bfsLevel: number;
};

function normMat(v: string): string {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\.0+$/, '');
}

function toMatched(
  index: RoutingIndex,
  comp: RoutingComponent,
  bfsLevel: number,
  kind: 'S2102' | 'S1619'
): MatchedMaterial | null {
  const desc = resolveMaterialDescription(index, comp.materialNumber, comp.description);
  if (kind === 'S2102') {
    if (!isS2102Formatka(desc) && !isS2102Formatka(comp.description)) return null;
    const useDesc = isS2102Formatka(desc) ? desc : comp.description;
    const dim = parseDimensions(useDesc);
    if (!dim) return null;
    return {
      materialNumber: normMat(comp.materialNumber),
      description: useDesc,
      length: dim.length,
      width: dim.width,
      area: dim.length * dim.width,
      bfsLevel,
    };
  }
  if (!isS1619(desc) && !isS1619(comp.description)) return null;
  const useDesc = isS1619(desc) ? desc : comp.description;
  const dim = parseDimensions(useDesc);
  return {
    materialNumber: normMat(comp.materialNumber),
    description: useDesc,
    length: dim?.length ?? null,
    width: dim?.width ?? null,
    area: dim ? dim.length * dim.width : null,
    bfsLevel,
  };
}

/**
 * Szuka materiałów pasujących do kind, zatrzymując się na pierwszym poziomie BFS z ≥1 trafieniem.
 */
export function findShallowestMatches(
  index: RoutingIndex,
  startErp: string,
  kind: 'S2102' | 'S1619'
): MatchedMaterial[] {
  const start = normMat(startErp);
  if (!start) return [];

  const visited = new Set<string>();
  let frontier: string[] = [start];
  visited.add(start);

  for (let depth = 1; depth <= BFS_MAX_DEPTH; depth++) {
    if (!frontier.length) break;
    const matches: MatchedMaterial[] = [];
    const next: string[] = [];

    for (const parent of frontier) {
      const comps = index.components.get(parent) ?? [];
      for (const comp of comps) {
        const child = normMat(comp.materialNumber);
        const hit = toMatched(index, comp, depth, kind);
        if (hit) matches.push(hit);
        if (child && !visited.has(child)) {
          visited.add(child);
          next.push(child);
        }
      }
    }

    if (matches.length > 0) {
      // dedupe po numerze materiału
      const byNum = new Map<string, MatchedMaterial>();
      for (const m of matches) {
        if (!byNum.has(m.materialNumber)) byNum.set(m.materialNumber, m);
      }
      return [...byNum.values()];
    }
    frontier = next;
  }
  return [];
}

/** Sort malejąco po L×W (area). */
export function sortByAreaDesc(items: MatchedMaterial[]): MatchedMaterial[] {
  return [...items].sort((a, b) => (b.area ?? 0) - (a.area ?? 0));
}
