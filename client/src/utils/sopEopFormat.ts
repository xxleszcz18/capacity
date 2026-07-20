/** SOP/EOP w formacie miesiąc.rok (np. 2.2021, 12.2030) — rok zawsze 4 cyfry. */

export type SopEopParts = { month: number; year: number };

function yearFromFraction(fraction: number): number | null {
  const year = Math.round(fraction * 10000 + 1e-4);
  if (year < 1900 || year > 2200) return null;
  return year;
}

function parseFromNumeric(value: number): SopEopParts | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const month = Math.floor(value);
  if (month < 1 || month > 12) return null;
  const year = yearFromFraction(value - month);
  if (year == null) return null;
  return { month, year };
}

function expandYearDigits(yearStr: string): number | null {
  if (!/^\d+$/.test(yearStr)) return null;
  if (yearStr.length === 4) {
    const y = parseInt(yearStr, 10);
    return y >= 1900 && y <= 2200 ? y : null;
  }
  if (yearStr.length === 3) {
    const y = parseInt(`${yearStr}0`, 10);
    return y >= 1900 && y <= 2200 ? y : null;
  }
  if (yearStr.length === 2) {
    const y = 2000 + parseInt(yearStr, 10);
    return y >= 1900 && y <= 2200 ? y : null;
  }
  return null;
}

export function parseSopEop(value: unknown): SopEopParts | null {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return parseFromNumeric(value);
  }

  const s = String(value).trim();
  if (!s) return null;

  const dash = s.match(/^(\d{4})-(\d{1,2})$/);
  if (dash) {
    const year = parseInt(dash[1], 10);
    const month = parseInt(dash[2], 10);
    if (month >= 1 && month <= 12 && year >= 1900 && year <= 2200) return { month, year };
  }

  const dot = s.match(/^(\d{1,2})\.(\d+)$/);
  if (dot) {
    const month = parseInt(dot[1], 10);
    if (month >= 1 && month <= 12) {
      const year = expandYearDigits(dot[2]);
      if (year != null) return { month, year };
    }
  }

  if (/^\d+\.\d+$/.test(s)) {
    const fromNum = parseFromNumeric(Number(s));
    if (fromNum) return fromNum;
  }

  return null;
}

export function formatSopEop(value: unknown): string {
  const parsed = parseSopEop(value);
  if (!parsed) return String(value ?? '').trim();
  return `${parsed.month}.${parsed.year}`;
}

export function sopEopYearsRange(sop: unknown, eop: unknown): { years: number[]; startMonth?: number; endMonth?: number } {
  const sopP = parseSopEop(sop);
  const eopP = parseSopEop(eop);
  if (!sopP || !eopP || eopP.year < sopP.year) return { years: [] };
  const years: number[] = [];
  for (let y = sopP.year; y <= eopP.year; y++) years.push(y);
  return { years, startMonth: sopP.month, endMonth: eopP.month };
}

export function isYearInProjectSopEop(sop: unknown, eop: unknown, year: number): boolean {
  return sopEopYearsRange(sop, eop).years.includes(year);
}
