import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

export default function ChangePassword() {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const forced = Boolean(user?.must_change_password);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await api.auth.changePassword({ current_password: current, new_password: next });
      await refresh();
      if (forced) navigate('/', { replace: true });
      else navigate(-1);
    } catch (err: any) {
      setError(err?.message || t('auth.changePasswordFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '2rem auto' }}>
      <h1>{t('auth.changePasswordTitle')}</h1>
      {forced && <p style={{ color: '#e65100' }}>{t('auth.mustChangePasswordHint')}</p>}
      {error && <p style={{ color: 'var(--cap-red)' }}>{error}</p>}
      <form onSubmit={onSubmit}>
        <label style={{ display: 'block', marginBottom: 12 }}>
          {t('auth.currentPasswordField')}
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }} required />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          {t('auth.newPasswordField')}
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }} required />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          {t('auth.confirmPasswordField')}
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }} required />
        </label>
        <button type="submit" disabled={submitting} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>
          {t('auth.changePasswordSubmit')}
        </button>
      </form>
    </div>
  );
}
