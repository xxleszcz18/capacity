import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useI18n } from '../context/I18nContext';

export default function ForgotPassword() {
  const { t } = useI18n();
  const [login, setLogin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const r = await api.auth.forgotPassword({ login: login.trim() });
      setMessage(r.message || t('auth.forgotPasswordSent'));
    } catch (err: any) {
      setError(err?.message || t('auth.forgotPasswordFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <form
        onSubmit={onSubmit}
        style={{ background: 'white', padding: '2rem', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: 'min(400px, 92vw)' }}
      >
        <h1 style={{ marginTop: 0 }}>{t('auth.forgotPasswordTitle')}</h1>
        {error && <p style={{ color: 'var(--cap-red)' }}>{error}</p>}
        {message && <p style={{ color: '#2e7d32' }}>{message}</p>}
        <label style={{ display: 'block', marginBottom: 16 }}>
          {t('auth.loginField')}
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }}
            required
          />
        </label>
        <button type="submit" disabled={submitting} style={{ width: '100%', padding: '0.6rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>
          {t('auth.forgotPasswordSubmit')}
        </button>
        <p style={{ marginTop: 16, fontSize: 13 }}>
          <Link to="/login">{t('auth.backToLogin')}</Link>
        </p>
      </form>
    </div>
  );
}
