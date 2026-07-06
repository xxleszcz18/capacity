import type { MachineStatusKey } from '../utils/machineStatusStyle';
import { useI18n } from '../context/I18nContext';

export type ActiveProjectRow = { id: number; client: string; name: string };

type Props = {
  open: boolean;
  machineId: number;
  /** np. `?scenarioId=3` — doklejane do linków wewnętrznych */
  navigationSearch: string;
  projects: ActiveProjectRow[];
  targetStatus: Extract<MachineStatusKey, 'inactive' | 'RFQ'>;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function MachineStatusActiveProjectsModal({
  open,
  machineId,
  navigationSearch,
  projects,
  targetStatus,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  if (!open) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const suffix = navigationSearch && navigationSearch.startsWith('?') ? navigationSearch : navigationSearch ? `?${navigationSearch}` : '';
  const machineUrl = `${origin}/maszyny/${machineId}${suffix}`;
  const targetLabel = targetStatus === 'RFQ' ? 'RFQ' : t('modals.machineStatusGuard.inactive');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="machine-status-guard-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 6000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.45)',
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'linear-gradient(180deg, #ffe0b2 0%, #fff3e0 28%, #fff8e1 100%)',
          border: '3px solid #ff9800',
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          padding: '1.35rem 1.5rem',
        }}
      >
        <h2 id="machine-status-guard-title" style={{ marginTop: 0, marginBottom: 12, color: '#e65100', fontSize: '1.25rem' }}>
          {t('modals.machineStatusGuard.title')}
        </h2>
        <p style={{ margin: '0 0 12px', color: '#4e342e', lineHeight: 1.5 }}>
          {t('modals.machineStatusGuard.body', { status: targetLabel })}
        </p>
        <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#bf360c' }}>{t('modals.machineStatusGuard.machinePage')}</p>
        <p style={{ margin: '0 0 16px', wordBreak: 'break-all' }}>
          <a href={machineUrl} style={{ color: '#1565c0', fontWeight: 500 }}>
            {machineUrl}
          </a>
        </p>
        <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#bf360c' }}>{t('modals.machineStatusGuard.activeProjects')}</p>
        {projects.length === 0 ? (
          <p style={{ margin: '0 0 1.25rem', color: '#6d4c41', fontSize: 14 }}>
            {t('modals.machineStatusGuard.noProjectList')}
          </p>
        ) : (
          <ul style={{ margin: '0 0 1.25rem', paddingLeft: '1.25rem', color: '#4e342e' }}>
            {projects.map((p) => {
              const href = `${origin}/projekty/${p.id}${suffix}`;
              return (
                <li key={p.id} style={{ marginBottom: 8 }}>
                  <a href={href} style={{ color: '#1565c0', fontWeight: 500 }}>
                    {href}
                  </a>
                  <span style={{ display: 'block', fontSize: 13, color: '#6d4c41', marginTop: 2 }}>
                    {p.client} — {p.name}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '0.5rem 1rem',
              background: '#9e9e9e',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1rem',
              background: '#e65100',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {t('modals.machineStatusGuard.confirmStatus')}
          </button>
        </div>
      </div>
    </div>
  );
}
