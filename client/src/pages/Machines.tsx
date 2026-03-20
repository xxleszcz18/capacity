import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { api } from '../api/client';

const EMPTY_MACHINE = { internal_number: '', sap_number: '', type: '', status: 'active' as const, location: '', oee_override: '' };

function parseCsvOrTsv(text: string): string[][] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.length);
  const sep = text.includes('\t') ? '\t' : ',';
  return lines.map((line) => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (!inQuotes && (c === sep || c === ',')) { out.push(cur.trim()); cur = ''; if (c === ',') continue; }
      else cur += c;
    }
    out.push(cur.trim());
    return out;
  });
}

function rowsToMachines(rows: string[][]): any[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const numIdx = header.findIndex((h) => /nr|numer|number|internal/.test(h));
  const sapIdx = header.findIndex((h) => /sap/.test(h));
  const typeIdx = header.findIndex((h) => /typ|type/.test(h));
  const statusIdx = header.findIndex((h) => /status/.test(h));
  const locIdx = header.findIndex((h) => /lok|location|hala/.test(h));
  const oeeIdx = header.findIndex((h) => /oee/.test(h));
  const machines: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const internal_number = numIdx >= 0 ? row[numIdx] : row[0];
    const type = typeIdx >= 0 ? row[typeIdx] : (row[2] ?? row[1]);
    if (!internal_number && !type) continue;
    machines.push({
      internal_number: internal_number ? Number(internal_number) || internal_number : '',
      sap_number: sapIdx >= 0 ? row[sapIdx] : (row[1] ?? ''),
      type: String(type ?? '').trim(),
      status: statusIdx >= 0 && String(row[statusIdx] || '').toLowerCase().includes('nieaktyw') ? 'inactive' : 'active',
      location: locIdx >= 0 ? row[locIdx] : '',
      oee_override: oeeIdx >= 0 ? row[oeeIdx] : '',
    });
  }
  return machines;
}

