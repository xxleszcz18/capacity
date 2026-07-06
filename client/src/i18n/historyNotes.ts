import type { Locale } from './types';

const AUTO_PREFIX: Record<Locale, string> = {
  pl: 'Automatyczna zmiana:',
  en: 'Automatic change:',
  de: 'Automatische Änderung:',
};

const AUTO_PREFIX_RE = /^Automatyczna zmiana:\s*/i;

type Rule = { re: RegExp; en: string; de: string };

const RULES: Rule[] = [
  {
    re: /^dodano rok (\d+) w wolumenie detalu "(.+)" \(zmiana z poziomu detalu\); przedłużono EOP \(poprzednia data (.+), nowa data (.+)\)\.?$/,
    en: 'added year $1 in volumes for part "$2" (change from part level); EOP extended (previous date $3, new date $4).',
    de: 'Jahr $1 in Volumen für Teil „$2“ hinzugefügt (Änderung auf Teilebene); EOP verlängert (vorheriges Datum $3, neues Datum $4).',
  },
  {
    re: /^dodano rok (\d+) w wolumenie detalu "(.+)" \(zmiana z poziomu detalu\)\.?$/,
    en: 'added year $1 in volumes for part "$2" (change from part level).',
    de: 'Jahr $1 in Volumen für Teil „$2“ hinzugefügt (Änderung auf Teilebene).',
  },
  {
    re: /^przedłużono EOP \(poprzednia data (.+), nowa data (.+)\)\.?$/,
    en: 'EOP extended (previous date $1, new date $2).',
    de: 'EOP verlängert (vorheriges Datum $1, neues Datum $2).',
  },
  {
    re: /^Przedłużenie EOP \(poprzednia data (.+), nowa data (.+)\)\.?$/,
    en: 'EOP extension (previous date $1, new date $2).',
    de: 'EOP-Verlängerung (vorheriges Datum $1, neues Datum $2).',
  },
  {
    re: /^zaktualizowano operację #(\d+)\.?$/,
    en: 'updated operation #$1.',
    de: 'Operation #$1 aktualisiert.',
  },
  {
    re: /^usunięto operację #(\d+)\.?$/,
    en: 'deleted operation #$1.',
    de: 'Operation #$1 gelöscht.',
  },
  {
    re: /^dodano operację #(\d+) na maszynie (.+)\.?$/,
    en: 'added operation #$1 on machine $2.',
    de: 'Operation #$1 auf Maschine $2 hinzugefügt.',
  },
  {
    re: /^dodano detal "(.+)"\.?$/,
    en: 'added part "$1".',
    de: 'Teil „$1“ hinzugefügt.',
  },
  {
    re: /^dodano załącznik zbiorczy "(.+)" — (.+)\.?$/,
    en: 'added shared attachment "$1" — $2.',
    de: 'Sammelanhang „$1“ hinzugefügt — $2.',
  },
  {
    re: /^dodano załącznik zbiorczy "(.+)"\.?$/,
    en: 'added shared attachment "$1".',
    de: 'Sammelanhang „$1“ hinzugefügt.',
  },
  {
    re: /^usunięto załącznik zbiorczy "(.+)"\.?$/,
    en: 'deleted shared attachment "$1".',
    de: 'Sammelanhang „$1“ gelöscht.',
  },
  {
    re: /^dodano załącznik "(.+)" — (.+)\.?$/,
    en: 'added attachment "$1" — $2.',
    de: 'Anhang „$1“ hinzugefügt — $2.',
  },
  {
    re: /^dodano załącznik "(.+)"\.?$/,
    en: 'added attachment "$1".',
    de: 'Anhang „$1“ hinzugefügt.',
  },
  {
    re: /^usunięto załącznik "(.+)"\.?$/,
    en: 'deleted attachment "$1".',
    de: 'Anhang „$1“ gelöscht.',
  },
  {
    re: /^usunięto detal "(.+)"\.?$/,
    en: 'deleted part "$1".',
    de: 'Teil „$1“ gelöscht.',
  },
  {
    re: /^zaktualizowano wolumeny projektu \((\d+) rekordów\)\.?$/,
    en: 'updated project volumes ($1 records).',
    de: 'Projektvolumen aktualisiert ($1 Datensätze).',
  },
  {
    re: /^zaktualizowano wolumeny kontraktowe projektu \((\d+) rekordów\)\.?$/,
    en: 'updated contractual project volumes ($1 records).',
    de: 'Vertragliche Projektvolumen aktualisiert ($1 Datensätze).',
  },
  {
    re: /^skopiowano wolumeny projektu \((produkcja → kontrakt|kontrakt → produkcja)\)\.?$/,
    en: 'copied project volumes ($1).',
    de: 'Projektvolumen kopiert ($1).',
  },
  {
    re: /^zaktualizowano wolumeny detalu "(.+)" \((\d+) rekordów\)\.?$/,
    en: 'updated volumes for part "$1" ($2 records).',
    de: 'Volumen für Teil „$1“ aktualisiert ($2 Datensätze).',
  },
  {
    re: /^zaktualizowano wolumeny kontraktowe detalu "(.+)" \((\d+) rekordów\)\.?$/,
    en: 'updated contractual volumes for part "$1" ($2 records).',
    de: 'Vertragliche Volumen für Teil „$1“ aktualisiert ($2 Datensätze).',
  },
  {
    re: /^skopiowano wolumeny \((produkcja → kontrakt|kontrakt → produkcja)\) detalu "(.+)"\.?$/,
    en: 'copied volumes ($1) for part "$2".',
    de: 'Volumen kopiert ($1) für Teil „$2“.',
  },
  {
    re: /^zaktualizowano ustawienia wolumenu detalu "(.+)"\.?$/,
    en: 'updated volume settings for part "$1".',
    de: 'Volumeneinstellungen für Teil „$1“ aktualisiert.',
  },
  {
    re: /^zaktualizowano wolumeny operacji #(\d+)\.?$/,
    en: 'updated volumes for operation #$1.',
    de: 'Volumen für Operation #$1 aktualisiert.',
  },
  {
    re: /^zaktualizowano wolumen operacji #(\d+) dla roku (\d+)\.?$/,
    en: 'updated volume for operation #$1 for year $2.',
    de: 'Volumen für Operation #$1 für Jahr $2 aktualisiert.',
  },
  {
    re: /^usunięto wolumen operacji #(\d+) dla roku (\d+)\.?$/,
    en: 'deleted volume for operation #$1 for year $2.',
    de: 'Volumen für Operation #$1 für Jahr $2 gelöscht.',
  },
  {
    re: /^alokacja — część wolumenu operacji #(\d+) przeniesiona na maszynę #(\d+), utworzono operację #(\d+), rok (\d+)\.?$/,
    en: 'allocation — part of operation #$1 volume moved to machine #$2, created operation #$3, year $4.',
    de: 'Allokation — Teil des Volumens von Operation #$1 auf Maschine #$2 verschoben, Operation #$3 erstellt, Jahr $4.',
  },
  {
    re: /^klient: "(.*)" → "(.*)"$/,
    en: 'client: "$1" → "$2"',
    de: 'Kunde: „$1“ → „$2“',
  },
  {
    re: /^nazwa: "(.*)" → "(.*)"$/,
    en: 'name: "$1" → "$2"',
    de: 'Name: „$1“ → „$2“',
  },
  {
    re: /^SOP: "(.*)" → "(.*)"$/,
    en: 'SOP: "$1" → "$2"',
    de: 'SOP: „$1“ → „$2“',
  },
  {
    re: /^EOP: "(.*)" → "(.*)"$/,
    en: 'EOP: "$1" → "$2"',
    de: 'EOP: „$1“ → „$2“',
  },
  {
    re: /^status: "(.*)" → "(.*)"$/,
    en: 'status: "$1" → "$2"',
    de: 'Status: „$1“ → „$2“',
  },
];

