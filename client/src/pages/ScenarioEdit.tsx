import { useEffect, useState } from 'react';

import { Link, useNavigate, useParams } from 'react-router-dom';

import { api } from '../api/client';

import { useScenarioMode } from '../context/ScenarioModeContext';

import { useI18n } from '../context/I18nContext';



export default function ScenarioEdit() {

  const { t, te } = useI18n();

  const { id } = useParams();

  const navigate = useNavigate();

  const { setActiveScenario } = useScenarioMode();

  const [name, setName] = useState('');

  const [scope, setScope] = useState('');

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');



  useEffect(() => {

    if (!id) return;

    api.scenarios

      .get(Number(id))

      .then((s) => {

        setName(s.name || '');

        setScope(s.scenario_scope ?? '');

        setActiveScenario(s.id, s.name || '');

      })

      .catch((e: any) => setError(te(e?.message) || t('scenarioEditExtra.loadFailed')))

      .finally(() => setLoading(false));

  }, [id, setActiveScenario, t, te]);



  const save = () => {

    const n = name.trim();

    const sc = scope.trim();

    if (!id || !n) {

      setError(t('scenarioEditExtra.nameRequired'));

      return;

    }

    if (!sc) {

      setError(t('errors.scenarioScopeRequired'));

      return;

    }

    setSaving(true);

    setError('');

    api.scenarios

      .update(Number(id), { name: n, scenario_scope: sc })

      .then(() => navigate(`/scenariusze/${id}`))

      .catch((e: any) => setError(te(e?.message) || t('scenarioEditExtra.saveFailed')))

      .finally(() => setSaving(false));

  };



  if (loading) return <p>{t('common.loading')}</p>;



  return (

    <div>

      <div style={{ marginBottom: '1rem' }}>

        <Link to={id ? `/scenariusze/${id}` : '/scenariusze'} style={{ color: 'var(--cap-green)' }}>

          {t('scenarioEditExtra.backPreview')}

        </Link>

      </div>

      <h1 style={{ marginTop: 0 }}>{t('scenarioEditExtra.editTitle')}</h1>

      <div style={{ maxWidth: 560, background: 'white', padding: '1.25rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

        <label style={{ display: 'block', marginBottom: 12 }}>

          {t('scenarioEditExtra.nameLabel')}

          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, padding: 8, boxSizing: 'border-box' }} />

        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>

          {t('scenarioEditExtra.scopeLabel')}

          <textarea

            value={scope}

            onChange={(e) => setScope(e.target.value)}

            rows={5}

            style={{ display: 'block', width: '100%', marginTop: 6, padding: 8, boxSizing: 'border-box', resize: 'vertical' }}

            placeholder={t('scenarioEditExtra.scopePlaceholder')}

          />

        </label>

        {error && <p style={{ color: 'var(--cap-red)', marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>

          <button

            type="button"

            onClick={save}

            disabled={saving}

            style={{ padding: '0.5rem 1rem', background: '#1565c0', color: 'white', border: 'none', borderRadius: 4 }}

          >

            {saving ? t('common.saving') : t('common.save')}

          </button>

          <button type="button" onClick={() => navigate(-1)} style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>

            {t('common.cancel')}

          </button>

        </div>

      </div>

    </div>

  );

}


