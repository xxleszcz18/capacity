import type { CSSProperties, ReactNode } from 'react';

export const adminHubListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  maxWidth: 720,
};

export const adminHubCardStyle: CSSProperties = {
  display: 'block',
  padding: '1.25rem 1.5rem',
  background: 'white',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  borderRadius: 8,
  color: 'inherit',
  textDecoration: 'none',
  border: '1px solid #eee',
};

export function AdminHubList({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...adminHubListStyle, ...style }}>{children}</div>;
}