/** Notatki audytu scenariusza (bez prefiksu „Automatyczna zmiana”). */
const SCENARIO_RULES: Rule[] = [
  {
    re: /^Zmiana statusu projektu #(\d+): „(.+)” → „(.+)”\.?$/,
    en: 'Project #$1 status change: "$2" → "$3".',
    de: 'Projektstatus #$1 geändert: „$2“ → „$3“.',
  },
  {
    re: /^Zmiana statusu detalu #(\d+): usunięto nadpisanie \(dziedziczenie z projektu\)\.?$/,
    en: 'Part #$1 status change: override removed (inherits from project).',
    de: 'Teilstatus #$1 geändert: Überschreibung entfernt (erbt vom Projekt).',
  },
  {
    re: /^Zmiana statusu detalu #(\d+): „(.+)” → „(.+)”\.?$/,
    en: 'Part #$1 status change: "$2" → "$3".',
    de: 'Teilstatus #$1 geändert: „$2“ → „$3“.',
  },
  {
    re: /^Zmiana statusu operacji #(\d+): usunięto nadpisanie \(dziedziczenie z detalu\/projekt\)\.?$/,
    en: 'Operation #$1 status change: override removed (inherits from part/project).',
    de: 'Operationsstatus #$1 geändert: Überschreibung entfernt (erbt von Teil/Projekt).',
  },
  {
    re: /^Zmiana statusu operacji #(\d+): „(.+)” → „(.+)”\.?$/,
    en: 'Operation #$1 status change: "$2" → "$3".',
    de: 'Operationsstatus #$1 geändert: „$2“ → „$3“.',
  },
  {
    re: /^Dodano do scenariusza projekty z wersji Capacity: (.+)\.?$/,
    en: 'Added projects from Capacity version to scenario: $1.',
    de: 'Projekte aus Capacity-Version zum Szenario hinzugefügt: $1.',
  },
];

