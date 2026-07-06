import { useEffect, useRef, useState } from 'react';
import { useI18n, useLocaleMeta } from '../context/I18nContext';
import type { Locale } from '../i18n/types';
import LanguageFlagIcon from './LanguageFlagIcon';

const ORDER: Locale[] = ['pl', 'en', 'de'];

export default function LanguageSwitcher({ accentColor = 'var(--cap-green)' }: { accentColor?: string }) {
  const { locale, setLocale, t } = useI18n();
  const meta = useLocaleMeta();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pickLocale = (code: Locale) => {
    setLocale(code);
    setOpen(false);
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        aria-label={t('layout.language')}
        aria-haspopup="menu"
        aria-expanded={open}
        title={meta[locale].title}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 32,
          padding: 3,
          border: `2px solid ${accentColor}`,
          borderRadius: 8,
          background: open ? '#f0f4f8' : '#fff',
          cursor: 'pointer',
          lineHeight: 0,
        }}
      >
        <LanguageFlagIcon locale={locale} width={36} height={24} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            padding: 6,
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 8,
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {ORDER.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={locale === code}
              aria-label={meta[code].title}
              title={meta[code].title}
              onClick={() => pickLocale(code)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                border: locale === code ? `2px solid ${accentColor}` : '2px solid transparent',
                borderRadius: 6,
                background: locale === code ? '#e8f5e9' : 'transparent',
                cursor: 'pointer',
                lineHeight: 0,
              }}
            >
              <LanguageFlagIcon locale={code} width={40} height={26} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
