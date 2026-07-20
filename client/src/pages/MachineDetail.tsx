import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useContractVolumes } from '../context/ContractVolumesContext';
import { confirmDelete } from '../confirmDelete';
import SearchableSelect from '../components/SearchableSelect';
import MachineStatusActiveProjectsModal from '../components/MachineStatusActiveProjectsModal';
import { digitsOnlyMachineLine, toStoredMachineLine } from '../utils/machineLineInput';
import { parseInternalMachineNumber, compareInternalMachineNumbers } from '../utils/internalMachineNumber';
import { machineStatusFromDb, machineStatusReadonlyStyle, machineStatusSelectStyle } from '../utils/machineStatusStyle';
import SortableTh from '../components/SortableTh';
import { useTableSort, sortRows } from '../utils/tableSort';
import { useI18n } from '../context/I18nContext';
import { loadColor, type LoadVisualSettings } from '../utils/loadCellColors';

const defaultLoadVisual: LoadVisualSettings = {
  colorize_load_cells: true,
  ok_enabled: true,
  ok_from: 0,
  ok_to: 79.99,
  ok_color: '#c8e6c9',
  warn_enabled: true,
  warn_from: 80,
  warn_to: 99.99,
  warn_color: '#fff9c4',
  danger_enabled: true,
  danger_from: 100,
  danger_to: 1000000,
  danger_color: '#ffcdd2',
};

type MachineEditStatus = 'active' | 'inactive' | 'RFQ';

function machineStatusReadLabelProjectsParity(status: unknown, t: (k: string) => string): string {
  const k = machineStatusFromDb(status);
  if (k === 'inactive') return t('common.inactive');
  if (k === 'RFQ') return t('common.rfq');
  return t('common.active');
}

