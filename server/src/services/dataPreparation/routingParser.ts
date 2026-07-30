/**
 * Parser SAP „Task List Print List” (routing.txt) — Data preparation.
 * Kodowanie: utf-8-sig; liczby EU: 1.000,000 → 1000; 0,500 → 0.5.
 */

export type RoutingComponent = {
  materialNumber: string;
  description: string;
  level: number;
};

export type RoutingOperation = {
  workCenter: string;
  description: string;
  baseQty: number | null;
  machineH: number | null;
};

export type RoutingIndex = {
  materialDesc: Map<string, string>;
  /** parent material → komponenty (dedupe parent+child) */
  components: Map<string, RoutingComponent[]>;
  operations: Map<string, RoutingOperation[]>;
  /** materiały z niepustym opisem */
  materialsWithDesc: number;
  /** materiały mające ≥1 komponent */
  materialsWithComponents: number;
};

export function parseEuNumber(raw: string): number | null {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  // EU: 1.000,000 lub 0,500
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Wymiary L×W z opisu; null gdy brak. */
export function parseDimensions(description: string): { length: number; width: number } | null {
  const m = String(description ?? '').match(/(\d{3,4})\s*[xX]\s*(\d{3,4})/);
  if (!m) return null;
  const length = Number(m[1]);
  const width = Number(m[2]);
  if (!Number.isFinite(length) || !Number.isFinite(width)) return null;
  return { length, width };
}

/** S2102 z wymiarami — odrzuca warianty bez LxW (np. Phantom). */
export function isS2102Formatka(description: string): boolean {
  const d = String(description ?? '').trim();
  if (!/^S2102\b/i.test(d)) return false;
  return parseDimensions(d) != null;
}

export function isS1619(description: string): boolean {
  return /^S1619\b/i.test(String(description ?? '').trim());
}

function normMat(v: string): string {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\.0+$/, '');
}

function decodeRoutingBuffer(buffer: Buffer): string {
  // utf-8-sig
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.slice(3).toString('utf8');
  }
  let text = buffer.toString('utf8');
  if (text.includes('\uFFFD') || !/Material\s+\d{6,}/.test(text)) {
    text = buffer.toString('latin1');
  }
  return text;
}

export function parseRoutingText(text: string): RoutingIndex {
  const lines = String(text ?? '').split(/\r?\n/);
  const materialDesc = new Map<string, string>();
  const components = new Map<string, RoutingComponent[]>();
  const operations = new Map<string, RoutingOperation[]>();
  const seenComp = new Map<string, Set<string>>();

  let currentMat: string | null = null;
  let expectDesc = false;
  let pendingComp: { materialNumber: string; description: string } | null = null;
  let pendingOp: Partial<RoutingOperation> | null = null;

  const materialRe = /^Material\s+(\d{6,})\s+Plant/i;
  const compRe = /^\s*Mat\.\s*Comp\.\s+(\d+)\s+(.*)$/i;
  const levelRe = /^\s*Level\s+(\d+)\b/i;
  const opRe = /^\s*Operation\s+\d+\s+Work\s+Ctr\s+(\S+)\s+(.*)$/i;
  const baseQtyRe = /^\s*Base\s+Qty\s+([\d.,]+)/i;
  const machineRe = /Machine\s+([\d.,]+)\s*H/i;

  const ensureMat = (mat: string) => {
    if (!components.has(mat)) components.set(mat, []);
    if (!operations.has(mat)) operations.set(mat, []);
    if (!seenComp.has(mat)) seenComp.set(mat, new Set());
  };

  const flushOp = () => {
    if (!currentMat || !pendingOp?.workCenter) {
      pendingOp = null;
      return;
    }
    ensureMat(currentMat);
    operations.get(currentMat)!.push({
      workCenter: pendingOp.workCenter,
      description: pendingOp.description ?? '',
      baseQty: pendingOp.baseQty ?? null,
      machineH: pendingOp.machineH ?? null,
    });
    pendingOp = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\u00a0/g, ' ');
    const trimmed = line.trim();

    // ignoruj nagłówki stron / same myślniki
    if (!trimmed) continue;
    if (/^-{10,}$/.test(trimmed)) continue;
    if (/Task List Print List/i.test(trimmed) && /^\d{2}\.\d{2}\.\d{4}/.test(trimmed)) continue;

    const matM = materialRe.exec(line);
    if (matM) {
      flushOp();
      pendingComp = null;
      currentMat = normMat(matM[1]);
      ensureMat(currentMat);
      expectDesc = true;
      continue;
    }

    if (expectDesc && currentMat) {
      if (/^(Group|LSize|Use)\b/i.test(trimmed)) {
        expectDesc = false;
      } else if (trimmed && !materialDesc.has(currentMat)) {
        materialDesc.set(currentMat, trimmed);
        expectDesc = false;
        continue;
      } else {
        expectDesc = false;
      }
    }

    if (!currentMat) continue;

    const opM = opRe.exec(line);
    if (opM) {
      flushOp();
      pendingOp = {
        workCenter: String(opM[1]).trim(),
        description: String(opM[2] ?? '').trim(),
        baseQty: null,
        machineH: null,
      };
      continue;
    }

    if (pendingOp) {
      const bq = baseQtyRe.exec(line);
      if (bq) pendingOp.baseQty = parseEuNumber(bq[1]);
      const mh = machineRe.exec(line);
      if (mh) pendingOp.machineH = parseEuNumber(mh[1]);
    }

    const cm = compRe.exec(line);
    if (cm) {
      flushOp();
      pendingComp = {
        materialNumber: normMat(cm[1]),
        description: String(cm[2] ?? '').trim(),
      };
      continue;
    }

    if (pendingComp) {
      const lv = levelRe.exec(line);
      if (lv) {
        const child = pendingComp.materialNumber;
        const desc = pendingComp.description;
        const level = Number(lv[1]);
        const key = `${currentMat}|${child}`;
        const seen = seenComp.get(currentMat)!;
        if (!seen.has(key)) {
          seen.add(key);
          components.get(currentMat)!.push({
            materialNumber: child,
            description: desc,
            level: Number.isFinite(level) ? level : 0,
          });
        }
        // uzupełnij opis materiału komponentu, jeśli jeszcze brak
        if (desc && !materialDesc.has(child)) {
          materialDesc.set(child, desc);
        }
        pendingComp = null;
      }
    }
  }
  flushOp();

  let materialsWithComponents = 0;
  for (const list of components.values()) {
    if (list.length > 0) materialsWithComponents++;
  }

  return {
    materialDesc,
    components,
    operations,
    materialsWithDesc: materialDesc.size,
    materialsWithComponents,
  };
}

export function parseRoutingBuffer(buffer: Buffer): RoutingIndex {
  return parseRoutingText(decodeRoutingBuffer(buffer));
}

/** Opis do rozpoznania typu: preferuj materialDesc, potem opis z linii Mat. Comp. */
export function resolveMaterialDescription(index: RoutingIndex, materialNumber: string, fallbackDesc = ''): string {
  const n = normMat(materialNumber);
  return index.materialDesc.get(n) || fallbackDesc || '';
}
