function parseCsvOrTsv(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.length);
  const sep = text.includes('\t') ? '\t' : ',';
  return lines.map((line) => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (!inQuotes && (c === sep || c === ',')) {
        out.push(cur.trim());
        cur = '';
        if (c === ',') continue;
      } else cur += c;
    }
    out.push(cur.trim());
    return out;
  });
}

function parseNumericCell(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function looksLikeHeader(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const y = cells[0].toLowerCase();
  const v = cells[1].toLowerCase();
  return (/^(rok|year|lata?)$/.test(y) || y.includes('rok')) && (/^(warto|value|ilo|qty|wolumen|volume)/.test(v) || v.includes('warto'));
}

/** Parsuje wklejoną tabelę (TSV/CSV): kolumna 1 = rok, kolumna 2 = wartość roczna. */
export function parseYearValuePaste(text: string): { year: number; value: number }[] {
  const rows = parseCsvOrTsv(text);
  if (rows.length === 0) return [];
  const dataRows = looksLikeHeader(rows[0]) ? rows.slice(1) : rows;
  const byYear = new Map<number, number>();
  for (const cells of dataRows) {
    if (cells.length < 2) continue;
    const year = parseInt(cells[0].replace(/\s/g, ''), 10);
    const value = parseNumericCell(cells[1]);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) continue;
    if (value == null || value < 0) continue;
    byYear.set(year, value);
  }
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, value]) => ({ year, value }));
}
