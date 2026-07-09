import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

type AdminContact = {
  display_name: string | null;
  email: string | null;
  username: string | null;
  label: string;
  contact: string;
};

export default function Login() {
  const { t } = useI18n();
  const { login, loginAsGuest, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [guestAvailable, setGuestAvailable] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [adminContacts, setAdminContacts] = useState<AdminContact[]>([]);
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverError, setRecoverError] = useState<string | null>(null);

  useEffect(() => {
    api.auth
      .guestAvailable()
      .then((r) => setGuestAvailable(r.available === true))
      .catch(() => setGuestAvailable(false));
  }, []);

  if (!loading && user && !user.must_change_password) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const u = await login(loginId.trim(), password);
      if (u.must_change_password) navigate('/zmiana-hasla', { replace: true });
      else navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || t('auth.loginFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const onGuest = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginAsGuest();
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.message || t('auth.guestUnavailable'));
    } finally {
      setSubmitting(false);
    }
  };

  const onRecoverPassword = async () => {
    if (recoverOpen) {
      setRecoverOpen(false);
      return;
    }
    setRecoverOpen(true);
    setRecoverLoading(true);
    setRecoverError(null);
    try {
      const r = await api.auth.adminContacts();
      setAdminContacts(r.contacts ?? []);
    } catch {
      setRecoverError(t('auth.adminContactsFailed'));
      setAdminContacts([]);
    } finally {
      setRecoverLoading(false);
    }
  };

  const inputStyle = {
    display: 'block' as const,
    width: '100%',
    marginTop: 4,
    padding: '0.55rem 0.65rem',
    border: '1px solid #bdbdbd',
    borderRadius: 4,
    boxSizing: 'border-box' as const,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          width: 'min(820px, 96vw)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px 0' }}>
          <LanguageSwitcher />
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'stretch',
          }}
        >
          <section
            style={{
              flex: '1 1 280px',
              padding: '1.25rem 2rem 1.5rem',
              borderRight: '1px solid #eee',
              background: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>{t('auth.guestLoginTitle')}</h2>
            <p style={{ color: '#666', fontSize: 14, margin: '0 0 1.25rem', lineHeight: 1.45 }}>{t('auth.guestLoginHint')}</p>
            {guestAvailable ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void onGuest()}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  background: 'white',
                  color: 'var(--cap-green)',
                  border: '2px solid var(--cap-green)',
                  borderRadius: 4,
                  cursor: submitting ? 'wait' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {t('auth.guestLogin')}
              </button>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: '#888', padding: '0.65rem', background: '#f0f0f0', borderRadius: 4 }}>
                {t('auth.guestUnavailable')}
              </p>
            )}
          </section>

          <section style={{ flex: '1 1 280px', padding: '1.25rem 2rem 1.5rem' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>{t('auth.loginTitle')}</h2>
            <p style={{ color: '#666', fontSize: 14, margin: '0 0 1rem' }}>{t('auth.loginHint')}</p>
            {error && <p style={{ color: 'var(--cap-red)', fontSize: 14, margin: '0 0 12px' }}>{error}</p>}
            <form onSubmit={onSubmit}>
              <label style={{ display: 'block', marginBottom: 12 }}>
                {t('auth.loginField')}
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoComplete="username"
                  style={inputStyle}
                  required
                />
              </label>
              <label style={{ display: 'block', marginBottom: 16 }}>
                {t('auth.passwordField')}
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={inputStyle}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  background: 'var(--cap-green)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: submitting ? 'wait' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {t('auth.loginButton')}
              </button>
            </form>
          </section>
        </div>

        <footer style={{ borderTop: '1px solid #eee', padding: '1rem 2rem 1.25rem', background: '#fafafa' }}>
          <button
            type="button"
            onClick={() => void onRecoverPassword()}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--cap-green)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {recoverOpen ? t('auth.recoverPasswordHide') : t('auth.recoverPassword')}
          </button>
          {recoverOpen && (
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: '0 0 10px', color: '#444', fontSize: 14, lineHeight: 1.45 }}>{t('auth.recoverPasswordMessage')}</p>
              <strong style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>{t('auth.administratorsList')}</strong>
              {recoverLoading ? (
                <p style={{ margin: 0, color: '#666', fontSize: 13 }}>{t('common.loading')}</p>
              ) : recoverError ? (
                <p style={{ margin: 0, color: 'var(--cap-red)', fontSize: 13 }}>{recoverError}</p>
              ) : adminContacts.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', fontSize: 14, color: '#333' }}>
                  {adminContacts.map((c) => (
                    <li key={c.contact} style={{ marginBottom: 6 }}>
                      {c.email ? (
                        <a href={`mailto:${c.email}`} style={{ color: 'var(--cap-green)', fontWeight: 500, textDecoration: 'none' }}>
                          {c.email}
                        </a>
                      ) : (
                        <span style={{ fontWeight: 500 }}>{c.contact}</span>
                      )}
                      {c.display_name && c.email ? (
                        <span style={{ color: '#666', marginLeft: 6 }}>({c.display_name})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, color: '#888', fontSize: 13 }}>{t('auth.noAdministrators')}</p>
              )}
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