export default function MachineDetail() {
  const { t, te } = useI18n();
  const location = useLocation();
  const scenarioQs = location.search || '';
  const scenarioIdFromUrl = useMemo(() => {
    const n = Number(new URLSearchParams(location.search).get('scenarioId'));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [location.search]);
  const { id } = useParams();
  const [machine, setMachine] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'opis' | 'alternatywy' | 'projekty' | 'zajetosc'>('opis');
  const [capacityData, setCapacityData] = useState<any>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [capacityLoading, setCapacityLoading] = useState(false);
  const [loadVisual, setLoadVisual] = useState<LoadVisualSettings>(defaultLoadVisual);
  const { useContractualVolumes } = useContractVolumes();

  type ProjSortCol = 'client' | 'name' | 'status';
  const { sortCol: projSortCol, sortDir: projSortDir, toggle: toggleProjSort } = useTableSort<ProjSortCol>('client');
  const sortedProjects = useMemo(() => {
    const rows = machine?.projects ?? [];
    return sortRows(rows, projSortCol, projSortDir, (p: any, col) => {
      switch (col) {
        case 'client':
          return String(p.client ?? '');
        case 'name':
          return String(p.name ?? '');
        case 'status':
          return String(p.status ?? '');
        default:
          return '';
      }
    });
  }, [machine?.projects, projSortCol, projSortDir]);

  type CapSortCol = 'year' | 'load' | 'capacity';
  const { sortCol: capSortCol, sortDir: capSortDir, toggle: toggleCapSort } = useTableSort<CapSortCol>('year');
  const sortedCapacityRows = useMemo(() => {
    const entries = Object.entries(capacityData?.years || {}) as [string, any][];
    return sortRows(entries, capSortCol, capSortDir, ([y, d], col) => {
      switch (col) {
        case 'year':
          return Number(y) || 0;
        case 'load':
          return Number(d?.load_percent) || 0;
        case 'capacity':
          return Number(d?.capacity_pcs_per_week) || 0;
        default:
          return 0;
      }
    });
  }, [capacityData, capSortCol, capSortDir]);

  useEffect(() => {
    if (!id) return;
    api.machines.get(Number(id)).then(setMachine).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api.settings.visual
      .get()
      .then((v) => {
        const raw = v as LoadVisualSettings;
        setLoadVisual({ ...defaultLoadVisual, ...raw });
      })
      .catch(() => setLoadVisual(defaultLoadVisual));
  }, []);

  useEffect(() => {
    if (!id || tab !== 'zajetosc') return;
    setCapacityError(null);
    setCapacityLoading(true);
    setCapacityData(null);
    api.capacity
      .machine(Number(id), {
        yearFrom: 2026,
        yearTo: 2030,
        ...(scenarioIdFromUrl != null ? { scenarioId: scenarioIdFromUrl } : {}),
        ...(useContractualVolumes ? { useContractualVolumes: true } : {}),
      })
      .then((d) => {
        setCapacityData(d);
        setCapacityError(null);
      })
      .catch((err: Error) => {
        setCapacityData(null);
        setCapacityError(te(err?.message) || t('machineDetail.noCapacityData'));
      })
      .finally(() => setCapacityLoading(false));
  }, [id, tab, scenarioIdFromUrl, useContractualVolumes]);

  if (loading || !machine) return <p>{t('common.loading')}</p>;

  const tabs = [
    { id: 'opis' as const, label: t('machineDetail.tabDesc') },
    { id: 'alternatywy' as const, label: t('machineDetail.tabAlt') },
    { id: 'projekty' as const, label: t('machineDetail.tabProjects') },
    { id: 'zajetosc' as const, label: t('machineDetail.tabOccupancy') },
  ];

  return (
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: '1rem' }}>
          <Link to={`/maszyny${scenarioQs}`} style={{ color: 'var(--cap-green)' }}>
            {t('machineDetail.back')}
          </Link>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '0.5rem 0.75rem',
                textAlign: 'left',
                background: tab === t.id ? 'var(--cap-green)' : '#eee',
                color: tab === t.id ? 'white' : '#333',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ flex: 3 }}>
        {tab === 'opis' && (
          <MachineDescForm machine={machine} onUpdate={(m) => setMachine(m)} navigationSearch={scenarioQs} />
        )}
        {tab === 'alternatywy' && (
          <AlternativesSection
            machineId={machine.id}
            machineType={String(machine.type ?? '').trim()}
            alternatives={machine.alternatives ?? []}
            onUpdate={() => api.machines.get(machine.id).then(setMachine)}
          />
        )}
        {tab === 'projekty' && (
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>{t('machineDetail.tabProjects')}</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <SortableTh label={t('projects.client')} active={projSortCol === 'client'} direction={projSortDir} onClick={() => toggleProjSort('client')} />
                  <SortableTh label={t('projects.name')} active={projSortCol === 'name'} direction={projSortDir} onClick={() => toggleProjSort('name')} />
                  <SortableTh label={t('projects.status')} active={projSortCol === 'status'} direction={projSortDir} onClick={() => toggleProjSort('status')} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ padding: '0.75rem' }}>{p.client}</td>
                    <td style={{ padding: '0.75rem' }}>{p.name}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          background: p.status === 'active' ? 'var(--cap-green)' : p.status === 'RFQ' ? '#ff9800' : '#9e9e9e',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: 4,
                        }}
                      >
                        {p.status === 'active' ? t('common.active') : p.status === 'RFQ' ? t('common.rfq') : t('common.inactive')}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <Link
                        to={`/projekty/${p.id}${scenarioQs}`}
                        style={{ padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', textDecoration: 'none', borderRadius: 4 }}
                      >
                        {t('common.details')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'zajetosc' && (
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>{t('machineDetail.tabOccupancy')}</h2>
            {capacityLoading && <p>{t('common.loading')}</p>}
            {!capacityLoading && capacityError && (
              <div>
                <p style={{ color: '#c62828' }}>{capacityError}</p>
                {machine.status === 'RFQ' && scenarioIdFromUrl == null && (
                  <p style={{ color: '#666', fontSize: 14, marginTop: 8 }}>
                    {t('machineDetail.rfqProdHint')}
                  </p>
                )}
                {machine.status === 'RFQ' && scenarioIdFromUrl != null && (
                  <p style={{ color: '#666', fontSize: 14, marginTop: 8 }}>
                    {t('machineDetail.rfqScenarioHint')}
                  </p>
                )}
              </div>
            )}
            {!capacityLoading && capacityData && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <SortableTh label={t('common.year')} active={capSortCol === 'year'} direction={capSortDir} onClick={() => toggleCapSort('year')} />
                    <SortableTh label={t('machineDetail.loadPct')} active={capSortCol === 'load'} direction={capSortDir} onClick={() => toggleCapSort('load')} />
                    <SortableTh label={t('machineDetail.capacityPcs')} active={capSortCol === 'capacity'} direction={capSortDir} onClick={() => toggleCapSort('capacity')} />
                  </tr>
                </thead>
                <tbody>
                  {sortedCapacityRows.map(([y, d]: [string, any]) => {
                    const pct = Number(d?.load_percent) || 0;
                    return (
                      <tr key={y}>
                        <td style={{ padding: '0.75rem' }}>{y}</td>
                        <td
                          style={{
                            padding: '0.75rem',
                            textAlign: 'center',
                            background: loadColor(pct, loadVisual),
                            border: '1px solid #e0e0e0',
                          }}
                        >
                          {pct}%
                        </td>
                        <td style={{ padding: '0.75rem' }}>{d.capacity_pcs_per_week}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const MACHINE_USAGE_OPTIONS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0];

function snapMachineUsageFromTypeDefault(u: unknown): number {
  const n = Number(u);
  if (!Number.isFinite(n)) return 1;
  const c = Math.max(0.1, Math.min(1, n));
  return Math.round(c * 10) / 10;
}

function MachineDescForm({
  machine,
  onUpdate,
  navigationSearch,
}: {
  machine: any;
  onUpdate: (m: any) => void;
  navigationSearch: string;
}) {
  const { t, te } = useI18n();
  const [editing, setEditing] = useState(false);
  const [machineCatalog, setMachineCatalog] = useState<{ id: number; name: string; default_machine_usage: number }[]>([]);
  const [editInternalNumber, setEditInternalNumber] = useState(String(machine.internal_number ?? ''));
  const [editSapNumber, setEditSapNumber] = useState(machine.sap_number ?? '');
  const [editType, setEditType] = useState(machine.type ?? '');
  const [editOeeOverride, setEditOeeOverride] = useState(machine.oee_override != null ? String(machine.oee_override) : '');
  const [editStatus, setEditStatus] = useState<MachineEditStatus>(machineStatusFromDb(machine.status));
  const [editMachineUsage, setEditMachineUsage] = useState<number>(typeof machine.machine_usage === 'number' ? machine.machine_usage : 1);
  const [editLineNumber, setEditLineNumber] = useState(digitsOnlyMachineLine(String(machine.location ?? '')));
  const [editWidthMm, setEditWidthMm] = useState(machine.width_mm != null ? String(machine.width_mm) : '');
  const [editDepthMm, setEditDepthMm] = useState(machine.depth_mm != null ? String(machine.depth_mm) : '');
  const [editHeightMm, setEditHeightMm] = useState(machine.height_mm != null ? String(machine.height_mm) : '');
  const [editStrokeMm, setEditStrokeMm] = useState(machine.stroke_mm != null ? String(machine.stroke_mm) : '');
  const [saving, setSaving] = useState(false);
  const [statusGuard, setStatusGuard] = useState<null | {
    projects: { id: number; client: string; name: string }[];
    target: 'inactive' | 'RFQ';
    payload: {
      internal_number: string;
      sap_number: string | undefined;
      type: string | undefined;
      oee_override: number | null;
      status: MachineEditStatus;
      machine_usage: number;
      location: string;
      width_mm: number | null;
      depth_mm: number | null;
      height_mm: number | null;
      stroke_mm: number | null;
    };
  }>(null);

  useEffect(() => {
    api.settings.machineTypes.list().then(setMachineCatalog).catch(() => setMachineCatalog([]));
  }, []);

  useEffect(() => {
    setEditInternalNumber(String(machine.internal_number ?? ''));
    setEditSapNumber(machine.sap_number ?? '');
    setEditType(machine.type ?? '');
    setEditOeeOverride(machine.oee_override != null ? String(machine.oee_override) : '');
    setEditStatus(machineStatusFromDb(machine.status));
    setEditMachineUsage(typeof machine.machine_usage === 'number' ? machine.machine_usage : 1);
    setEditLineNumber(digitsOnlyMachineLine(String(machine.location ?? '')));
    setEditWidthMm(machine.width_mm != null ? String(machine.width_mm) : '');
    setEditDepthMm(machine.depth_mm != null ? String(machine.depth_mm) : '');
    setEditHeightMm(machine.height_mm != null ? String(machine.height_mm) : '');
    setEditStrokeMm(machine.stroke_mm != null ? String(machine.stroke_mm) : '');
  }, [machine.id, machine.internal_number, machine.sap_number, machine.type, machine.oee_override, machine.status, machine.machine_usage, machine.location, machine.width_mm, machine.depth_mm, machine.height_mm, machine.stroke_mm]);

  const parseDimField = (raw: string): number | null => (raw.trim() === '' ? null : Number(raw.replace(',', '.')));

  const formatDimDisplay = (v: unknown) => {
    if (v == null || v === '') return t('common.dash');
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : t('common.dash');
  };

  const executeSave = (payload: {
    internal_number: string;
    sap_number: string | undefined;
    type: string | undefined;
    oee_override: number | null;
    status: MachineEditStatus;
    machine_usage: number;
    location: string;
    width_mm: number | null;
    depth_mm: number | null;
    height_mm: number | null;
    stroke_mm: number | null;
  }) => {
    setSaving(true);
    api.machines
      .update(machine.id, payload)
      .then((updated) => {
        onUpdate(updated);
        setEditing(false);
      })
      .catch((err) => {
        alert(te(err?.message) || t('common.saveError'));
      })
      .finally(() => setSaving(false));
  };

  const handleSave = async () => {
    const internalParsed = parseInternalMachineNumber(editInternalNumber);
    if (!internalParsed.ok) {
      alert(internalParsed.error);
      return;
    }
    const internal_number = internalParsed.value;
    if (!editType.trim()) {
      alert(t('errors.typeRequired'));
      return;
    }
    const lineStored = toStoredMachineLine(editLineNumber);
    if (!lineStored) {
      alert(t('machineDetail.lineDigitsOnly'));
      return;
    }
    let typeToSend = editType.trim();
    if (machineCatalog.length > 0) {
      const found = machineCatalog.find((t) => t.name.toLowerCase() === typeToSend.toLowerCase());
      if (!found) {
        alert(t('machineDetail.selectTypeFromList'));
        return;
      }
      typeToSend = found.name;
    }

    const payload = {
      internal_number,
      sap_number: editSapNumber.trim() || undefined,
      type: typeToSend || undefined,
      oee_override: editOeeOverride === '' ? null : Number(editOeeOverride),
      status: editStatus,
      machine_usage: editMachineUsage,
      location: lineStored,
      width_mm: parseDimField(editWidthMm),
      depth_mm: parseDimField(editDepthMm),
      height_mm: parseDimField(editHeightMm),
      stroke_mm: parseDimField(editStrokeMm),
    };

    const prevStatus = machineStatusFromDb(machine.status);
    if ((editStatus === 'inactive' || editStatus === 'RFQ') && editStatus !== prevStatus) {
      try {
        const data = await api.machines.activeProjectOperationCount(machine.id);
        if (data.count > 0) {
          setStatusGuard({
            projects: data.projects ?? [],
            target: editStatus as 'inactive' | 'RFQ',
            payload,
          });
          return;
        }
      } catch (err: unknown) {
        alert(err instanceof Error ? te(err.message) : t('machineDetail.verifyOpsFailed'));
        return;
      }
    }

    if (!window.confirm(t('machineDetail.saveConfirm'))) return;
    executeSave(payload);
  };

  const usageVal = Math.max(0, Math.min(1, editMachineUsage));
  const usageRounded = Math.round(usageVal * 10) / 10;

  const inputStyleWide = { width: 200, padding: '0.35rem' as const };

  return (
    <>
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0 }}>{t('machineDetail.descTitle')}</h2>
      {!editing ? (
        <>
          <p style={{ marginBottom: 6 }}><strong>{t('machineDetail.sapNumber')}</strong> {machine.sap_number ?? t('common.dash')}</p>
          <p style={{ marginBottom: 6 }}><strong>{t('machineDetail.internalNumber')}</strong> {machine.internal_number}</p>
          <p style={{ marginBottom: 6 }}><strong>{t('machineDetail.type')}</strong> {machine.type ?? t('common.dash')}</p>
          <p style={{ marginBottom: 6 }}><strong>{t('machineDetail.lineNumber')}</strong> {machine.location?.trim() ? machine.location : t('common.dash')}</p>
          <p style={{ marginBottom: 6 }}><strong>{t('machineDetail.oeeOverride')}</strong> {machine.oee_override != null ? machine.oee_override : t('common.dash')}</p>
          <p style={{ marginBottom: 6 }}><strong>{t('machineDetail.machineUsage')}</strong> {typeof machine.machine_usage === 'number' ? machine.machine_usage : 1}</p>
          <p style={{ marginBottom: 6 }}><strong>{t('machineDetail.widthMm')}</strong> {formatDimDisplay(machine.width_mm)}</p>
          <p style={{ marginBottom: 6 }}><strong>{t('machineDetail.depthMm')}</strong> {formatDimDisplay(machine.depth_mm)}</p>
          <p style={{ marginBottom: 6 }}><strong>{t('machineDetail.heightMm')}</strong> {formatDimDisplay(machine.height_mm)}</p>
          <p style={{ marginBottom: 6 }}><strong>{t('machineDetail.strokeMm')}</strong> {formatDimDisplay(machine.stroke_mm)}</p>
          <p style={{ marginBottom: 10 }}>
            <strong>{t('machineDetail.statusLabel')}</strong>{' '}
            <span style={machineStatusReadonlyStyle(machine.status)}>{machineStatusReadLabelProjectsParity(machine.status, t)}</span>
          </p>
          <button type="button" onClick={() => setEditing(true)} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>{t('commonExtra.edit')}</button>
        </>
      ) : (
        <>
          <p style={{ marginBottom: 6 }}>
            <strong>{t('machineDetail.sapNumber')}</strong>{' '}
            <input type="text" value={editSapNumber} onChange={(e) => setEditSapNumber(e.target.value)} style={inputStyleWide} />
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>{t('machineDetail.internalNumber')}</strong>{' '}
            <input type="text" value={editInternalNumber} onChange={(e) => setEditInternalNumber(e.target.value)} placeholder={t('machines.internalPlaceholder')} style={inputStyleWide} />
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>{t('machineDetail.type')}</strong>{' '}
            {machineCatalog.length > 0 ? (
              <SearchableSelect
                value={editType}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditType(v);
                  const entry = machineCatalog.find((t) => t.name === v);
                  if (entry) setEditMachineUsage(snapMachineUsageFromTypeDefault(entry.default_machine_usage));
                }}
                style={{ padding: '0.35rem', minWidth: 160 }}
              >
                <option value="">{t('machineDetail.chooseType')}</option>
                {(() => {
                  const names = machineCatalog.map((c) => c.name);
                  const t = String(editType ?? '').trim();
                  const extra = t && !names.some((n) => n.toLowerCase() === t.toLowerCase()) ? [t] : [];
                  return [...names, ...extra].sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
                })().map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </SearchableSelect>
            ) : (
              <>
                <input type="text" value={editType} onChange={(e) => setEditType(e.target.value)} style={{ ...inputStyleWide, marginLeft: 4 }} />
                <span style={{ fontSize: 12, color: '#666', display: 'block', marginTop: 4 }}>
                  {t('machineDetail.typesHintPrefix')}{' '}
                  <Link to="/administracja/ustawienia-bazy/typy-maszyn" style={{ color: 'var(--cap-green)' }}>{t('settings.machineTypes')}</Link>.
                </span>
              </>
            )}
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>{t('machineDetail.lineRequired')}</strong>{' '}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t('machines.digitsOnly')}
              value={editLineNumber}
              onChange={(e) => setEditLineNumber(digitsOnlyMachineLine(e.target.value))}
              style={inputStyleWide}
            />
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>{t('machineDetail.oeeOverride')}</strong>{' '}
            <input type="number" step="0.01" min={0} max={1} value={editOeeOverride} onChange={(e) => setEditOeeOverride(e.target.value)} style={{ width: 80, padding: '0.35rem' }} placeholder="0.85" />
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>{t('machineDetail.machineUsage')}</strong>{' '}
            <SearchableSelect value={usageRounded} onChange={(e) => setEditMachineUsage(Number(e.target.value))} style={{ padding: '0.35rem' }}>
              {MACHINE_USAGE_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </SearchableSelect>
            <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>{t('machineDetail.usageHint')}</span>
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>{t('machineDetail.widthMm')}</strong>{' '}
            <input type="number" step="0.1" min={0} value={editWidthMm} onChange={(e) => setEditWidthMm(e.target.value)} style={{ width: 100, padding: '0.35rem' }} />
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>{t('machineDetail.depthMm')}</strong>{' '}
            <input type="number" step="0.1" min={0} value={editDepthMm} onChange={(e) => setEditDepthMm(e.target.value)} style={{ width: 100, padding: '0.35rem' }} />
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>{t('machineDetail.heightMm')}</strong>{' '}
            <input type="number" step="0.1" min={0} value={editHeightMm} onChange={(e) => setEditHeightMm(e.target.value)} style={{ width: 100, padding: '0.35rem' }} />
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>{t('machineDetail.strokeMm')}</strong>{' '}
            <input type="number" step="0.1" min={0} value={editStrokeMm} onChange={(e) => setEditStrokeMm(e.target.value)} style={{ width: 100, padding: '0.35rem' }} />
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong>{t('machineDetail.statusLabel')}</strong>{' '}
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as MachineEditStatus)}
              title={t('machineDetail.changeStatusTitle')}
              style={machineStatusSelectStyle(editStatus, { saving })}
            >
              <option value="active">{t('common.active')}</option>
              <option value="inactive">{t('common.inactive')}</option>
              <option value="RFQ">{t('common.rfq')}</option>
            </select>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button type="button" onClick={() => setEditing(false)} style={{ padding: '0.35rem 0.75rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>{t('common.cancel')}</button>
          </div>
        </>
      )}
    </div>
    {statusGuard && (
      <MachineStatusActiveProjectsModal
        open
        machineId={machine.id}
        navigationSearch={navigationSearch}
        projects={statusGuard.projects}
        targetStatus={statusGuard.target}
        onCancel={() => setStatusGuard(null)}
        onConfirm={() => {
          const g = statusGuard;
          if (!g) return;
          setStatusGuard(null);
          executeSave(g.payload);
        }}
      />
    )}
    </>
  );
}

function AlternativesSection({
  machineId,
  machineType,
  alternatives,
  onUpdate,
}: {
  machineId: number;
  machineType: string;
  alternatives: any[];
  onUpdate: () => void;
}) {
  const { t, te } = useI18n();
  const [addId, setAddId] = useState('');
  const [machineList, setMachineList] = useState<any[]>([]);

  useEffect(() => {
    api.machines.list({ status: 'active' }).then(setMachineList);
  }, []);

  const add = () => {
    const altId = Number(addId);
    if (!altId) return;
    api.alternatives.add(machineId, altId).then(onUpdate).catch((err) => alert(te(err?.message) || t('common.saveError')));
    setAddId('');
  };

  const remove = (altMachineId: number) => {
    const alt = alternatives.find((a: any) => a.id === altMachineId);
    const label = alt ? `${alt.internal_number} (${alt.type})` : String(altMachineId);
    if (!confirmDelete(t('machineDetail.removeAltConfirm', { label }))) return;
    api.alternatives.remove(machineId, altMachineId).then(onUpdate);
  };

  const normType = (t: unknown) => String(t ?? '').trim();
  const sameGroup = (m: { type?: string }) => {
    const g = normType(machineType);
    return g !== '' && normType(m.type) === g;
  };

  type AltSortCol = 'machine' | 'sap';
  const { sortCol: altSortCol, sortDir: altSortDir, toggle: toggleAltSort } = useTableSort<AltSortCol>('machine');
  const sortedAlternatives = useMemo(
    () =>
      sortRows(alternatives, altSortCol, altSortDir, (a, col) => {
        if (col === 'sap') return String(a.sap_number ?? '');
        return `${a.internal_number ?? ''} (${a.type ?? ''})`;
      }),
    [alternatives, altSortCol, altSortDir]
  );

  const available = machineList
    .filter((m) => m.id !== machineId && !alternatives.some((a: any) => a.id === m.id))
    .sort((a, b) => {
      const aSame = sameGroup(a);
      const bSame = sameGroup(b);
      if (aSame && !bSame) return -1;
      if (!aSame && bSame) return 1;
      const byType = normType(a.type).localeCompare(normType(b.type), 'pl', { sensitivity: 'base' });
      if (byType !== 0) return byType;
      return compareInternalMachineNumbers(a.internal_number, b.internal_number);
    });

  return (
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0 }}>{t('machineDetail.altTitle')}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <SortableTh label={t('machineDetail.machineCol')} active={altSortCol === 'machine'} direction={altSortDir} onClick={() => toggleAltSort('machine')} />
            <SortableTh label="SAP" active={altSortCol === 'sap'} direction={altSortDir} onClick={() => toggleAltSort('sap')} />
            <th style={{ padding: '0.75rem', textAlign: 'left' }}></th>
          </tr>
        </thead>
        <tbody>
          {sortedAlternatives.map((a: any) => (
            <tr key={a.id}>
              <td style={{ padding: '0.75rem' }}>{a.internal_number} ({a.type})</td>
              <td style={{ padding: '0.75rem' }}>{a.sap_number || '-'}</td>
              <td style={{ padding: '0.75rem' }}><button type="button" onClick={() => remove(a.id)} style={{ background: '#c62828', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: 4 }}>{t('common.delete')}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '1rem', display: 'flex', gap: 8, alignItems: 'center' }}>
        <SearchableSelect value={addId} onChange={(e) => setAddId(e.target.value)} style={{ padding: '0.5rem' }}>
          <option value="">{t('machineDetail.chooseMachine')}</option>
          {available.map((m) => <option key={m.id} value={m.id}>{m.internal_number} ({m.type})</option>)}
        </SearchableSelect>
        <button onClick={add} style={{ padding: '0.5rem 1rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>{t('machineDetail.newAlt')}</button>
      </div>
    </div>
  );
}
