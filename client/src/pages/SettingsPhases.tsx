import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { confirmDelete } from '../confirmDelete';
import SortableTh from '../components/SortableTh';
import { useTableSort, sortRows } from '../utils/tableSort';
import { useI18n } from '../context/I18nContext';

export default function SettingsPhases() {
  const { t, te } = useI18n();
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
      .catch((e) => setError(te(e.message) || t('phases.loadError')));
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
      .catch((e) => setAddError(te(e.message) || t('phases.addFailed')));
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

  type PhaseSortCol = 'name';
  const { sortCol, sortDir, toggle } = useTableSort<PhaseSortCol>('name');

  const displayPhases = useMemo(() => {
    const filtered = search.trim()
      ? phases.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
      : phases;
    return sortRows(filtered, sortCol, sortDir, (p) => p.name);
  }, [phases, search, sortCol, sortDir]);

  if (loading) return <p>{t('common.loading')}</p>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/administracja/ustawienia-bazy" style={{ color: 'var(--cap-green)' }}>{t('settings.backDatabase')}</Link>
      </div>
      <h1 style={{ marginTop: 0 }}>{t('settings.phases')}</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>{t('phases.intro')}</p>

      {error && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{error}</p>}
      {addError && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{addError}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder={t('phases.namePlaceholder')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPhase()}
          style={{ padding: '0.5rem', width: 220 }}
        />
        <button onClick={addPhase} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>
          {t('phases.addPhase')}
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <SortableTh label={t('phases.nameCol')} active={sortCol === 'name'} direction={sortDir} onClick={() => toggle('name')} />
            <th style={{ padding: '0.75rem', width: 180 }}>{t('commonExtra.actions')}</th>
          </tr>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder={t('common.filterColumn', { column: t('phases.nameCol') })} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px' }}></th>
          </tr>
        </thead>
        <tbody>
          {displayPhases.map((p) => (
            <tr key={p.id}>
              <td style={{ padding: '0.75rem' }}>{p.name}</td>
              <td style={{ padding: '0.75rem' }}>
                <button onClick={() => openEdit(p)} style={{ marginRight: 8, padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>{t('commonExtra.edit')}</button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirmDelete(t('phases.deleteConfirmWarn', { name: p.name }))) return;
                    api.settings.phases.delete(p.id).then(load);
                  }}
                  style={{ padding: '0.25rem 0.5rem', background: '#c62828', color: 'white', border: 'none', borderRadius: 4 }}
                >
                  {t('common.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {phases.length === 0 && !error && <p style={{ color: '#999', marginTop: 8 }}>{t('phases.empty')}</p>}
      {phases.length > 0 && search.trim() && !phases.some((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())) && <p style={{ color: '#666', marginTop: 8 }}>{t('phases.noFilterResults')}</p>}

      {editModal && (
        <div onMouseDown={(e) => { if (e.target === e.currentTarget) setEditModal(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onMouseDown={(e) => e.stopPropagation()} style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h3 style={{ marginTop: 0 }}>{t('phases.editTitle')}</h3>
            <label style={{ display: 'block', marginBottom: 8 }}>
              {t('phases.nameLabel')} <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ marginLeft: 8, padding: 6, width: 240 }} />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={saveEdit} disabled={saving || !editName.trim()} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>{t('common.save')}</button>
              <button onClick={() => setEditModal(null)} style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
