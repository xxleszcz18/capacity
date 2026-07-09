import { useCallback, useEffect, useMemo, useState } from 'react';
import SortableTh from '../components/SortableTh';
import { useTableSort, sortRows } from '../utils/tableSort';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { scenarioNavQuery, useScenarioMode } from '../context/ScenarioModeContext';
import { confirmDelete } from '../confirmDelete';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectFilter from '../components/MultiSelectFilter';
import ProjectActivateRfqMachinesModal from '../components/ProjectActivateRfqMachinesModal';
import StatusMultiFilter, { type ProjectStatusFilterValue } from '../components/StatusMultiFilter';
import { joinCsvFilter } from '../utils/filterParams';
import { machineStatusFromDb, machineStatusReadonlyStyle } from '../utils/machineStatusStyle';
import { formatDetailSapAliasLabel } from '../utils/detailLabel';
import { useReferenceDisplay } from '../context/ReferenceDisplayContext';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { formatSopEop, parseSopEop } from '../utils/sopEopFormat';

type PartToAdd = { type: 'existing'; designation_id: number } | { type: 'new'; sap_number?: string; alias?: string; free_text?: string };

function monthInputToSopEop(value: string): string {
  if (!value) return '';
  const [y, m] = value.split('-');
  return `${m}.${y}`;
}
function sopEopToMonthInput(sop: string): string {
  const parsed = parseSopEop(sop);
  if (parsed) return `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
  return '';
}

export default function Projects() {
  const { t, te } = useI18n();
  const { hasAnyPermission } = useAuth();
  const canChangeStatus = hasAnyPermission(['projects.change_status', 'projects.edit']);
  const canViewDetails = hasAnyPermission(['projects.details', 'projects.edit']);
  const { referenceDisplay } = useReferenceDisplay();
  const [searchParams] = useSearchParams();
  const scenarioFromUrlNum = searchParams.get('scenarioId') != null ? Number(searchParams.get('scenarioId')) : NaN;
  const { activeScenarioId: ctxScenarioId, appSection, setActiveScenario } = useScenarioMode();
  const effectiveScenarioId =
    Number.isFinite(scenarioFromUrlNum) && scenarioFromUrlNum > 0
      ? scenarioFromUrlNum
      : appSection === 'scenarios' && ctxScenarioId != null && ctxScenarioId > 0
        ? ctxScenarioId
        : undefined;

  useEffect(() => {
    if (effectiveScenarioId == null || effectiveScenarioId <= 0) return;
    api.scenarios
      .get(effectiveScenarioId)
      .then((s) => setActiveScenario(effectiveScenarioId, s.name))
      .catch(() => {});
  }, [effectiveScenarioId, setActiveScenario]);
  const [list, setList] = useState<any[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [designations, setDesignations] = useState<{ id: number; designation?: string | null; sap_number?: string | null; alias?: string | null; free_text?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilterValue[]>([]);
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filterKlient, setFilterKlient] = useState('');
  const [filterNazwa, setFilterNazwa] = useState('');
  const [filterMaszyny, setFilterMaszyny] = useState('');
  const [filterSap, setFilterSap] = useState('');
  const [filterCzesci, setFilterCzesci] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<ProjectStatusFilterValue[]>([]);
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
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<number | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [rfqActivate, setRfqActivate] = useState<null | { project: any; operations: any[] }>(null);
  const [rfqProjectActivateSaving, setRfqProjectActivateSaving] = useState(false);

  const load = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    if (effectiveScenarioId != null && effectiveScenarioId > 0) {
      Promise.all([api.scenarios.get(effectiveScenarioId), api.machines.list({ status: 'active' })])
        .then(([s, machinesList]) => {
          const snap = s.snapshot || {};
          const desById = new Map<number, any>((snap.part_designations || []).map((d: any) => [Number(d.id), d]));
          const byMid = new Map<number, any>(machinesList.map((m: any) => [Number(m.id), m]));
          let projects = (snap.projects || []).map((p: any) => {
            const mids = [
              ...new Set(
                (snap.operations || [])
                  .filter((o: any) => Number(o.project_id) === Number(p.id))
                  .map((o: any) => Number(o.machine_id))
                  .filter((id: number) => Number.isFinite(id) && id > 0)
              ),
            ] as number[];
            const machines = mids.map((mid) => {
              const m = byMid.get(mid) as { internal_number?: number; sap_number?: string | null } | undefined;
              return { machine_id: mid, internal_number: m?.internal_number ?? mid, sap_number: m?.sap_number ?? null };
            });
            const parts = (snap.parts || [])
              .filter((pt: any) => Number(pt.project_id) === Number(p.id))
              .map((pt: any) => {
                const d: any = pt.designation_id != null ? desById.get(Number(pt.designation_id)) : null;
                return {
                  ...pt,
                  detail_sap_number: d?.sap_number ?? null,
                  detail_alias: d?.alias ?? null,
                  detail_free_text: d?.free_text ?? null,
                  designation: pt.designation ?? null,
                };
              });
            return { ...p, machines, parts };
          });
          if (statusFilter.length > 0) projects = projects.filter((p: any) => statusFilter.includes(p.status));
          if (clientFilter.length > 0) projects = projects.filter((p: any) => clientFilter.includes(String(p.client ?? '')));
          if (search.trim()) {
            const q = search.trim().toLowerCase();
            projects = projects.filter(
              (p: any) =>
                String(p.name ?? '')
                  .toLowerCase()
                  .includes(q) ||
                String(p.client ?? '')
                  .toLowerCase()
                  .includes(q) ||
                formatSopEop(p.sop)
                  .toLowerCase()
                  .includes(q) ||
                formatSopEop(p.eop)
                  .toLowerCase()
                  .includes(q)
            );
          }
          setList(projects);
          const clientSet = Array.from(
            new Set((snap.projects || []).map((p: any) => String(p.client ?? '').trim()).filter((c: string) => c.length > 0))
          ) as string[];
          setClients([...clientSet].sort((a, b) => a.localeCompare(b, 'pl')));
        })
        .catch((err) => {
          setLoadError(err.message || 'Błąd ładowania scenariusza.');
          setList([]);
        })
        .finally(() => setLoading(false));
      return;
    }
    const params: Record<string, string | undefined> = {};
    const statuses = joinCsvFilter(statusFilter);
    if (statuses) params.statuses = statuses;
    const clients = joinCsvFilter(clientFilter);
    if (clients) params.clients = clients;
    if (search.trim()) params.search = search.trim();
    api.projects
      .list(params)
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((err) => {
        setLoadError(err.message || 'Błąd ładowania listy projektów.');
        setList([]);
      })
      .finally(() => setLoading(false));
  }, [effectiveScenarioId, statusFilter.join(','), clientFilter.join(','), search]);
  useEffect(() => {
    if (effectiveScenarioId != null && effectiveScenarioId > 0) return;
    api.projects.clients().then(setClients).catch(() => {});
  }, [effectiveScenarioId]);
  useEffect(() => {
    load();
  }, [load]);
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
    setPartsToAdd((prev) => [...prev, { type: 'new', sap_number: newPartSap.trim() || undefined, alias: newPartAlias.trim() || undefined, free_text: newPartFreeText.trim() || undefined }]);
    setNewPartSap(''); setNewPartAlias(''); setNewPartFreeText(''); setShowNewPart(false);
  };
  const removePartToAdd = (idx: number) => {
    if (!confirmDelete('Usunąć ten detal z listy dołączanych do nowego projektu?')) return;
    setPartsToAdd((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddProject = async () => {
    if (!form.client.trim()) { setFormError(t('projects.errClientRequired')); return; }
    if (!form.name.trim()) { setFormError(t('projects.errNameRequired')); return; }
    if (!form.sop.trim() || !form.eop.trim()) { setFormError(t('projects.errSopEopRequired')); return; }
    setFormError('');
    setSaving(true);
    try {
      if (effectiveScenarioId != null && effectiveScenarioId > 0) {
        setFormError(t('projects.errScenarioOnlyProduction'));
        setSaving(false);
        return;
      }
      const created = await api.projects.create({ client: form.client.trim(), name: form.name.trim(), sop: formatSopEop(form.sop) || undefined, eop: formatSopEop(form.eop) || undefined, status: form.status });
      setAddModal(false);
      setForm({ client: '', name: '', sop: '', eop: '', status: 'active' });
      setSopMonth(''); setEopMonth(''); setPartsToAdd([]);
      for (const p of partsToAdd) {
        try {
          if (p.type === 'existing') {
            await api.projects.addPart(created.id, { designation_id: p.designation_id });
          } else {
            const des = await api.settings.designations.create({ sap_number: p.sap_number, alias: p.alias, free_text: p.free_text });
            await api.projects.addPart(created.id, { designation_id: des.id });
          }
        } catch (_) {}
      }
      setPartsToAdd([]);
      load();
    } catch (e: any) {
      setFormError(te(e.message) || t('projects.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (project: any, nextStatus: 'active' | 'inactive' | 'RFQ') => {
    if (effectiveScenarioId != null && effectiveScenarioId > 0) {
      setStatusError(t('projects.statusScenarioListError'));
      return;
    }
    if (!project?.id) return;
    if (project.status === nextStatus) return;
    setStatusError(null);

    if (nextStatus === 'active' && project.status !== 'active') {
      const opsLike = (project.machines ?? []).map((m: any) => ({
        machine_id: m.machine_id,
        machine_status: m.machine_status,
        machine_number: m.internal_number,
        machine_type: m.machine_type ?? '',
      }));
      const hasRfqMachine = opsLike.some((row: any) => machineStatusFromDb(row.machine_status) === 'RFQ');
      if (hasRfqMachine) {
        setRfqActivate({ project, operations: opsLike });
        return;
      }
    }

    setSavingStatusId(project.id);
    const previousStatus = project.status;
    setList((prev) => prev.map((p) => (p.id === project.id ? { ...p, status: nextStatus } : p)));
    try {
      await api.projects.update(project.id, { status: nextStatus });
    } catch (e: any) {
      setList((prev) => prev.map((p) => (p.id === project.id ? { ...p, status: previousStatus } : p)));
      setStatusError(te(e?.message) || t('projects.statusChangeError'));
    } finally {
      setSavingStatusId(null);
    }
  };
  const clearAllFilters = () => {
    setStatusFilter([]);
    setClientFilter([]);
    setSearch('');
    setFilterKlient('');
    setFilterNazwa('');
    setFilterMaszyny('');
    setFilterSap('');
    setFilterCzesci('');
    setFilterStatuses([]);
  };

  type ProjectSortCol = 'client' | 'name' | 'machines' | 'sap' | 'parts' | 'status';
  const { sortCol, sortDir, toggle } = useTableSort<ProjectSortCol>('client');

  const displayList = useMemo(() => {
    const filtered = list.filter((p) => {
      const k = filterKlient.trim().toLowerCase();
      if (k && !(p.client ?? '').toLowerCase().includes(k)) return false;
      const n = filterNazwa.trim().toLowerCase();
      if (n && !(p.name ?? '').toLowerCase().includes(n)) return false;
      const m = filterMaszyny.trim();
      if (m && !(p.machines ?? []).some((x: any) => String(x.internal_number ?? x.machine_id ?? '').includes(m))) return false;
      const s = filterSap.trim().toLowerCase();
      if (s && !(p.machines ?? []).some((x: any) => (x.sap_number ?? '').toLowerCase().includes(s))) return false;
      const c = filterCzesci.trim().toLowerCase();
      if (
        c &&
        !(p.parts ?? []).some((pt: any) =>
          formatDetailSapAliasLabel(
            {
              sap_number: pt.detail_sap_number,
              alias: pt.detail_alias,
              free_text: pt.detail_free_text,
              designation: pt.designation,
              id: pt.id,
            },
            referenceDisplay
          )
            .toLowerCase()
            .includes(c)
        )
      )
        return false;
      if (filterStatuses.length > 0 && !filterStatuses.includes(p.status as ProjectStatusFilterValue)) return false;
      return true;
    });
    return sortRows(filtered, sortCol, sortDir, (p, col) => {
      switch (col) {
        case 'client':
          return String(p.client ?? '');
        case 'name':
          return String(p.name ?? '');
        case 'machines':
          return (p.machines ?? []).map((x: any) => String(x.internal_number ?? x.machine_id ?? '')).join(', ');
        case 'sap':
          return [...new Set((p.machines ?? []).map((x: any) => x.sap_number).filter(Boolean))].join(', ');
        case 'parts':
          return (p.parts ?? [])
            .map((pt: any) =>
              formatDetailSapAliasLabel(
                {
                  sap_number: pt.detail_sap_number,
                  alias: pt.detail_alias,
                  free_text: pt.detail_free_text,
                  designation: pt.designation,
                  id: pt.id,
                },
                referenceDisplay
              )
            )
            .join(', ');
        case 'status':
          return String(p.status ?? '');
        default:
          return '';
      }
    });
  }, [
    list,
    filterKlient,
    filterNazwa,
    filterMaszyny,
    filterSap,
    filterCzesci,
    filterStatuses,
    sortCol,
    sortDir,
    referenceDisplay,
  ]);

  if (loading && list.length === 0 && !loadError) return <p>{t('common.loading')}</p>;
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>
        {t('projects.title')}
        {effectiveScenarioId != null && effectiveScenarioId > 0 ? (
          <span style={{ fontSize: 16, fontWeight: 400, color: '#1565c0' }}> — kopia w scenariuszu #{effectiveScenarioId}</span>
        ) : null}
      </h1>
      {loadError && (
        <p style={{ padding: '0.75rem', background: '#ffebee', color: '#c62828', borderRadius: 8, marginBottom: '1rem' }}>
          {loadError} Upewnij się, że serwer działa (npm run dev w folderze server, port 3001).
        </p>
      )}
      {statusError && (
        <p style={{ padding: '0.75rem', background: '#fff3e0', color: '#e65100', borderRadius: 8, marginBottom: '1rem' }}>
          {statusError}
        </p>
      )}
      <div className="filters-toolbar">
        <button onClick={() => setAddModal(true)} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>{t('projects.add')}</button>
        <span className="filters-label">{t('common.showOnly')}</span>
        <div style={{ minWidth: 200, maxWidth: 280 }}>
          <StatusMultiFilter selected={statusFilter} onChange={setStatusFilter} />
        </div>
        <span>{t('projects.client').toLowerCase()}</span>
        <div style={{ minWidth: 180, maxWidth: 260 }}>
          <MultiSelectFilter
            className="cap-filter-select"
            options={clients.map((c) => ({ value: c, label: c }))}
            selected={clientFilter}
            onChange={setClientFilter}
            allLabel={t('common.allClients')}
            clearLabel={t('common.clearFilters')}
            searchable
            searchPlaceholder={t('common.searchFilter')}
          />
        </div>
        <input type="text" placeholder={t('projects.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 200 }} />
        <button type="button" className="filter-clear-btn" onClick={clearAllFilters}>{t('common.clearFilters')}</button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <SortableTh label={t('projects.client')} active={sortCol === 'client'} direction={sortDir} onClick={() => toggle('client')} />
            <SortableTh label={t('projects.name')} active={sortCol === 'name'} direction={sortDir} onClick={() => toggle('name')} />
            <SortableTh label={t('projects.machinesInternal')} active={sortCol === 'machines'} direction={sortDir} onClick={() => toggle('machines')} />
            <SortableTh label={t('projects.machinesSap')} active={sortCol === 'sap'} direction={sortDir} onClick={() => toggle('sap')} />
            <SortableTh label={t('projects.parts')} active={sortCol === 'parts'} direction={sortDir} onClick={() => toggle('parts')} />
            <SortableTh label={t('projects.status')} active={sortCol === 'status'} direction={sortDir} onClick={() => toggle('status')} />
            <th style={{ padding: '0.75rem', textAlign: 'left' }}></th>
          </tr>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder={t('common.filterColumn', { column: t('projects.client') })} value={filterKlient} onChange={(e) => setFilterKlient(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder={t('common.filterColumn', { column: t('projects.name') })} value={filterNazwa} onChange={(e) => setFilterNazwa(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder={t('common.filterColumn', { column: t('projects.machinesInternal') })} value={filterMaszyny} onChange={(e) => setFilterMaszyny(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder={t('common.filterColumn', { column: t('projects.machinesSap') })} value={filterSap} onChange={(e) => setFilterSap(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder={t('common.filterColumn', { column: t('projects.parts') })} value={filterCzesci} onChange={(e) => setFilterCzesci(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <StatusMultiFilter selected={filterStatuses} onChange={setFilterStatuses} />
            </th>
            <th style={{ padding: '4px 6px' }}></th>
          </tr>
        </thead>
        <tbody>
          {displayList.map((p) => (
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
                    const saps = [
                      ...new Set(
                        (p.machines ?? [])
                          .map((m: { sap_number?: string | null }) => m.sap_number)
                          .filter((s: string | null | undefined): s is string => typeof s === 'string' && s.length > 0)
                      ),
                    ] as string[];
                    if (saps.length > 0) return saps.map((sap) => <span key={sap} style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{sap}</span>);
                    return <span style={{ color: '#888', fontSize: 13 }}>—</span>;
                  })()}
                </div>
              </td>
              <td style={{ padding: '0.75rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(p.parts ?? []).map((pt: any) => (
                    <span key={pt.id} style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
                      {formatDetailSapAliasLabel(
                        {
                          sap_number: pt.detail_sap_number,
                          alias: pt.detail_alias,
                          free_text: pt.detail_free_text,
                          designation: pt.designation,
                          id: pt.id,
                        },
                        referenceDisplay
                      )}
                    </span>
                  ))}
                </div>
              </td>
              <td style={{ padding: '0.75rem' }}>
                {canChangeStatus ? (
                <select
                  value={p.status}
                  onChange={(e) => handleStatusChange(p, e.target.value as 'active' | 'inactive' | 'RFQ')}
                  disabled={
                    savingStatusId === p.id ||
                    (effectiveScenarioId != null && effectiveScenarioId > 0) ||
                    rfqActivate?.project?.id === p.id
                  }
                  style={{
                    width: 130,
                    padding: '0.25rem 0.5rem',
                    borderRadius: 4,
                    border: 'none',
                    color: 'white',
                    background: p.status === 'active' ? 'var(--cap-green)' : p.status === 'RFQ' ? '#ff9800' : '#9e9e9e',
                    opacity: savingStatusId === p.id || (rfqProjectActivateSaving && rfqActivate?.project?.id === p.id) ? 0.7 : 1,
                    cursor: savingStatusId === p.id || (rfqProjectActivateSaving && rfqActivate?.project?.id === p.id) ? 'wait' : 'pointer',
                  }}
                  title={t('projects.changeStatusTitle')}
                >
                  <option value="active">{t('common.active')}</option>
                  <option value="inactive">{t('common.inactive')}</option>
                  <option value="RFQ">{t('common.rfq')}</option>
                </select>
                ) : (
                  <span style={machineStatusReadonlyStyle(p.status)}>
                    {p.status === 'active' ? t('common.active') : p.status === 'RFQ' ? t('common.rfq') : t('common.inactive')}
                  </span>
                )}
              </td>
              <td style={{ padding: '0.75rem' }}>
                {canViewDetails ? (
                <Link
                  to={
                    effectiveScenarioId != null && effectiveScenarioId > 0
                      ? `/projekty/${p.id}${scenarioNavQuery(effectiveScenarioId)}`
                      : `/projekty/${p.id}`
                  }
                  style={{ padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', textDecoration: 'none', borderRadius: 4 }}
                  title={
                    effectiveScenarioId != null && effectiveScenarioId > 0 ? t('projects.detailsScenarioTitle') : undefined
                  }
                >
                  {t('common.details')}
                </Link>
                ) : (
                  <span style={{ color: '#999', fontSize: 13 }}>{t('common.dash')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ProjectActivateRfqMachinesModal
        open={rfqActivate != null}
        operations={rfqActivate?.operations}
        navigationSearch={scenarioNavQuery(effectiveScenarioId ?? null)}
        onClose={() => setRfqActivate(null)}
        onMachinesUpdated={async () => {
          const pid = rfqActivate?.project?.id;
          if (pid == null) return;
          try {
            const proj = await api.projects.get(pid);
            const opsLike = (proj.operations ?? []).map((o: any) => ({
              machine_id: o.machine_id,
              machine_status: o.machine_status,
              machine_number: o.machine_number,
              machine_type: o.machine_type ?? '',
            }));
            setRfqActivate((prev) => (prev && prev.project.id === pid ? { project: prev.project, operations: opsLike } : prev));
          } catch {
            /* list refresh below */
          }
          await load();
        }}
        onConfirmActivateProject={async () => {
          if (!rfqActivate?.project?.id) return;
          setRfqProjectActivateSaving(true);
          try {
            await api.projects.update(rfqActivate.project.id, { status: 'active' });
            setRfqActivate(null);
            await load();
          } catch (e: any) {
            setStatusError(te(e?.message) || t('projects.statusChangeError'));
          } finally {
            setRfqProjectActivateSaving(false);
          }
        }}
        projectActivateSaving={rfqProjectActivateSaving}
      />

      {addModal && (
        <div onMouseDown={(e) => { if (e.target === e.currentTarget) setAddModal(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onMouseDown={(e) => e.stopPropagation()} style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 440, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0 }}>{t('projects.newTitle')}</h2>
            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
              <label>
                {t('projects.clientRequired')}{' '}
                <input type="text" value={form.client} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))} style={{ width: '100%', padding: 6 }} />
              </label>
              <label>
                {t('projects.nameRequired')}{' '}
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: 6 }} />
              </label>
              <div>
                <label>{t('projects.sop')}</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <input type="month" value={sopMonth || sopEopToMonthInput(form.sop)} onChange={(e) => { const v = e.target.value; setSopMonth(v); setForm((f) => ({ ...f, sop: monthInputToSopEop(v) })); }} style={{ padding: 6 }} title={t('projects.pickMonthTitle')} />
                  <input type="text" value={form.sop} onChange={(e) => setForm((f) => ({ ...f, sop: e.target.value }))} placeholder={t('projects.sopPlaceholder')} style={{ flex: 1, padding: 6 }} />
                </div>
              </div>
              <div>
                <label>{t('projects.eop')}</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <input type="month" value={eopMonth || sopEopToMonthInput(form.eop)} onChange={(e) => { const v = e.target.value; setEopMonth(v); setForm((f) => ({ ...f, eop: monthInputToSopEop(v) })); }} style={{ padding: 6 }} title={t('projects.pickMonthTitle')} />
                  <input type="text" value={form.eop} onChange={(e) => setForm((f) => ({ ...f, eop: e.target.value }))} placeholder={t('projects.eopPlaceholder')} style={{ flex: 1, padding: 6 }} />
                </div>
              </div>
              <label>
                {t('projects.status')}{' '}
                <SearchableSelect value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))} style={{ width: '100%', padding: 6 }}>
                  <option value="active">{t('common.active')}</option>
                  <option value="inactive">{t('common.inactive')}</option>
                  <option value="RFQ">{t('common.rfq')}</option>
                </SearchableSelect>
              </label>

              <div style={{ marginTop: 8, padding: '0.75rem', background: '#f5f5f5', borderRadius: 6 }}>
                <strong>{t('projects.partsOptional')}</strong>
                {effectiveScenarioId != null && effectiveScenarioId > 0 ? (
                  <p style={{ margin: '4px 0 8px', fontSize: 13, color: '#1565c0' }}>{t('projects.partsScenarioNote')}</p>
                ) : (
                  <p style={{ margin: '4px 0 8px', fontSize: 13, color: '#555' }}>{t('projects.partsIntro')}</p>
                )}
                {!(effectiveScenarioId != null && effectiveScenarioId > 0) && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <SearchableSelect value={String(newPartDesignationId)} onChange={(e) => setNewPartDesignationId(e.target.value === '' ? '' : Number(e.target.value))} style={{ padding: 4, minWidth: 200 }}>
                    <option value="">{t('projects.pickExistingPart')}</option>
                    {designations
                      .filter((d) => (d.sap_number ?? '').trim() || (d.alias ?? '').trim() || (d.free_text ?? '').trim())
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {formatDetailSapAliasLabel(
                            {
                              sap_number: d.sap_number,
                              alias: d.alias,
                              free_text: d.free_text,
                              designation: d.designation,
                              id: d.id,
                            },
                            referenceDisplay
                          )}
                        </option>
                      ))}
                  </SearchableSelect>
                  <button type="button" onClick={addExistingPart} disabled={!newPartDesignationId} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>{t('common.add')}</button>
                  <button type="button" onClick={() => setShowNewPart((v) => !v)} style={{ padding: '0.35rem 0.75rem', background: '#757575', color: 'white', border: 'none', borderRadius: 4 }}>{t('projects.newPartBtn')}</button>
                </div>
                )}
                {!(effectiveScenarioId != null && effectiveScenarioId > 0) && showNewPart && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input type="text" placeholder={t('designations.sapCol')} value={newPartSap} onChange={(e) => setNewPartSap(e.target.value)} style={{ padding: 4, width: 120 }} />
                    <input type="text" placeholder={t('designations.aliasCol')} value={newPartAlias} onChange={(e) => setNewPartAlias(e.target.value)} style={{ padding: 4, width: 120 }} />
                    <input type="text" placeholder={t('designations.freeTextCol')} value={newPartFreeText} onChange={(e) => setNewPartFreeText(e.target.value)} style={{ padding: 4, width: 120 }} />
                    <button type="button" onClick={addNewPartFromForm} disabled={!newPartSap.trim() && !newPartAlias.trim() && !newPartFreeText.trim()} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>{t('projects.addAndCreatePart')}</button>
                  </div>
                )}
                {!(effectiveScenarioId != null && effectiveScenarioId > 0) && partsToAdd.length > 0 && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {partsToAdd.map((p, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ background: '#e8f5e9', padding: '2px 8px', borderRadius: 4 }}>
                          {p.type === 'existing'
                            ? (() => {
                                const d = designations.find((x) => x.id === p.designation_id);
                                return d
                                  ? formatDetailSapAliasLabel(
                                      {
                                        sap_number: d.sap_number,
                                        alias: d.alias,
                                        free_text: d.free_text,
                                        designation: d.designation,
                                        id: d.id,
                                      },
                                      referenceDisplay
                                    )
                                  : `#${p.designation_id}`;
                              })()
                            : `${t('projects.newPartPrefix')} ${formatDetailSapAliasLabel(
                                {
                                  sap_number: p.sap_number,
                                  alias: p.alias,
                                  free_text: p.free_text,
                                },
                                referenceDisplay
                              )}`}
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
              <button onClick={handleAddProject} disabled={saving} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>{t('common.save')}</button>
              <button onClick={() => setAddModal(false)} style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
