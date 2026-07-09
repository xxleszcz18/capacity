import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

function UserIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill={color} aria-hidden>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

export default function UserMenu({
  accentColor = 'var(--cap-green)',
  scenarioChrome = false,
}: {
  accentColor?: string;
  scenarioChrome?: boolean;
}) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const iconColor = scenarioChrome ? '#0d47a1' : accentColor;
  const textColor = scenarioChrome ? '#0d47a1' : '#333';
  const linkColor = scenarioChrome ? '#1565c0' : accentColor;

  const menuItemStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 13,
    color: textColor,
    textDecoration: 'none',
    borderRadius: 4,
    boxSizing: 'border-box',
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        aria-label={t('auth.userMenuAria')}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.display_name || user.login}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 32,
          padding: 3,
          border: `2px solid ${accentColor}`,
          borderRadius: 8,
          background: open ? '#f0f4f8' : '#fff',
          cursor: 'pointer',
          lineHeight: 0,
        }}
      >
        <UserIcon color={iconColor} />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: 200,
            padding: '6px 0',
            background: '#fff',
            border: '1px solid #ddd',
            borderRadius: 8,
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            zIndex: 200,
          }}
        >
          <div
            style={{
              padding: '8px 12px 10px',
              fontWeight: 600,
              fontSize: 13,
              color: textColor,
              borderBottom: '1px solid #eee',
              marginBottom: 4,
            }}
            title={user.login}
          >
            {user.display_name || user.login}
          </div>
          {user.is_guest !== 1 && (
          <Link
            to="/zmiana-hasla"
            role="menuitem"
            onClick={() => setOpen(false)}
            style={{ ...menuItemStyle, color: linkColor }}
          >
            {t('auth.changePasswordMenu')}
          </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void logout().then(() => navigate('/login'));
            }}
            style={{ ...menuItemStyle, color: linkColor }}
          >
            {t('auth.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
