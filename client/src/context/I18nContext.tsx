import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translateApiError } from '../i18n/apiErrors';
import { applyDocumentLocale, getInitialLocale, persistLocale, translate } from '../i18n/core';
import type { Locale } from '../i18n/types';
import { LOCALE_META } from '../i18n/types';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Tłumaczy komunikat błędu z API (mapa znaných tekstów) lub zwraca oryginał. */
  te: (message: string | undefined | null) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
    applyDocumentLocale(next);
  }, []);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  );

  const te = useCallback((message: string | undefined | null) => translateApiError(locale, message), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t, te }), [locale, setLocale, t, te]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function useLocaleMeta() {
  return LOCALE_META;
}
