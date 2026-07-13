import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useI18n } from '../../context/I18nContext';

type Props = {
  kind: 'backup' | 'attachments';
  initialPath?: string;
  onSelect: (settingValue: string) => void;
  onClose: () => void;
};

export default function ServerStorageBrowser({ kind, initialPath, onSelect, onClose }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<{ name: string; path: string; setting_value: string }[]>([]);
  const [selectedValue, setSelectedValue] = useState('');

  const load = useCallback(
    (path?: string) => {
      setLoading(true);
      setError('');
      api.admin
        .browseStorage({ path, kind })
        .then((res) => {
          setCurrentPath(res.current_path);
          setParentPath(res.parent_path);
          setSelectedValue(res.setting_value);
          setEntries(res.entries);
        })
        .catch((e: Error) => setError(e.message || t('adminSettingsExtra.storageBrowseFailed')))
        .finally(() => setLoading(false));
    },
    [kind, t]
  );

  useEffect(() => {
    load(initialPath?.trim() || undefined);
  }, [initialPath, load]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          width: 'min(560px, 100%)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '1rem 1.1rem', borderBottom: '1px solid #eee' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{t('adminSettingsExtra.storageBrowseTitle')}</h3>
          <p style={{ margin: '0.35rem 0 0', fontSize: 13, color: '#666' }}>{t('adminSettingsExtra.storageBrowseHint')}</p>
        </div>
        <div style={{ padding: '0.75rem 1.1rem', flex: 1, overflow: 'auto' }}>
          {error && <p style={{ color: 'var(--cap-red)', fontSize: 13 }}>{error}</p>}
          {loading ? (
            <p style={{ color: '#666', fontSize: 14 }}>{t('common.loading')}</p>
          ) : (
            <>
              <p style={{ margin: '0 0 0.75rem', fontSize: 12, color: '#555', wordBreak: 'break-all' }}>
                <strong>{t('adminSettingsExtra.storageBrowseCurrent')}</strong> {currentPath}
              </p>
              {parentPath != null && (
                <button
                  type="button"
                  onClick={() => load(parentPath)}
                  style={{
                    marginBottom: 10,
                    padding: '0.35rem 0.65rem',
                    border: '1px solid #ccc',
                    borderRadius: 4,
                    background: '#fafafa',
                    cursor: 'pointer',
                  }}
                >
                  {t('adminSettingsExtra.storageBrowseUp')}
                </button>
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {entries.length === 0 ? (
                  <li style={{ fontSize: 13, color: '#888' }}>{t('adminSettingsExtra.storageBrowseEmpty')}</li>
                ) : (
                  entries.map((entry) => (
                    <li key={entry.path}>
                      <button
                        type="button"
                        onClick={() => load(entry.path)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.45rem 0.5rem',
                          marginBottom: 4,
                          border: '1px solid #e8e8e8',
                          borderRadius: 4,
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        {entry.name}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </div>
        <div style={{ padding: '0.75rem 1.1rem', borderTop: '1px solid #eee', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={!selectedValue || loading}
            onClick={() => {
              onSelect(selectedValue);
              onClose();
            }}
            style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: '#fff', border: 'none', borderRadius: 4 }}
          >
            {t('adminSettingsExtra.storageBrowseSelect')}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: '#fff', border: 'none', borderRadius: 4 }}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
