import { useMemo } from 'react';
import { useI18n } from '../context/I18nContext';
import type { ProjectStatusFilterValue } from '../components/StatusMultiFilter';

export function useStatusLabels() {
  const { t } = useI18n();
  return useMemo(
    () => ({
      label: (status: ProjectStatusFilterValue) => {
        if (status === 'active') return t('common.active');
        if (status === 'inactive') return t('common.inactive');
        return t('common.rfq');
      },
      allStatuses: t('common.allStatuses'),
      clearFilter: t('common.clearStatusFilter'),
    }),
    [t]
  );
}
