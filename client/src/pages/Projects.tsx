import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { confirmDelete } from '../confirmDelete';

type PartToAdd = { type: 'existing'; designation_id: number } | { type: 'new'; sap_number?: string; alias?: string; free_text?: string; slot_number?: string };

function monthInputToSopEop(value: string): string {
  if (!value) return '';
  const [y, m] = value.split('-');
  return `${m}.${y}`;
}
function sopEopToMonthInput(sop: string): string {
  const match = sop.match(/^(\d{1,2})\.(\d{4})$/);
  if (match) return `${match[2]}-${match[1].padStart(2, '0')}`;
  return '';
}

export default function Projects() {
  const [list, setList] = useState<any[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [designations, setDesignations] = useState<{ id: number; sap_number?: string | null; alias?: string | null; free_text?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'active' | 'inactive' | 'RFQ' | 'all'>('all');
  const [clientFilter, setClientFilter] = useState('Wszyscy');
  const [search, setSearch] = useState('');
  const [filterKlient, setFilterKlient] = useState('');
  const [filterNazwa, setFilterNazwa] = useState('');
  const [filterMaszyny, setFilterMaszyny] = useState('');
  const [filterSap, setFilterSap] = useState('');
  const [filterCzesci, setFilterCzesci] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ client: '', name: '', sop: '', eop: '', status: 'active' as const });
  const [sopMonth, setSopMonth] = useState('');
  const [eopMonth, setEopMonth] = useState('');
  const [partsToAdd, setPartsToAdd] = useState<PartToAdd[]>([]);
  const [newPartDesignationId, setNewPartDesignationId] = useState<number | ''>('');
  const [showNewPart, setShowNewPart] = useState(false);
  const [newPartSap, setNewPartSap] = useState('');
  const [newPartAlias, setNewPartAlias] = useState('');
  const [newPartFreeText, setNewPartFreeText] = useState('');
  const [newPartSlot, setNewPartSlot] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = () => {
    setLoadError(null);
    setLoading(true);
    const params: Record<string, string | undefined> = {};
    if (status !== 'all') params.status = status;
    if (clientFilter !== 'Wszyscy') params.client = clientFilter;
    if (search.trim()) params.search = search.trim();
    api.projects.list(params)
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((err) => { setLoadError(err.message || 'Błąd ładowania listy projektów.'); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { api.projects.clients().then(setClients).catch(() => {}); }, []);
  useEffect(load, [status, clientFilter, search]);
  useEffect(() => { if (addModal) api.settings.designations.list().then(setDesignations).catch(() => []); }, [addModal]);

  const addExistingPart = () => {
    if (newPartDesignationId === '') return;
    const id = Number(newPartDesignationId);
    if (partsToAdd.some((p) => p.type === 'existing' && p.designation_id === id)) return;
    setPartsToAdd((prev) => [...prev, { type: 'existing', designation_id: id }]);
    setNewPartDesignationId('');
  };
  const addNewPartFromForm = () => {
    if (!newPartSap.trim() && !newPartAlias.trim() && !newPartFreeText.trim()) return;
    setPartsToAdd((prev) => [...prev, { type: 'new', sap_number: newPartSap.trim() || undefined, alias: newPartAlias.trim() || undefined, free_text: newPartFreeText.trim() || undefined, slot_number: newPartSlot.trim() || undefined }]);
    setNewPartSap(''); setNewPartAlias(''); setNewPartFreeText(''); setNewPartSlot(''); setShowNewPart(false);
  };
  const removePartToAdd = (idx: number) => {
    if (!confirmDelete('Usunąć ten detal z listy dołączanych do nowego projektu?')) return;
    setPartsToAdd((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddProject = async () => {
    if (!form.client.trim()) { setFormError('Podaj klienta'); return; }
    if (!form.name.trim()) { setFormError('Podaj nazwę projektu'); return; }
    setFormError('');
    setSaving(true);
    try {
      const created = await api.projects.create({ client: form.client.trim(), name: form.name.trim(), sop: form.sop || undefined, eop: form.eop || undefined, status: form.status });
      setAddModal(false);
      setForm({ client: '', name: '', sop: '', eop: '', status: 'active' });
      setSopMonth(''); setEopMonth(''); setPartsToAdd([]);
      for (const p of partsToAdd) {
        try {
          if (p.type === 'existing') {
            await api.projects.addPart(created.id, { designation_id: p.designation_id });
          } else {
            const des = await api.settings.designations.create({ sap_number: p.sap_number, alias: p.alias, free_text: p.free_text, slot_number: p.slot_number });
            await api.projects.addPart(created.id, { designation_id: des.id });
          }
        } catch (_) {}
      }
      setPartsToAdd([]);
      load();
    } catch (e: any) {
      setFormError(e.message || 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  if (loading && list.length === 0 && !loadError) return <p>Ładowanie…</p>;
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Projekty</h1>
      {loadError && (
        <p style={{ padding: '0.75rem', background: '#ffebee', color: '#c62828', borderRadius: 8, marginBottom: '1rem' }}>
          {loadError} Upewnij się, że serwer działa (npm run dev w folderze server, port 3001).
        </p>
      )}
      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <button onClick={() => setAddModal(true)} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Dodaj projekt</button>
        <span style={{ marginLeft: 8 }}>Pokaż tylko:</span>
        <label><input type="radio" name="status" checked={status === 'active'} onChange={() => setStatus('active')} /> Aktywne</label>
        <label><input type="radio" name="status" checked={status === 'inactive'} onChange={() => setStatus('inactive')} /> Nieaktywne</label>
        <label><input type="radio" name="status" checked={status === 'RFQ'} onChange={() => setStatus('RFQ')} /> RFQ</label>
        <label><input type="radio" name="status" checked={status === 'all'} onChange={() => setStatus('all')} /> Wszystkie</label>
        <span style={{ marginLeft: 8 }}>klient:</span>
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
          <option value="Wszyscy">Wszyscy</option>
          {clients.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="text" placeholder="szukaj w projektach..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '0.5rem', minWidth: 200 }} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Klient</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Nazwa</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Maszyny (nr wewn.)</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Nr SAP maszyn</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Części</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}></th>
          </tr>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Klient" value={filterKlient} onChange={(e) => setFilterKlient(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Nazwa" value={filterNazwa} onChange={(e) => setFilterNazwa(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Maszyny" value={filterMaszyny} onChange={(e) => setFilterMaszyny(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Nr SAP" value={filterSap} onChange={(e) => setFilterSap(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Części" value={filterCzesci} onChange={(e) => setFilterCzesci(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }}>
                <option value="">—</option>
                <option value="active">Aktywny</option>
                <option value="inactive">Nieaktywny</option>
                <option value="RFQ">RFQ</option>
              </select>
            </th>
            <th style={{ padding: '4px 6px' }}></th>
          </tr>
        </thead>
        <tbody>
          {list
            .filter((p) => {
              const k = filterKlient.trim().toLowerCase();
              if (k && !(p.client ?? '').toLowerCase().includes(k)) return false;
              const n = filterNazwa.trim().toLowerCase();
              if (n && !(p.name ?? '').toLowerCase().includes(n)) return false;
              const m = filterMaszyny.trim();
              if (m && !(p.machines ?? []).some((x: any) => String(x.internal_number ?? x.machine_id ?? '').includes(m))) return false;
              const s = filterSap.trim().toLowerCase();
              if (s && !(p.machines ?? []).some((x: any) => (x.sap_number ?? '').toLowerCase().includes(s))) return false;
              const c = filterCzesci.trim().toLowerCase();
              if (c && !(p.parts ?? []).some((pt: any) => (pt.designation ?? '').toLowerCase().includes(c))) return false;
              if (filterStatus && p.status !== filterStatus) return false;
              return true;
            })
            .map((p) => (
            <tr key={p.id}>
              <td style={{ padding: '0.75rem' }}>{p.client}</td>
              <td style={{ padding: '0.75rem' }}>{p.name}</td>
              <td style={{ padding: '0.75rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(p.machines ?? []).map((m: { machine_id: number; internal_number: number; sap_number?: string | null }) => (
                    <span key={m.machine_id} style={{ background: '#e3f2fd', padding: '2px 6px', borderRadius: 4 }} title={m.sap_number ? `SAP: ${m.sap_number}` : undefined}>{m.internal_number ?? m.machine_id}</span>
                  ))}
                </div>
              </td>
              <td style={{ padding: '0.75rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(() => {
                    const saps = [...new Set((p.machines ?? []).map((m: { sap_number?: string | null }) => m.sap_number).filter((s): s is string => Boolean(s)))];
                    if (saps.length > 0) return saps.map((sap) => <span key={sap} style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{sap}</span>);
                    return <span style={{ color: '#888', fontSize: 13 }}>—</span>;
                  })()}
                </div>
              </td>
              <td style={{ padding: '0.75rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(p.parts ?? []).map((pt: any) => <span key={pt.id} style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{pt.designation}</span>)}
                </div>
              </td>
              <td style={{ padding: '0.75rem' }}>
                <span style={{ background: p.status === 'active' ? 'var(--cap-green)' : p.status === 'RFQ' ? '#ff9800' : '#9e9e9e', color: 'white', padding: '0.25rem 0.5rem', borderRadius: 4 }}>{p.status === 'active' ? 'Aktywny' : p.status === 'RFQ' ? 'RFQ' : 'Nieaktywny'}</span>
              </td>
              <td style={{ padding: '0.75rem' }}>
                <Link to={`/projekty/${p.id}`} style={{ padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', textDecoration: 'none', borderRadius: 4 }}>Szczegóły</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 440, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>Nowy projekt</h2>
            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
              <label>Klient * <input type="text" value={form.client} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))} style={{ width: '100%', padding: 6 }} /></label>
              <label>Nazwa projektu * <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: 6 }} /></label>
              <div>
                <label>Data rozpoczęcia (SOP)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <input type="month" value={sopMonth || sopEopToMonthInput(form.sop)} onChange={(e) => { const v = e.target.value; setSopMonth(v); setForm((f) => ({ ...f, sop: monthInputToSopEop(v) })); }} style={{ padding: 6 }} title="Wybierz miesiąc i rok" />
                  <input type="text" value={form.sop} onChange={(e) => setForm((f) => ({ ...f, sop: e.target.value }))} placeholder="np. 01.2026 lub CW12" style={{ flex: 1, padding: 6 }} />
                </div>
              </div>
              <div>
                <label>Data zakończenia (EOP)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <input type="month" value={eopMonth || sopEopToMonthInput(form.eop)} onChange={(e) => { const v = e.target.value; setEopMonth(v); setForm((f) => ({ ...f, eop: monthInputToSopEop(v) })); }} style={{ padding: 6 }} title="Wybierz miesiąc i rok" />
                  <input type="text" value={form.eop} onChange={(e) => setForm((f) => ({ ...f, eop: e.target.value }))} placeholder="np. 12.2030" style={{ flex: 1, padding: 6 }} />
                </div>
              </div>
              <label>Status <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))} style={{ width: '100%', padding: 6 }}><option value="active">Aktywny</option><option value="inactive">Nieaktywny</option><option value="RFQ">RFQ</option></select></label>

              <div style={{ marginTop: 8, padding: '0.75rem', background: '#f5f5f5', borderRadius: 6 }}>
                <strong>Detale (opcjonalnie)</strong>
                <p style={{ margin: '4px 0 8px', fontSize: 13, color: '#555' }}>Wybierz z listy lub utwórz nowy — trafią do projektu i do bazy detali.</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <select value={String(newPartDesignationId)} onChange={(e) => setNewPartDesignationId(e.target.value === '' ? '' : Number(e.target.value))} style={{ padding: 4, minWidth: 200 }}>
                    <option value="">— wybierz istniejący detal —</option>
                    {designations.filter((d) => (d.sap_number ?? '').trim() || (d.alias ?? '').trim()).map((d) => (
                      <option key={d.id} value={d.id}>{d.sap_number || d.alias || d.free_text || ''}</option>
                    ))}
                  </select>
                  <button type="button" onClick={addExistingPart} disabled={!newPartDesignationId} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Dodaj</button>
                  <button type="button" onClick={() => setShowNewPart((v) => !v)} style={{ padding: '0.35rem 0.75rem', background: '#757575', color: 'white', border: 'none', borderRadius: 4 }}>+ Nowy detal</button>
                </div>
                {showNewPart && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input type="text" placeholder="Nr SAP" value={newPartSap} onChange={(e) => setNewPartSap(e.target.value)} style={{ padding: 4, width: 120 }} />
                    <input type="text" placeholder="Alias" value={newPartAlias} onChange={(e) => setNewPartAlias(e.target.value)} style={{ padding: 4, width: 120 }} />
                    <input type="text" placeholder="Free text" value={newPartFreeText} onChange={(e) => setNewPartFreeText(e.target.value)} style={{ padding: 4, width: 120 }} />
                    <input type="text" placeholder="Nr gniazda" value={newPartSlot} onChange={(e) => setNewPartSlot(e.target.value)} style={{ padding: 4, width: 100 }} />
                    <button type="button" onClick={addNewPartFromForm} disabled={!newPartSap.trim() && !newPartAlias.trim() && !newPartFreeText.trim()} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Dodaj i utwórz</button>
                  </div>
                )}
                {partsToAdd.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {partsToAdd.map((p, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ background: '#e8f5e9', padding: '2px 8px', borderRadius: 4 }}>
                          {p.type === 'existing' ? (designations.find((d) => d.id === p.designation_id)?.sap_number || designations.find((d) => d.id === p.designation_id)?.alias || `#${p.designation_id}`) : `Nowy: ${p.sap_number || p.alias || p.free_text || '—'}`}
                        </span>
                        <button type="button" onClick={() => removePartToAdd(idx)} style={{ padding: '0 6px', background: '#c62828', color: 'white', border: 'none', borderRadius: 4 }}>×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {formError && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAddProject} disabled={saving} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Zapisz</button>
              <button onClick={() => setAddModal(false)} style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>Anuluj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
