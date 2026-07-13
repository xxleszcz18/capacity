import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../context/I18nContext';
import { useScenarioMode } from '../../context/ScenarioModeContext';
import {
  DEFAULT_CALL_OFF_IMPORT_PANEL,
  DEFAULT_WORKSPACE_THEMES,
  callOffImportPanelFromVisualSettings,
  workspaceThemesFromVisualSettings,
  type CallOffImportPanelColors,
} from '../../utils/workspaceTheme';

type Props = {
  buttonStyle?: CSSProperties;
  className?: string;
};

export default function CallOffNewComparisonControl({ buttonStyle, className }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { setActiveCallOff } = useScenarioMode();

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [accent, setAccent] = useState(DEFAULT_WORKSPACE_THEMES.calloffs.accent);
  const [importPanel, setImportPanel] = useState<CallOffImportPanelColors>(DEFAULT_CALL_OFF_IMPORT_PANEL);

  useEffect(() => {
    api.settings.visual
      .get()
      .then((v) => {
        const raw = v as Record<string, unknown>;
        setAccent(workspaceThemesFromVisualSettings(raw).calloffs.accent);
        setImportPanel(callOffImportPanelFromVisualSettings(raw));
      })
      .catch(() => {
        setAccent(DEFAULT_WORKSPACE_THEMES.calloffs.accent);
        setImportPanel(DEFAULT_CALL_OFF_IMPORT_PANEL);
      });
  }, []);

  const openModal = () => {
    setError('');
    setOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setOpen(false);
    setNewName('');
    setDateFrom('');
    setDateTo('');
    setError('');
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) {
      setError(t('callOffs.nameRequired'));
      return;
    }
    if (!dateFrom || !dateTo) {
      setError(t('callOffs.dateRangeRequired'));
      return;
    }
    setSaving(true);
    setError('');
    api.callOffs
      .create({ name, date_from: dateFrom, date_to: dateTo })
      .then((row) => {
        setActiveCallOff(row.id, row.name);
        closeModal();
        navigate(`/call-offs/${row.id}`);
      })
      .catch((e) => setError(e.message || t('callOffs.saveError')))
      .finally(() => setSaving(false));
  };

  const defaultButtonStyle: CSSProperties = {
    padding: '0.5rem 1rem',
    background: accent,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontWeight: 600,
    cursor: 'pointer',
  };

  return (
    <>
      <button type="button" className={className} onClick={openModal} style={{ ...defaultButtonStyle, ...buttonStyle }}>
        {t('callOffs.newComparison')}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: '#fff',
              padding: '1.25rem',
              borderRadius: 8,
              minWidth: 320,
              maxWidth: 480,
              border: `1px solid ${importPanel.panel_border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, color: importPanel.accent }}>{t('callOffs.newComparison')}</h2>
            {error && <p style={{ color: '#c62828', marginTop: 0 }}>{error}</p>}
            <label style={{ display: 'block', marginBottom: 10 }}>
              {t('callOffs.colName')}
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '0.5rem' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 10 }}>
              {t('callOffs.dateFrom')}
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '0.5rem' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              {t('callOffs.dateTo')}
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '0.5rem' }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={closeModal} disabled={saving}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                style={{
                  background: accent,
                  color: '#fff',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? t('common.saving') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
