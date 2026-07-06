import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import MachineTypesMultiFilter from './MachineTypesMultiFilter';
import { useI18n } from '../context/I18nContext';
import { useReferenceDisplay } from '../context/ReferenceDisplayContext';
import { machineMatchesCalculatorFilter } from '../utils/machineSearchFilter';
import { formatMachineSapInternalLabel, type MachineDisplayMode } from '../utils/machineLabel';

type MachineRow = {
  id: number;
  internal_number?: string | null;
  sap_number?: string | null;
  type?: string | null;
  status?: string | null;
  location?: string | null;
};

type GroupRow = {
  id: number;
  name: string;
  machines: MachineRow[];
};

export default function MachineGroupsModal({ onClose, onChanged }: { onClose: () => void; onChanged?: () => void }) {
  const { t, te } = useI18n();
  const { machineDisplay: defaultMachineDisplay } = useReferenceDisplay();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [allMachines, setAllMachines] = useState<MachineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [machineSearch, setMachineSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [machineTypes, setMachineTypes] = useState<string[]>([]);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [labelDisplayMode, setLabelDisplayMode] = useState<MachineDisplayMode>(defaultMachineDisplay);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    return Promise.all([api.machineGroups.list(), api.machines.list(), api.machines.types()])
      .then(([groupData, machineData, typesData]) => {
        setGroups(Array.isArray(groupData) ? groupData : []);
        setAllMachines(Array.isArray(machineData) ? machineData : []);
        setMachineTypes(Array.isArray(typesData) ? typesData : []);
      })
      .catch((e: Error) => setError(te(e?.message) || t('common.loadError')))
      .finally(() => setLoading(false));
  }, [t, te]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (editingId == null) setLabelDisplayMode(defaultMachineDisplay);
  }, [editingId, defaultMachineDisplay]);

  const resetEditorFilters = () => {
    setMachineSearch('');
    setTypeFilter([]);
    setShowSelectedOnly(false);
    setLabelDisplayMode(defaultMachineDisplay);
  };

  const startNew = () => {
    setEditingId('new');
    setName('');
    setSelectedIds(new Set());
    resetEditorFilters();
    setError('');
  };

  const startEdit = (group: GroupRow) => {
    setEditingId(group.id);
    setName(group.name);
    setSelectedIds(new Set(group.machines.map((m) => m.id)));
    resetEditorFilters();
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setSelectedIds(new Set());
    resetEditorFilters();
    setError('');
  };

  const filteredMachines = useMemo(() => {
    let list = allMachines;
    if (typeFilter.length > 0) {
      list = list.filter((m) => m.type && typeFilter.includes(m.type));
    }
    const q = machineSearch.trim();
    if (q) {
      list = list.filter((m) => machineMatchesCalculatorFilter(m, q, labelDisplayMode));
    }
    return [...list].sort((a, b) =>
      String(a.internal_number ?? '').localeCompare(String(b.internal_number ?? ''), undefined, { numeric: true }),
    );
  }, [allMachines, machineSearch, typeFilter, labelDisplayMode]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [machineSearch, typeFilter.join(','), showSelectedOnly, labelDisplayMode]);

  const displayMachines = useMemo(() => {
    if (!showSelectedOnly) return filteredMachines;
    return filteredMachines.filter((m) => selectedIds.has(m.id));
  }, [filteredMachines, showSelectedOnly, selectedIds]);

  const toggleMachine = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const m of displayMachines) next.add(m.id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('machines.groupsNameRequired'));
      return;
    }
    setSaving(true);
    setError('');
    const machine_ids = [...selectedIds];
    const req =
      editingId === 'new'
        ? api.machineGroups.create(trimmed, machine_ids)
        : api.machineGroups.update(Number(editingId), trimmed, machine_ids);
    req
      .then(() => load().then(() => {
        onChanged?.();
        cancelEdit();
      }))
      .catch((e: Error) => setError(te(e?.message) || t('common.saveError')))
      .finally(() => setSaving(false));
  };

  const removeGroup = (id: number) => {
    if (!confirm(t('machines.groupsDeleteConfirm'))) return;
    setSaving(true);
    setError('');
    api.machineGroups
      .delete(id)
      .then(() => load().then(() => {
        onChanged?.();
        if (editingId === id) cancelEdit();
      }))
      .catch((e: Error) => setError(te(e?.message) || t('common.saveError')))
      .finally(() => setSaving(false));
  };

  const machineLabel = (m: MachineRow) => formatMachineSapInternalLabel(m, labelDisplayMode, { includeType: true });

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          width: 'min(960px, 100%)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{t('machines.groupsTitle')}</h2>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', lineHeight: 1 }} aria-label={t('common.close')}>
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ width: 260, borderRight: '1px solid #eee', padding: '1rem', overflowY: 'auto' }}>
            <button
              type="button"
              onClick={startNew}
              style={{ width: '100%', marginBottom: 12, padding: '0.5rem', background: 'var(--cap-green)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              {t('machines.groupsNew')}
            </button>
            {loading ? (
              <p style={{ color: '#666', fontSize: 14 }}>{t('common.loading')}</p>
            ) : groups.length === 0 ? (
              <p style={{ color: '#666', fontSize: 14 }}>{t('machines.groupsEmpty')}</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {groups.map((g) => (
                  <li key={g.id} style={{ marginBottom: 6 }}>
                    <button
                      type="button"
                      onClick={() => startEdit(g)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        border: editingId === g.id ? '2px solid var(--cap-green)' : '1px solid #e0e0e0',
                        borderRadius: 6,
                        background: editingId === g.id ? '#f1f8e9' : '#fafafa',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                        {t('machines.groupsMachineCount', { count: g.machines.length })}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ flex: 1, padding: '1rem 1.25rem', overflowY: 'auto', minWidth: 0 }}>
            {editingId == null ? (
              <p style={{ color: '#666', margin: 0 }}>{t('machines.groupsSelectHint')}</p>
            ) : (
              <>
                <label style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
                  {t('machines.groupsNameLabel')}
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={saving}
                    placeholder={t('machines.groupsNamePlaceholder')}
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: '0.5rem' }}
                  />
                </label>

                <div className="filters-toolbar" style={{ marginBottom: 8 }}>
                  <span>{t('machines.type')}</span>
                  <div style={{ minWidth: 180, maxWidth: 260 }}>
                    <MachineTypesMultiFilter types={machineTypes} selected={typeFilter} onChange={setTypeFilter} />
                  </div>
                  <input
                    type="text"
                    value={machineSearch}
                    onChange={(e) => setMachineSearch(e.target.value)}
                    placeholder={t('machines.groupsMachineSearch')}
                    autoComplete="off"
                    spellCheck={false}
                    style={{ flex: 1, minWidth: 180 }}
                  />
                  <button type="button" className="filter-clear-btn" onClick={selectAllVisible}>
                    {t('machines.groupsSelectVisible')}
                  </button>
                  <button type="button" className="filter-clear-btn" onClick={clearSelection}>
                    {t('machines.groupsClearSelection')}
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{t('machines.groupsLabelDisplay')}</span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="groupsLabelDisplay"
                      checked={labelDisplayMode === 'internal'}
                      onChange={() => setLabelDisplayMode('internal')}
                    />
                    {t('visual.internalOnly')}
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="groupsLabelDisplay"
                      checked={labelDisplayMode === 'sap'}
                      onChange={() => setLabelDisplayMode('sap')}
                    />
                    {t('visual.sapOnly')}
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="groupsLabelDisplay"
                      checked={labelDisplayMode === 'both'}
                      onChange={() => setLabelDisplayMode('both')}
                    />
                    {t('visual.bothSapInternal')}
                  </label>
                </div>

                <div className="machine-groups-list-mode" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: showSelectedOnly ? '#888' : '#263238', fontWeight: showSelectedOnly ? 400 : 600 }}>
                    {t('machines.groupsListAll')}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showSelectedOnly}
                    aria-label={t('machines.groupsListModeSwitch')}
                    onClick={() => setShowSelectedOnly((v) => !v)}
                    style={{
                      position: 'relative',
                      width: 46,
                      height: 26,
                      borderRadius: 13,
                      border: '2px solid var(--cap-green)',
                      background: showSelectedOnly ? 'var(--cap-green)' : '#e0e0e0',
                      cursor: 'pointer',
                      flexShrink: 0,
                      padding: 0,
                      transition: 'background 0.18s ease',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        top: 3,
                        left: showSelectedOnly ? 22 : 3,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: '#fff',
                        transition: 'left 0.18s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                      }}
                    />
                  </button>
                  <span style={{ fontSize: 13, color: showSelectedOnly ? '#263238' : '#888', fontWeight: showSelectedOnly ? 600 : 400 }}>
                    {t('machines.groupsListSelected')}
                  </span>
                </div>

                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#555' }}>
                  {t('machines.groupsSelectedCount', { count: selectedIds.size })}
                  {' · '}
                  {t('machines.groupsVisibleCount', { count: displayMachines.length })}
                </p>

                <div
                  ref={listRef}
                  style={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 6,
                    maxHeight: 320,
                    overflowY: 'auto',
                    padding: '4px 0',
                  }}
                >
                  {displayMachines.length === 0 ? (
                    <p style={{ padding: '0.75rem 1rem', margin: 0, color: '#666', fontSize: 14 }}>
                      {showSelectedOnly ? t('machines.groupsNoSelectedMachines') : t('machines.groupsNoMachinesMatch')}
                    </p>
                  ) : (
                    displayMachines.map((m) => (
                      <label
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: 13,
                          borderBottom: '1px solid #f5f5f5',
                        }}
                      >
                        <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleMachine(m.id)} />
                        <span>{machineLabel(m)}</span>
                      </label>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    style={{ padding: '0.5rem 1rem', background: '#2196f3', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    {saving ? t('common.saving') : t('common.save')}
                  </button>
                  <button type="button" onClick={cancelEdit} disabled={saving} style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    {t('common.cancel')}
                  </button>
                  {editingId !== 'new' && (
                    <button
                      type="button"
                      onClick={() => removeGroup(Number(editingId))}
                      disabled={saving}
                      style={{ padding: '0.5rem 1rem', background: '#c62828', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginLeft: 'auto' }}
                    >
                      {t('machines.groupsDelete')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <p style={{ margin: 0, padding: '0.75rem 1.25rem', background: '#ffebee', color: '#c62828', borderTop: '1px solid #ffcdd2' }}>{error}</p>
        )}
      </div>
    </div>
  );
}
