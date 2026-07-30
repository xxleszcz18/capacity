import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

const panelStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 8,
  padding: '1.25rem 1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  border: '1px solid #eee',
  maxWidth: 720,
};

const fileBoxStyle: React.CSSProperties = {
  ...panelStyle,
  marginBottom: '1rem',
};

type OcuStats = {
  pivot_rows: number;
  filled_ab: number;
  filled_x: number;
  filled_ac: number;
  filled_ad: number;
  filled_ae: number;
  filled_s1619: number;
  filled_s2102_large: number;
  filled_s2102_small: number;
  unmatched_sonar: number;
  unmatched_erp_in_db: number;
  unmatched_routing: number;
  routing_finished_goods: number;
};

export default function AdminOcuData() {
  const { t, te } = useI18n();
  const { hasPermission } = useAuth();
  const canGenerate = hasPermission('admin_ocu.edit');
  const [transitionFile, setTransitionFile] = useState<File | null>(null);
  const [katowiceFile, setKatowiceFile] = useState<File | null>(null);
  const [routingFile, setRoutingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<OcuStats | null>(null);

  const ready = Boolean(transitionFile && katowiceFile && routingFile);

  const onGenerate = async () => {
    setError('');
    setStats(null);
    if (!transitionFile) {
      setError(t('admin.ocuDataNeedTransition'));
      return;
    }
    if (!katowiceFile) {
      setError(t('admin.ocuDataNeedKatowice'));
      return;
    }
    if (!routingFile) {
      setError(t('admin.ocuDataNeedRouting'));
      return;
    }
    setBusy(true);
    try {
      const result = await api.admin.generateOcuData(transitionFile, katowiceFile, routingFile);
      setStats(result.stats);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setError(te(msg) || t('admin.ocuDataGenerateFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p style={{ marginBottom: '0.75rem' }}>
        <Link to="/administracja" style={{ color: 'var(--cap-green)' }}>
          ← {t('admin.title')}
        </Link>
      </p>
      <h1 style={{ marginTop: 0 }}>{t('admin.ocuData')}</h1>
      <p style={{ color: '#666', marginBottom: '1.25rem', maxWidth: 820 }}>{t('admin.ocuDataIntro')}</p>

      <div style={fileBoxStyle}>
        <strong style={{ display: 'block', marginBottom: 8 }}>{t('admin.ocuDataTransitionTitle')}</strong>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#555' }}>{t('admin.ocuDataTransitionHelp')}</p>
        <input
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setTransitionFile(e.target.files?.[0] ?? null)}
        />
        {transitionFile && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#33691e' }}>
            {transitionFile.name} ({Math.round(transitionFile.size / 1024)} KB)
          </p>
        )}
      </div>

      <div style={fileBoxStyle}>
        <strong style={{ display: 'block', marginBottom: 8 }}>{t('admin.ocuDataKatowiceTitle')}</strong>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#555' }}>{t('admin.ocuDataKatowiceHelp')}</p>
        <input
          type="file"
          accept=".xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
          onChange={(e) => setKatowiceFile(e.target.files?.[0] ?? null)}
        />
        {katowiceFile && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#33691e' }}>
            {katowiceFile.name} ({(katowiceFile.size / (1024 * 1024)).toFixed(1)} MB)
          </p>
        )}
      </div>

      <div style={fileBoxStyle}>
        <strong style={{ display: 'block', marginBottom: 8 }}>{t('admin.ocuDataRoutingTitle')}</strong>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#555' }}>{t('admin.ocuDataRoutingHelp')}</p>
        <input
          type="file"
          accept=".txt,text/plain"
          onChange={(e) => setRoutingFile(e.target.files?.[0] ?? null)}
        />
        {routingFile && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#33691e' }}>
            {routingFile.name} ({(routingFile.size / (1024 * 1024)).toFixed(1)} MB)
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: '1rem' }}>
        {canGenerate ? (
          <button
            type="button"
            disabled={busy || !ready}
            onClick={() => void onGenerate()}
            style={{
              padding: '0.55rem 1.1rem',
              background: 'var(--cap-green)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              opacity: busy || !ready ? 0.65 : 1,
              cursor: busy || !ready ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? t('admin.ocuDataGenerating') : t('admin.ocuDataGenerate')}
          </button>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: '#c62828' }}>{t('admin.ocuDataNoGeneratePermission')}</p>
        )}
      </div>

      {error && <p style={{ color: 'var(--cap-red)' }}>{error}</p>}

      {stats && (
        <div style={{ ...panelStyle, background: '#f1f8e9', borderColor: '#c5e1a5' }}>
          <strong style={{ display: 'block', marginBottom: 8 }}>{t('admin.ocuDataStatsTitle')}</strong>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: 14, color: '#37474f', lineHeight: 1.6 }}>
            <li>{t('admin.ocuDataStatsRows', { count: stats.pivot_rows })}</li>
            <li>{t('admin.ocuDataStatsAb', { count: stats.filled_ab })}</li>
            <li>{t('admin.ocuDataStatsX', { count: stats.filled_x })}</li>
            <li>{t('admin.ocuDataStatsAc', { count: stats.filled_ac })}</li>
            <li>{t('admin.ocuDataStatsAd', { count: stats.filled_ad })}</li>
            <li>{t('admin.ocuDataStatsAe', { count: stats.filled_ae })}</li>
            <li>{t('admin.ocuDataStatsS1619', { count: stats.filled_s1619 })}</li>
            <li>{t('admin.ocuDataStatsS2102Large', { count: stats.filled_s2102_large })}</li>
            <li>{t('admin.ocuDataStatsS2102Small', { count: stats.filled_s2102_small })}</li>
            <li>{t('admin.ocuDataStatsUnmatchedSonar', { count: stats.unmatched_sonar })}</li>
            <li>{t('admin.ocuDataStatsUnmatchedErp', { count: stats.unmatched_erp_in_db })}</li>
            <li>{t('admin.ocuDataStatsUnmatchedRouting', { count: stats.unmatched_routing })}</li>
            <li>{t('admin.ocuDataStatsRoutingFg', { count: stats.routing_finished_goods })}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
