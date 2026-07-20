import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useI18n } from '../context/I18nContext';
import { useScenarioMode } from '../context/ScenarioModeContext';
import {
  DEFAULT_CALL_OFF_IMPORT_PANEL,
  callOffImportPanelFromVisualSettings,
  type CallOffImportPanelColors,
} from '../utils/workspaceTheme';
import Calculator from './Calculator';

type LastImport = NonNullable<Awaited<ReturnType<typeof api.callOffs.get>>['last_import']>;

function ImportSummaryMessage({
  last,
  t,
}: {
  last: LastImport;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const params = {
    imported: last.imported,
    skipped: last.skippedOutOfRange + last.skippedInvalid,
    exact: last.matchedExact,
    truncated: last.matchedTruncated,
  };
  return (
    <p style={{ margin: '0.75rem 0 0', color: '#2e7d32' }}>
      {t('callOffs.importDoneMain', params)}
      <span style={{ color: '#e65100', fontWeight: 600 }}>
        {t('callOffs.importDoneUnmatchedPart', { unmatched: last.unmatchedSap })}
      </span>
    </p>
  );
}

function archiveButtonStyle(panel: CallOffImportPanelColors, disabled = false): CSSProperties {
  return {
    padding: '0.35rem 0.75rem',
    fontSize: 13,
    borderRadius: 6,
    border: `1px solid ${panel.panel_border}`,
    background: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? '#999' : panel.accent,
    fontWeight: 600,
    opacity: disabled ? 0.65 : 1,
  };
}

export default function CallOffView() {
  const { id } = useParams();
  const comparisonId = Number(id);
  const { t } = useI18n();
  const { setAppSection } = useScenarioMode();
  const fileRef = useRef<HTMLInputElement>(null);

  const [importing, setImporting] = useState(false);
  const [downloadingSource, setDownloadingSource] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState<LastImport | null>(null);
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof api.callOffs.get>> | null>(null);
  const [calcRefreshKey, setCalcRefreshKey] = useState(0);
  const [importPanel, setImportPanel] = useState<CallOffImportPanelColors>(DEFAULT_CALL_OFF_IMPORT_PANEL);

  useEffect(() => {
    setAppSection('calloffs');
  }, [setAppSection]);

  useEffect(() => {
    api.settings.visual
      .get()
      .then((v) => setImportPanel(callOffImportPanelFromVisualSettings(v as Record<string, unknown>)))
      .catch(() => setImportPanel(DEFAULT_CALL_OFF_IMPORT_PANEL));
  }, []);

  const loadMeta = useCallback(() => {
    if (!Number.isFinite(comparisonId) || comparisonId <= 0) return Promise.resolve();
    return api.callOffs
      .get(comparisonId)
      .then((row) => {
        setMeta(row);
        const last = row.last_import;
        if (last) {
          setImportSummary(last);
        } else {
          setImportSummary(null);
        }
      })
      .catch(() => setMeta(null));
  }, [comparisonId]);

  useEffect(() => {
    setError('');
    void loadMeta();
  }, [loadMeta, calcRefreshKey]);

  const onImport = async (file: File | undefined) => {
    if (!file || !Number.isFinite(comparisonId)) return;
    setImporting(true);
    setImportSummary(null);
    setError('');
    try {
      const r = await api.callOffs.importSalesFcst(comparisonId, file);
      setImportSummary(r);
      setCalcRefreshKey((k) => k + 1);
      await loadMeta();
    } catch (e: any) {
      setError(e.message || t('callOffs.importError'));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const downloadSource = async () => {
    if (!meta?.source_filename || !meta.source_file_available) return;
    setDownloadingSource(true);
    setError('');
    try {
      await api.callOffs.downloadSourceFile(comparisonId, meta.source_filename);
    } catch (e: any) {
      setError(e.message || t('callOffs.downloadSourceError'));
    } finally {
      setDownloadingSource(false);
    }
  };

  const downloadReport = async () => {
    if (!meta?.last_import) return;
    setDownloadingReport(true);
    setError('');
    try {
      const base = meta.source_filename?.replace(/\.[^.]+$/, '') || `calloff-${comparisonId}`;
      await api.callOffs.downloadUnmatchedReport(comparisonId, `${base}-unmatched.csv`);
    } catch (e: any) {
      setError(e.message || t('callOffs.downloadReportError'));
    } finally {
      setDownloadingReport(false);
    }
  };

  const hasLastImport = Boolean(meta?.last_import);
  const isArchived = Boolean(meta?.archived_at?.trim());
  const sourceFileAvailable = Boolean(meta?.source_file_available && meta?.source_filename);
  const reportAvailable = Boolean(meta?.unmatched_report_available && meta?.last_import);

  if (!Number.isFinite(comparisonId) || comparisonId <= 0) {
    return <p>{t('callOffs.invalidId')}</p>;
  }

  return (
    <div>
      <p style={{ marginTop: 0 }}>
        <Link to="/call-offs">{t('callOffs.backToList')}</Link>
      </p>

      <section
        style={{
          marginBottom: '1.25rem',
          padding: '1rem',
          background: importPanel.panel_bg,
          borderRadius: 8,
          border: `1px solid ${importPanel.panel_border}`,
        }}
      >
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: importPanel.accent }}>{t('callOffs.importSection')}</h2>
        {meta?.notes?.trim() && (
          <p style={{ margin: '0 0 0.75rem', fontSize: 14, color: '#555', whiteSpace: 'pre-wrap' }}>
            <strong style={{ color: importPanel.accent }}>{t('callOffs.notes')}:</strong> {meta.notes.trim()}
          </p>
        )}
        {meta && (
          <p style={{ margin: '0 0 0.75rem', fontSize: 14, color: '#555' }}>
            {t('callOffs.dateRangeLabel', { from: meta.date_from, to: meta.date_to })}
          </p>
        )}
        {isArchived && (
          <p style={{ margin: '0 0 0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.55)', borderRadius: 6, color: '#6d4c41', fontSize: 14 }}>
            {t('callOffs.archivedReadOnly')}
          </p>
        )}
        <p style={{ margin: '0 0 0.75rem', fontSize: 14, color: '#555' }}>{t('callOffs.importHint')}</p>

        {hasLastImport && (
          <div
            style={{
              marginBottom: 14,
              padding: '0.75rem',
              background: 'rgba(255,255,255,0.55)',
              borderRadius: 6,
              border: `1px solid ${importPanel.panel_border}`,
            }}
          >
            <strong style={{ display: 'block', marginBottom: 10, fontSize: 14, color: importPanel.accent }}>
              {t('callOffs.importArchiveTitle')}
            </strong>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>
                <strong>{t('callOffs.uploadedFileLabel')}</strong> {meta?.source_filename || '—'}
              </span>
              <button
                type="button"
                onClick={() => void downloadSource()}
                disabled={!sourceFileAvailable || downloadingSource}
                style={archiveButtonStyle(importPanel, !sourceFileAvailable || downloadingSource)}
              >
                {downloadingSource ? t('common.loading') : t('callOffs.downloadSourceFile')}
              </button>
              {!sourceFileAvailable && meta?.source_filename && (
                <span style={{ fontSize: 12, color: '#888' }}>{t('callOffs.sourceFileUnavailable')}</span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 14 }}>
                <strong>{t('callOffs.unmatchedReportTitle')}</strong>
              </span>
              <button
                type="button"
                onClick={() => void downloadReport()}
                disabled={!reportAvailable || downloadingReport}
                style={archiveButtonStyle(importPanel, !reportAvailable || downloadingReport)}
              >
                {downloadingReport ? t('common.loading') : t('callOffs.downloadUnmatchedReport')}
              </button>
            </div>
          </div>
        )}

        <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>{t('callOffs.replaceImportLabel')}</label>
        <input
          ref={fileRef}
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={importing || isArchived}
          onChange={(e) => void onImport(e.target.files?.[0])}
        />
        {importing && <span style={{ marginLeft: 12 }}>{t('common.loading')}</span>}
        {importSummary && <ImportSummaryMessage last={importSummary} t={t} />}
        {error && <p style={{ margin: '0.75rem 0 0', color: '#c62828' }}>{error}</p>}
      </section>

      <Calculator key={calcRefreshKey} callOffComparisonId={comparisonId} />
    </div>
  );
}
