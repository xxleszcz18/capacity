import type { CSSProperties, ReactNode } from 'react';

export const adminTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: 'white',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

export const adminThStyle: CSSProperties = { padding: '0.75rem', textAlign: 'left' };

export const adminTdStyle: CSSProperties = { padding: '0.75rem' };

export const adminFilterRowStyle: CSSProperties = { background: '#fafafa' };

export const adminFilterInputStyle: CSSProperties = { width: '100%', padding: 4, fontSize: 12 };

export const adminInputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: '0.5rem',
  border: '1px solid #bdbdbd',
  borderRadius: 4,
  boxSizing: 'border-box',
};

export const adminBtnPrimary: CSSProperties = {
  padding: '0.5rem 1rem',
  background: 'var(--cap-green)',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
};

export const adminBtnEdit: CSSProperties = {
  padding: '0.25rem 0.5rem',
  background: '#2196f3',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
};

export const adminBtnDanger: CSSProperties = {
  padding: '0.25rem 0.5rem',
  background: '#c62828',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
};

export const adminBtnSecondary: CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#9e9e9e',
  color: 'white',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
};

export const adminBtnNeutral: CSSProperties = {
  padding: '0.5rem 1rem',
  background: 'white',
  color: '#333',
  border: '1px solid #bdbdbd',
  borderRadius: 4,
  cursor: 'pointer',
};

export const adminStatusActive: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 12,
  background: '#e8f5e9',
  color: '#2e7d32',
};

export const adminStatusInactive: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 12,
  background: '#f5f5f5',
  color: '#616161',
};

export const adminBadgeSystem: CSSProperties = {
  display: 'inline-block',
  marginLeft: 6,
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 11,
  background: '#f5f5f5',
  color: '#666',
};

export const adminBadgeGuest: CSSProperties = {
  display: 'inline-block',
  marginLeft: 6,
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 11,
  background: '#e3f2fd',
  color: '#1565c0',
};

export function AdminModal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 320,
          maxWidth: wide ? 'min(1040px, 96vw)' : 'min(480px, 96vw)',
          width: wide ? '96vw' : undefined,
          maxHeight: '92vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
