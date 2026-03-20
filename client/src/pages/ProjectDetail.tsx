import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { confirmDelete } from '../confirmDelete';

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'opis' | 'operacje' | 'notatki' | 'wolumeny'>('opis');
  const [phases, setPhases] = useState<any[]>([]);
  const [opModal, setOpModal] = useState<{ open: boolean; edit?: any }>({ open: false });

  const load = () => (id ? api.projects.get(Number(id)).then(setProject) : Promise.resolve());
  useEffect(() => {
    if (!id) return;
    load().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api.settings.phases.list().then(setPhases);
  }, []);

  if (loading || !project) return <p>Ładowanie…</p>;

  const tabs = [
    { id: 'opis' as const, label: 'Opis projektu' },
    { id: 'wolumeny' as const, label: 'Wolumeny' },
    { id: 'operacje' as const, label: 'Operacje' },
    { id: 'notatki' as const, label: 'Notatki' },
  ];

  return (
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: '1rem' }}><Link to="/projekty" style={{ color: 'var(--cap-green)' }}>← Projekty</Link></div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', background: tab === t.id ? 'var(--cap-green)' : '#eee', color: tab === t.id ? 'white' : '#333', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{t.label}</button>
          ))}
        </nav>
      </div>
      <div style={{ flex: 3 }}>
        {tab === 'opis' && (
          <ProjectDescTab project={project} onUpdate={load} onGoToVolumes={() => setTab('wolumeny')} />
        )}
        {tab === 'wolumeny' && (
          <VolumesTab key={`vol-${project.id}-${project.eop ?? ''}`} project={project} onUpdate={load} />
        )}
        {tab === 'operacje' && (
          <ProjectOperationsTab
            project={project}
            onReload={load}
            onEdit={(op) => setOpModal({ open: true, edit: op })}
            onNew={() => setOpModal({ open: true })}
          />
        )}
        {tab === 'notatki' && (
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Notatki</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f5f5f5' }}><th style={{ padding: '0.75rem', textAlign: 'left' }}>Data</th><th style={{ padding: '0.75rem', textAlign: 'left' }}>Autor</th><th style={{ padding: '0.75rem', textAlign: 'left' }}>Notatka</th></tr></thead>
              <tbody>
                {(project.notes ?? []).map((n: any) => (
                  <tr key={n.id}><td style={{ padding: '0.75rem' }}>{n.note_date}</td><td style={{ padding: '0.75rem' }}>{n.author || '-'}</td><td style={{ padding: '0.75rem' }}>{n.note}</td></tr>
                ))}
              </tbody>
            </table>
            <AddNoteForm projectId={project.id} onAdded={load} />
          </div>
        )}
      </div>
      {opModal.open && (
        <OperationModal
          projectId={project.id}
          parts={project.parts ?? []}
          phases={phases}
          edit={opModal.edit}
          onClose={() => setOpModal({ open: false })}
          onSaved={() => { setOpModal({ open: false }); load(); }}
        />
      )}
    </div>
  );
}

function opMatchesSearch(op: any, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const hay = [
    op.machine_number,
    op.machine_type,
    op.part_designation,
    op.phase_name,
    op.cycle_time_seconds,
    op.volume_value,
    op.volume_unit,
  ]
    .map((x) => String(x ?? '').toLowerCase())
    .join(' ');
  return hay.includes(s);
}

/** Etykieta liczby podziałów z alokacji (1 podział / 2 podziały / 5 podziałów). */
function podzialyZAlokacjiLabel(n: number): string {
  if (n === 1) return '1 podział';
  const mod100 = n % 100;
  if (mod100 >= 12 && mod100 <= 14) return `${n} podziałów`;
  const mod10 = n % 10;
  if (mod10 >= 2 && mod10 <= 4) return `${n} podziały`;
  return `${n} podziałów`;
}

function groupOperationsForDisplay(operations: any[]): {
  roots: any[];
  childrenByParent: Map<number, any[]>;
} {
  const ops = operations ?? [];
  const byId = new Map<number, any>(ops.map((o: any) => [o.id, o]));
  const childrenByParent = new Map<number, any[]>();
  for (const o of ops) {
    const pid = o.split_from_operation_id;
    if (pid != null && byId.has(pid)) {
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid)!.push(o);
    }
  }
  for (const [, arr] of childrenByParent) arr.sort((a, b) => a.id - b.id);
  const roots = ops
    .filter((o: any) => {
      const sid = o.split_from_operation_id;
      return sid == null || !byId.has(sid);
    })
    .sort((a, b) => a.id - b.id);
  return { roots, childrenByParent };
}