export default function Machines() {
  const [list, setList] = useState<any[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'active' | 'inactive' | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState('Wszystkie');
  const [search, setSearch] = useState('');
  const [filterNr, setFilterNr] = useState('');
  const [filterSap, setFilterSap] = useState('');
  const [filterTyp, setFilterTyp] = useState('Wszystkie');
  const [filterStatusCol, setFilterStatusCol] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importMode, setImportMode] = useState<'excel' | 'csv' | 'paste'>('excel');
  const [importPaste, setImportPaste] = useState('');
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [form, setForm] = useState(EMPTY_MACHINE);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoadError(null);
    setLoading(true);
    const params: Record<string, string | undefined> = {};
    if (status !== 'all') params.status = status;
    if (typeFilter !== 'Wszystkie') params.type = typeFilter;
    if (search.trim()) params.search = search.trim();
    api.machines.list(params)
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((err) => { setLoadError(err.message || 'Błąd ładowania listy maszyn.'); setList([]); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { api.machines.types().then(setTypes).catch(() => {}); }, []);
  useEffect(load, [status, typeFilter, search]);

  const openAdd = () => { setForm(EMPTY_MACHINE); setFormError(''); setAddModal(true); };
  const openImport = () => { setImportResult(null); setImportPaste(''); setImportModal(true); setImportMode('excel'); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const handleAddSubmit = () => {
    const num = Number(form.internal_number);
    if (!Number.isInteger(num) || num <= 0) { setFormError('Numer maszyny musi być liczbą całkowitą > 0'); return; }
    if (!form.type.trim()) { setFormError('Podaj typ maszyny'); return; }
    setFormError('');
    setSaving(true);
    api.machines.create({
      internal_number: num,
      sap_number: form.sap_number.trim() || null,
      type: form.type.trim(),
      status: form.status,
      location: form.location.trim() || null,
      oee_override: form.oee_override !== '' ? Number(form.oee_override) : null,
    }).then(() => { setAddModal(false); load(); api.machines.types().then(setTypes); }).catch((e) => setFormError(e.message || 'Błąd zapisu')).finally(() => setSaving(false));
  };

  const handleFileImport = (file: File) => {
    if (importMode === 'csv') {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result);
        const rows = parseCsvOrTsv(text);
        const machines = rowsToMachines(rows);
        if (!machines.length) { setImportResult({ created: 0, skipped: 0, errors: ['Brak wierszy do importu'] }); return; }
        api.machines.import(machines).then((r) => { setImportResult(r); load(); api.machines.types().then(setTypes); }).catch((e) => setImportResult({ created: 0, skipped: 0, errors: [e.message] }));
      };
      reader.readAsText(file, 'utf-8');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const first = wb.SheetNames[0];
      const ws = wb.Sheets[first];
      const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const machines = rowsToMachines(rows);
      if (!machines.length) { setImportResult({ created: 0, skipped: 0, errors: ['Brak wierszy w arkuszu'] }); return; }
      api.machines.import(machines).then((r) => { setImportResult(r); load(); api.machines.types().then(setTypes); }).catch((err) => setImportResult({ created: 0, skipped: 0, errors: [err.message] }));
    };
    reader.readAsArrayBuffer(file);
  };

  const handlePasteImport = () => {
    const rows = parseCsvOrTsv(importPaste);
    const machines = rowsToMachines(rows);
    if (!machines.length) { setImportResult({ created: 0, skipped: 0, errors: ['Wklej dane w formacie CSV lub TSV (pierwszy wiersz = nagłówki)'] }); return; }
    api.machines.import(machines).then((r) => { setImportResult(r); load(); api.machines.types().then(setTypes); }).catch((e) => setImportResult({ created: 0, skipped: 0, errors: [e.message] }));
  };

  if (loading && list.length === 0 && !loadError) return <p>Ładowanie…</p>;
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Maszyny</h1>
      {loadError && (
        <p style={{ padding: '0.75rem', background: '#ffebee', color: '#c62828', borderRadius: 8, marginBottom: '1rem' }}>
          {loadError} Upewnij się, że serwer działa (npm run dev w folderze server, port 3001).
        </p>
      )}
      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <button onClick={openAdd} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Dodaj maszynę</button>
        <div style={{ position: 'relative' }}>
          <button onClick={openImport} style={{ padding: '0.5rem 1rem', background: '#1976d2', color: 'white', border: 'none', borderRadius: 4 }}>Importuj</button>
        </div>
        <span style={{ marginLeft: 8 }}>Pokaż tylko:</span>
        <label><input type="radio" name="status" checked={status === 'active'} onChange={() => setStatus('active')} /> Aktywne</label>
        <label><input type="radio" name="status" checked={status === 'inactive'} onChange={() => setStatus('inactive')} /> Nieaktywne</label>
        <label><input type="radio" name="status" checked={status === 'all'} onChange={() => setStatus('all')} /> Wszystkie</label>
        <span style={{ marginLeft: 8 }}>typ maszyny:</span>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="Wszystkie">Wszystkie</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="text" placeholder="szukaj w maszynach..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ padding: '0.5rem', minWidth: 200 }} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Nr</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>SAP</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Typ</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}></th>
          </tr>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Nr" value={filterNr} onChange={(e) => setFilterNr(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr SAP" value={filterSap} onChange={(e) => setFilterSap(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <select value={filterTyp} onChange={(e) => setFilterTyp(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }}>
                <option value="Wszystkie">Wszystkie</option>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <select value={filterStatusCol} onChange={(e) => setFilterStatusCol(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }}>
                <option value="">—</option>
                <option value="active">Aktywny</option>
                <option value="inactive">Nieaktywny</option>
              </select>
            </th>
            <th style={{ padding: '4px 6px' }}></th>
          </tr>
        </thead>
        <tbody>
          {list
            .filter((m) => {
              if (filterNr.trim() && !String(m.internal_number ?? '').includes(filterNr.trim())) return false;
              if (filterSap.trim() && !(m.sap_number ?? '').toLowerCase().includes(filterSap.trim().toLowerCase())) return false;
              if (filterTyp !== 'Wszystkie' && m.type !== filterTyp) return false;
              if (filterStatusCol && m.status !== filterStatusCol) return false;
              return true;
            })
            .map((m) => (
            <tr key={m.id}>
              <td style={{ padding: '0.75rem' }}>{m.internal_number}</td>
              <td style={{ padding: '0.75rem' }}>{m.sap_number || '-'}</td>
              <td style={{ padding: '0.75rem' }}>{m.type}</td>
              <td style={{ padding: '0.75rem' }}>
                <span style={{ background: m.status === 'active' ? 'var(--cap-green)' : '#9e9e9e', color: 'white', padding: '0.25rem 0.5rem', borderRadius: 4 }}>{m.status === 'active' ? 'Aktywny' : 'Nieaktywny'}</span>
              </td>
              <td style={{ padding: '0.75rem' }}>
                <Link to={`/maszyny/${m.id}`} style={{ padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', textDecoration: 'none', borderRadius: 4 }}>Szczegóły</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360 }}>
            <h2 style={{ marginTop: 0 }}>Dodaj maszynę</h2>
            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
              <label>Numer wewnętrzny * <input type="number" value={form.internal_number} onChange={(e) => setForm((f) => ({ ...f, internal_number: e.target.value }))} style={{ width: '100%', padding: 6 }} /></label>
              <label>Numer SAP <input type="text" value={form.sap_number} onChange={(e) => setForm((f) => ({ ...f, sap_number: e.target.value }))} style={{ width: '100%', padding: 6 }} /></label>
              <label>Typ * <input type="text" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} placeholder="np. MC, WJ" style={{ width: '100%', padding: 6 }} /></label>
              <label>Status <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'active' | 'inactive' }))} style={{ width: '100%', padding: 6 }}><option value="active">Aktywny</option><option value="inactive">Nieaktywny</option></select></label>
              <label>Lokalizacja <input type="text" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="np. hala A" style={{ width: '100%', padding: 6 }} /></label>
              <label>OEE (nadpisanie) <input type="number" step="0.01" placeholder="puste = domyślne" value={form.oee_override} onChange={(e) => setForm((f) => ({ ...f, oee_override: e.target.value }))} style={{ width: '100%', padding: 6 }} /></label>
            </div>
            {formError && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAddSubmit} disabled={saving} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Zapisz</button>
              <button onClick={() => setAddModal(false)} style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>Anuluj</button>
            </div>
          </div>
        </div>
      )}

      {importModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 440, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>Import maszyn</h2>
            <p style={{ color: '#666', fontSize: 14 }}>Kolumny: numer (Nr/numer/internal_number), SAP, typ (Typ/type), opcjonalnie status, lokalizacja, OEE. Pierwszy wiersz = nagłówki. Dane z bazy SQL: wyeksportuj wynik do CSV lub Excel i zaimportuj tutaj.</p>
            <div style={{ marginBottom: '1rem' }}>
              <label><input type="radio" name="importMode" checked={importMode === 'excel'} onChange={() => setImportMode('excel')} /> Z pliku Excel (.xlsx)</label>
              <label style={{ marginLeft: 16 }}><input type="radio" name="importMode" checked={importMode === 'csv'} onChange={() => setImportMode('csv')} /> Z pliku CSV</label>
              <label style={{ marginLeft: 16 }}><input type="radio" name="importMode" checked={importMode === 'paste'} onChange={() => setImportMode('paste')} /> Wklej dane (CSV/TSV)</label>
            </div>
            {(importMode === 'excel' || importMode === 'csv') && (
              <div style={{ marginBottom: '1rem' }}>
                <input ref={fileInputRef} type="file" accept={importMode === 'excel' ? '.xlsx,.xls' : '.csv,.txt'} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileImport(f); }} style={{ width: '100%' }} />
              </div>
            )}
            {importMode === 'paste' && (
              <div style={{ marginBottom: '1rem' }}>
                <textarea value={importPaste} onChange={(e) => setImportPaste(e.target.value)} placeholder="Nr&#10;1019&#10;1020&#10;... lub z nagłówkami: Nr,SAP,Typ&#10;1019,C06-002,MC" rows={6} style={{ width: '100%', padding: 8, fontFamily: 'monospace' }} />
                <button onClick={handlePasteImport} style={{ marginTop: 4, padding: '0.5rem 1rem', background: '#1976d2', color: 'white', border: 'none', borderRadius: 4 }}>Importuj wklejone dane</button>
              </div>
            )}
            {importResult && (
              <div style={{ marginTop: '1rem', padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                <p><strong>Wynik:</strong> dodane: {importResult.created}, pominięte (duplikaty): {importResult.skipped}</p>
                {importResult.errors.length > 0 && <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--cap-red)' }}>{importResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
              </div>
            )}
            <button onClick={() => setImportModal(false)} style={{ marginTop: 12, padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>Zamknij</button>
          </div>
        </div>
      )}
    </div>
  );
}
