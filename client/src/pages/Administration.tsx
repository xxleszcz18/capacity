import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { scenarioNavQuery, useScenarioMode } from '../context/ScenarioModeContext';

const cardStyle: CSSProperties = {
  display: 'block',
  padding: '1.25rem 1.5rem',
  minWidth: 240,
  background: 'white',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  borderRadius: 8,
  color: 'inherit',
  textDecoration: 'none',
  border: '1px solid #eee',
};

export default function Administration() {
  const { t } = useI18n();
  const { activeScenarioId, appSection } = useScenarioMode();
  const adminQuery = scenarioNavQuery(activeScenarioId);
  const scenarioOnly = appSection === 'scenarios';
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>{t('admin.title')}</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        {scenarioOnly ? t('admin.subtitleScenario') : t('admin.subtitle')}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {!scenarioOnly && (
          <>
            <Link to="/administracja/ustawienia-bazy" style={cardStyle}>
              <strong style={{ fontSize: '1.1rem' }}>{t('admin.databaseSettings')}</strong>
              <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('admin.databaseSettingsDesc')}</p>
            </Link>

            <Link to="/administracja/ustawienia-administracyjne" style={cardStyle}>
              <strong style={{ fontSize: '1.1rem' }}>{t('admin.adminSettings')}</strong>
              <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('admin.adminSettingsDesc')}</p>
            </Link>

            <Link to="/administracja/wizualizacja-danych" style={cardStyle}>
              <strong style={{ fontSize: '1.1rem' }}>{t('admin.dataVisualization')}</strong>
              <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('admin.dataVisualizationDesc')}</p>
            </Link>
          </>
        )}

        <Link to={`/administracja/historia-zmian${adminQuery}`} style={cardStyle}>
          <strong style={{ fontSize: '1.1rem' }}>{t('admin.changeHistory')}</strong>
          <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('admin.changeHistoryDesc')}</p>
        </Link>

        <Link to="/administracja/instrukcja" style={cardStyle}>
          <strong style={{ fontSize: '1.1rem' }}>{t('admin.userManual')}</strong>
          <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('admin.userManualDesc')}</p>
        </Link>
      </div>
    </div>
  );
}
