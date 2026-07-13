import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import SearchableSelect from '../SearchableSelect';
import { useI18n } from '../../context/I18nContext';
import { useScenarioMode } from '../../context/ScenarioModeContext';
import { DEFAULT_WORKSPACE_THEMES, workspaceThemesFromVisualSettings } from '../../utils/workspaceTheme';

type ScenarioRow = {
  id: number;
  name: string;
};

type Props = {
  buttonStyle?: CSSProperties;
  className?: string;
  /** Po utworzeniu scenariusza (np. odświeżenie listy). */
  onCreated?: () => void;
  /** Po utworzeniu ustaw aktywny scenariusz i przejdź do kalkulatora. */
  activateOnCreate?: boolean;
};

export default function ScenarioNewControl({ buttonStyle, className, onCreated, activateOnCreate = false }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { setActiveScenario } = useScenarioMode();

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState('');
  const [baseMode, setBaseMode] = useState<'live' | 'scenario'>('live');
  const [sourceScenarioId, setSourceScenarioId] = useState<number | ''>('');
  const [activeForSourcePicker, setActiveForSourcePicker] = useState<ScenarioRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [accent, setAccent] = useState(DEFAULT_WORKSPACE_THEMES.scenarios.accent);

  useEffect(() => {
    api.settings.visual
      .get()
      .then((v) => setAccent(workspaceThemesFromVisualSettings(v as Record<string, unknown>).scenarios.accent))
      .catch(() => setAccent(DEFAULT_WORKSPACE_THEMES.scenarios.accent));
  }, []);

  useEffect(() => {
    if (!open) return;
    api.scenarios
      .list({ archived: false })
      .then(setActiveForSourcePicker)
      .catch(() => setActiveForSourcePicker([]));
  }, [open]);

  const openModal = () => {
    setError('');
    setNewName('');
    setNewScope('');
    setBaseMode('live');
    setSourceScenarioId('');
    setOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setOpen(false);
    setError('');
  };

  const handleCreate = () => {
    const name = newName.trim();
    const scenario_scope = newScope.trim();
    if (!name) {
      setError(t('scenarios.errNameRequired'));
      return;
    }
    if (!scenario_scope) {
      setError(t('scenarios.errScopeRequired'));
      return;
    }
    if (baseMode === 'scenario') {
      const sid = Number(sourceScenarioId);
      if (!Number.isFinite(sid) || sid <= 0) {
        setError(t('scenarios.errPickSource'));
        return;
      }
    }
    setSaving(true);
    setError('');
    api.scenarios
      .create({
        name,
        scenario_scope,
        sourceScenarioId: baseMode === 'scenario' && sourceScenarioId !== '' ? Number(sourceScenarioId) : null,
      })
      .then((row) => {
        closeModal();
        onCreated?.();
        if (activateOnCreate) {
          setActiveScenario(row.id, row.name);
          navigate(`/kalkulator?scenarioId=${row.id}`, { replace: true });
        }
      })
      .catch((e) => setError(e.message || t('scenarios.saveError')))
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
        {t('scenarios.new')}
      </button>

      {open && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 400, maxWidth: '96vw' }}
          >
            <h2 style={{ marginTop: 0, color: accent }}>{t('scenarios.new')}</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>{t('scenarios.startingPoint')}</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input type="radio" name="scenario-base" checked={baseMode === 'live'} onChange={() => setBaseMode('live')} />
                {t('scenarios.sourceLiveDb')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="radio" name="scenario-base" checked={baseMode === 'scenario'} onChange={() => setBaseMode('scenario')} />
                {t('scenarios.sourceFromScenario')}
              </label>
              {baseMode === 'scenario' && (
                <div style={{ marginTop: 8, marginLeft: 24 }}>
                  <SearchableSelect
                    value={sourceScenarioId === '' ? '' : String(sourceScenarioId)}
                    onChange={(e) => setSourceScenarioId(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '100%', maxWidth: 360, padding: 6 }}
                  >
                    <option value="">{t('scenarios.pickScenario')}</option>
                    {activeForSourcePicker.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (#{s.id})
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
              )}
            </div>
            <label style={{ display: 'block', marginBottom: 8 }}>
              {t('scenarios.nameRequired')}{' '}
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ width: '100%', padding: 6, marginTop: 4 }}
                placeholder={t('scenarios.namePlaceholder')}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              {t('scenarios.scopeRequired')}{' '}
              <textarea
                value={newScope}
                onChange={(e) => setNewScope(e.target.value)}
                rows={4}
                style={{ width: '100%', padding: 6, marginTop: 4, boxSizing: 'border-box' }}
                placeholder={t('scenarios.scopePlaceholder')}
              />
            </label>
            {error && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                style={{
                  padding: '0.5rem 1rem',
                  background: accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? t('common.saving') : t('scenarios.createScenario')}
              </button>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
