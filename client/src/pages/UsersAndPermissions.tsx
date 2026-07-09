import { Link } from 'react-router-dom';
import { AdminHubList, adminHubCardStyle } from '../components/AdminHubCards';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';

export default function UsersAndPermissions() {
  const { t } = useI18n();
  const { hasPermission } = useAuth();

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/administracja" style={{ color: 'var(--cap-green)' }}>
          {t('common.back', { target: t('admin.title') })}
        </Link>
      </div>
      <h1 style={{ marginTop: 0 }}>{t('layout.usersAndPermissions')}</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>{t('admin.usersPermissionsSubtitle')}</p>

      <AdminHubList>
        {hasPermission('user_management.view') && (
          <Link to="/administracja/uzytkownicy-i-uprawnienia/uzytkownicy" style={adminHubCardStyle}>
            <strong style={{ fontSize: '1.1rem' }}>{t('admin.users')}</strong>
            <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('admin.usersDesc')}</p>
          </Link>
        )}

        {hasPermission('role_management.view') && (
          <Link to="/administracja/uzytkownicy-i-uprawnienia/role" style={adminHubCardStyle}>
            <strong style={{ fontSize: '1.1rem' }}>{t('admin.roles')}</strong>
            <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('admin.rolesDesc')}</p>
          </Link>
        )}
      </AdminHubList>
    </div>
  );
}
