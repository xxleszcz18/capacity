import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

export type MultiSelectOption<T extends string | number> = {
  value: T;
  label: string;
  disabled?: boolean;
};

/** Pusty `selected` = brak filtra (wszystkie opcje). */
export default function MultiSelectFilter<T extends string | number>({
  options,
  selected,
  onChange,
  allLabel,
  clearLabel,
  searchable = false,
  searchPlaceholder,
  emptyLabel,
  className,
  style,
  activeBackground = '#e8f5e9',
}: {
  options: MultiSelectOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
  allLabel: string;
  clearLabel: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  className?: string;
  style?: CSSProperties;
  activeBackground?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn, true);
    return () => document.removeEventListener('mousedown', fn, true);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const toggle = (value: T) => {
    if (selected.includes(value)) onChange(selected.filter((x) => x !== value));
    else onChange([...selected, value]);
  };

  const summary = useMemo(() => {
    if (selected.length === 0) return allLabel;
    const labels = selected
      .map((v) => options.find((o) => o.value === v)?.label)
      .filter(Boolean) as string[];
    return labels.length > 0 ? labels.join(', ') : `${selected.length}`;
  }, [selected, options, allLabel]);

  const qLower = query.trim().toLowerCase();
  const visibleOptions = useMemo(() => {
    if (!searchable || !qLower) return options;
    return options.filter((o) => o.label.toLowerCase().includes(qLower));
  }, [options, searchable, qLower]);

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', ...(className ? {} : { minWidth: 140 }), ...style }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '4px 8px',
          fontSize: 12,
          border: '1px solid #bdbdbd',
          borderRadius: 4,
          background: selected.length > 0 ? activeBackground : '#fff',
          cursor: 'pointer',
          lineHeight: 1.35,
        }}
      >
        {summary}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 4000,
            left: 0,
            minWidth: 220,
            maxWidth: 360,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #bdbdbd',
            borderRadius: 6,
            padding: '8px 10px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {searchable && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              style={{ width: '100%', marginBottom: 8, padding: '4px 6px', fontSize: 12, boxSizing: 'border-box' }}
              autoFocus
            />
          )}
          {visibleOptions.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: '#666' }}>{emptyLabel ?? allLabel}</p>
          ) : (
            visibleOptions.map((o) => (
              <label
                key={String(o.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 0',
                  cursor: o.disabled ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  opacity: o.disabled ? 0.5 : 1,
                }}
              >
                <input type="checkbox" checked={selected.includes(o.value)} disabled={o.disabled} onChange={() => toggle(o.value)} />
                {o.label}
              </label>
            ))
          )}
          <button
            type="button"
            onClick={() => {
              onChange([]);
              setOpen(false);
            }}
            style={{
              marginTop: 6,
              width: '100%',
              padding: '4px 6px',
              fontSize: 12,
              border: '1px solid #e0e0e0',
              borderRadius: 4,
              background: '#fafafa',
              cursor: 'pointer',
            }}
          >
            {clearLabel}
          </button>
        </div>
      )}
    </div>
  );
}
