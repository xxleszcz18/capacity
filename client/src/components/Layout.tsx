import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { AppSection } from '../context/ScenarioModeContext';
import { scenarioNavQuery, useScenarioMode } from '../context/ScenarioModeContext';
import { useContractVolumes } from '../context/ContractVolumesContext';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { useOcuMode } from '../context/OcuModeContext';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';

async function pickLatestScenario(): Promise<{ id: number; name: string } | null> {
  const list = await api.scenarios.list({ archived: false });
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => {
    const ta = new Date(a.updated_at || a.created_at || 0).getTime();
    const tb = new Date(b.updated_at || b.created_at || 0).getTime();
    return tb - ta;
  });
  const pick = sorted[0];
  return pick ? { id: pick.id, name: pick.name } : null;
}

function MainNavLink({
  path,
  label,
  end,
  appSection,
  activeScenarioId,
  setActiveScenario,
  navigate,
  scenarioChrome,
}: {
  path: string;
  label: string;
  end?: boolean;
  appSection: AppSection;
  activeScenarioId: number | null;
  setActiveScenario: (id: number, name: string) => void;
  navigate: ReturnType<typeof useNavigate>;
  scenarioChrome: boolean;
}) {
  const needsScenarioPick =
    appSection === 'scenarios' && path !== '/scenariusze' && (activeScenarioId == null || activeScenarioId <= 0);
  const to =
    appSection === 'capacity'
      ? path
      : path === '/scenariusze'
        ? path
        : activeScenarioId != null && activeScenarioId > 0
          ? `${path}?scenarioId=${activeScenarioId}`
          : path;

  return (
    <NavLink
      to={to}
      end={end}
      onClick={async (e) => {
        if (!needsScenarioPick) return;
        e.preventDefault();
        const pick = await pickLatestScenario();
        if (!pick) {
          navigate('/scenariusze');
          return;
        }
        setActiveScenario(pick.id, pick.name);
        navigate(`${path}?scenarioId=${pick.id}`);
      }}
      style={({ isActive }) => ({
        padding: '0.5rem 0.75rem',
        color: isActive ? '#fff' : scenarioChrome ? '#0d47a1' : 'var(--cap-green)',
        textDecoration: 'none',
        borderRadius: 4,
        background: isActive ? (scenarioChrome ? '#1565c0' : 'var(--cap-green)') : 'transparent',
      })}
    >
      {label}
    </NavLink>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeScenarioId, activeScenarioName, setActiveScenario, clearActiveScenario, setAppSection, appSection } =
    useScenarioMode();
  const { useContractualVolumes, setUseContractualVolumes } = useContractVolumes();
  const { t } = useI18n();
  const { hasPermission, hasAnyPermission } = useAuth();
  const { ocuFeatureEnabled, calculationProfile, toggleCalculationProfile } = useOcuMode();
  const [contractualFrameColor, setContractualFrameColor] = useState('#ff9800');

  useEffect(() => {
    api.settings.visual
      .get()
      .then((v: { contractual_calculator_frame_color?: string }) => {
        const c = v?.contractual_calculator_frame_color;
        if (typeof c === 'string' && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(c.trim())) setContractualFrameColor(c.trim());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeScenarioId == null || activeScenarioId <= 0 || activeScenarioName) return;
    api.scenarios
      .get(activeScenarioId)
      .then((s) => setActiveScenario(s.id, s.name))
      .catch(() => {});
  }, [activeScenarioId, activeScenarioName, setActiveScenario]);

  /** Link z ?scenarioId= do Administracji w trybie Capacity (np. powrót z podstron). */
  const adminQuery = scenarioNavQuery(activeScenarioId);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const sid = Number(sp.get('scenarioId'));
    if (Number.isFinite(sid) && sid > 0) {
      setAppSection('scenarios');
    }
  }, [location.search, setAppSection]);

  useEffect(() => {
    if (appSection !== 'scenarios') return;
    if (location.pathname === '/scenariusze' || location.pathname.startsWith('/scenariusze/')) return;
    const sp = new URLSearchParams(location.search);
    const urlSid = Number(sp.get('scenarioId'));
    if (Number.isFinite(urlSid) && urlSid > 0) return;
    if (activeScenarioId != null && activeScenarioId > 0) {
      sp.set('scenarioId', String(activeScenarioId));
      navigate({ pathname: location.pathname, search: sp.toString() }, { replace: true });
    }
  }, [appSection, activeScenarioId, location.pathname, location.search, navigate]);

  /** W obszarze scenariuszy dostępne są tylko kalkulator, historia i lista scenariuszy — inne ścieżki przekieruj. */
  useEffect(() => {
    if (appSection !== 'scenarios') return;
    const p = location.pathname;
    const allowed =
      p === '/kalkulator' ||
      p === '/administracja' ||
      p === '/administracja/historia-zmian' ||
      p === '/historia-zmian' ||
      p === '/scenariusze' ||
      p.startsWith('/scenariusze/');
    if (allowed) return;
    const sp = new URLSearchParams();
    if (activeScenarioId != null && activeScenarioId > 0) sp.set('scenarioId', String(activeScenarioId));
    const q = sp.toString();
    navigate(`/kalkulator${q ? `?${q}` : ''}`, { replace: true });
  }, [appSection, location.pathname, activeScenarioId, navigate]);

  const scenarioMode = activeScenarioId != null && activeScenarioId > 0;
  const scenarioChrome = appSection === 'scenarios';
  const headerAccent = scenarioChrome ? '#1565c0' : 'var(--cap-green)';

  const switchSection = useCallback(
    async (next: AppSection) => {
      if (next === appSection) return;
      setAppSection(next);
      if (next === 'scenarios') {
        let sid = activeScenarioId;
        if (sid == null || sid <= 0) {
          const pick = await pickLatestScenario();
          if (pick) {
            setActiveScenario(pick.id, pick.name);
            sid = pick.id;
          }
        }
        if (sid != null && sid > 0) {
          const sp = new URLSearchParams(location.search);
          sp.set('scenarioId', String(sid));
          navigate({ pathname: location.pathname, search: sp.toString() }, { replace: true });
        }
      } else {
        clearActiveScenario();
        const path = location.pathname;
        const scenarioOnlyRoute = path === '/scenariusze' || path.startsWith('/scenariusze/');
        if (scenarioOnlyRoute) {
          navigate('/kalkulator', { replace: true });
        } else {
          navigate({ pathname: location.pathname, search: '' }, { replace: true });
        }
      }
    },
    [
      appSection,
      setAppSection,
      activeScenarioId,
      setActiveScenario,
      clearActiveScenario,
      navigate,
      location.pathname,
      location.search,
    ]
  );

  const capacityMainNav: { path: string; labelKey: string; end?: boolean; permission: string }[] = [
    { path: '/kalkulator', labelKey: 'layout.calculator', end: true, permission: 'calculator.view' },
    { path: '/maszyny', labelKey: 'layout.machines', permission: 'machines.view' },
    { path: '/projekty', labelKey: 'layout.projects', permission: 'projects.view' },
    { path: '/detale', labelKey: 'layout.details', permission: 'designations.view' },
    { path: '/wizualizacja-danych', labelKey: 'layout.dataVisualization', permission: 'admin_data_viz.view' },
  ];

  const scenarioMainNav: { path: string; labelKey: string; end?: boolean; permission: string }[] = [
    { path: '/kalkulator', labelKey: 'layout.calculator', end: true, permission: 'calculator.view' },
  ];

  const mainNav = (scenarioChrome ? scenarioMainNav : capacityMainNav).filter((item) => hasPermission(item.permission));

  const scenarioListNav = { path: '/scenariusze', labelKey: 'layout.scenarioList', permission: 'scenarios.view' };

  const showAdminLink = hasAnyPermission([
    'admin_database.view',
    'admin_settings.view',
    'change_history.view',
    'user_management.view',
    'role_management.view',
  ]);

  const showScenariosWorkspace = hasPermission('scenarios.view');

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: scenarioChrome ? '#e4ecf7' : '#f7f8fa',
      }}
    >
      {scenarioChrome && (
        <div
          style={{
            background: 'linear-gradient(90deg, #1565c0 0%, #0d47a1 100%)',
            color: '#fff',
            padding: '0.4rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          <span>
            <strong>{t('layout.scenarioWorkspace')}</strong>
            {scenarioMode ? (
              <span style={{ opacity: 0.92 }}> {t('layout.scenarioWithActive')}</span>
            ) : (
              <span style={{ opacity: 0.9 }}> {t('layout.scenarioNoActive')}</span>
            )}
          </span>
        </div>
      )}
      <header
        style={{
          background: scenarioChrome ? '#d8e4f5' : '#fff',
          color: '#333',
          padding: '0.5rem 1.25rem',
          minHeight: 52,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          borderBottom: `2px solid ${scenarioChrome ? '#1565c0' : 'var(--cap-green)'}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: '1.25rem',
            color: scenarioChrome ? '#0d47a1' : 'var(--cap-green)',
            display: 'flex',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '0.25rem 0.75rem',
          }}
        >
          {ocuFeatureEnabled && !scenarioChrome ? (
            <button
              type="button"
              onClick={toggleCalculationProfile}
              title={t('layout.calculationProfileToggle')}
              style={{
                fontWeight: 700,
                fontSize: '1.25rem',
                color: 'var(--cap-green)',
                background: 'transparent',
                border: calculationProfile === 'ocu' ? '2px solid var(--cap-green)' : '2px solid transparent',
                borderRadius: 4,
                padding: calculationProfile === 'ocu' ? '2px 8px' : '2px 0',
                cursor: 'pointer',
                lineHeight: 1.2,
              }}
            >
              {calculationProfile === 'ocu' ? 'OCU' : 'Capacity'}
            </button>
          ) : (
            'Capacity'
          )}
          {scenarioChrome && scenarioMode && activeScenarioName ? (
            <Link
              to={`/scenariusze/${activeScenarioId}`}
              title={t('layout.openScenarioPreview')}
              style={{
                fontWeight: 600,
                fontSize: '1.05rem',
                color: '#0d47a1',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              · {activeScenarioName}
              <span style={{ fontWeight: 500, fontSize: '0.85rem', opacity: 0.88, marginLeft: 8 }}>#{activeScenarioId}</span>
            </Link>
          ) : scenarioChrome && scenarioMode && activeScenarioId ? (
            <Link
              to={`/scenariusze/${activeScenarioId}`}
              title={t('layout.openScenarioPreview')}
              style={{
                fontWeight: 600,
                fontSize: '1rem',
                color: '#1565c0',
                opacity: 0.95,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              {t('layout.scenarioHash', { id: activeScenarioId })}
            </Link>
          ) : null}
        </span>
        <nav style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          {mainNav.map(({ path, labelKey, end }) => (
            <MainNavLink
              key={path}
              path={path}
              label={t(labelKey)}
              end={end}
              appSection={appSection}
              activeScenarioId={activeScenarioId}
              setActiveScenario={setActiveScenario}
              navigate={navigate}
              scenarioChrome={scenarioChrome}
            />
          ))}
          {appSection === 'scenarios' && showScenariosWorkspace && (
            <MainNavLink
              key={scenarioListNav.path}
              path={scenarioListNav.path}
              label={t(scenarioListNav.labelKey)}
              appSection={appSection}
              activeScenarioId={activeScenarioId}
              setActiveScenario={setActiveScenario}
              navigate={navigate}
              scenarioChrome={scenarioChrome}
            />
          )}
          {showAdminLink && (
          <NavLink
            to={`/administracja${adminQuery}`}
            style={({ isActive }) => ({
              padding: '0.5rem 0.75rem',
              color: isActive ? '#fff' : scenarioChrome ? '#0d47a1' : 'var(--cap-green)',
              textDecoration: 'none',
              borderRadius: 4,
              background: isActive ? (scenarioChrome ? '#1565c0' : 'var(--cap-green)') : 'transparent',
            })}
          >
            {t('layout.administration')}
          </NavLink>
          )}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              userSelect: 'none',
              color: scenarioChrome ? '#0d47a1' : '#333',
            }}
            title={t('layout.contractualVolumesTitle')}
          >
            <button
              type="button"
              role="switch"
              aria-checked={useContractualVolumes}
              onClick={() => setUseContractualVolumes(!useContractualVolumes)}
              style={{
                position: 'relative',
                width: 46,
                height: 26,
                borderRadius: 13,
                border: `2px solid ${scenarioChrome ? '#1565c0' : 'var(--cap-green)'}`,
                background: useContractualVolumes ? contractualFrameColor : '#e0e0e0',
                cursor: 'pointer',
                flexShrink: 0,
                padding: 0,
                transition: 'background 0.18s ease',
                boxSizing: 'border-box',
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 3,
                  left: useContractualVolumes ? 22 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.28)',
                  transition: 'left 0.18s ease',
                }}
              />
            </button>
            <span style={{ fontWeight: 600, cursor: 'default' }}>{t('layout.contractualVolumes')}</span>
          </div>
          <div
            style={{
              display: 'inline-flex',
              borderRadius: 10,
              overflow: 'hidden',
              border: `2px solid ${headerAccent}`,
              boxSizing: 'border-box',
            }}
            role="group"
            aria-label={t('layout.workspaceAria')}
          >
            <button
              type="button"
              onClick={() => void switchSection('capacity')}
              style={{
                padding: '0.45rem 0.85rem',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                background: appSection === 'capacity' ? 'var(--cap-green)' : 'transparent',
                color: appSection === 'capacity' ? '#fff' : scenarioChrome ? '#0d47a1' : 'var(--cap-green)',
              }}
            >
              {t('layout.versionCapacity')}
            </button>
            <button
              type="button"
              onClick={() => void switchSection('scenarios')}
              disabled={!showScenariosWorkspace}
              style={{
                padding: '0.45rem 0.85rem',
                border: 'none',
                borderLeft: `1px solid ${headerAccent}`,
                cursor: showScenariosWorkspace ? 'pointer' : 'not-allowed',
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                opacity: showScenariosWorkspace ? 1 : 0.45,
                background: appSection === 'scenarios' ? '#1565c0' : 'transparent',
                color: appSection === 'scenarios' ? '#fff' : scenarioChrome ? '#0d47a1' : 'var(--cap-green)',
              }}
            >
              {t('layout.scenarios')}
            </button>
          </div>
          <UserMenu accentColor={headerAccent} scenarioChrome={scenarioChrome} />
          <LanguageSwitcher accentColor={headerAccent} />
          <Link
            to="/kalkulator"
            title={t('layout.logoTitle')}
            style={{ display: 'flex', alignItems: 'center', flexShrink: 0, lineHeight: 0 }}
          >
            <img
              src="/logo-autoneum.png"
              alt="Autoneum"
              style={{
                height: 'clamp(25px, min(5.6vmin, 7.7vh), 39px)',
                width: 'auto',
                maxWidth: 'min(50.4vw, 448px)',
                display: 'block',
                objectFit: 'contain',
              }}
            />
          </Link>
        </div>
      </header>
      <main style={{ flex: 1, padding: '1.5rem', background: scenarioChrome ? '#e8f0fa' : 'transparent' }}>{children}</main>
    </div>
  );
}
