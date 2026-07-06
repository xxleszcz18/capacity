import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { confirmDelete } from '../confirmDelete';
import SortableTh from '../components/SortableTh';
import { formatDetailSapAliasLabel, formatSapNumberForDisplay } from '../utils/detailLabel';
import { useReferenceDisplay } from '../context/ReferenceDisplayContext';
import { useI18n } from '../context/I18nContext';
import { useTableSort, sortRows } from '../utils/tableSort';
import { isDesignationDuplicateError } from '../utils/designationDuplicate';

type Designation = {
  id: number;
  designation?: string;
  sap_number?: string | number | null;
  alias?: string | null;
  free_text?: string | null;
  slot_number?: string | null;
  projects?: { id: number; name: string }[];
  machine_lines?: string[];
};

export default function SettingsDesignations() {
  const { t, te } = useI18n();
  const location = useLocation();
  const scenarioQs = location.search || '';
  const { referenceDisplay } = useReferenceDisplay();
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [newSap, setNewSap] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [newFreeText, setNewFreeText] = useState('');
  const [editModal, setEditModal] = useState<Designation | null>(null);
  const [editSap, setEditSap] = useState('');
  const [editAlias, setEditAlias] = useState('');
  const [editFreeText, setEditFreeText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filterSap, setFilterSap] = useState('');
  const [filterAlias, setFilterAlias] = useState('');
  const [filterFreeText, setFilterFreeText] = useState('');
  const [filterSlot, setFilterSlot] = useState('');
  const [filterProject, setFilterProject] = useState('');
  type RelatedOperation = {
    id: number;
    label: string;
    has_children: number;
  };
  const [deleteModal, setDeleteModal] = useState<{
    designation: Designation;
    operations: RelatedOperation[];
    selected: Set<number>;
    loading: boolean;
    saving: boolean;
    error: string | null;
    resultMessage: string | null;
  } | null>(null);

  const matchesFilters = (d: Designation) => {
    if (filterSap.trim()) {
      const sapDisp = formatSapNumberForDisplay(d.sap_number).toLowerCase();
      if (!sapDisp.includes(filterSap.trim().toLowerCase())) return false;
    }
    if (filterAlias.trim() && !(d.alias ?? '').toLowerCase().includes(filterAlias.trim().toLowerCase())) return false;
    if (filterFreeText.trim() && !(d.free_text ?? d.designation ?? '').toLowerCase().includes(filterFreeText.trim().toLowerCase())) return false;
    if (filterSlot.trim()) {
      const q = filterSlot.trim().toLowerCase();
      const lines = d.machine_lines ?? [];
      if (!lines.some((line) => line.toLowerCase().includes(q))) return false;
    }
    if (filterProject.trim()) {
      const q = filterProject.trim().toLowerCase();
      const names = d.projects ?? [];
      if (!names.some((p) => p.name.toLowerCase().includes(q))) return false;
    }
    return true;
  };

  const load = () => {
    setError(null);
    return api.settings.designations
      .list()
      .then(setDesignations)
      .catch((e) => setError(te(e.message) || t('errors.designationsLoadFailed')));
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
    api.settings.designations
      .create({ sap_number: sap_number || undefined, alias: alias || undefined, free_text: free_text || undefined })
      .then((created) => {
        setNewSap('');
        setNewAlias('');
        setNewFreeText('');
        setDesignations((prev) => [...prev, created]);
      })
      .catch((e) => {
        if (isDesignationDuplicateError(e.message)) {
          setDuplicateModalOpen(true);
          return;
        }
        setAddError(te(e.message) || t('errors.designationAddFailed'));
      });
  };

  const openEdit = (d: Designation) => {
    setSaveError(null);
    setEditModal(d);
    setEditSap(formatSapNumberForDisplay(d.sap_number));
    setEditAlias(d.alias ?? '');
    setEditFreeText(d.free_text ?? (d.designation ?? ''));
  };

  const saveEdit = () => {
    if (!editModal) return;
    const sap_number = editSap.trim();
    const alias = editAlias.trim();
    const free_text = editFreeText.trim();
    if (!sap_number && !alias && !free_text) return;
    setSaveError(null);
    setSaving(true);
    api.settings.designations
      .update(editModal.id, { sap_number: sap_number || undefined, alias: alias || undefined, free_text: free_text || undefined })
      .then(() => {
        setEditModal(null);
        return load();
      })
      .catch((e) => {
        if (isDesignationDuplicateError(e.message)) {
          setEditModal(null);
          setDuplicateModalOpen(true);
          return;
        }
        setSaveError(te(e.message) || t('errors.saveFailed'));
      })
      .finally(() => setSaving(false));
  };

  const designationLabel = (d: Designation) =>
    formatDetailSapAliasLabel(
      {
        sap_number: d.sap_number != null ? String(d.sap_number) : d.sap_number,
        alias: d.alias,
        free_text: d.free_text,
        designation: d.designation,
        id: d.id,
      },
      referenceDisplay
    );

  const openDeleteModal = (d: Designation) => {
    setDeleteModal({
      designation: d,
      operations: [],
      selected: new Set(),
      loading: true,
      saving: false,
      error: null,
      resultMessage: null,
    });
    api.settings.designations
      .relatedOperations(d.id)
      .then((r) => {
        const ops = r.operations ?? [];
        setDeleteModal((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                operations: ops.map((o) => ({ id: o.id, label: o.label, has_children: o.has_children })),
                selected: new Set(),
              }
            : prev
        );
      })
      .catch((e) => {
        setDeleteModal((prev) =>
          prev ? { ...prev, loading: false, error: te(e.message) || t('errors.designationsLoadFailed') } : prev
        );
      });
  };

  const confirmDeleteCascade = () => {
    if (!deleteModal) return;
    const { designation, operations, selected } = deleteModal;
    if (operations.length === 0) {
      if (!confirmDelete(`${t('designations.deleteNoOpsIntro')} ${t('common.irreversible')}`)) return;
      setDeleteModal((prev) => (prev ? { ...prev, saving: true, error: null } : prev));
      api.settings.designations
        .delete(designation.id)
        .then(() => {
          setDeleteModal(null);
          return load();
        })
        .catch((e) =>
          setDeleteModal((prev) =>
            prev ? { ...prev, saving: false, error: te(e.message) || t('errors.saveFailed') } : prev
          )
        );
      return;
    }
    const ids = [...selected];
    if (ids.length === 0) return;
    setDeleteModal((prev) => (prev ? { ...prev, saving: true, error: null, resultMessage: null } : prev));
    api.settings.designations
      .deleteCascade(designation.id, ids)
      .then((r) => {
        if (r.designation_deleted) {
          setDeleteModal(null);
          return load();
        }
        setDeleteModal((prev) =>
          prev
            ? {
                ...prev,
                saving: false,
                resultMessage: t('designations.deletePartialRemaining', {
                  ops: r.operations_deleted,
                  remaining: r.operations_remaining,
                }),
                operations: prev.operations.filter((o) => !ids.includes(o.id)),
                selected: new Set(),
              }
            : prev
        );
        return load();
      })
      .catch((e) =>
        setDeleteModal((prev) =>
          prev ? { ...prev, saving: false, error: te(e.message) || t('designations.deleteErrors') } : prev
        )
      );
  };

  type DetSortCol = 'sap' | 'alias' | 'free_text' | 'line' | 'project';
  const { sortCol, sortDir, toggle } = useTableSort<DetSortCol>('sap');

  const displayField = (value: string | number | null | undefined, formatSap = false) => {
    const s = value != null ? String(value).trim() : '';
    if (!s) return t('designations.emptyValue');
    return formatSap ? formatSapNumberForDisplay(value) : s;
  };

  const displayDesignations = useMemo(() => {
    const filtered = designations.filter(matchesFilters);
    return sortRows(filtered, sortCol, sortDir, (d, col) => {
      switch (col) {
        case 'sap':
          return formatSapNumberForDisplay(d.sap_number);
        case 'alias':
          return String(d.alias ?? '');
        case 'free_text':
          return String(d.free_text ?? d.designation ?? '');
        case 'line':
          return (d.machine_lines ?? []).join(', ');
        case 'project':
          return (d.projects ?? []).map((p) => p.name).join(', ');
        default:
          return '';
      }
    });
  }, [designations, filterSap, filterAlias, filterFreeText, filterSlot, filterProject, sortCol, sortDir]);

  if (loading) return <p>{t('common.loading')}</p>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/administracja/ustawienia-bazy" style={{ color: 'var(--cap-green)' }}>
          {t('common.back', { target: t('settings.databaseSettings') })}
        </Link>
      </div>
      <h1 style={{ marginTop: 0 }}>{t('designations.title')}</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>{t('designations.intro')}</p>

      {error && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{error}</p>}
      {addError && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{addError}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder={t('designations.sapCol')}
          value={newSap}
          onChange={(e) => setNewSap(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addDesignation()}
          style={{ padding: '0.5rem', width: 140 }}
        />
        <input
          type="text"
          placeholder={t('designations.aliasCol')}
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addDesignation()}
          style={{ padding: '0.5rem', width: 140 }}
        />
        <input
          type="text"
          placeholder={t('designations.freeTextCol')}
          value={newFreeText}
          onChange={(e) => setNewFreeText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addDesignation()}
          style={{ padding: '0.5rem', width: 180 }}
        />
        <button
          onClick={addDesignation}
          style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}
        >
          {t('designations.addDetail')}
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <SortableTh label={t('designations.sapCol')} active={sortCol === 'sap'} direction={sortDir} onClick={() => toggle('sap')} />
            <SortableTh label={t('designations.aliasCol')} active={sortCol === 'alias'} direction={sortDir} onClick={() => toggle('alias')} />
            <SortableTh label={t('designations.freeTextCol')} active={sortCol === 'free_text'} direction={sortDir} onClick={() => toggle('free_text')} />
            <SortableTh label={t('designations.lineCol')} active={sortCol === 'line'} direction={sortDir} onClick={() => toggle('line')} />
            <SortableTh label={t('designations.projectCol')} active={sortCol === 'project'} direction={sortDir} onClick={() => toggle('project')} style={{ minWidth: 160 }} />
            <th style={{ padding: '0.75rem', width: 180 }}>{t('designations.actions')}</th>
          </tr>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input
                type="text"
                placeholder={t('designations.filterSap')}
                value={filterSap}
                onChange={(e) => setFilterSap(e.target.value)}
                style={{ width: '100%', padding: 4, fontSize: 12 }}
              />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input
                type="text"
                placeholder={t('designations.filterAlias')}
                value={filterAlias}
                onChange={(e) => setFilterAlias(e.target.value)}
                style={{ width: '100%', padding: 4, fontSize: 12 }}
              />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input
                type="text"
                placeholder={t('designations.filterFreeText')}
                value={filterFreeText}
                onChange={(e) => setFilterFreeText(e.target.value)}
                style={{ width: '100%', padding: 4, fontSize: 12 }}
              />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input
                type="text"
                placeholder={t('designations.filterLine')}
                value={filterSlot}
                onChange={(e) => setFilterSlot(e.target.value)}
                style={{ width: '100%', padding: 4, fontSize: 12 }}
              />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input
                type="text"
                placeholder={t('designations.filterProject')}
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                style={{ width: '100%', padding: 4, fontSize: 12 }}
              />
            </th>
            <th style={{ padding: '4px 6px' }}></th>
          </tr>
        </thead>
        <tbody>
          {displayDesignations.map((d) => (
            <tr key={d.id}>
              <td style={{ padding: '0.75rem' }}>{displayField(d.sap_number, true)}</td>
              <td style={{ padding: '0.75rem' }}>{displayField(d.alias)}</td>
              <td style={{ padding: '0.75rem' }}>{displayField(d.free_text ?? d.designation)}</td>
              <td style={{ padding: '0.75rem' }}>
                {d.machine_lines && d.machine_lines.length > 0 ? d.machine_lines.join(', ') : t('designations.emptyValue')}
              </td>
              <td style={{ padding: '0.75rem', fontSize: 14 }}>
                {!d.projects || d.projects.length === 0 ? (
                  t('designations.emptyValue')
                ) : (
                  d.projects.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 ? ', ' : null}
                      <Link to={`/projekty/${p.id}${scenarioQs}`} style={{ color: 'var(--cap-green)' }}>
                        {p.name}
                      </Link>
                    </span>
                  ))
                )}
              </td>
              <td style={{ padding: '0.75rem' }}>
                <button
                  onClick={() => openEdit(d)}
                  style={{ marginRight: 8, padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}
                >
                  {t('commonExtra.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteModal(d)}
                  style={{ padding: '0.25rem 0.5rem', background: '#c62828', color: 'white', border: 'none', borderRadius: 4 }}
                >
                  {t('common.delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {designations.length === 0 && !error && <p style={{ color: '#999', marginTop: 8 }}>{t('designations.emptyList')}</p>}
      {designations.length > 0 &&
        (filterSap.trim() || filterAlias.trim() || filterFreeText.trim() || filterSlot.trim() || filterProject.trim()) &&
        designations.filter(matchesFilters).length === 0 && (
          <p style={{ color: '#666', marginTop: 8 }}>{t('designations.noFilterResults')}</p>
        )}

      {duplicateModalOpen && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDuplicateModalOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 'min(520px, 96vw)' }}
          >
            <h3 style={{ marginTop: 0 }}>{t('designations.duplicateExistsTitle')}</h3>
            <p style={{ margin: '0 0 1.25rem', lineHeight: 1.5, color: '#455a64' }}>{t('designations.duplicateExistsModal')}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                autoFocus
                onClick={() => setDuplicateModalOpen(false)}
                style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleteModal.saving) setDeleteModal(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 420,
              maxWidth: 'min(720px, 96vw)',
              maxHeight: '85vh',
              overflow: 'auto',
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              {deleteModal.operations.length > 0 ? t('designations.deleteModalTitle') : t('designations.deleteNoOpsTitle')}
            </h3>
            <p style={{ fontSize: 13, color: '#455a64', lineHeight: 1.45 }}>
              <strong>{designationLabel(deleteModal.designation)}</strong>
            </p>
            {deleteModal.loading ? (
              <p style={{ color: '#546e7a' }}>{t('designations.loadingRelatedOps')}</p>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#455a64', lineHeight: 1.45 }}>
                  {deleteModal.operations.length > 0 ? t('designations.deleteModalIntro') : t('designations.deleteNoOpsIntro')}
                </p>
                {deleteModal.error && <p style={{ color: 'var(--cap-red)' }}>{deleteModal.error}</p>}
                {deleteModal.resultMessage && <p style={{ color: '#2e7d32' }}>{deleteModal.resultMessage}</p>}
                {deleteModal.operations.length > 0 && (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteModal((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  selected: new Set(
                                    prev.operations.filter((o) => !o.has_children).map((o) => o.id)
                                  ),
                                }
                              : prev
                          )
                        }
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        {t('designations.deleteSelectAll')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteModal((prev) => (prev ? { ...prev, selected: new Set() } : prev))}
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        {t('designations.deleteSelectNone')}
                      </button>
                    </div>
                    <div
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: 4,
                        maxHeight: 280,
                        overflow: 'auto',
                        marginBottom: 12,
                      }}
                    >
                      {deleteModal.operations.map((op) => {
                        const blocked = Number(op.has_children) === 1;
                        const checked = deleteModal.selected.has(op.id);
                        return (
                          <label
                            key={op.id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 8,
                              padding: '8px 10px',
                              borderBottom: '1px solid #eee',
                              background: blocked ? '#fafafa' : checked ? '#e8f5e9' : 'white',
                              cursor: blocked ? 'not-allowed' : 'pointer',
                              fontSize: 13,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={blocked || deleteModal.saving}
                              onChange={() => {
                                setDeleteModal((prev) => {
                                  if (!prev) return prev;
                                  const next = new Set(prev.selected);
                                  if (next.has(op.id)) next.delete(op.id);
                                  else next.add(op.id);
                                  return { ...prev, selected: next };
                                });
                              }}
                              style={{ marginTop: 3 }}
                            />
                            <span>
                              {op.label}
                              {blocked && (
                                <span style={{ display: 'block', color: '#c62828', fontSize: 12 }}>
                                  {t('designations.opHasChildren')}
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={deleteModal.saving || deleteModal.loading}
                onClick={() => setDeleteModal(null)}
                style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={
                  deleteModal.saving ||
                  deleteModal.loading ||
                  (deleteModal.operations.length > 0 && deleteModal.selected.size === 0)
                }
                onClick={confirmDeleteCascade}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#c62828',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                {deleteModal.operations.length > 0 ? t('designations.deleteConfirmBtn') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditModal(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360 }}
          >
            <h3 style={{ marginTop: 0 }}>{t('designations.editTitle')}</h3>
            {saveError && <p style={{ color: 'var(--cap-red)', marginBottom: 12 }}>{saveError}</p>}
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              <label>
                {t('designations.sapCol')}:{' '}
                <input type="text" value={editSap} onChange={(e) => setEditSap(e.target.value)} style={{ marginLeft: 8, padding: 6, width: 220 }} />
              </label>
              <label>
                {t('designations.aliasCol')}:{' '}
                <input type="text" value={editAlias} onChange={(e) => setEditAlias(e.target.value)} style={{ marginLeft: 8, padding: 6, width: 220 }} />
              </label>
              <label>
                {t('designations.freeTextCol')}:{' '}
                <input type="text" value={editFreeText} onChange={(e) => setEditFreeText(e.target.value)} style={{ marginLeft: 8, padding: 6, width: 220 }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={saveEdit}
                disabled={saving || (!editSap.trim() && !editAlias.trim() && !editFreeText.trim())}
                style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}
              >
                {t('common.save')}
              </button>
              <button
                onClick={() => setEditModal(null)}
                style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
