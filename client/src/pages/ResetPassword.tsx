import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useI18n } from '../context/I18nContext';

export default function ResetPassword() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (!token) {
      setError(t('auth.resetTokenMissing'));
      return;
    }
    setSubmitting(true);
    try {
      await api.auth.resetPassword({ token, password });
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError(err?.message || t('auth.resetFailed'));
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
        <h1 style={{ marginTop: 0 }}>{t('auth.resetPasswordTitle')}</h1>
        {error && <p style={{ color: 'var(--cap-red)' }}>{error}</p>}
        <label style={{ display: 'block', marginBottom: 12 }}>
          {t('auth.newPasswordField')}
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }} required />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          {t('auth.confirmPasswordField')}
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }} required />
        </label>
        <button type="submit" disabled={submitting} style={{ width: '100%', padding: '0.6rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>
          {t('auth.resetPasswordSubmit')}
        </button>
        <p style={{ marginTop: 16, fontSize: 13 }}>
          <Link to="/login">{t('auth.backToLogin')}</Link>
        </p>
      </form>
    </div>
  );
}
