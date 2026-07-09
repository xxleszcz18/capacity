import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

export default function ProtectedRoute({
  children,
  permission,
  anyPermission,
}: {
  children: React.ReactNode;
  permission?: string;
  anyPermission?: string[];
}) {
  const { t } = useI18n();
  const { user, loading, hasPermission, hasAnyPermission } = useAuth();
  const location = useLocation();

  if (loading) return <p style={{ padding: '2rem' }}>{t('common.loading')}</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.must_change_password && !user.is_guest && location.pathname !== '/zmiana-hasla') {
    return <Navigate to="/zmiana-hasla" replace />;
  }
  if (permission && !hasPermission(permission)) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>403</h2>
        <p>{t('auth.forbidden')}</p>
      </div>
    );
  }
  if (anyPermission && !hasAnyPermission(anyPermission)) {
    return (
      <div style={{ padding: '2rem' }}>
        <h2>403</h2>
        <p>{t('auth.forbidden')}</p>
      </div>
    );
  }
  return <>{children}</>;
}
