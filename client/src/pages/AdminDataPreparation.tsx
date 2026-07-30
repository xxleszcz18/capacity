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
  maxWidth: 820,
};

const fileBoxStyle: React.CSSProperties = {
  ...panelStyle,
  marginBottom: '1rem',
};

type PrepStats = {
  routing_materials_with_desc: number;
  routing_materials_with_components: number;
  transition_mappings: number;
  input_data_rows: number;
  a_filled_1: number;
  a_filled_2: number;
  a_filled_total: number;
  a_ambiguous: number;
  a_skipped: number;
  a_no_match: number;
  a_no_erp: number;
  b_filled: number;
  b_ambiguous: number;
  b_skipped: number;
  b_no_match: number;
  b_no_erp: number;
  verify_agree: number;
  verify_disagree: number;
  verify_no_match: number;
};

export default function AdminDataPreparation() {
  const { t, te } = useI18n();
  const { hasPermission } = useAuth();
  const canRun = hasPermission('admin_data_preparation.edit');
  const [katowiceFile, setKatowiceFile] = useState<File | null>(null);
  const [routingFile, setRoutingFile] = useState<File | null>(null);
  const [transitionFile, setTransitionFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<PrepStats | null>(null);

  const ready = Boolean(katowiceFile && routingFile && transitionFile);

  const onRun = async () => {
    setError('');
    setStats(null);
    if (!katowiceFile) {
      setError(t('admin.dataPrepNeedKatowice'));
      return;
    }
    if (!routingFile) {
      setError(t('admin.dataPrepNeedRouting'));
      return;
    }
    if (!transitionFile) {
      setError(t('admin.dataPrepNeedTransition'));
      return;
    }
    setBusy(true);
    try {
      const result = await api.admin.generateDataPreparation(katowiceFile, routingFile, transitionFile);
      setStats(result.stats as PrepStats);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setError(te(msg) || t('admin.dataPrepFailed'));
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
      <h1 style={{ marginTop: 0 }}>{t('admin.dataPrep')}</h1>
      <p style={{ color: '#666', marginBottom: '1.25rem', maxWidth: 860 }}>{t('admin.dataPrepIntro')}</p>

      <div style={fileBoxStyle}>
        <strong style={{ display: 'block', marginBottom: 8 }}>{t('admin.dataPrepKatowiceTitle')}</strong>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#555' }}>{t('admin.dataPrepKatowiceHelp')}</p>
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
        <strong style={{ display: 'block', marginBottom: 8 }}>{t('admin.dataPrepRoutingTitle')}</strong>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#555' }}>{t('admin.dataPrepRoutingHelp')}</p>
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

      <div style={fileBoxStyle}>
        <strong style={{ display: 'block', marginBottom: 8 }}>{t('admin.dataPrepTransitionTitle')}</strong>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#555' }}>{t('admin.dataPrepTransitionHelp')}</p>
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

      <div style={{ ...panelStyle, marginBottom: '1rem' }}>
        {canRun ? (
          <button
            type="button"
            disabled={!ready || busy}
            onClick={() => void onRun()}
            style={{
              background: 'var(--cap-green)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              cursor: !ready || busy ? 'not-allowed' : 'pointer',
              opacity: !ready || busy ? 0.6 : 1,
            }}
          >
            {busy ? t('admin.dataPrepRunning') : t('admin.dataPrepRun')}
          </button>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: '#c62828' }}>{t('admin.dataPrepNoPermission')}</p>
        )}
        {busy && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: '#555' }}>{t('admin.dataPrepProgressHint')}</p>
        )}
        {error && <p style={{ margin: '12px 0 0', color: '#c62828' }}>{error}</p>}
      </div>

      {stats && (
        <div style={panelStyle}>
          <strong style={{ display: 'block', marginBottom: 8 }}>{t('admin.dataPrepStatsTitle')}</strong>
          <p style={{ fontSize: 13, color: '#555', marginTop: 0 }}>{t('admin.dataPrepStatsRouting', {
            desc: stats.routing_materials_with_desc,
            comps: stats.routing_materials_with_components,
          })}</p>

          <h3 style={{ fontSize: 15, marginBottom: 6 }}>{t('admin.dataPrepStatsTaskA')}</h3>
          <ul style={{ margin: '0 0 1rem', paddingLeft: 18, fontSize: 14, lineHeight: 1.55 }}>
            <li>{t('admin.dataPrepStatsAFilled1', { count: stats.a_filled_1 })}</li>
            <li>{t('admin.dataPrepStatsAFilled2', { count: stats.a_filled_2 })}</li>
            <li>{t('admin.dataPrepStatsATotal', { count: stats.a_filled_total })}</li>
            <li>{t('admin.dataPrepStatsAAmbiguous', { count: stats.a_ambiguous })}</li>
            <li>{t('admin.dataPrepStatsASkipped', { count: stats.a_skipped })}</li>
            <li>{t('admin.dataPrepStatsANoMatch', { count: stats.a_no_match })}</li>
            <li>{t('admin.dataPrepStatsANoErp', { count: stats.a_no_erp })}</li>
          </ul>

          <h3 style={{ fontSize: 15, marginBottom: 6 }}>{t('admin.dataPrepStatsTaskB')}</h3>
          <ul style={{ margin: '0 0 1rem', paddingLeft: 18, fontSize: 14, lineHeight: 1.55 }}>
            <li>{t('admin.dataPrepStatsBFilled', { count: stats.b_filled })}</li>
            <li>{t('admin.dataPrepStatsBSkipped', { count: stats.b_skipped })}</li>
            <li>{t('admin.dataPrepStatsBNoMatch', { count: stats.b_no_match })}</li>
            <li>{t('admin.dataPrepStatsBNoErp', { count: stats.b_no_erp })}</li>
          </ul>
          <p style={{ fontSize: 13, color: '#6d4c41', background: '#fff8e1', padding: '8px 10px', borderRadius: 6 }}>
            {t('admin.dataPrepStatsBNote')}
          </p>

          <h3 style={{ fontSize: 15, marginBottom: 6 }}>{t('admin.dataPrepStatsVerify')}</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.55 }}>
            <li>{t('admin.dataPrepStatsVerifyAgree', { count: stats.verify_agree })}</li>
            <li>{t('admin.dataPrepStatsVerifyDisagree', { count: stats.verify_disagree })}</li>
          </ul>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 0 }}>{t('admin.dataPrepZipHint')}</p>
        </div>
      )}
    </div>
  );
}
