import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { confirmDelete } from '../confirmDelete';

export default function Scenarios() {
  const [list, setList] = useState<{ id: number; name: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filterNazwa, setFilterNazwa] = useState('');
  const [filterUtworzono, setFilterUtworzono] = useState('');

  const load = () => {
    setLoading(true);
    api.scenarios.list().then(setList).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) { setError('Podaj nazwę scenariusza'); return; }
    setError('');
    setSaving(true);
    api.scenarios.create(name)
      .then(() => { setAddModal(false); setNewName(''); load(); })
      .catch((e) => setError(e.message || 'Błąd zapisu'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirmDelete(`Czy na pewno usunąć scenariusz „${name}”? Zniknie zapisany stan projektów i operacji. Tej operacji nie można cofnąć.`)) return;
    api.scenarios.delete(id).then(load);
  };

  const filteredList = list.filter((s) => {
    if (filterNazwa.trim() && !s.name.toLowerCase().includes(filterNazwa.trim().toLowerCase())) return false;
    const createdStr = new Date(s.created_at).toLocaleString('pl-PL');
    if (filterUtworzono.trim() && !createdStr.includes(filterUtworzono.trim())) return false;
    return true;
  });

  if (loading && list.length === 0) return <p>Ładowanie…</p>;
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Scenariusze</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>Zapisz aktualny stan bazy (projekty, części, operacje, ustawienia dni robocze) jako scenariusz. Scenariusze pozwalają porównywać capacity dla różnych zestawów projektów.</p>
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => { setAddModal(true); setNewName(''); setError(''); }} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Nowy scenariusz</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Nazwa</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Utworzono</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}></th>
          </tr>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Nazwa" value={filterNazwa} onChange={(e) => setFilterNazwa(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Utworzono" value={filterUtworzono} onChange={(e) => setFilterUtworzono(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px' }}></th>
          </tr>
        </thead>
        <tbody>
          {filteredList.map((s) => (
            <tr key={s.id}>
              <td style={{ padding: '0.75rem' }}>{s.name}</td>
              <td style={{ padding: '0.75rem' }}>{new Date(s.created_at).toLocaleString('pl-PL')}</td>
              <td style={{ padding: '0.75rem' }}>
                <Link to={`/scenariusze/${s.id}`} style={{ marginRight: 8, padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', textDecoration: 'none', borderRadius: 4 }}>Podgląd</Link>
                <button type="button" onClick={() => handleDelete(s.id, s.name)} style={{ padding: '0.25rem 0.5rem', background: '#c62828', color: 'white', border: 'none', borderRadius: 4 }}>Usuń</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredList.length === 0 && !loading && <p style={{ color: '#666' }}>{list.length === 0 ? 'Brak scenariuszy. Kliknij „Nowy scenariusz”, aby zapisać aktualny stan bazy.' : 'Brak wyników dla podanego filtra.'}</p>}

      {addModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360 }}>
            <h2 style={{ marginTop: 0 }}>Nowy scenariusz</h2>
            <p style={{ fontSize: 14, color: '#666' }}>Zostanie zapisana kopia: projektów, części, operacji i ustawień dni robocze (maszyny i gniazda pozostają bieżące).</p>
            <label style={{ display: 'block', marginBottom: 8 }}>Nazwa scenariusza * <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: '100%', padding: 6, marginTop: 4 }} placeholder="np. Wariant A 2026" /></label>
            {error && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCreate} disabled={saving} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Zapisz scenariusz</button>
              <button onClick={() => setAddModal(false)} style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>Anuluj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