function ProjectOperationsTab({
  project,
  onReload,
  onEdit,
  onNew,
}: {
  project: any;
  onReload: () => void;
  onEdit: (op: any) => void;
  onNew: () => void;
}) {
  const [opSearch, setOpSearch] = useState('');
  const { roots, childrenByParent } = useMemo(
    () => groupOperationsForDisplay(project.operations ?? []),
    [project.operations]
  );

  const [expandedParents, setExpandedParents] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    setExpandedParents(new Set());
  }, [project.id]);

  const toggleParent = (id: number) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const q = opSearch;
  const visibleRoots = roots.filter((root) => {
    const kids = childrenByParent.get(root.id) ?? [];
    if (opMatchesSearch(root, q)) return true;
    return kids.some((c) => opMatchesSearch(c, q));
  });

  const volumeCell = (op: any) =>
    op.volume_value === 0 ? 'z detalu' : `${op.volume_value} (${op.volume_unit})`;

  /** Wiersz rodzica zaczyna tekst po chevronie (~36px); dzieci mają wyraźnie większe wcięcie niż ta linia bazowa. */
  const childFirstColPaddingLeft = 'calc(0.75rem + 2.75rem + 1.25rem)';

  const renderRow = (op: any, opts: { isChild: boolean }) => {
    const { isChild } = opts;
    return (
      <tr key={op.id} style={{ background: isChild ? '#f8fafc' : undefined }}>
        <td
          style={{
            padding: '0.75rem',
            paddingLeft: isChild ? childFirstColPaddingLeft : '0.75rem',
            verticalAlign: 'middle',
          }}
        >
          {op.machine_number} ({op.machine_type})
          {isChild && (
            <span style={{ marginLeft: 8, fontSize: 11, color: '#1565c0', fontWeight: 600 }}>← alokacja</span>
          )}
        </td>
        <td style={{ padding: '0.75rem' }}>{op.part_designation}</td>
        <td style={{ padding: '0.75rem' }}>{op.phase_name}</td>
        <td style={{ padding: '0.75rem' }}>{op.cycle_time_seconds}</td>
        <td style={{ padding: '0.75rem' }}>{volumeCell(op)}</td>
        <td style={{ padding: '0.75rem' }}>
          <button
            type="button"
            onClick={() => onEdit(op)}
            style={{ marginRight: 4, padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}
          >
            Edycja
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirmDelete('Czy na pewno usunąć tę operację? Powiązane wolumeny i podziały z alokacji zostaną usunięte lub scalone. Tej operacji nie można cofnąć.')) return;
              api.projects.deleteOperation(project.id, op.id).then(onReload);
            }}
            style={{ padding: '0.25rem 0.5rem', background: '#c62828', color: 'white', border: 'none', borderRadius: 4 }}
          >
            Usuń
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0 }}>Operacje</h2>
      <p style={{ margin: '0 0 0.75rem', fontSize: 13, color: '#555' }}>
        Operacje utworzone przy <strong>alokacji wolumenu</strong> są pod operacją źródłową — lista jest <strong>domyślnie zwinięta</strong>; rozwiń strzałką, aby je zobaczyć. Badge przy rodzicu pokazuje liczbę podziałów.
      </p>
      <input
        type="text"
        placeholder="szukaj w operacjach..."
        value={opSearch}
        onChange={(e) => setOpSearch(e.target.value)}
        style={{ marginBottom: '1rem', padding: '0.5rem', width: 280 }}
      />
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Maszyna</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Detal</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Faza</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Cykl</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Wolumen</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}></th>
          </tr>
        </thead>
        <tbody>
          {visibleRoots.map((root) => {
            const children = childrenByParent.get(root.id) ?? [];
            const hasChildren = children.length > 0;
            const expanded = expandedParents.has(root.id);
            const rootMatches = opMatchesSearch(root, q);
            const visibleChildren = expanded
              ? rootMatches
                ? children
                : children.filter((c) => opMatchesSearch(c, q))
              : [];
            return (
              <Fragment key={root.id}>
                <tr style={{ background: hasChildren ? '#f1f8e9' : undefined }}>
                  <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggleParent(root.id)}
                        aria-expanded={expanded}
                        title={expanded ? 'Zwiń operacje z alokacji' : 'Rozwiń operacje z alokacji'}
                        style={{
                          marginRight: 8,
                          width: 28,
                          height: 28,
                          padding: 0,
                          border: '1px solid #c5e1a5',
                          borderRadius: 4,
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: 14,
                          lineHeight: 1,
                          verticalAlign: 'middle',
                        }}
                      >
                        {expanded ? '▼' : '▶'}
                      </button>
                    ) : (
                      <span style={{ display: 'inline-block', width: 36 }} />
                    )}
                    <span style={{ fontWeight: hasChildren ? 600 : undefined }}>
                      {root.machine_number} ({root.machine_type})
                    </span>
                    {hasChildren && (
                      <span
                        style={{
                          marginLeft: 10,
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#2e7d32',
                          background: '#e8f5e9',
                          padding: '2px 8px',
                          borderRadius: 10,
                          verticalAlign: 'middle',
                        }}
                        title="Liczba operacji utworzonych przy przenoszeniu wolumenu z kalkulatora"
                      >
                        {podzialyZAlokacjiLabel(children.length)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem' }}>{root.part_designation}</td>
                  <td style={{ padding: '0.75rem' }}>{root.phase_name}</td>
                  <td style={{ padding: '0.75rem' }}>{root.cycle_time_seconds}</td>
                  <td style={{ padding: '0.75rem' }}>{volumeCell(root)}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => onEdit(root)}
                      style={{ marginRight: 4, padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}
                    >
                      Edycja
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirmDelete('Czy na pewno usunąć tę operację? Powiązane wolumeny i podziały z alokacji zostaną usunięte lub scalone. Tej operacji nie można cofnąć.')) return;
                        api.projects.deleteOperation(project.id, root.id).then(onReload);
                      }}
                      style={{ padding: '0.25rem 0.5rem', background: '#c62828', color: 'white', border: 'none', borderRadius: 4 }}
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
                {visibleChildren.map((child) => renderRow(child, { isChild: true }))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <button type="button" onClick={onNew} style={{ marginTop: 8, padding: '0.5rem 1rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>
        Nowa operacja
      </button>
    </div>
  );
}

function ProjectDescTab({ project, onUpdate, onGoToVolumes }: { project: any; onUpdate: () => void; onGoToVolumes?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [eopExtension, setEopExtension] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCheckVolumes, setShowCheckVolumes] = useState(false);
  const [editClient, setEditClient] = useState(project.client ?? '');
  const [editName, setEditName] = useState(project.name ?? '');
  const [editSop, setEditSop] = useState(project.sop ?? '');
  const [editEop, setEditEop] = useState(project.eop ?? '');
  const [savingDesc, setSavingDesc] = useState(false);

  useEffect(() => {
    setEditClient(project.client ?? '');
    setEditName(project.name ?? '');
    setEditSop(project.sop ?? '');
    setEditEop(project.eop ?? '');
  }, [project.id, project.client, project.name, project.sop, project.eop]);

  const saveDescription = () => {
    const client = editClient.trim();
    const name = editName.trim();
    if (!client || !name) return;
    setSavingDesc(true);
    api.projects.update(project.id, { client, name, sop: editSop.trim() || undefined, eop: editEop.trim() || undefined })
      .then(() => { onUpdate(); setEditing(false); })
      .finally(() => setSavingDesc(false));
  };

  const saveEopExtension = () => {
    const value = eopExtension.trim();
    if (!value) return;
    setSaving(true);
    setShowCheckVolumes(false);
    api.projects.update(project.id, { eop_extension: value })
      .then(() => { setEopExtension(''); onUpdate(); setShowCheckVolumes(true); })
      .finally(() => setSaving(false));
  };
  return (
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0 }}>Opis projektu</h2>
      <div style={{ marginBottom: '1rem' }}>
        {!editing ? (
          <>
            <p style={{ marginBottom: 6 }}><strong>Klient:</strong> {project.client ?? '—'}</p>
            <p style={{ marginBottom: 6 }}><strong>Nazwa projektu:</strong> {project.name ?? '—'}</p>
            <p style={{ marginBottom: 6 }}><strong>Data rozpoczęcia (SOP):</strong> {project.sop ?? '—'}</p>
            <p style={{ marginBottom: 8 }}><strong>Data zakończenia (EOP):</strong> {project.eop ?? '—'}</p>
            <button type="button" onClick={() => setEditing(true)} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Edytuj</button>
          </>
        ) : (
          <>
            <p style={{ marginBottom: 6 }}>
              <strong>Klient:</strong>{' '}
              <input type="text" value={editClient} onChange={(e) => setEditClient(e.target.value)} style={{ padding: '0.35rem', width: 280, maxWidth: '100%' }} placeholder="Nazwa klienta" />
            </p>
            <p style={{ marginBottom: 6 }}>
              <strong>Nazwa projektu:</strong>{' '}
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ padding: '0.35rem', width: 280, maxWidth: '100%' }} placeholder="Nazwa projektu" />
            </p>
            <p style={{ marginBottom: 6 }}>
              <strong>Data rozpoczęcia (SOP):</strong>{' '}
              <input type="text" value={editSop} onChange={(e) => setEditSop(e.target.value)} style={{ padding: '0.35rem', width: 120 }} placeholder="np. 02.2027" title="Format: MM.RRRR" />
            </p>
            <p style={{ marginBottom: 8 }}>
              <strong>Data zakończenia (EOP):</strong>{' '}
              <input type="text" value={editEop} onChange={(e) => setEditEop(e.target.value)} style={{ padding: '0.35rem', width: 120 }} placeholder="np. 12.2030" title="Format: MM.RRRR" />
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={saveDescription} disabled={savingDesc || !editClient.trim() || !editName.trim()} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>
                {savingDesc ? 'Zapisywanie…' : 'Zapisz'}
              </button>
              <button type="button" onClick={() => setEditing(false)} style={{ padding: '0.35rem 0.75rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>Anuluj</button>
            </div>
          </>
        )}
      </div>
      {project.eop_original && (
        <p style={{ fontSize: 13, color: '#555' }}><strong>Pierwotna data EOP:</strong> {project.eop_original} <span style={{ fontStyle: 'italic' }}>(przed przedłużeniem)</span></p>
      )}
      {(project.eop_extensions?.length > 0) && (
        <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
          <strong>Poprzednie przedłużenia:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: '1.25rem' }}>
            {(project.eop_extensions || []).map((ext: { eop_before: string; eop_after: string; created_at?: string }, i: number) => (
              <li key={i}>
                {ext.eop_before} → {ext.eop_after}
                {ext.created_at && <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>(zapis: {ext.created_at})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p>
        <strong>Przedłużenie EOP:</strong>{' '}
        <input type="text" placeholder="Nowa data (np. 2030-12)" value={eopExtension} onChange={(e) => setEopExtension(e.target.value)} style={{ padding: '0.35rem', width: 160, marginRight: 8 }} />
        <button onClick={saveEopExtension} disabled={saving || !eopExtension.trim()} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Zapisz</button>
        <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#666' }}>Wprowadzona data nadpisze aktualne EOP; w notatkach zostanie zapisana adnotacja o poprzedniej dacie. Można wpisać kolejną datę w innym terminie.</span>
      </p>
      {showCheckVolumes && onGoToVolumes && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#e3f2fd', border: '1px solid #2196f3', borderRadius: 6 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Data EOP została zaktualizowana. Sprawdź wolumeny.</p>
          <button type="button" onClick={onGoToVolumes} style={{ padding: '0.35rem 0.75rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>Przejdź do Wolumeny</button>
        </div>
      )}
      <p>
        <strong>Status:</strong>{' '}
        <span style={{ background: project.status === 'active' ? 'var(--cap-green)' : project.status === 'RFQ' ? '#ff9800' : '#9e9e9e', color: 'white', padding: '0.25rem 0.5rem', borderRadius: 4, marginRight: 8 }}>{project.status === 'active' ? 'Aktywny' : project.status === 'RFQ' ? 'RFQ' : 'Nieaktywny'}</span>
        <select
          value={project.status}
          onChange={(e) => {
            const newStatus = e.target.value as 'active' | 'inactive' | 'RFQ';
            api.projects.update(project.id, { status: newStatus }).then(onUpdate);
          }}
          style={{ padding: '0.25rem 0.5rem', borderRadius: 4 }}
        >
          <option value="active">Aktywny</option>
          <option value="inactive">Nieaktywny</option>
          <option value="RFQ">RFQ</option>
        </select>
      </p>
    </div>
  );
}

const WORK_WEEKS_PER_YEAR = 48;
function toAnnual(value: number, unit: string): number {
  if (unit === 'annual') return value;
  if (unit === 'monthly') return value * 12;
  return value * WORK_WEEKS_PER_YEAR;
}
function derivedValues(value: number, unit: string) {
  const annual = toAnnual(value, unit);
  return { annual, monthly: annual / 12, weekly: annual / WORK_WEEKS_PER_YEAR };
}

/** Parsuje SOP/EOP (np. "01.2026", "12.2030") i zwraca listę lat oraz opcjonalnie miesiące dla pierwszego/ostatniego roku. */
function parseSopEopYears(sop: string, eop: string): { years: number[]; startMonth?: number; endMonth?: number } {
  const sopMatch = String(sop || '').trim().match(/^(\d{1,2})\.(\d{4})$/);
  const eopMatch = String(eop || '').trim().match(/^(\d{1,2})\.(\d{4})$/);
  const sopYear = sopMatch ? parseInt(sopMatch[2], 10) : null;
  const eopYear = eopMatch ? parseInt(eopMatch[2], 10) : null;
  const startMonth = sopMatch ? parseInt(sopMatch[1], 10) : undefined;
  const endMonth = eopMatch ? parseInt(eopMatch[1], 10) : undefined;
  if (sopYear == null || eopYear == null || eopYear < sopYear) return { years: [] };
  const years: number[] = [];
  for (let y = sopYear; y <= eopYear; y++) years.push(y);
  return { years, startMonth, endMonth };
}

/** Ułamek roku uwzględniający SOP/EOP: pierwszy rok od startMonth, ostatni do endMonth, środkowe = 1. */
function yearFraction(sopEop: { years: number[]; startMonth?: number; endMonth?: number }, year: number): { fraction: number; label?: string } {
  if (!sopEop.years.length) return { fraction: 1 };
  const isFirst = year === sopEop.years[0];
  const isLast = year === sopEop.years[sopEop.years.length - 1];
  if (isFirst && sopEop.startMonth != null) {
    const monthsInYear = 13 - sopEop.startMonth;
    return { fraction: monthsInYear / 12, label: `${monthsInYear}/12 roku` };
  }
  if (isLast && sopEop.endMonth != null) {
    return { fraction: sopEop.endMonth / 12, label: `${sopEop.endMonth}/12 roku` };
  }
  return { fraction: 1 };
}

type ProjectVolumeRow = { year: number; volume_value: number; volume_unit: string; include_in_calculator_after_eop?: number | boolean };
function VolumesTab({ project, onUpdate }: { project: any; onUpdate: () => void }) {
  const normInclude = (v: any) => (v === 1 || v === true || v === '1' ? 1 : 0);
  const [projectVolumes, setProjectVolumes] = useState<ProjectVolumeRow[]>(() => (project.project_volumes ?? []).map((pv: any) => ({ ...pv, include_in_calculator_after_eop: normInclude(pv.include_in_calculator_after_eop) })));
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newValue, setNewValue] = useState('');
  const [newUnit, setNewUnit] = useState<'annual' | 'monthly' | 'weekly'>('annual');
  const [saving, setSaving] = useState(false);
  const [applyAllValue, setApplyAllValue] = useState('');
  const [applyAllUnit, setApplyAllUnit] = useState<'annual' | 'monthly' | 'weekly'>('annual');
  const valueInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const addValueInputRef = useRef<HTMLInputElement | null>(null);
  const projectVolumesRef = useRef(projectVolumes);
  projectVolumesRef.current = projectVolumes;

  useEffect(() => {
    const list = (project.project_volumes ?? []).map((pv: any) => ({ ...pv, include_in_calculator_after_eop: normInclude(pv.include_in_calculator_after_eop) }));
    setProjectVolumes(list);
  }, [project?.id, project?.eop, project?.project_volumes]);

  const saveProjectVolumes = (volumes: ProjectVolumeRow[]) => {
    setSaving(true);
    api.projects.setVolumes(project.id, volumes)
      .then((rows) => { setProjectVolumes(rows); onUpdate(); })
      .finally(() => setSaving(false));
  };

  const addProjectVolume = () => {
    const v = Number(newValue);
    if (!v || v <= 0) return;
    if (projectVolumes.some((pv) => pv.year === newYear)) return;
    const next = [...projectVolumes, { year: newYear, volume_value: v, volume_unit: newUnit, include_in_calculator_after_eop: 0 }].sort((a, b) => a.year - b.year);
    setProjectVolumes(next);
    setNewValue('');
    setNewYear((prev) => prev + 1);
    saveProjectVolumes(next);
    setTimeout(() => addValueInputRef.current?.focus(), 0);
  };

  const removeProjectVolume = (year: number) => {
    if (!confirmDelete(`Czy na pewno usunąć wolumen projektu dla roku ${year}? Tej operacji nie można cofnąć.`)) return;
    const next = projectVolumes.filter((pv) => pv.year !== year);
    setProjectVolumes(next);
    saveProjectVolumes(next);
  };

  const updateProjectVolume = (year: number, field: 'volume_value' | 'volume_unit' | 'include_in_calculator_after_eop', val: number | string | boolean) => {
    setProjectVolumes((prev) => prev.map((pv) => pv.year === year ? { ...pv, [field]: val } : pv));
  };

  const persistVolumeChange = () => {
    saveProjectVolumes(projectVolumesRef.current);
  };

  const applySameToAllYears = () => {
    const v = Number(applyAllValue);
    if (!v || v <= 0 || projectVolumes.length === 0) return;
    if (!confirmDelete(`Ustawić wartość ${v} (${applyAllUnit}) dla wszystkich ${projectVolumes.length} lat? Obecne wartości zostaną nadpisane. Kontynuować?`)) return;
    const next = projectVolumes.map((pv) => ({ ...pv, volume_value: v, volume_unit: applyAllUnit }));
    setProjectVolumes(next);
    saveProjectVolumes(next);
  };

  const sortedYears = [...projectVolumes].map((pv) => pv.year).sort((a, b) => a - b);
  const sopEop = parseSopEopYears(project.sop ?? '', project.eop ?? '');
  const eopYear = sopEop.years.length > 0 ? sopEop.years[sopEop.years.length - 1] : null;
  const applyAllNum = Number(applyAllValue);
  const applyDerived = applyAllValue.trim() && !isNaN(applyAllNum) && applyAllNum > 0 ? derivedValues(applyAllNum, applyAllUnit) : null;

  const toggleIncludeAfterEop = (year: number) => {
    const pv = projectVolumes.find((v) => v.year === year);
    if (!pv) return;
    const current = pv.include_in_calculator_after_eop === 1 || pv.include_in_calculator_after_eop === true;
    const next = projectVolumes.map((v) => v.year === year ? { ...v, include_in_calculator_after_eop: current ? 0 : 1 } : v);
    setProjectVolumes(next);
    saveProjectVolumes(next);
  };

  const fillYearsFromSopEop = () => {
    if (sopEop.years.length === 0) return;
    const existing = new Set(projectVolumes.map((pv) => pv.year));
    const toAdd = sopEop.years.filter((y) => !existing.has(y)).map((year) => ({ year, volume_value: 0, volume_unit: 'annual' as const, include_in_calculator_after_eop: 0 }));
    if (toAdd.length === 0) return;
    const next = [...projectVolumes, ...toAdd].sort((a, b) => a.year - b.year);
    setProjectVolumes(next);
    saveProjectVolumes(next);
  };

  return (
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0 }}>Wolumeny</h2>
      <p style={{ color: '#555', marginBottom: '1rem' }}>
        Ustal wolumeny na poziomie projektu dla każdego roku (podaj wielkość roczną, miesięczną lub tygodniową — pozostałe obliczą się same). Następnie dla każdego detalu możesz przejąć wartości z projektu (domyślnie), podać % udział lub wpisać własną wartość.
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginTop: 0 }}>Wolumeny projektu (na rok)</h3>

        {sopEop.years.length > 0 && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#e3f2fd', borderRadius: 6, border: '1px solid #90caf9' }}>
            <strong>Lata z SOP–EOP</strong> ({project.sop} → {project.eop}): {sopEop.years.join(', ')}
            {sopEop.startMonth != null && (
              <span style={{ fontSize: 12, color: '#555', marginLeft: 8 }}>Rok {sopEop.years[0]} od miesiąca {sopEop.startMonth}.</span>
            )}
            {sopEop.endMonth != null && sopEop.years.length > 1 && (
              <span style={{ fontSize: 12, color: '#555', marginLeft: 8 }}>Rok {sopEop.years[sopEop.years.length - 1]} do miesiąca {sopEop.endMonth}.</span>
            )}
            <div style={{ marginTop: 6 }}>
              <button type="button" onClick={fillYearsFromSopEop} disabled={saving} style={{ padding: '0.35rem 0.75rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>Uzupełnij tabelę latami z SOP–EOP</button>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f0f7f0', borderRadius: 6, border: '1px solid #c8e6c9' }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>Ta sama wartość dla wszystkich lat</strong>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="number" min={0} placeholder="Wartość" value={applyAllValue} onChange={(e) => setApplyAllValue(e.target.value)} style={{ width: 100, padding: 4 }} />
            <select value={applyAllUnit} onChange={(e) => setApplyAllUnit(e.target.value as any)} style={{ padding: 4 }}>
              <option value="annual">roczny</option>
              <option value="monthly">miesięczny</option>
              <option value="weekly">tygodniowy</option>
            </select>
            <button type="button" onClick={applySameToAllYears} disabled={projectVolumes.length === 0 || saving} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Przypisz do wszystkich lat</button>
          </div>
          {applyDerived && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#2e7d32' }}>
              Przeliczenie: <strong>rocznie {Math.round(applyDerived.annual)}</strong> / miesięcznie {Math.round(applyDerived.monthly)} / tygodniowo {Math.round(applyDerived.weekly)}
            </p>
          )}
          {projectVolumes.length === 0 && !applyDerived && <span style={{ fontSize: 12, color: '#666' }}>Uzupełnij tabelę latami z SOP–EOP lub dodaj rok poniżej.</span>}
        </div>

        <p style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>Wartość i jednostkę możesz edytować w tabeli; zmiany zapisują się przy wyjściu z pola. Obliczenia uwzględniają SOP/EOP (np. rok 2033 do maja = 5/12 roku).</p>
        {saving && <span style={{ fontSize: 13, color: '#666', marginBottom: 8, display: 'block' }}>Zapisywanie…</span>}

        <p style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Lata po dacie EOP domyślnie nie wchodzą do kalkulatora obciążenia. Możesz zaznaczyć „Liczyć w kalkulatorze po EOP” — wtedy wyświetli się informacja „zmienione ręcznie”.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Rok</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Wartość</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Jednostka</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Obliczone (roczny / miesięczny / tygodniowy)</th>
              <th style={{ padding: '0.5rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Liczyć po EOP</th>
              <th style={{ padding: '0.5rem', width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {projectVolumes.map((pv, idx) => {
              const d = derivedValues(pv.volume_value, pv.volume_unit);
              const { fraction, label } = yearFraction(sopEop, pv.year);
              const effectiveAnnual = d.annual * fraction;
              const effectiveMonthly = effectiveAnnual / 12;
              const effectiveWeekly = effectiveAnnual / WORK_WEEKS_PER_YEAR;
              const nextYear = sortedYears[idx + 1];
              const isAfterEop = eopYear != null && pv.year > eopYear;
              const includeAfterEop = pv.include_in_calculator_after_eop === 1 || pv.include_in_calculator_after_eop === true;
              return (
                <tr key={pv.year}>
                  <td style={{ padding: '0.5rem' }}>{pv.year}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <input
                      ref={(el) => { valueInputRefs.current[pv.year] = el; }}
                      type="number"
                      min={0}
                      value={pv.volume_value}
                      onChange={(e) => updateProjectVolume(pv.year, 'volume_value', Number(e.target.value))}
                      onBlur={persistVolumeChange}
                      onKeyDown={(e) => { if (e.key === 'Enter' && nextYear != null) { e.preventDefault(); valueInputRefs.current[nextYear]?.focus(); } }}
                      style={{ width: 100 }}
                      title="Edytuj ilość"
                    />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <select
                      value={pv.volume_unit}
                      onChange={(e) => updateProjectVolume(pv.year, 'volume_unit', e.target.value)}
                      onBlur={persistVolumeChange}
                    >
                      <option value="annual">roczny</option>
                      <option value="monthly">miesięczny</option>
                      <option value="weekly">tygodniowy</option>
                    </select>
                  </td>
                  <td style={{ padding: '0.5rem', fontSize: 13, color: '#666' }}>
                    {label ? (
                      <span title={`Uwzględniono ${label} (SOP/EOP)`}>
                        {Math.round(effectiveAnnual)} / {Math.round(effectiveMonthly)} / {Math.round(effectiveWeekly)}
                        <span style={{ marginLeft: 6, color: '#1565c0', fontWeight: 600 }}>({label})</span>
                      </span>
                    ) : (
                      <span>{Math.round(effectiveAnnual)} / {Math.round(effectiveMonthly)} / {Math.round(effectiveWeekly)}</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem', fontSize: 12 }}>
                    {isAfterEop ? (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={includeAfterEop} onChange={() => toggleIncludeAfterEop(pv.year)} />
                        <span>Liczyć w kalkulatorze</span>
                        {includeAfterEop && <span style={{ color: '#c62828', fontWeight: 600 }} title="Wartość zmieniona ręcznie – wchodzi do kalkulatora mimo daty EOP">(zmienione ręcznie)</span>}
                      </label>
                    ) : (
                      <span style={{ color: '#888' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <button type="button" onClick={() => removeProjectVolume(pv.year)} style={{ padding: '0.2rem 0.5rem', background: '#c62828', color: 'white', border: 'none', borderRadius: 4 }}>Usuń</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <input type="number" placeholder="Rok" value={newYear} onChange={(e) => setNewYear(Number(e.target.value))} style={{ width: 70, padding: 4 }} title="Rok następny jest ustawiany po dodaniu" />
          <input ref={addValueInputRef} type="number" placeholder="Wartość" value={newValue} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addProjectVolume(); }} style={{ width: 100, padding: 4 }} />
          <select value={newUnit} onChange={(e) => setNewUnit(e.target.value as any)} style={{ padding: 4 }}>
            <option value="annual">roczny</option>
            <option value="monthly">miesięczny</option>
            <option value="weekly">tygodniowy</option>
          </select>
          <button type="button" onClick={addProjectVolume} disabled={saving} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Dodaj rok</button>
        </div>
      </section>

      <section>
        <h3 style={{ marginTop: 0 }}>Wolumeny detali</h3>
        <p style={{ fontSize: 13, color: '#666', marginBottom: '1rem' }}>Dla każdego detalu przypisanego do projektu: przejmij wartości z projektu (domyślnie), ustaw % udział w wolumenie projektu lub wpisz własne wartości na rok.</p>
        {(project.parts ?? []).length === 0 ? (
          <p style={{ color: '#888' }}>Brak detali w projekcie. Dodaj detale w operacjach (np. przy nowej operacji).</p>
        ) : (
          (project.parts ?? []).map((part: any) => (
            <PartVolumeRow key={part.id} projectId={project.id} part={part} projectVolumes={projectVolumes} sop={project.sop} eop={project.eop} onUpdate={onUpdate} />
          ))
        )}
      </section>
    </div>
  );
}

function PartVolumeRow({ projectId, part, projectVolumes, sop, eop, onUpdate }: { projectId: number; part: any; projectVolumes: { year: number; volume_value: number; volume_unit: string }[]; sop?: string; eop?: string; onUpdate: () => void }) {
  const label = part.detail_sap_number || part.detail_alias || part.detail_free_text || part.designation || `Detal #${part.id}`;
  const [mode, setMode] = useState<string>(part.volume_mode ?? 'project');
  const [sharePercent, setSharePercent] = useState<string>(part.volume_share_percent != null ? String(part.volume_share_percent) : '');
  const [shareByYear, setShareByYear] = useState<Record<number, string>>(() => {
    const byYear: Record<number, string> = {};
    (part.volume_share_by_year ?? []).forEach((r: { year: number; share_percent: number }) => { byYear[r.year] = String(r.share_percent); });
    return byYear;
  });
  const [selectedShareYear, setSelectedShareYear] = useState<'all' | number>('all');
  const [volumeByYear, setVolumeByYear] = useState<{ year: number; volume_value: number; volume_unit: string }[]>(() => part.volume_by_year ?? []);
  const [defaultVolumeValue, setDefaultVolumeValue] = useState<string>(part.default_volume_value != null ? String(part.default_volume_value) : '');
  const [defaultVolumeUnit, setDefaultVolumeUnit] = useState<'annual' | 'monthly' | 'weekly'>(part.default_volume_unit && ['annual', 'monthly', 'weekly'].includes(part.default_volume_unit) ? part.default_volume_unit : 'annual');
  const [saving, setSaving] = useState(false);
  const [addYear, setAddYear] = useState(new Date().getFullYear());
  const [addValue, setAddValue] = useState('');
  const [addUnit, setAddUnit] = useState<'annual' | 'monthly' | 'weekly'>('annual');

  const sopEopYears = parseSopEopYears(sop ?? '', eop ?? '').years;
  const yearsForShare = sopEopYears.length > 0 ? sopEopYears : projectVolumes.map((pv) => pv.year);
  const yearsForOverride = sopEopYears.length > 0 ? sopEopYears : projectVolumes.map((pv) => pv.year);

  const getEffectiveShareForYear = (year: number): number => {
    const fromYear = shareByYear[year];
    if (fromYear !== undefined && fromYear !== '' && !isNaN(Number(fromYear))) return Math.max(0, Math.min(100, Number(fromYear)));
    if (sharePercent !== '' && !isNaN(Number(sharePercent))) return Math.max(0, Math.min(100, Number(sharePercent)));
    return 0;
  };

  const currentShareValue = selectedShareYear === 'all' ? sharePercent : (shareByYear[selectedShareYear] ?? sharePercent);
  const setCurrentShareValue = (val: string) => {
    if (selectedShareYear === 'all') setSharePercent(val);
    else setShareByYear((prev) => ({ ...prev, [selectedShareYear]: val }));
  };
  const setShareForYear = (year: number, value: string) => setShareByYear((prev) => ({ ...prev, [year]: value }));

  const assignedVolumeText = (() => {
    if (mode === 'override') {
      const hasDefault = defaultVolumeValue !== '' && !isNaN(Number(defaultVolumeValue)) && Number(defaultVolumeValue) > 0;
      if (volumeByYear.length > 0 && !hasDefault) {
        const sum = volumeByYear.reduce((a, v) => a + toAnnual(v.volume_value, v.volume_unit), 0);
        const first = volumeByYear[0];
        if (volumeByYear.length === 1) return `${Math.round(first.volume_value)} (${first.volume_unit === 'annual' ? 'roczny' : first.volume_unit === 'monthly' ? 'miesięczny' : 'tygodniowy'}) w ${first.year}`;
        return `własne wartości na ${volumeByYear.length} lat, łącznie rocznie ≈ ${Math.round(sum / volumeByYear.length)}`;
      }
      if (hasDefault && volumeByYear.length === 0) {
        const v = Number(defaultVolumeValue);
        const u = defaultVolumeUnit === 'annual' ? 'roczny' : defaultVolumeUnit === 'monthly' ? 'miesięczny' : 'tygodniowy';
        return `${Math.round(v)} (${u}) — domyślnie dla wszystkich lat`;
      }
      if (hasDefault && volumeByYear.length > 0) {
        const v = Number(defaultVolumeValue);
        const u = defaultVolumeUnit === 'annual' ? 'roczny' : defaultVolumeUnit === 'monthly' ? 'miesięczny' : 'tygodniowy';
        return `domyślnie ${Math.round(v)} (${u}) dla wszystkich lat + ${volumeByYear.length} nadpisań na poszczególne lata`;
      }
    }
    if (mode === 'share') {
      const displayYear = selectedShareYear === 'all' ? (projectVolumes[0]?.year ?? yearsForShare[0]) : selectedShareYear;
      const pv = projectVolumes.find((p) => p.year === displayYear);
      const pct = getEffectiveShareForYear(displayYear);
      if (pv && (pct > 0 || sharePercent !== '' || shareByYear[displayYear] !== undefined)) {
        const v = pv.volume_value * (pct / 100);
        const yearLabel = `w ${displayYear}`;
        const sourceLabel = selectedShareYear === 'all' ? `(domyślnie ${sharePercent || '—'}% dla wszystkich lat)` : `(${pct}% z projektu)`;
        return `${Math.round(v)} (${pv.volume_unit === 'annual' ? 'roczny' : pv.volume_unit === 'monthly' ? 'miesięczny' : 'tygodniowy'}) ${yearLabel} ${sourceLabel}`;
      }
      if (selectedShareYear !== 'all' && (pct > 0 || shareByYear[displayYear] !== undefined)) {
        return `Udział ${pct}% dla roku ${displayYear}${!pv ? ' (uzupełnij wolumen projektu na ten rok w zakładce Wolumeny)' : ''}`;
      }
      if (projectVolumes.length > 0 && sharePercent !== '') {
        const first = projectVolumes[0];
        const v = first.volume_value * (Number(sharePercent) / 100);
        return `${Math.round(v)} (${first.volume_unit === 'annual' ? 'roczny' : first.volume_unit === 'monthly' ? 'miesięczny' : 'tygodniowy'}) w ${first.year} (${sharePercent}% z projektu)`;
      }
    }
    if ((mode === 'project' || !mode) && projectVolumes.length > 0) {
      const first = projectVolumes[0];
      return `${Math.round(first.volume_value)} (${first.volume_unit === 'annual' ? 'roczny' : first.volume_unit === 'monthly' ? 'miesięczny' : 'tygodniowy'}) w ${first.year} — z projektu`;
    }
    return null;
  })();

  const savePart = () => {
    setSaving(true);
    const shareByYearArray = Object.entries(shareByYear)
      .filter(([, v]) => v !== '' && !isNaN(Number(v)))
      .map(([year, share_percent]) => ({ year: Number(year), share_percent: Number(share_percent) }));
    const defaultVal = mode === 'override' && defaultVolumeValue !== '' && !isNaN(Number(defaultVolumeValue)) ? Number(defaultVolumeValue) : null;
    const defaultUn = mode === 'override' && defaultVal != null ? defaultVolumeUnit : null;
    const volumesToSave = mode === 'override' && yearsForOverride.length > 0
      ? yearsForOverride.map((year) => {
          const row = volumeByYear.find((r) => r.year === year);
          return row ?? { year, volume_value: 0, volume_unit: 'annual' as const };
        })
      : mode === 'override'
        ? volumeByYear
        : [];
    api.projects.updatePart(projectId, part.id, {
      volume_mode: mode,
      volume_share_percent: mode === 'share' && sharePercent !== '' ? Number(sharePercent) : null,
      volume_share_by_year: mode === 'share' ? shareByYearArray : undefined,
      default_volume_value: defaultVal,
      default_volume_unit: defaultUn,
    })
      .then(() => api.projects.setPartVolumes(projectId, part.id, volumesToSave))
      .then(() => onUpdate())
      .finally(() => setSaving(false));
  };

  const addYearRow = () => {
    const v = Number(addValue);
    if (!v || v <= 0) return;
    if (volumeByYear.some((r) => r.year === addYear)) return;
    setVolumeByYear((prev) => [...prev, { year: addYear, volume_value: v, volume_unit: addUnit }].sort((a, b) => a.year - b.year));
    setAddValue('');
  };

  const removeYear = (year: number) => setVolumeByYear((prev) => prev.filter((r) => r.year !== year));
  const updateYearRow = (year: number, field: string, val: number | string) => {
    setVolumeByYear((prev) => {
      const idx = prev.findIndex((r) => r.year === year);
      if (idx >= 0) return prev.map((r) => r.year === year ? { ...r, [field]: val } : r);
      return [...prev, { year, volume_value: field === 'volume_value' ? Number(val) : 0, volume_unit: field === 'volume_unit' ? (val as string) : 'annual' }].sort((a, b) => a.year - b.year);
    });
  };
  const getRowForYear = (year: number) => volumeByYear.find((r) => r.year === year) ?? { year, volume_value: 0, volume_unit: 'annual' as const };

  useEffect(() => {
    setMode(part.volume_mode ?? 'project');
    setSharePercent(part.volume_share_percent != null ? String(part.volume_share_percent) : '');
    const byYear: Record<number, string> = {};
    (part.volume_share_by_year ?? []).forEach((r: { year: number; share_percent: number }) => { byYear[r.year] = String(r.share_percent); });
    setShareByYear(byYear);
    setVolumeByYear(part.volume_by_year ?? []);
    setDefaultVolumeValue(part.default_volume_value != null ? String(part.default_volume_value) : '');
    setDefaultVolumeUnit(part.default_volume_unit && ['annual', 'monthly', 'weekly'].includes(part.default_volume_unit) ? part.default_volume_unit : 'annual');
  }, [part.id, part.volume_mode, part.volume_share_percent, part.volume_by_year, part.volume_share_by_year, part.default_volume_value, part.default_volume_unit]);

  useEffect(() => {
    if (mode !== 'override' || yearsForOverride.length === 0) return;
    setVolumeByYear((prev) => {
      const existing = new Set(prev.map((r) => r.year));
      const toAdd = yearsForOverride.filter((y) => !existing.has(y)).map((year) => ({ year, volume_value: 0, volume_unit: 'annual' as const }));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd].sort((a, b) => a.year - b.year);
    });
  }, [mode, yearsForOverride.join(',')]);

  return (
    <div key={part.id} style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: '1rem', marginBottom: '1rem', background: '#fafafa' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {assignedVolumeText && (
        <p style={{ margin: '0 0 8px', fontSize: 15, color: '#1565c0', fontWeight: 600 }}>Przypisany wolumen: {assignedVolumeText}</p>
      )}
      <div style={{ marginBottom: 8 }}>
        <span style={{ marginRight: 12 }}>Źródło wolumenu:</span>
        <label style={{ marginRight: 12 }}><input type="radio" name={`vol-${part.id}`} checked={mode === 'project'} onChange={() => setMode('project')} /> Z projektu (domyślnie)</label>
        <label style={{ marginRight: 12 }}><input type="radio" name={`vol-${part.id}`} checked={mode === 'share'} onChange={() => setMode('share')} /> % udział</label>
        <label><input type="radio" name={`vol-${part.id}`} checked={mode === 'override'} onChange={() => setMode('override')} /> Własna wartość</label>
      </div>
      {mode === 'share' && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ marginBottom: 10, padding: '8px 10px', background: '#f0f7ff', borderRadius: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Domyślna (dla wszystkich lat)</div>
            <label>Udział [%]: <input type="number" min={0} max={100} step={0.1} value={sharePercent} onChange={(e) => setSharePercent(e.target.value)} style={{ width: 80, marginLeft: 4, padding: 4 }} title="Stosowany do lat, dla których nie ustawiono osobnego udziału poniżej" /></label>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#555' }}>Używany, gdy dla danego roku nie wpisano wartości w tabeli poniżej.</p>
          </div>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Osobno dla poszczególnych lat</div>
          <p style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>Ustaw udział [%] dla wybranych lat — nadpisuje wartość domyślną. Pozostaw puste, aby użyć domyślnej.</p>
          <table style={{ borderCollapse: 'collapse', marginBottom: 4 }}>
            <thead><tr style={{ background: '#eee' }}><th style={{ padding: 4 }}>Rok</th><th style={{ padding: 4 }}>Udział [%]</th></tr></thead>
            <tbody>
              {yearsForShare.map((y) => (
                <tr key={y}>
                  <td style={{ padding: 4 }}>{y}</td>
                  <td style={{ padding: 4 }}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={shareByYear[y] ?? ''}
                      onChange={(e) => setShareForYear(y, e.target.value)}
                      placeholder={sharePercent !== '' ? sharePercent : '—'}
                      style={{ width: 90 }}
                      title={`Udział dla roku ${y}. Puste = domyślna (${sharePercent || '—'}%)`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {yearsForShare.length === 0 && <p style={{ fontSize: 12, color: '#888' }}>Ustaw daty SOP i EOP projektu, aby pojawiła się lista lat.</p>}
        </div>
      )}
      {mode === 'override' && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ marginBottom: 12, padding: '8px 10px', background: '#f0f7ff', borderRadius: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Wartość domyślna (dla wszystkich lat)</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label>Wartość: <input type="number" min={0} value={defaultVolumeValue} onChange={(e) => setDefaultVolumeValue(e.target.value)} style={{ width: 100, padding: 4 }} placeholder="np. 50000" /></label>
              <label>Jednostka: <select value={defaultVolumeUnit} onChange={(e) => setDefaultVolumeUnit(e.target.value as any)} style={{ padding: 4 }}><option value="annual">roczny</option><option value="monthly">miesięczny</option><option value="weekly">tygodniowy</option></select></label>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#555' }}>Stosowana do każdego roku w zakresie SOP–EOP. Poniżej możesz ustawić inną wartość tylko dla wybranych lat (nadpisze domyślną).</p>
          </div>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Osobno dla poszczególnych lat</div>
          <table style={{ borderCollapse: 'collapse', marginBottom: 4 }}>
            <thead><tr style={{ background: '#eee' }}><th style={{ padding: 4 }}>Rok</th><th style={{ padding: 4 }}>Wartość</th><th style={{ padding: 4 }}>Jednostka</th></tr></thead>
            <tbody>
              {yearsForOverride.map((year) => {
                const r = getRowForYear(year);
                return (
                  <tr key={year}>
                    <td style={{ padding: 4 }}>{year}</td>
                    <td style={{ padding: 4 }}><input type="number" min={0} value={r.volume_value} onChange={(e) => updateYearRow(year, 'volume_value', Number(e.target.value) || 0)} style={{ width: 90 }} /></td>
                    <td style={{ padding: 4 }}>
                      <select value={r.volume_unit} onChange={(e) => updateYearRow(year, 'volume_unit', e.target.value)}>
                        <option value="annual">roczny</option>
                        <option value="monthly">miesięczny</option>
                        <option value="weekly">tygodniowy</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {yearsForOverride.length === 0 && <p style={{ fontSize: 12, color: '#888' }}>Ustaw daty SOP i EOP projektu, aby pojawiła się lista lat.</p>}
          {yearsForOverride.length > 0 && (
            <p style={{ fontSize: 13, color: '#555', marginTop: 6, marginBottom: 0 }}>Wymagane jest wprowadzenie wartości dla każdego z roku (może być wpisane 0).</p>
          )}
        </div>
      )}
      <button type="button" onClick={savePart} disabled={saving} style={{ padding: '0.35rem 0.75rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>Zapisz</button>
    </div>
  );
}

function AddNoteForm({ projectId, onAdded }: { projectId: number; onAdded: () => void }) {
  const [note, setNote] = useState('');
  const [author, setAuthor] = useState('');
  const save = () => {
    if (!note.trim()) return;
    api.projects.addNote(projectId, { note: note.trim(), author: author || undefined }).then(() => { setNote(''); setAuthor(''); onAdded(); });
  };
  return (
    <div style={{ marginTop: '1rem', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <input type="text" placeholder="Autor" value={author} onChange={(e) => setAuthor(e.target.value)} style={{ padding: '0.5rem', width: 120 }} />
      <input type="text" placeholder="Notatka" value={note} onChange={(e) => setNote(e.target.value)} style={{ padding: '0.5rem', flex: 1 }} />
      <button onClick={save} style={{ padding: '0.5rem 1rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>Nowa notatka</button>
    </div>
  );
}

function OperationModal({ projectId, parts, phases, edit, onClose, onSaved }: { projectId: number; parts: any[]; phases: any[]; edit?: any; onClose: () => void; onSaved: () => void }) {
  const [partsList, setPartsList] = useState(parts);
  const [part_id, setPart_id] = useState(edit?.part_id ?? (parts[0]?.id));
  const [phase_id, setPhase_id] = useState(edit?.phase_id ?? (phases[0]?.id));
  const [machine_id, setMachine_id] = useState(edit?.machine_id ?? '');
  const [cycle_time_seconds, setCycle_time_seconds] = useState(edit?.cycle_time_seconds ?? 60);
  const [nests_count, setNests_count] = useState(edit?.nests_count ?? 1);
  const [oee_override, setOee_override] = useState(edit?.oee_override != null ? String(Math.round(edit.oee_override * 100)) : '');
  const [machines, setMachines] = useState<any[]>([]);
  const [freeCapacityPercent, setFreeCapacityPercent] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showNewDetail, setShowNewDetail] = useState(false);
  const [detailSearchBy, setDetailSearchBy] = useState<'sap' | 'alias'>('sap');
  const [selectedDetailId, setSelectedDetailId] = useState<number | ''>(() => (edit && edit.part_id ? (parts.find((p: any) => p.id === edit.part_id)?.designation_id ?? '') : ''));
  const [newDetailSap, setNewDetailSap] = useState('');
  const [newDetailAlias, setNewDetailAlias] = useState('');
  const [newDetailFreeText, setNewDetailFreeText] = useState('');
  const [newDetailSlotNumber, setNewDetailSlotNumber] = useState('');
  const [designations, setDesignations] = useState<{ id: number; designation?: string; sap_number?: string | null; alias?: string | null; free_text?: string | null }[]>([]);
  const currentYear = new Date().getFullYear();
  const [isSet, setIsSet] = useState(!!edit?.is_set);
  const [setMembers, setSetMembers] = useState<{ part_id: number; label: string }[]>(() => {
    if (edit?.set_members?.length) return edit.set_members.map((m: any) => ({ part_id: m.part_id, label: m.label || String(m.part_id) }));
    return [];
  });
  const [setAddDesignationId, setSetAddDesignationId] = useState<number | ''>('');

  const selectedDetail = selectedDetailId ? designations.find((d) => d.id === Number(selectedDetailId)) : null;

  useEffect(() => { setPartsList(parts); if (edit?.part_id) setPart_id(edit.part_id); }, [parts, edit?.part_id]);
  useEffect(() => {
    if (edit?.part_id && !edit?.is_set) setSelectedDetailId(parts.find((p: any) => p.id === edit.part_id)?.designation_id ?? '');
  }, [edit?.part_id, edit?.is_set, parts]);
  useEffect(() => {
    if (edit?.is_set && edit?.set_members?.length) setSetMembers(edit.set_members.map((m: any) => ({ part_id: m.part_id, label: m.label || String(m.part_id) })));
  }, [edit?.id]);
  useEffect(() => {
    api.machines.list({ status: 'active' }).then(setMachines);
    api.settings.designations.list().then(setDesignations);
  }, []);

  useEffect(() => {
    if (!machine_id) { setFreeCapacityPercent(null); return; }
    api.capacity.machine(Number(machine_id), { yearFrom: currentYear, yearTo: currentYear + 1 })
      .then((data: { years?: Record<number, { load_percent?: number }> }) => {
        const load = data.years?.[currentYear]?.load_percent ?? 0;
        setFreeCapacityPercent(Math.max(0, Math.round(100 - load)));
      })
      .catch(() => setFreeCapacityPercent(null));
  }, [machine_id, currentYear]);

  const hasNewDetailFields = newDetailSap.trim() || newDetailAlias.trim() || newDetailFreeText.trim();

  const addToSet = async () => {
    if (!setAddDesignationId) return;
    setError('');
    const designationId = Number(setAddDesignationId);
    const designation = designations.find((d) => d.id === designationId);
    const label = designation ? (designation.sap_number || designation.alias || designation.free_text || '—') : String(designationId);
    try {
      let partId: number;
      const existing = partsList.find((p: any) => p.designation_id === designationId);
      if (existing) partId = existing.id;
      else {
        const newPart = await api.projects.addPart(projectId, { designation_id: designationId });
        setPartsList((prev: any[]) => [...prev, newPart]);
        partId = newPart.id;
      }
      if (setMembers.some((m) => m.part_id === partId)) { setError('Ten detal jest już w secie.'); return; }
      setSetMembers((prev) => [...prev, { part_id: partId, label }]);
      setSetAddDesignationId('');
    } catch (e: any) {
      setError(e.message || 'Nie udało się dodać detalu do setu.');
    }
  };

  const removeFromSet = (partId: number) => {
    if (!confirmDelete('Usunąć ten detal z listy setu? Zapis nastąpi dopiero po kliknięciu „Zapisz” przy operacji.')) return;
    setSetMembers((prev) => prev.filter((m) => m.part_id !== partId));
  };

  const addNewPart = async () => {
    setError('');
    try {
      if (selectedDetailId) {
        const newPart = await api.projects.addPart(projectId, { designation_id: Number(selectedDetailId) });
        setPartsList((prev) => [...prev, newPart]);
        setPart_id(newPart.id);
        setShowNewDetail(false);
        setSelectedDetailId('');
      } else if (hasNewDetailFields) {
        const created = await api.settings.designations.create({
          sap_number: newDetailSap.trim() || undefined,
          alias: newDetailAlias.trim() || undefined,
          free_text: newDetailFreeText.trim() || undefined,
          slot_number: newDetailSlotNumber.trim() || undefined,
        });
        setDesignations((prev) => [...prev, created]);
        const newPart = await api.projects.addPart(projectId, { designation_id: created.id });
        setPartsList((prev) => [...prev, newPart]);
        setPart_id(newPart.id);
        setShowNewDetail(false);
        setNewDetailSap('');
        setNewDetailAlias('');
        setNewDetailFreeText('');
        setNewDetailSlotNumber('');
      }
    } catch (e: any) {
      setError(e.message || 'Nie udało się dodać detalu.');
    }
  };

  const save = async () => {
    setError('');
    if (isSet) {
      if (setMembers.length < 2) {
        setError('Set musi zawierać co najmniej 2 detale. Dodaj detale z listy poniżej.');
        return;
      }
    } else {
      if (!edit && !selectedDetailId) {
        if (showNewDetail && hasNewDetailFields) setError('Kliknij "Dodaj i wybierz", aby dodać nowy detal do projektu.');
        else setError('Wybierz detal z listy (po Nr SAP lub Alias) lub utwórz nowy.');
        return;
      }
    }
    setSaving(true);
    try {
      let partId = part_id;
      if (!isSet && !edit && selectedDetailId) {
        const existing = partsList.find((p: any) => p.designation_id === Number(selectedDetailId));
        if (existing) partId = existing.id;
        else {
          const newPart = await api.projects.addPart(projectId, { designation_id: Number(selectedDetailId) });
          setPartsList((prev: any[]) => [...prev, newPart]);
          partId = newPart.id;
        }
      }
      const oeeVal = oee_override === '' ? null : Number(oee_override) / 100;
      const body: any = { phase_id, machine_id: Number(machine_id), cycle_time_seconds, nests_count, oee_override: oeeVal };
      if (!edit) {
        body.volume_value = 0;
        body.volume_unit = 'annual';
      }
      if (isSet) {
        body.is_set = true;
        body.set_part_ids = setMembers.map((m) => m.part_id);
      } else {
        body.is_set = false;
        body.part_id = partId;
      }
      await (edit ? api.projects.updateOperation(projectId, edit.id, body) : api.projects.addOperation(projectId, body));
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Błąd');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{edit ? 'Edycja operacji' : 'Nowa operacja'}</h3>
        <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ fontWeight: 600 }}>Wolumen dla: </label>
            <div style={{ marginTop: 4, marginBottom: 10 }}>
              <label style={{ marginRight: 16 }}><input type="radio" name="volumeFor" checked={!isSet} onChange={() => { setIsSet(false); setSetMembers([]); }} /> Pojedyncza część</label>
              <label><input type="radio" name="volumeFor" checked={isSet} onChange={() => { setIsSet(true); setSelectedDetailId(''); setShowNewDetail(false); }} /> Set (2+ detali)</label>
            </div>
          </div>
          {!isSet && (
            <div>
              <label>Detal: </label>
              <div style={{ marginTop: 4 }}>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ marginRight: 12 }}>Wybór po:</span>
                  <label><input type="radio" name="detailBy" checked={detailSearchBy === 'sap'} onChange={() => { setDetailSearchBy('sap'); setSelectedDetailId(''); }} /> Nr SAP</label>
                  <label style={{ marginLeft: 8 }}><input type="radio" name="detailBy" checked={detailSearchBy === 'alias'} onChange={() => { setDetailSearchBy('alias'); setSelectedDetailId(''); }} /> Alias</label>
                </div>
                <select value={showNewDetail ? '__new__' : String(selectedDetailId || '')} onChange={(e) => { const v = e.target.value; if (v === '__new__') setShowNewDetail(true); else { setShowNewDetail(false); setSelectedDetailId(v === '' ? '' : Number(v)); } }} style={{ padding: 4, minWidth: 260 }}>
                  <option value="">— wybierz z bazy detali —</option>
                  {designations
                    .filter((d) => (detailSearchBy === 'sap' ? (d.sap_number ?? '').trim() : (d.alias ?? '').trim()))
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {detailSearchBy === 'sap' ? (d.sap_number || d.alias || d.free_text || '') : (d.alias || d.sap_number || d.free_text || '')}
                      </option>
                    ))}
                  <option value="__new__">+ Nowy detal…</option>
                </select>
                {selectedDetail && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#555' }}>
                    {detailSearchBy === 'sap' ? <>Alias: <strong>{selectedDetail.alias ?? '—'}</strong></> : <>Nr SAP: <strong>{selectedDetail.sap_number ?? '—'}</strong></>}
                    {selectedDetail.free_text && <> · Free text: {selectedDetail.free_text}</>}
                  </div>
                )}
              </div>
              {showNewDetail && (
                <div style={{ marginTop: 8, padding: 8, background: '#f9f9f9', borderRadius: 6 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, color: '#555' }}>Wypełnij co najmniej jedno pole (jak przy nowym detalu w ustawieniach):</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input type="text" placeholder="Nr SAP" value={newDetailSap} onChange={(e) => setNewDetailSap(e.target.value)} style={{ padding: '0.5rem', width: 140 }} />
                    <input type="text" placeholder="Alias" value={newDetailAlias} onChange={(e) => setNewDetailAlias(e.target.value)} style={{ padding: '0.5rem', width: 140 }} />
                    <input type="text" placeholder="Free text" value={newDetailFreeText} onChange={(e) => setNewDetailFreeText(e.target.value)} style={{ padding: '0.5rem', width: 160 }} />
                    <input type="text" placeholder="Nr gniazda (opcjonalnie)" value={newDetailSlotNumber} onChange={(e) => setNewDetailSlotNumber(e.target.value)} style={{ padding: '0.5rem', width: 140 }} title="Numer gniazda produkcyjnego" />
                  </div>
                  <button type="button" onClick={addNewPart} disabled={!hasNewDetailFields} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Dodaj i wybierz</button>
                </div>
              )}
            </div>
          )}
          {isSet && (
            <div style={{ padding: 8, background: '#f5f9f5', borderRadius: 6, border: '1px solid #c8e6c9' }}>
              <label style={{ fontWeight: 600 }}>Detale w secie (min. 2)</label>
              <p style={{ margin: '4px 0 8px', fontSize: 12, color: '#555' }}>Czas cyklu jest wspólny dla całego setu; w jednym cyklu powstaje po 1 szt każdego detalu. Wolumen = liczba setów.</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <select value={String(setAddDesignationId)} onChange={(e) => setSetAddDesignationId(e.target.value === '' ? '' : Number(e.target.value))} style={{ padding: 4, minWidth: 220 }}>
                  <option value="">— wybierz detal do dodania —</option>
                  {designations
                    .filter((d) => (d.sap_number ?? '').trim() || (d.alias ?? '').trim())
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.sap_number || d.alias || d.free_text || '—'}
                      </option>
                    ))}
                </select>
                <button type="button" onClick={addToSet} disabled={!setAddDesignationId} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Dodaj do setu</button>
              </div>
              {setMembers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {setMembers.map((m, idx) => (
                    <span key={m.part_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'white', borderRadius: 4, border: '1px solid #a5d6a7' }}>
                      {idx > 0 && <span style={{ color: '#888' }}>+</span>}
                      <span>{m.label}</span>
                      <button type="button" onClick={() => removeFromSet(m.part_id)} style={{ padding: '0 4px', lineHeight: 1, background: 'transparent', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: 16 }} title="Usuń z setu">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <label>Faza: <select value={phase_id} onChange={(e) => setPhase_id(Number(e.target.value))} style={{ marginLeft: 8 }}>{phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Maszyna:
            <select value={machine_id} onChange={(e) => setMachine_id(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="">--</option>
              {machines.map((m) => <option key={m.id} value={m.id}>{m.internal_number} ({m.type})</option>)}
            </select>
            {machine_id && freeCapacityPercent != null && (
              <span style={{ fontSize: 12, color: '#666' }} title="Wolna zdolność maszyny (obciążenie w kalkulatorze)">wolne: {freeCapacityPercent}%</span>
            )}
          </label>
          {machine_id && (
            <p style={{ fontSize: 12, color: '#666', margin: '0 0 4px' }}>Na tej maszynie w projekcie udziały operacji sumują się do 100%. Przy dodaniu kolejnej operacji udziały zostaną automatycznie wyrównane (np. 50% i 50%).</p>
          )}
          <label>Cykl [s]: <input type="number" value={cycle_time_seconds} onChange={(e) => setCycle_time_seconds(Number(e.target.value))} style={{ marginLeft: 8, width: 80 }} /></label>
          <p style={{ fontSize: 13, color: '#555', margin: '4px 0' }}>Wolumen jest przypisywany do detalu w zakładce Wolumeny.</p>
          <label>Ilość gniazd: <input type="number" min={1} value={nests_count} onChange={(e) => setNests_count(Number(e.target.value))} style={{ marginLeft: 8, width: 60 }} /></label>
          <label>OEE [%]: <input type="number" min={0} max={100} step={0.01} placeholder="puste = z ustawień" title="Nadpisanie OEE dla tego detalu i operacji" value={oee_override} onChange={(e) => setOee_override(e.target.value)} style={{ marginLeft: 8, width: 80 }} /></label>
        </div>
        {error && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={saving} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Zapisz</button>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>Anuluj</button>
        </div>
      </div>
    </div>
  );
}