function matchVariants(body: string): string[] {
  const trimmed = body.trim();
  const out = [trimmed];
  if (!trimmed.endsWith('.')) out.push(`${trimmed}.`);
  else if (trimmed.length > 1) out.push(trimmed.slice(0, -1));
  return out;
}

function applyRule(body: string, rule: Rule, locale: 'en' | 'de'): string | null {
  const m = body.match(rule.re);
  if (!m) return null;
  let out = locale === 'en' ? rule.en : rule.de;
  for (let i = 1; i < m.length; i++) {
    let val = m[i] ?? '';
    if (val === 'produkcja → kontrakt') {
      val = locale === 'en' ? 'production → contract' : 'Produktion → Vertrag';
    } else if (val === 'kontrakt → produkcja') {
      val = locale === 'en' ? 'contract → production' : 'Vertrag → Produktion';
    } else if (val === 'dziedziczy') {
      val = locale === 'en' ? 'inherits' : 'erbt';
    }
    out = out.replace(`$${i}`, val);
  }
  return out;
}

function tryRules(body: string, rules: Rule[], locale: 'en' | 'de'): string | null {
  for (const candidate of matchVariants(body)) {
    for (const rule of rules) {
      const hit = applyRule(candidate, rule, locale);
      if (hit) return hit;
    }
  }
  return null;
}

function translateBodySegment(locale: Locale, body: string): string {
  if (locale === 'pl') return body;
  const loc = locale as 'en' | 'de';
  return tryRules(body, RULES, loc) ?? body;
}

function translateBody(locale: Locale, body: string): string {
  if (locale === 'pl') return body;
  const loc = locale as 'en' | 'de';
  const full = tryRules(body, RULES, loc);
  if (full) return full;
  if (body.includes('; ')) {
    return body
      .split('; ')
      .map((seg) => translateBodySegment(locale, seg.trim()))
      .join('; ');
  }
  return translateBodySegment(locale, body);
}

/** Tłumaczy polskie notatki automatyczne zapisane w bazie. */
export function translateHistoryNote(locale: Locale, note: string): string {
  if (!note?.trim()) return note;
  const raw = note.trim();
  if (locale === 'pl') return raw;
  if (AUTO_PREFIX_RE.test(raw)) {
    const body = raw.replace(AUTO_PREFIX_RE, '');
    return `${AUTO_PREFIX[locale]} ${translateBody(locale, body)}`;
  }
  const scenario = tryRules(raw, SCENARIO_RULES, locale as 'en' | 'de');
  if (scenario) return scenario;
  return translateBody(locale, raw);
}
