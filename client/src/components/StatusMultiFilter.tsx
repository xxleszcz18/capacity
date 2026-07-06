import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useStatusLabels } from '../i18n/useStatusLabels';

export type ProjectStatusFilterValue = 'active' | 'inactive' | 'RFQ';

const STATUS_VALUES: ProjectStatusFilterValue[] = ['active', 'inactive', 'RFQ'];

/** Pusty `selected` = brak filtra (wszystkie statusy). */
export default function StatusMultiFilter({
  selected,
  onChange,
  style,
}: {
  selected: ProjectStatusFilterValue[];
  onChange: (next: ProjectStatusFilterValue[]) => void;
  style?: CSSProperties;
}) {
  const { label, allStatuses, clearFilter } = useStatusLabels();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn, true);
    return () => document.removeEventListener('mousedown', fn, true);
  }, [open]);

  const toggle = (v: ProjectStatusFilterValue) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };

  const summary =
    selected.length === 0 ? allStatuses : selected.map((s) => label(s)).join(', ');

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', ...style }}>
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
          background: '#fff',
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
            right: 0,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #bdbdbd',
            borderRadius: 6,
            padding: '8px 10px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
          }}
        >
          {STATUS_VALUES.map((v) => (
            <label
              key={v}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 13 }}
            >
              <input type="checkbox" checked={selected.includes(v)} onChange={() => toggle(v)} />
              {label(v)}
            </label>
          ))}
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
            {clearFilter}
          </button>
        </div>
      )}
    </div>
  );
}
