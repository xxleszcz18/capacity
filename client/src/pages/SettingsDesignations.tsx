import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { confirmDelete } from '../confirmDelete';

type Designation = { id: number; designation?: string; sap_number?: string | null; alias?: string | null; free_text?: string | null; slot_number?: string | null };

export default function SettingsDesignations() {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [newSap, setNewSap] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [newFreeText, setNewFreeText] = useState('');
  const [newSlotNumber, setNewSlotNumber] = useState('');
  const [editModal, setEditModal] = useState<Designation | null>(null);
  const [editSap, setEditSap] = useState('');
  const [editAlias, setEditAlias] = useState('');
  const [editFreeText, setEditFreeText] = useState('');
  const [editSlotNumber, setEditSlotNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filterSap, setFilterSap] = useState('');
  const [filterAlias, setFilterAlias] = useState('');
  const [filterFreeText, setFilterFreeText] = useState('');
  const [filterSlot, setFilterSlot] = useState('');

  const load = () => {
    setError(null);
    return api.settings.designations.list()
      .then(setDesignations)
      .catch((e) => setError(e.message || 'Błąd ładowania detali'));
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const addDesignation = () => {
    const sap_number = newSap.trim();
    const alias = newAlias.trim();
    const free_text = newFreeText.trim();
    if (!sap_number && !alias && !free_text) return;
    setAddError(null);
    api.settings.designations.create({ sap_number: sap_number || undefined, alias: alias || undefined, free_text: free_text || undefined, slot_number: newSlotNumber.trim() || undefined })
      .then((created) => {
        setNewSap('');
        setNewAlias('');
        setNewFreeText('');
        setNewSlotNumber('');
        setDesignations((prev) => [...prev, created]);
      })
      .catch((e) => setAddError(e.message || 'Nie udało się dodać detalu'));
  };

  const openEdit = (d: Designation) => {
    setSaveError(null);
    setEditModal(d);
    setEditSap(d.sap_number ?? '');
    setEditAlias(d.alias ?? '');
    setEditFreeText(d.free_text ?? (d.designation ?? ''));
    setEditSlotNumber(d.slot_number ?? '');
  };

  const saveEdit = () => {
    if (!editModal) return;
    const sap_number = editSap.trim();
    const alias = editAlias.trim();
    const free_text = editFreeText.trim();
    if (!sap_number && !alias && !free_text) return;
    setSaveError(null);
    setSaving(true);
    api.settings.designations.update(editModal.id, { sap_number: sap_number || undefined, alias: alias || undefined, free_text: free_text || undefined, slot_number: editSlotNumber.trim() || undefined })
      .then(() => {
        setEditModal(null);
        return load();
      })
      .catch((e) => setSaveError(e.message || 'Nie udało się zapisać'))
      .finally(() => setSaving(false));
  };

  if (loading) return <p>Ładowanie…</p>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/ustawienia" style={{ color: 'var(--cap-green)' }}>← Ustawienia</Link>
      </div>
      <h1 style={{ marginTop: 0 }}>Detale (oznaczenia)</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>Katalog detali: Nr SAP, Alias, Free text. Przy wyborze w projekcie można szukać po Nr SAP lub po Alias. Możesz dodawać, edytować i usuwać wpisy.</p>

      {error && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{error}</p>}
      {addError && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{addError}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" placeholder="Nr SAP" value={newSap} onChange={(e) => setNewSap(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDesignation()} style={{ padding: '0.5rem', width: 140 }} />
        <input type="text" placeholder="Alias" value={newAlias} onChange={(e) => setNewAlias(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDesignation()} style={{ padding: '0.5rem', width: 140 }} />
        <input type="text" placeholder="Free text" value={newFreeText} onChange={(e) => setNewFreeText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDesignation()} style={{ padding: '0.5rem', width: 180 }} />
        <input type="text" placeholder="Nr gniazda (opcjonalnie)" value={newSlotNumber} onChange={(e) => setNewSlotNumber(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addDesignation()} style={{ padding: '0.5rem', width: 140 }} title="Numer gniazda produkcyjnego" />
        <button onClick={addDesignation} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Dodaj detal</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Nr SAP</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Alias</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Free text</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Nr gniazda</th>
            <th style={{ padding: '0.75rem', width: 180 }}>Akcje</th>
          </tr>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Nr SAP" value={filterSap} onChange={(e) => setFilterSap(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Alias" value={filterAlias} onChange={(e) => setFilterAlias(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Free text" value={filterFreeText} onChange={(e) => setFilterFreeText(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Nr gniazda" value={filterSlot} onChange={(e) => setFilterSlot(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px' }}></th>
          </tr>
        </thead>
        <tbody>
          {designations
            .filter((d) => {
              if (filterSap.trim() && !(d.sap_number ?? '').toLowerCase().includes(filterSap.trim().toLowerCase())) return false;
              if (filterAlias.trim() && !(d.alias ?? '').toLowerCase().includes(filterAlias.trim().toLowerCase())) return false;
              if (filterFreeText.trim() && !(d.free_text ?? d.designation ?? '').toLowerCase().includes(filterFreeText.trim().toLowerCase())) return false;
              if (filterSlot.trim() && !(d.slot_number ?? '').toLowerCase().includes(filterSlot.trim().toLowerCase())) return false;
              return true;
            })
            .map((d) => (
            <tr key={d.id}>
              <td style={{ padding: '0.75rem' }}>{d.sap_number ?? '—'}</td>
              <td style={{ padding: '0.75rem' }}>{d.alias ?? '—'}</td>
              <td style={{ padding: '0.75rem' }}>{d.free_text ?? (d.designation ?? '—')}</td>
              <td style={{ padding: '0.75rem' }}>{d.slot_number ?? '—'}</td>
              <td style={{ padding: '0.75rem' }}>
                <button onClick={() => openEdit(d)} style={{ marginRight: 8, padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>Edytuj</button>
                <button
                  type="button"
                  onClick={() => {
                    const label = d.sap_number || d.alias || d.free_text || d.designation || `ID ${d.id}`;
                    if (!confirmDelete(`Czy na pewno usunąć detal „${label}”? Tej operacji nie można cofnąć.`)) return;
                    api.settings.designations.delete(d.id).then(load);
                  }}
                  style={{ padding: '0.25rem 0.5rem', background: '#c62828', color: 'white', border: 'none', borderRadius: 4 }}
                >
                  Usuń
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {designations.length === 0 && !error && <p style={{ color: '#999', marginTop: 8 }}>Brak detali. Dodaj pierwszy powyżej (wypełnij co najmniej jedno pole).</p>}
      {designations.length > 0 && (filterSap.trim() || filterAlias.trim() || filterFreeText.trim() || filterSlot.trim()) && designations.filter((d) => {
        if (filterSap.trim() && !(d.sap_number ?? '').toLowerCase().includes(filterSap.trim().toLowerCase())) return false;
        if (filterAlias.trim() && !(d.alias ?? '').toLowerCase().includes(filterAlias.trim().toLowerCase())) return false;
        if (filterFreeText.trim() && !(d.free_text ?? d.designation ?? '').toLowerCase().includes(filterFreeText.trim().toLowerCase())) return false;
        if (filterSlot.trim() && !(d.slot_number ?? '').toLowerCase().includes(filterSlot.trim().toLowerCase())) return false;
        return true;
      }).length === 0 && <p style={{ color: '#666', marginTop: 8 }}>Brak wyników dla podanych filtrów.</p>}

      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360 }}>
            <h3 style={{ marginTop: 0 }}>Edycja detalu</h3>
            {saveError && <p style={{ color: 'var(--cap-red)', marginBottom: 12 }}>{saveError}</p>}
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              <label>Nr SAP: <input type="text" value={editSap} onChange={(e) => setEditSap(e.target.value)} style={{ marginLeft: 8, padding: 6, width: 220 }} /></label>
              <label>Alias: <input type="text" value={editAlias} onChange={(e) => setEditAlias(e.target.value)} style={{ marginLeft: 8, padding: 6, width: 220 }} /></label>
              <label>Free text: <input type="text" value={editFreeText} onChange={(e) => setEditFreeText(e.target.value)} style={{ marginLeft: 8, padding: 6, width: 220 }} /></label>
              <label>Nr gniazda (opcjonalnie): <input type="text" value={editSlotNumber} onChange={(e) => setEditSlotNumber(e.target.value)} style={{ marginLeft: 8, padding: 6, width: 220 }} placeholder="Numer gniazda produkcyjnego" /></label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEdit} disabled={saving || (!editSap.trim() && !editAlias.trim() && !editFreeText.trim())} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Zapisz</button>
              <button onClick={() => setEditModal(null)} style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>Anuluj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
