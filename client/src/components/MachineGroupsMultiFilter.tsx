import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useI18n } from '../context/I18nContext';

export type MachineGroupOption = { id: number; name: string };

/** Pusty `selected` = brak filtra (wszystkie grupy). */
export default function MachineGroupsMultiFilter({
  groups,
  selected,
  onChange,
  className,
  style,
}: {
  groups: MachineGroupOption[];
  selected: number[];
  onChange: (next: number[]) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const { t } = useI18n();
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

  const toggle = (id: number) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  const summary = useMemo(() => {
    if (selected.length === 0) return t('machines.groupsFilterAll');
    const names = selected
      .map((id) => groups.find((g) => g.id === id)?.name)
      .filter(Boolean) as string[];
    return names.length > 0 ? names.join(', ') : t('machines.groupsFilterSelected', { count: selected.length });
  }, [selected, groups, t]);

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', ...(className ? {} : { minWidth: 160 }), ...style }}>
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
          background: selected.length > 0 ? '#e8f5e9' : '#fff',
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
            maxWidth: 320,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #bdbdbd',
            borderRadius: 6,
            padding: '8px 10px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {groups.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: '#666' }}>{t('machines.groupsFilterEmpty')}</p>
          ) : (
            groups.map((g) => (
              <label
                key={g.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 13 }}
              >
                <input type="checkbox" checked={selected.includes(g.id)} onChange={() => toggle(g.id)} />
                {g.name}
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
            {t('machines.groupsFilterClear')}
          </button>
        </div>
      )}
    </div>
  );
}
