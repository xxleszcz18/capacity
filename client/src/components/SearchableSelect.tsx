import { Children, ReactNode, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../context/I18nContext';

type OptionRow = { value: string; label: string; disabled: boolean };

type Props = {
  value: string | number;
  onChange: (e: { target: { value: string } }) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Nadpisuje domyślny wygląd przycisku (np. kolorowe statusy jak w projektach). */
  triggerStyle?: React.CSSProperties;
  title?: string;
  onBlur?: () => void;
  /** Tekst dopasowywany przy wpisywaniu w polu wyszukiwania (domyślnie: etykieta opcji). */
  filterMatchText?: (option: { value: string; label: string }) => string;
  /** Placeholder pola wyszukiwania w rozwiniętej liście. */
  searchPlaceholder?: string;
  /** Wywoływane przy zmianie tekstu wyszukiwania (np. zapytanie do API). */
  onSearchQueryChange?: (query: string) => void;
  /** Gdy true — opcje są już filtrowane po stronie serwera (bez dodatkowego filtrowania w komponencie). */
  serverFiltered?: boolean;
};

export default function SearchableSelect({
  value,
  onChange,
  children,
  disabled,
  className,
  style,
  triggerStyle,
  title,
  onBlur,
  filterMatchText,
  searchPlaceholder,
  onSearchQueryChange,
  serverFiltered,
}: Props) {
  const { t } = useI18n();
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('common.searchFilter');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const options = useMemo<OptionRow[]>(() => {
    const arr = Children.toArray(children);
    return arr
      .filter((ch) => Boolean(ch) && isValidElement(ch))
      .map((ch) => {
        const el = ch as any;
        const v = el.props?.value != null ? String(el.props.value) : '';
        const raw = el.props?.children;
        const label = Array.isArray(raw) ? raw.join('') : String(raw ?? '');
        return { value: v, label, disabled: Boolean(el.props?.disabled) };
      });
  }, [children]);

  const selectedValue = String(value ?? '');
  const selected = options.find((o) => o.value === selectedValue);
  const qLower = query.trim().toLowerCase();
  const filtered =
    serverFiltered || !qLower
      ? options
      : options.filter((o) => {
          const hay = (filterMatchText ? filterMatchText(o) : o.label).toLowerCase();
          return hay.includes(qLower);
        });

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc, true);
    return () => document.removeEventListener('mousedown', onDoc, true);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', display: 'inline-block', ...style }} title={title}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'white',
          border: '1px solid #bdbdbd',
          borderRadius: 4,
          padding: '4px 8px',
          lineHeight: 1.2,
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...triggerStyle,
        }}
      >
        {selected?.label ?? t('common.dash')}
      </button>
      {open && !disabled && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              minWidth: menuPos.width,
              zIndex: 10000,
              background: 'white',
              border: '1px solid #bdbdbd',
              borderRadius: 4,
              boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
              maxHeight: 260,
              overflow: 'auto',
            }}
          >
            <div style={{ padding: 6, borderBottom: '1px solid #eee' }}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  const next = e.target.value;
                  setQuery(next);
                  onSearchQueryChange?.(next);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder={resolvedSearchPlaceholder}
                style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              {filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => {
                    onChange({ target: { value: o.value } });
                    setOpen(false);
                    setQuery('');
                    if (onBlur) setTimeout(() => onBlur(), 0);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    border: 'none',
                    borderBottom: '1px solid #f3f3f3',
                    background: o.value === selectedValue ? '#e3f2fd' : 'white',
                    cursor: o.disabled ? 'not-allowed' : 'pointer',
                    color: o.disabled ? '#999' : '#222',
                  }}
                >
                  {o.label}
                </button>
              ))}
              {filtered.length === 0 && (
                <div style={{ padding: 8, color: '#666', fontSize: 13 }}>{t('common.noResults')}</div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
