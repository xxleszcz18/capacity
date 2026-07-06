import { useEffect, useState } from 'react';

import { Link } from 'react-router-dom';

import { api } from '../api/client';

import { useI18n } from '../context/I18nContext';



type Row = {

  id: number;

  name: string;

  scenario_scope?: string;

  source_scenario_id?: number | null;

  source_scenario_name?: string | null;

  updated_at?: string | null;

};



export default function ScenarioDeployOverview() {

  const { t, te } = useI18n();

  const [list, setList] = useState<Row[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);



  useEffect(() => {

    setLoading(true);

    api.scenarios

      .list({ archived: false })

      .then(setList)

      .catch((e: any) => setError(te(e?.message) || t('scenarioDeployExtra.scenariosLoadFailed')))

      .finally(() => setLoading(false));

  }, [t, te]);



  return (

    <div>

      <div style={{ marginBottom: '1rem' }}>

        <Link to="/scenariusze" style={{ color: 'var(--cap-green)' }}>

          {t('scenarioDeployExtra.overviewBack')}

        </Link>

      </div>

      <h1 style={{ marginTop: 0 }}>{t('scenarioDeployExtra.overviewTitle')}</h1>

      <p style={{ color: '#37474f', maxWidth: 900, lineHeight: 1.55 }}>

        {t('scenarioDeployExtra.overviewIntro')}

      </p>

      {loading && <p>{t('common.loading')}</p>}

      {error && <p style={{ color: 'var(--cap-red)' }}>{error}</p>}

      {!loading && !error && list.length === 0 && <p style={{ color: '#666' }}>{t('scenarioDeployExtra.noActiveScenarios')}</p>}

      <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0' }}>

        {list.map((s) => (

          <li

            key={s.id}

            style={{

              marginBottom: 12,

              padding: '0.85rem 1rem',

              background: '#fff',

              borderRadius: 8,

              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',

              border: '1px solid #e3f2fd',

            }}

          >

            <Link

              to={`/scenariusze/${s.id}/wdrozenie`}

              style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0d47a1', textDecoration: 'none' }}

            >

              {s.name}

            </Link>

            <span style={{ color: '#888', marginLeft: 8, fontSize: 13 }}>#{s.id}</span>

            {s.source_scenario_id != null && s.source_scenario_id > 0 && (

              <div style={{ fontSize: 13, color: '#555', marginTop: 6 }}>

                {t('scenarioDeployExtra.sourcePointLabel')}{' '}

                {s.source_scenario_name ? t('scenarioDeployExtra.sourceScenarioName', { name: s.source_scenario_name }) : t('scenarioViewExtra.sourceScenario', { id: s.source_scenario_id })}

              </div>

            )}

            {s.source_scenario_id == null && (

              <div style={{ fontSize: 13, color: '#555', marginTop: 6 }}>{t('scenarioDeployExtra.sourceProduction')}</div>

            )}

            {s.scenario_scope != null && String(s.scenario_scope).trim() !== '' && (

              <div style={{ fontSize: 13, color: '#666', marginTop: 4, maxHeight: 56, overflow: 'hidden' }}>

                {t('scenarioDeployExtra.scopeLabel')} {String(s.scenario_scope).trim().length > 160 ? `${String(s.scenario_scope).trim().slice(0, 160)}…` : String(s.scenario_scope).trim()}

              </div>

            )}

          </li>

        ))}

      </ul>

    </div>

  );

}


