/**
 * Tekst bezpieczny dla jsPDF (Helvetica) — bez polskich znaków diakrytycznych
 * i znaków spoza Latin-1 (Δ, −, „”, itd.), które dają śmieci typu &k&o&n&t&r.
 */
export function pdfSafe(value: unknown): string {
  let s = String(value ?? '');

  /** Pary znak → zamiennik (tablica zamiast obiektu — unikamy duplikatów kluczy przy tych samych znakach Unicode). */
  const single: [string, string][] = [
    ['ą', 'a'],
    ['ć', 'c'],
    ['ę', 'e'],
    ['ł', 'l'],
    ['ń', 'n'],
    ['ó', 'o'],
    ['ś', 's'],
    ['ż', 'z'],
    ['ź', 'z'],
    ['Ą', 'A'],
    ['Ć', 'C'],
    ['Ę', 'E'],
    ['Ł', 'L'],
    ['Ń', 'N'],
    ['Ó', 'O'],
    ['Ś', 'S'],
    ['Ż', 'Z'],
    ['Ź', 'Z'],
    ['—', '-'],
    ['–', '-'],
    ['−', '-'],
    ['Δ', 'Rozn.'],
    ['„', '"'],
    ['”', '"'],
    ['«', '"'],
    ['»', '"'],
    ['’', "'"],
    ['‘', "'"],
    ['…', '...'],
    ['\u00a0', ' '],
  ];
  const singleMap = new Map(single);

  s = s.replace(/./g, (ch) => {
    if (singleMap.has(ch)) return singleMap.get(ch)!;
    const code = ch.charCodeAt(0);
    if (code > 255) return '';
    return ch;
  });

  return s.replace(/\s+/g, ' ').trim();
}

/** Nagłówki kolumn tabel trendów / analityki w PDF. */
export const PDF_HEADER = {
  year: 'Rok',
  production: 'Produkcja %',
  contract: 'Kontrakt %',
  deltaContractProd: 'Rozn. kontr.-prod. (p.p.)',
  scenarioProd: 'Scenariusz (prod.) %',
  deltaScenarioProd: 'Rozn. scen.-prod. (p.p.)',
  scenarioContract: 'Scenariusz (kontr.) %',
  deltaScenarioContract: 'Rozn. scen.kontr.-kontr. (p.p.)',
  deltaContractMinusProd: 'Rozn. prod.-kontr. (p.p.)',
  deltaScenarioMinusProd: 'Rozn. scen.-prod. (p.p.)',
} as const;
