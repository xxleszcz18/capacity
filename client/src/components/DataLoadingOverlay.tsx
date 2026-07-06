import { useI18n } from '../context/I18nContext';

type Props = {
  active: boolean;
  label?: string;
  children: React.ReactNode;
  className?: string;
};

export function DataLoadingBadge({ active, label }: { active: boolean; label?: string }) {
  const { t } = useI18n();
  if (!active) return null;
  return (
    <span className="data-loading-badge" role="status" aria-live="polite">
      <span className="data-loading-spinner" aria-hidden="true" />
      {label ?? t('common.recalculating')}
    </span>
  );
}

export default function DataLoadingOverlay({ active, label, children, className }: Props) {
  const { t } = useI18n();
  const msg = label ?? t('common.recalculating');
  return (
    <div
      className={[
        'data-loading-host',
        active ? 'data-loading-host--active' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
      {active && (
        <div className="data-loading-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="data-loading-overlay-panel">
            <span className="data-loading-spinner" aria-hidden="true" />
            <span className="data-loading-overlay-label">{msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}
