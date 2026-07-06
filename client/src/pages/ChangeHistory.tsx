import { useEffect, useMemo, useState } from 'react';
import SortableTh from '../components/SortableTh';
import { useTableSort, sortRows } from '../utils/tableSort';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import MultiSelectFilter from '../components/MultiSelectFilter';
import { useI18n } from '../context/I18nContext';
import { translateHistoryNote } from '../i18n/historyNotes';
import { scenarioNavQuery, useScenarioMode } from '../context/ScenarioModeContext';
import { joinCsvFilter, joinCsvFilterNumbers } from '../utils/filterParams';

type Filters = {
  projectIds: number[];
  machineIds: number[];
  partIds: number[];
  clients: string[];
  authors: string[];
  text: string;
};

const defaultFilters: Filters = {
  projectIds: [],
  machineIds: [],
  partIds: [],
  clients: [],
  authors: [],
  text: '',
};

export default function ChangeHistory() {
  const { t, locale } = useI18n();
  const [searchParams] = useSearchParams();
  const { activeScenarioId: ctxScenarioId, appSection } = useScenarioMode();
  const scenarioFromQuery = searchParams.get('scenarioId');
  const scenarioIdParam = scenarioFromQuery != null ? Number(scenarioFromQuery) : NaN;
  const scopedScenarioId =
    Number.isFinite(scenarioIdParam) && scenarioIdParam > 0
      ? scenarioIdParam
      : appSection === 'scenarios' && ctxScenarioId != null && ctxScenarioId > 0
        ? ctxScenarioId
        : null;
  const adminBackTo = `/administracja${scenarioNavQuery(scopedScenarioId)}`;

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    projects: { id: number; client: string; name: string }[];
    clients: string[];
    machines: { id: number; sap_number?: string | null; internal_number?: string | null; type?: string | null }[];
    details: { id: number; label: string }[];
    authors: string[];
  }>({ projects: [], clients: [], machines: [], details: [], authors: [] });

  const load = () => {
    setLoading(true);
    setError(null);
    const params = {
      projectIds: joinCsvFilterNumbers(filters.projectIds),
      machineIds: joinCsvFilterNumbers(filters.machineIds),
      partIds: joinCsvFilterNumbers(filters.partIds),
      clients: joinCsvFilter(filters.clients),
      authors: joinCsvFilter(filters.authors),
      text: filters.text.trim() || undefined,
    };
    const chain =
      scopedScenarioId != null
        ? api.scenarios.history(scopedScenarioId, params)
        : api.projects.history(params);
    chain
      .then(setRows)
      .catch((e: any) => {
        setRows([]);
        setError(e?.message || t('history.loadError'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (scopedScenarioId != null) {
      api.scenarios.historyFilters(scopedScenarioId).then(setMeta).catch(() => {});
    } else {
      api.projects.historyFilters().then(setMeta).catch(() => {});
    }
  }, [scopedScenarioId]);

  useEffect(() => {
    load();
  }, [filters.projectIds.join(','), filters.machineIds.join(','), filters.partIds.join(','), filters.clients.join(','), filters.authors.join(','), filters.text, scopedScenarioId]);

  const projectLabelById = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of meta.projects) map.set(p.id, `${p.client} / ${p.name}`);
    return map;
  }, [meta.projects]);

  const machineOptionLabel = (m: { sap_number?: string | null; internal_number?: string | null; type?: string | null }) => {
    const sap = String(m.sap_number ?? '').trim();
    const internal = String(m.internal_number ?? '').trim();
    if (sap && internal) return `${sap} (${internal})${m.type ? ` - ${m.type}` : ''}`;
    if (sap) return `${sap}${m.type ? ` - ${m.type}` : ''}`;
    if (internal) return `${internal}${m.type ? ` - ${m.type}` : ''}`;
    return '—';
  };

  const clearFilters = () => setFilters(defaultFilters);

  type HistorySortCol = 'date' | 'client' | 'project' | 'machine' | 'detail' | 'type' | 'author' | 'note';
  const { sortCol, sortDir, toggle } = useTableSort<HistorySortCol>('date', 'desc');

  const sortedRows = useMemo(
    () =>
      sortRows(rows, sortCol, sortDir, (r, col) => {
        switch (col) {
          case 'date':
            return String(r.note_date ?? '');
          case 'client':
            return String(r.client ?? '');
          case 'project':
            return projectLabelById.get(Number(r.project_id)) || String(r.project_name ?? '');
          case 'machine':
            return String(r.machine_label ?? '');
          case 'detail':
            return String(r.detail_label ?? '');
          case 'type':
            return r.note_type === 'auto' ? t('history.auto') : t('history.manual');
          case 'author':
            return String(r.author ?? 'system');
          case 'note':
            return translateHistoryNote(locale, String(r.note ?? ''));
          default:
            return '';
        }
      }),
    [rows, sortCol, sortDir, projectLabelById, t, locale]
  );

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={adminBackTo} style={{ color: 'var(--cap-green)' }}>
          {t('admin.backAdmin')}
        </Link>
      </div>
      <h1 style={{ marginTop: 0 }}>{t('history.title')}</h1>
      {scopedScenarioId != null && (
        <p style={{ color: '#1565c0', marginBottom: '1rem', fontSize: 15 }}>
          {t('history.scenarioFootnoteLead')}{' '}
          <strong>{t('history.scenarioFootnoteBold', { id: scopedScenarioId })}</strong> {t('history.scenarioFootnoteDetails')}{' '}
          {t('history.scenarioFootnoteFull')}
        </p>
      )}
      <div className="filters-toolbar">
        <span className="filters-label">{t('common.filters')}</span>
        <label>
          {t('history.project')}
          <MultiSelectFilter
            className="cap-filter-select"
            options={meta.projects.map((p) => ({ value: p.id, label: `${p.client} / ${p.name}` }))}
            selected={filters.projectIds}
            onChange={(next) => setFilters((prev) => ({ ...prev, projectIds: next }))}
            allLabel={t('common.all')}
            clearLabel={t('common.clearFilters')}
            searchable
            searchPlaceholder={t('common.searchFilter')}
            style={{ minWidth: 260 }}
          />
        </label>
        <label>
          {t('history.client')}
          <MultiSelectFilter
            className="cap-filter-select"
            options={meta.clients.map((c) => ({ value: c, label: c }))}
            selected={filters.clients}
            onChange={(next) => setFilters((prev) => ({ ...prev, clients: next }))}
            allLabel={t('common.allClients')}
            clearLabel={t('common.clearFilters')}
            searchable
            searchPlaceholder={t('common.searchFilter')}
            style={{ minWidth: 160 }}
          />
        </label>
        <label>
          {t('history.machine')}
          <MultiSelectFilter
            className="cap-filter-select"
            options={meta.machines.map((m) => ({ value: m.id, label: machineOptionLabel(m) }))}
            selected={filters.machineIds}
            onChange={(next) => setFilters((prev) => ({ ...prev, machineIds: next }))}
            allLabel={t('common.all')}
            clearLabel={t('common.clearFilters')}
            searchable
            searchPlaceholder={t('common.searchFilter')}
            style={{ minWidth: 220 }}
          />
        </label>
        <label>
          {t('history.detail')}
          <MultiSelectFilter
            className="cap-filter-select"
            options={meta.details.map((d) => ({ value: d.id, label: d.label }))}
            selected={filters.partIds}
            onChange={(next) => setFilters((prev) => ({ ...prev, partIds: next }))}
            allLabel={t('common.all')}
            clearLabel={t('common.clearFilters')}
            searchable
            searchPlaceholder={t('common.searchFilter')}
            style={{ minWidth: 220 }}
          />
        </label>
        <label>
          {t('history.author')}
          <MultiSelectFilter
            className="cap-filter-select"
            options={meta.authors.map((a) => ({ value: a, label: a }))}
            selected={filters.authors}
            onChange={(next) => setFilters((prev) => ({ ...prev, authors: next }))}
            allLabel={t('common.all')}
            clearLabel={t('common.clearFilters')}
            searchable
            searchPlaceholder={t('common.searchFilter')}
            style={{ minWidth: 160 }}
          />
        </label>
        <label>
          {t('history.searchNotes')}
          <input
            type="text"
            value={filters.text}
            onChange={(e) => setFilters((prev) => ({ ...prev, text: e.target.value }))}
            style={{ minWidth: 200, marginLeft: 4, padding: 4 }}
          />
        </label>
        <button type="button" className="filter-clear-btn" onClick={clearFilters}>
          {t('common.clearFilters')}
        </button>
      </div>

      {error && <p style={{ color: '#c62828' }}>{error}</p>}
      {loading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <SortableTh label={t('history.date')} active={sortCol === 'date'} direction={sortDir} onClick={() => toggle('date')} />
              <SortableTh label={t('history.client')} active={sortCol === 'client'} direction={sortDir} onClick={() => toggle('client')} />
              <SortableTh label={t('history.project')} active={sortCol === 'project'} direction={sortDir} onClick={() => toggle('project')} />
              <SortableTh label={t('history.machine')} active={sortCol === 'machine'} direction={sortDir} onClick={() => toggle('machine')} />
              <SortableTh label={t('history.detail')} active={sortCol === 'detail'} direction={sortDir} onClick={() => toggle('detail')} />
              <SortableTh label={t('history.type')} active={sortCol === 'type'} direction={sortDir} onClick={() => toggle('type')} />
              <SortableTh label={t('history.author')} active={sortCol === 'author'} direction={sortDir} onClick={() => toggle('author')} />
              <SortableTh label={t('history.note')} active={sortCol === 'note'} direction={sortDir} onClick={() => toggle('note')} />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>{r.note_date}</td>
                <td style={{ padding: '0.75rem' }}>{r.client || '—'}</td>
                <td style={{ padding: '0.75rem' }}>{projectLabelById.get(Number(r.project_id)) || r.project_name || '—'}</td>
                <td style={{ padding: '0.75rem' }}>{r.machine_label || '—'}</td>
                <td style={{ padding: '0.75rem' }}>{r.detail_label || '—'}</td>
                <td style={{ padding: '0.75rem' }}>{r.note_type === 'auto' ? t('history.auto') : t('history.manual')}</td>
                <td style={{ padding: '0.75rem' }}>{r.author || 'system'}</td>
                <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>{translateHistoryNote(locale, String(r.note ?? ''))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
