import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export default function Layout({ children }: { children: ReactNode }) {
  const nav: { to: string; label: string; end?: boolean }[] = [
    { to: '/kalkulator', label: 'Kalkulator' },
    { to: '/maszyny', label: 'Maszyny' },
    { to: '/projekty', label: 'Projekty' },
    { to: '/scenariusze', label: 'Scenariusze' },
    { to: '/ustawienia', label: 'Ustawienia', end: true },
    { to: '/ustawienia/fazy-procesu', label: 'Fazy procesu' },
    { to: '/ustawienia/detale', label: 'Detale' },
  ];
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: '#fff',
          color: '#333',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
          borderBottom: '2px solid var(--cap-green)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--cap-green)' }}>Capacity</span>
        <nav style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {nav.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                padding: '0.5rem 0.75rem',
                color: isActive ? '#fff' : 'var(--cap-green)',
                textDecoration: 'none',
                borderRadius: 4,
                background: isActive ? 'var(--cap-green)' : 'transparent',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto' }}>
          <img src="/logo-autoneum.png" alt="Autoneum" style={{ height: 32, display: 'block' }} />
        </div>
      </header>
      <main style={{ flex: 1, padding: '1.5rem' }}>{children}</main>
    </div>
  );
}
