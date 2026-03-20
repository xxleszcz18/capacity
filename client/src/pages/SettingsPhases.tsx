import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { confirmDelete } from '../confirmDelete';

export default function SettingsPhases() {
  const [phases, setPhases] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [editModal, setEditModal] = useState<{ id: number; name: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = () => {
    setError(null);
    return api.settings.phases.list()
      .then(setPhases)
      .catch((e) => setError(e.message || 'Błąd ładowania faz'));
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const addPhase = () => {
    const name = newName.trim();
    if (!name) return;
    setAddError(null);
    api.settings.phases.create(name)
      .then((created) => {
        setNewName('');
        setPhases((prev) => [...prev, created]);
      })
      .catch((e) => setAddError(e.message || 'Nie udało się dodać fazy'));
  };

  const openEdit = (p: { id: number; name: string }) => {
    setEditModal(p);
    setEditName(p.name);
  };

  const saveEdit = () => {
    if (!editModal) return;
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    api.settings.phases.update(editModal.id, name)
      .then((updated) => {
        setPhases((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        setEditModal(null);
      })
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  if (loading) return <p>Ładowanie…</p>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/ustawienia" style={{ color: 'var(--cap-green)' }}>← Ustawienia</Link>
      </div>
      <h1 style={{ marginTop: 0 }}>Fazy procesu</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>Lista faz używanych w operacjach (np. Piankowanie, Cięcie). Możesz dodawać, edytować i usuwać fazy.</p>

      {error && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{error}</p>}
      {addError && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{addError}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Nazwa fazy"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPhase()}
          style={{ padding: '0.5rem', width: 220 }}
        />
        <button onClick={addPhase} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>
          Dodaj fazę
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Nazwa</th>
            <th style={{ padding: '0.75rem', width: 180 }}>Akcje</th>
          </tr>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Nazwa" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px' }}></th>
          </tr>
        </thead>
        <tbody>
          {(search.trim() ? phases.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())) : phases).map((p) => (
            <tr key={p.id}>
              <td style={{ padding: '0.75rem' }}>{p.name}</td>
              <td style={{ padding: '0.75rem' }}>
                <button onClick={() => openEdit(p)} style={{ marginRight: 8, padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>Edytuj</button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirmDelete(`Czy na pewno usunąć fazę „${p.name}”? Jeśli jest używana w operacjach, usuwanie może się nie powieść. Tej operacji nie można cofnąć.`)) return;
                    api.settings.phases.delete(p.id).then(load);
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
      {phases.length === 0 && !error && <p style={{ color: '#999', marginTop: 8 }}>Brak faz. Dodaj pierwszą powyżej.</p>}
      {phases.length > 0 && search.trim() && !phases.some((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())) && <p style={{ color: '#666', marginTop: 8 }}>Brak wyników dla podanego filtra.</p>}

      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>Edycja fazy</h3>
            <label style={{ display: 'block', marginBottom: 8 }}>
              Nazwa: <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ marginLeft: 8, padding: 6, width: 240 }} />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={saveEdit} disabled={saving || !editName.trim()} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Zapisz</button>
              <button onClick={() => setEditModal(null)} style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>Anuluj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
