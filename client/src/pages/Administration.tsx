import { Link } from 'react-router-dom';
import { AdminHubList, adminHubCardStyle } from '../components/AdminHubCards';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { scenarioNavQuery, useScenarioMode } from '../context/ScenarioModeContext';

export default function Administration() {
  const { t } = useI18n();
  const { hasPermission, hasAnyPermission } = useAuth();
  const { activeScenarioId, appSection } = useScenarioMode();
  const adminQuery = scenarioNavQuery(activeScenarioId);
  const scenarioOnly = appSection === 'scenarios';
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>{t('admin.title')}</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        {scenarioOnly ? t('admin.subtitleScenario') : t('admin.subtitle')}
      </p>

      <AdminHubList>
        {!scenarioOnly && hasPermission('admin_database.view') && (
          <Link to="/administracja/ustawienia-bazy" style={adminHubCardStyle}>
            <strong style={{ fontSize: '1.1rem' }}>{t('admin.databaseSettings')}</strong>
            <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('admin.databaseSettingsDesc')}</p>
          </Link>
        )}

        {!scenarioOnly && hasPermission('admin_settings.view') && (
          <Link to="/administracja/ustawienia-administracyjne" style={adminHubCardStyle}>
            <strong style={{ fontSize: '1.1rem' }}>{t('admin.adminSettings')}</strong>
            <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('admin.adminSettingsDesc')}</p>
          </Link>
        )}

        {!scenarioOnly && hasAnyPermission(['user_management.view', 'role_management.view']) && (
          <Link to="/administracja/uzytkownicy-i-uprawnienia" style={adminHubCardStyle}>
            <strong style={{ fontSize: '1.1rem' }}>{t('layout.usersAndPermissions')}</strong>
            <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('admin.usersPermissionsSubtitle')}</p>
          </Link>
        )}

        {hasPermission('change_history.view') && (
          <Link to={`/administracja/historia-zmian${adminQuery}`} style={adminHubCardStyle}>
            <strong style={{ fontSize: '1.1rem' }}>{t('admin.changeHistory')}</strong>
            <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('admin.changeHistoryDesc')}</p>
          </Link>
        )}

        <Link to="/administracja/instrukcja" style={adminHubCardStyle}>
          <strong style={{ fontSize: '1.1rem' }}>{t('admin.userManual')}</strong>
          <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('admin.userManualDesc')}</p>
        </Link>
      </AdminHubList>
    </div>
  );
}
