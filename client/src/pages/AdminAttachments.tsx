import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import SortableTh from '../components/SortableTh';
import { useI18n } from '../context/I18nContext';
import { sortRows, useTableSort } from '../utils/tableSort';

type AdminAttachmentRow = {
  id: number;
  project_id: number;
  project_client: string;
  project_name: string;
  description: string;
  original_filename: string;
  stored_filename: string;
  mime_type: string | null;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by: string | null;
  is_shared: number;
  relative_dir: string;
  absolute_path: string | null;
  file_exists: boolean | null;
};

function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type SortCol = 'date' | 'project' | 'file' | 'location' | 'size' | 'author' | 'status';

export default function AdminAttachments() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AdminAttachmentRow[]>([]);
  const [storageConfigured, setStorageConfigured] = useState(false);
  const [storageRoot, setStorageRoot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const { sortCol, sortDir, toggle } = useTableSort<SortCol>('date', 'desc');

  const load = () => {
    setLoading(true);
    setError(null);
    api.admin
      .listAttachments()
      .then((data) => {
        setRows(data.attachments ?? []);
        setStorageConfigured(!!data.storage_configured);
        setStorageRoot(data.storage_root ?? null);
      })
      .catch((e: any) => {
        setRows([]);
        setError(e?.message || t('admin.attachmentsLoadError'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.project_client,
        r.project_name,
        r.original_filename,
        r.stored_filename,
        r.description,
        r.uploaded_by,
        r.relative_dir,
        r.absolute_path,
        String(r.project_id),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, text]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sortCol, sortDir, (r, col) => {
        switch (col) {
          case 'date':
            return String(r.uploaded_at ?? '');
          case 'project':
            return `${r.project_client} / ${r.project_name}`;
          case 'file':
            return r.original_filename ?? '';
          case 'location':
            return r.absolute_path || r.relative_dir || '';
          case 'size':
            return Number(r.size_bytes) || 0;
          case 'author':
            return r.uploaded_by ?? '';
          case 'status':
            if (r.file_exists === true) return 2;
            if (r.file_exists === false) return 0;
            return 1;
          default:
            return '';
        }
      }),
    [filtered, sortCol, sortDir]
  );

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/administracja" style={{ color: 'var(--cap-green)' }}>
          {t('admin.backAdmin')}
        </Link>
      </div>
      <h1 style={{ marginTop: 0 }}>{t('admin.attachments')}</h1>
      <p style={{ color: '#666', marginBottom: '1rem', maxWidth: 820 }}>{t('admin.attachmentsIntro')}</p>

      {storageRoot ? (
        <p style={{ margin: '0 0 1rem', fontSize: 13, color: '#555' }}>
          <strong>{t('admin.attachmentsStorageRoot')}:</strong>{' '}
          <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{storageRoot}</code>
        </p>
      ) : (
        <p style={{ margin: '0 0 1rem', fontSize: 13, color: '#c62828' }}>
          {t('admin.attachmentsStorageMissing')}{' '}
          <Link to="/administracja/ustawienia-administracyjne" style={{ color: 'var(--cap-green)' }}>
            {t('admin.adminSettings')}
          </Link>
          .
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('admin.attachmentsSearchPlaceholder')}
          style={{ padding: '0.5rem 0.75rem', minWidth: 280, flex: '1 1 240px' }}
        />
        <button
          type="button"
          onClick={load}
          style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: '#fff', border: 'none', borderRadius: 4 }}
        >
          {t('admin.attachmentsRefresh')}
        </button>
        <span style={{ fontSize: 13, color: '#666' }}>
          {t('admin.attachmentsCount', { count: sorted.length, total: rows.length })}
        </span>
      </div>

      {error && <p style={{ color: '#c62828' }}>{error}</p>}
      {loading ? (
        <p>{t('common.loading')}</p>
      ) : sorted.length === 0 ? (
        <p style={{ color: '#666' }}>{storageConfigured ? t('admin.attachmentsEmpty') : t('admin.attachmentsEmptyNoStorage')}</p>
      ) : (
        <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                <SortableTh label={t('admin.attachmentsColDate')} active={sortCol === 'date'} direction={sortDir} onClick={() => toggle('date')} />
                <SortableTh label={t('admin.attachmentsColProject')} active={sortCol === 'project'} direction={sortDir} onClick={() => toggle('project')} />
                <SortableTh label={t('admin.attachmentsColFile')} active={sortCol === 'file'} direction={sortDir} onClick={() => toggle('file')} />
                <SortableTh label={t('admin.attachmentsColLocation')} active={sortCol === 'location'} direction={sortDir} onClick={() => toggle('location')} />
                <SortableTh label={t('admin.attachmentsColSize')} active={sortCol === 'size'} direction={sortDir} onClick={() => toggle('size')} />
                <SortableTh label={t('admin.attachmentsColAuthor')} active={sortCol === 'author'} direction={sortDir} onClick={() => toggle('author')} />
                <SortableTh label={t('admin.attachmentsColStatus')} active={sortCol === 'status'} direction={sortDir} onClick={() => toggle('status')} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {r.uploaded_at ? new Date(r.uploaded_at).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', verticalAlign: 'top' }}>
                    <Link to={`/projekty/${r.project_id}`} style={{ color: 'var(--cap-green)' }}>
                      {r.project_client || r.project_name
                        ? `${r.project_client}${r.project_client && r.project_name ? ' · ' : ''}${r.project_name}`
                        : `#${r.project_id}`}
                    </Link>
                    {r.is_shared ? (
                      <div style={{ marginTop: 4, fontSize: 11, color: '#1565c0', fontWeight: 600 }}>{t('admin.attachmentsSharedBadge')}</div>
                    ) : null}
                    {r.description ? <div style={{ marginTop: 4, color: '#666', fontSize: 12 }}>{r.description}</div> : null}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 600 }}>{r.original_filename}</div>
                    <div style={{ fontSize: 11, color: '#888', wordBreak: 'break-all' }}>{r.stored_filename}</div>
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', verticalAlign: 'top', maxWidth: 360 }}>
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
                      <code>{r.relative_dir}/</code>
                    </div>
                    {r.absolute_path ? (
                      <code style={{ fontSize: 11, wordBreak: 'break-all', color: '#333' }}>{r.absolute_path}</code>
                    ) : (
                      <span style={{ color: '#999' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {formatAttachmentSize(Number(r.size_bytes))}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', verticalAlign: 'top' }}>{r.uploaded_by || '—'}</td>
                  <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {r.file_exists === true ? (
                      <span style={{ color: '#2e7d32', fontWeight: 600 }}>{t('admin.attachmentsStatusOk')}</span>
                    ) : r.file_exists === false ? (
                      <span style={{ color: '#c62828', fontWeight: 600 }}>{t('admin.attachmentsStatusMissing')}</span>
                    ) : (
                      <span style={{ color: '#999' }}>{t('admin.attachmentsStatusUnknown')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
