import type { CSSProperties, ReactNode } from 'react';
import { SORTABLE_TH_BASE, sortIndicator, type SortDirection } from '../utils/tableSort';

type Props = {
  label: ReactNode;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  title?: string;
  style?: CSSProperties;
  className?: string;
};

export default function SortableTh({ label, active, direction, onClick, title, style, className }: Props) {
  return (
    <th
      className={className}
      style={{ ...SORTABLE_TH_BASE, ...style }}
      onClick={onClick}
      title={title ?? 'Kliknij, aby zmienić sortowanie'}
    >
      {label}
      {sortIndicator(active, direction)}
    </th>
  );
}
