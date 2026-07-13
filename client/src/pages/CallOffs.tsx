import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { confirmDelete } from '../confirmDelete';
import { useI18n } from '../context/I18nContext';
import { useScenarioMode } from '../context/ScenarioModeContext';
import {
  DEFAULT_CALL_OFF_IMPORT_PANEL,
  callOffImportPanelFromVisualSettings,
  type CallOffImportPanelColors,
} from '../utils/workspaceTheme';

type CallOffRow = {
  id: number;
  name: string;
  date_from: string;
  date_to: string;
  source_filename: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  volume_row_count?: number;
};

const callOffRowActionStyle: CSSProperties = {
  display: 'inline-block',
  width: 122,
  minWidth: 122,
  maxWidth: 122,
  boxSizing: 'border-box',
  textAlign: 'center',
  padding: '0.35rem 0.35rem',
  borderRadius: 6,
  marginRight: 8,
  verticalAlign: 'middle',
  fontSize: 13,
  fontWeight: 600,
};

function secondaryButtonStyle(panel: CallOffImportPanelColors): CSSProperties {
  return {
    ...callOffRowActionStyle,
    border: `1px solid ${panel.panel_border}`,
    background: '#fff',
    cursor: 'pointer',
    color: panel.accent,
  };
}

export default function CallOffs() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { setActiveCallOff, clearActiveCallOff, activeCallOffId, setAppSection } = useScenarioMode();
  const [viewMode, setViewMode] = useState<'active' | 'archive'>('active');
  const [list, setList] = useState<CallOffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importPanel, setImportPanel] = useState<CallOffImportPanelColors>(DEFAULT_CALL_OFF_IMPORT_PANEL);

  const load = () => {
    setLoading(true);
    setError('');
    return api.callOffs
      .list({ archived: viewMode === 'archive' })
      .then(setList)
      .catch((e) => setError(e.message || t('callOffs.loadError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setAppSection('calloffs');
    api.settings.visual
      .get()
      .then((v) => setImportPanel(callOffImportPanelFromVisualSettings(v as Record<string, unknown>)))
      .catch(() => setImportPanel(DEFAULT_CALL_OFF_IMPORT_PANEL));
  }, [setAppSection]);

  useEffect(() => {
    load();
  }, [viewMode]);

  const openComparison = (row: CallOffRow) => {
    setActiveCallOff(row.id, row.name);
    navigate(`/call-offs/${row.id}`);
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirmDelete(t('callOffs.deleteConfirm', { name }))) return;
    api.callOffs
      .delete(id)
      .then(() => {
        if (activeCallOffId === id) clearActiveCallOff();
        load();
      })
      .catch((e) => setError(e.message || t('callOffs.saveError')));
  };

  const handleArchive = (id: number, name: string) => {
    if (!window.confirm(t('callOffs.archiveConfirm', { name }))) return;
    api.callOffs
      .archive(id)
      .then(() => {
        if (activeCallOffId === id) clearActiveCallOff();
        load();
      })
      .catch((e) => setError(e.message || t('callOffs.archiveError')));
  };

  const handleUnarchive = (id: number, name: string) => {
    if (!window.confirm(t('callOffs.unarchiveConfirm', { name }))) return;
    api.callOffs
      .unarchive(id)
      .then(load)
      .catch((e) => setError(e.message || t('callOffs.unarchiveError')));
  };

  const tabStyle = (active: boolean): CSSProperties => ({
    padding: '0.45rem 1rem',
    border: 'none',
    cursor: 'pointer',
    background: active ? importPanel.accent : importPanel.panel_bg,
    color: active ? '#fff' : importPanel.accent,
    fontWeight: active ? 600 : 400,
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, color: importPanel.accent }}>{t('callOffs.title')}</h1>
      </div>
      <p style={{ color: '#555', marginTop: 0 }}>{t('callOffs.subtitle')}</p>
      {error && <p style={{ color: '#c62828' }}>{error}</p>}

      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            display: 'inline-flex',
            borderRadius: 6,
            overflow: 'hidden',
            border: `1px solid ${importPanel.panel_border}`,
            background: '#fff',
          }}
        >
          <button type="button" onClick={() => setViewMode('active')} style={tabStyle(viewMode === 'active')}>
            {t('callOffs.active')}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('archive')}
            style={{ ...tabStyle(viewMode === 'archive'), borderLeft: `1px solid ${importPanel.panel_border}` }}
          >
            {t('callOffs.archive')}
          </button>
        </div>
      </div>

      {loading ? (
        <p>{t('common.loading')}</p>
      ) : list.length === 0 ? (
        <p style={{ color: '#666' }}>{viewMode === 'archive' ? t('callOffs.emptyArchived') : t('callOffs.emptyActive')}</p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: '#fff',
            border: `1px solid ${importPanel.panel_border}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          <thead>
            <tr style={{ background: importPanel.table_header_bg, textAlign: 'left', color: importPanel.accent }}>
              <th style={{ padding: '0.75rem' }}>{t('callOffs.colName')}</th>
              <th style={{ padding: '0.75rem' }}>{t('callOffs.colDateRange')}</th>
              <th style={{ padding: '0.75rem' }}>{t('callOffs.colFile')}</th>
              <th style={{ padding: '0.75rem' }}>{t('callOffs.colUpdated')}</th>
              {viewMode === 'archive' && <th style={{ padding: '0.75rem' }}>{t('callOffs.archived')}</th>}
              <th style={{ padding: '0.75rem', width: 1 }} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id} style={{ borderTop: `1px solid ${importPanel.panel_border}` }}>
                <td style={{ padding: '0.75rem' }}>
                  <Link
                    to={`/call-offs/${row.id}`}
                    onClick={() => setActiveCallOff(row.id, row.name)}
                    style={{ fontWeight: 600, color: importPanel.accent }}
                  >
                    {row.name}
                  </Link>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  {row.date_from} — {row.date_to}
                </td>
                <td style={{ padding: '0.75rem' }}>{row.source_filename || '—'}</td>
                <td style={{ padding: '0.75rem' }}>{row.updated_at?.slice(0, 16) ?? row.created_at?.slice(0, 16)}</td>
                {viewMode === 'archive' && (
                  <td style={{ padding: '0.75rem', fontSize: 13, color: '#555' }}>
                    {row.archived_at ? new Date(row.archived_at).toLocaleString() : '—'}
                  </td>
                )}
                <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                  <button type="button" onClick={() => openComparison(row)} style={secondaryButtonStyle(importPanel)}>
                    {t('callOffs.open')}
                  </button>
                  {viewMode === 'active' ? (
                    <button
                      type="button"
                      onClick={() => handleArchive(row.id, row.name)}
                      style={{ ...callOffRowActionStyle, background: '#6d4c41', color: '#fff', border: 'none', cursor: 'pointer' }}
                    >
                      {t('callOffs.archiveBtn')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUnarchive(row.id, row.name)}
                      style={{ ...callOffRowActionStyle, background: '#00897b', color: '#fff', border: 'none', cursor: 'pointer' }}
                    >
                      {t('callOffs.restoreBtn')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(row.id, row.name)}
                    style={{ ...callOffRowActionStyle, marginRight: 0, color: '#c62828', border: '1px solid #e57373', background: '#fff', cursor: 'pointer' }}
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
