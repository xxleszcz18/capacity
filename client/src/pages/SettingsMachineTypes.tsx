import { useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { api } from '../api/client';

import { confirmDelete } from '../confirmDelete';

import SortableTh from '../components/SortableTh';

import { useTableSort, sortRows } from '../utils/tableSort';

import { useI18n } from '../context/I18nContext';



type MachineTypeRow = { id: number; name: string; default_machine_usage: number };



function clampUsageInput(v: number): number {

  if (!Number.isFinite(v)) return 1;

  const c = Math.max(0.1, Math.min(1, v));

  return Math.round(c * 10) / 10;

}



export default function SettingsMachineTypes() {

  const { t, te } = useI18n();

  const [types, setTypes] = useState<MachineTypeRow[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [addError, setAddError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');

  const [newUsage, setNewUsage] = useState('1');

  const [editModal, setEditModal] = useState<MachineTypeRow | null>(null);

  const [editName, setEditName] = useState('');

  const [editUsage, setEditUsage] = useState('1');

  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');



  const [syncBusy, setSyncBusy] = useState(false);

  const [syncMessage, setSyncMessage] = useState<string | null>(null);



  const load = () => {

    setError(null);

    return api.settings.machineTypes

      .list()

      .then(setTypes)

      .catch((e) => setError(te(e.message) || t('machineTypes.loadError')));

  };



  useEffect(() => {

    setLoading(true);

    load().finally(() => setLoading(false));

  }, []);



  const addType = () => {

    const name = newName.trim();

    if (!name) return;

    const u = clampUsageInput(Number(newUsage.replace(',', '.')));

    setAddError(null);

    setSyncMessage(null);

    api.settings.machineTypes

      .create({ name, default_machine_usage: u })

      .then((created) => {

        setNewName('');

        setNewUsage('1');

        setTypes((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })));

      })

      .catch((e) => setAddError(te(e.message) || t('machineTypes.addFailed')));

  };



  const openEdit = (row: MachineTypeRow) => {

    setEditModal(row);

    setEditName(row.name);

    setEditUsage(String(row.default_machine_usage ?? 1));

  };



  const saveEdit = () => {

    if (!editModal) return;

    const name = editName.trim();

    if (!name) return;

    const u = clampUsageInput(Number(editUsage.replace(',', '.')));

    setSaving(true);

    api.settings.machineTypes

      .update(editModal.id, { name, default_machine_usage: u })

      .then((updated) => {

        setTypes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)).sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })));

        setEditModal(null);

      })

      .catch(() => {})

      .finally(() => setSaving(false));

  };



  type MtSortCol = 'name' | 'usage';

  const { sortCol, sortDir, toggle } = useTableSort<MtSortCol>('name');



  const displayTypes = useMemo(() => {

    const filtered = search.trim()

      ? types.filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()))

      : types;

    return sortRows(filtered, sortCol, sortDir, (row, col) => {

      if (col === 'usage') return Number(row.default_machine_usage) || 0;

      return row.name;

    });

  }, [types, search, sortCol, sortDir]);



  if (loading) return <p>{t('common.loading')}</p>;



  return (

    <div>

      <div style={{ marginBottom: '1rem' }}>

        <Link to="/administracja/ustawienia-bazy" style={{ color: 'var(--cap-green)' }}>{t('settings.backDatabase')}</Link>

      </div>

      <h1 style={{ marginTop: 0 }}>{t('settings.machineTypes')}</h1>

      <p style={{ color: '#666', marginBottom: '1rem' }}>{t('machineTypes.intro')}</p>



      {error && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{error}</p>}

      {addError && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{addError}</p>}

      {syncMessage && <p style={{ color: '#2e7d32', marginBottom: 8 }}>{syncMessage}</p>}



      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

          <span style={{ fontSize: 13 }}>{t('machineTypes.typeName')}</span>

          <input

            type="text"

            placeholder={t('machineTypes.typeNamePlaceholder')}

            value={newName}

            onChange={(e) => setNewName(e.target.value)}

            onKeyDown={(e) => e.key === 'Enter' && addType()}

            style={{ padding: '0.5rem', width: 200 }}

          />

        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

          <span style={{ fontSize: 13 }}>{t('machineTypes.defaultUsage')}</span>

          <input

            type="number"

            min={0.1}

            max={1}

            step={0.1}

            value={newUsage}

            onChange={(e) => setNewUsage(e.target.value)}

            style={{ padding: '0.5rem', width: 120 }}

          />

        </label>

        <button onClick={addType} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>

          {t('machineTypes.addType')}

        </button>

        <button

          type="button"

          disabled={syncBusy}

          onClick={() => {

            setSyncBusy(true);

            setError(null);

            setAddError(null);

            setSyncMessage(null);

            api.settings.machineTypes

              .syncFromMachines()

              .then((r) => {

                setTypes(r.types.sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' })));

                setSyncMessage(

                  r.inserted > 0

                    ? t('machineTypes.syncInserted', { count: r.inserted })

                    : t('machineTypes.syncNone')

                );

              })

              .catch((e) => setError(te(e.message) || t('machineTypes.syncFailed')))

              .finally(() => setSyncBusy(false));

          }}

          style={{ padding: '0.5rem 1rem', background: '#455a64', color: 'white', border: 'none', borderRadius: 4 }}

        >

          {syncBusy ? t('machineTypes.syncing') : t('machineTypes.syncFromMachines')}

        </button>

      </div>



      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

        <thead>

          <tr style={{ background: '#f5f5f5' }}>

            <SortableTh label={t('machineTypes.nameCol')} active={sortCol === 'name'} direction={sortDir} onClick={() => toggle('name')} />

            <SortableTh label={t('machineTypes.usageCol')} active={sortCol === 'usage'} direction={sortDir} onClick={() => toggle('usage')} />

            <th style={{ padding: '0.75rem', width: 180 }}>{t('commonExtra.actions')}</th>

          </tr>

          <tr style={{ background: '#fafafa' }}>

            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>

              <input type="text" placeholder={t('machineTypes.filter')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />

            </th>

            <th style={{ padding: '4px 6px' }}></th>

            <th style={{ padding: '4px 6px' }}></th>

          </tr>

        </thead>

        <tbody>

          {displayTypes.map((row) => (

            <tr key={row.id}>

              <td style={{ padding: '0.75rem' }}>{row.name}</td>

              <td style={{ padding: '0.75rem' }}>{row.default_machine_usage ?? 1}</td>

              <td style={{ padding: '0.75rem' }}>

                <button onClick={() => openEdit(row)} style={{ marginRight: 8, padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>{t('commonExtra.edit')}</button>

                <button

                  type="button"

                  onClick={() => {

                    if (!confirmDelete(t('machineTypes.deleteConfirmWarn', { name: row.name }))) return;

                    api.settings.machineTypes.delete(row.id).then(load);

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

      {types.length === 0 && !error && <p style={{ color: '#999', marginTop: 8 }}>{t('machineTypes.empty')}</p>}

      {types.length > 0 && search.trim() && !types.some((row) => row.name.toLowerCase().includes(search.trim().toLowerCase())) && (

        <p style={{ color: '#666', marginTop: 8 }}>{t('phases.noFilterResults')}</p>

      )}



      {editModal && (

        <div onMouseDown={(e) => { if (e.target === e.currentTarget) setEditModal(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>

          <div onMouseDown={(e) => e.stopPropagation()} style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 340 }}>

            <h3 style={{ marginTop: 0 }}>{t('machineTypes.editTitle')}</h3>

            <label style={{ display: 'block', marginBottom: 12 }}>

              {t('phases.nameLabel')} <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ marginLeft: 8, padding: 6, width: 220 }} />

            </label>

            <label style={{ display: 'block', marginBottom: 8 }}>

              {t('machineTypes.defaultUsage')}:{' '}

              <input

                type="number"

                min={0.1}

                max={1}

                step={0.1}

                value={editUsage}

                onChange={(e) => setEditUsage(e.target.value)}

                style={{ marginLeft: 8, padding: 6, width: 120 }}

              />

            </label>

            <p style={{ fontSize: 12, color: '#666', margin: '0 0 12px' }}>{t('machineTypes.editUsageNote')}</p>

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


