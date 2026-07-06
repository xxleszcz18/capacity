import type { Locale, TranslationTree } from './types';
import { LOCALE_STORAGE_KEY } from './types';
import { de } from './locales/de';
import { en } from './locales/en';
import { pl } from './locales/pl';
import { extendedDe } from './locales/extended-de';
import { extendedEn } from './locales/extended-en';
import { extendedPl } from './locales/extended-pl';
import { manualDe } from './manual/manual-de';
import { manualEn } from './manual/manual-en';
import { manualPl } from './manual/manual-pl';

function deepMerge(base: TranslationTree, extra: TranslationTree): TranslationTree {
  const out: TranslationTree = { ...base };
  for (const key of Object.keys(extra)) {
    const b = base[key];
    const e = extra[key];
    if (
      b != null &&
      typeof b === 'object' &&
      e != null &&
      typeof e === 'object' &&
      typeof e !== 'string'
    ) {
      out[key] = deepMerge(b as TranslationTree, e as TranslationTree);
    } else {
      out[key] = e;
    }
  }
  return out;
}

const bundles: Record<Locale, TranslationTree> = {
  pl: deepMerge(deepMerge(pl, extendedPl), manualPl),
  en: deepMerge(deepMerge(en, extendedEn), manualEn),
  de: deepMerge(deepMerge(de, extendedDe), manualDe),
};

export function detectBrowserLocale(): Locale {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const raw of langs) {
    const l = String(raw ?? '').toLowerCase();
    if (l.startsWith('de')) return 'de';
    if (l.startsWith('en')) return 'en';
    if (l.startsWith('pl')) return 'pl';
  }
  return 'pl';
}

export function loadStoredLocale(): Locale | null {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v === 'pl' || v === 'en' || v === 'de') return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function getInitialLocale(): Locale {
  return loadStoredLocale() ?? detectBrowserLocale();
}

function lookup(tree: TranslationTree | undefined, key: string): string | undefined {
  if (!tree) return undefined;
  const parts = key.split('.');
  let node: string | TranslationTree | undefined = tree;
  for (const p of parts) {
    if (node == null || typeof node === 'string') return undefined;
    node = node[p];
  }
  return typeof node === 'string' ? node : undefined;
}

export function translate(locale: Locale, key: string, params?: Record<string, string | number>): string {
  let text = lookup(bundles[locale], key) ?? lookup(bundles.pl, key) ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = locale;
}
