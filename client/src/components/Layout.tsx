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
import CallOffNewComparisonControl from './callOffs/CallOffNewComparisonControl';
import ScenarioNewControl from './scenarios/ScenarioNewControl';
import {
  DEFAULT_WORKSPACE_THEMES,
  workspaceAccentMuted,
  workspaceBannerGradient,
  workspaceThemesFromVisualSettings,
  type WorkspaceThemeColors,
  type WorkspaceThemeSettings,
} from '../utils/workspaceTheme';

async function pickLatestCallOff(): Promise<{ id: number; name: string } | null> {
  const list = await api.callOffs.list({ archived: false });
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => {
    const ta = new Date(a.updated_at || a.created_at || 0).getTime();
    const tb = new Date(b.updated_at || b.created_at || 0).getTime();
    return tb - ta;
  });
  const pick = sorted[0];
  return pick ? { id: pick.id, name: pick.name } : null;
}

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
  navTheme,
  isActivePath,
}: {
  path: string;
  label: string;
  end?: boolean;
  appSection: AppSection;
  activeScenarioId: number | null;
  setActiveScenario: (id: number, name: string) => void;
  navigate: ReturnType<typeof useNavigate>;
  navTheme: WorkspaceThemeColors;
  isActivePath?: (pathname: string) => boolean;
}) {
  const location = useLocation();
  const navInactive = workspaceAccentMuted(navTheme.accent);
  const needsScenarioPick =
    appSection === 'scenarios' && path !== '/scenariusze' && (activeScenarioId == null || activeScenarioId <= 0);
  const to =
    appSection === 'capacity'
      ? path
      : appSection === 'calloffs'
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
      style={({ isActive }) => {
        const active = isActivePath ? isActivePath(location.pathname) : isActive;
        return {
        padding: '0.5rem 0.75rem',
        color: active ? '#fff' : navInactive,
        textDecoration: 'none',
        borderRadius: 4,
        background: active ? navTheme.accent : 'transparent',
      };
      }}
    >
      {label}
    </NavLink>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    activeScenarioId,
    activeScenarioName,
    activeCallOffId,
    activeCallOffName,
    setActiveScenario,
    clearActiveScenario,
    setActiveCallOff,
    clearActiveCallOff,
    setAppSection,
    appSection,
  } = useScenarioMode();
  const { useContractualVolumes, setUseContractualVolumes } = useContractVolumes();
  const { t } = useI18n();
  const { hasPermission, hasAnyPermission } = useAuth();
  const { ocuFeatureEnabled, calculationProfile, toggleCalculationProfile } = useOcuMode();
  const [contractualFrameColor, setContractualFrameColor] = useState('#ff9800');
  const [workspaceThemes, setWorkspaceThemes] = useState<WorkspaceThemeSettings>(DEFAULT_WORKSPACE_THEMES);

  const loadVisualPrefs = useCallback(() => {
    api.settings.visual
      .get()
      .then((v) => {
        const raw = v as { contractual_calculator_frame_color?: string };
        const c = raw?.contractual_calculator_frame_color;
        if (typeof c === 'string' && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(c.trim())) {
          setContractualFrameColor(c.trim());
        }
        setWorkspaceThemes(workspaceThemesFromVisualSettings(v as Record<string, unknown>));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadVisualPrefs();
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadVisualPrefs();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadVisualPrefs]);

  useEffect(() => {
    if (activeScenarioId == null || activeScenarioId <= 0 || activeScenarioName) return;
    api.scenarios
      .get(activeScenarioId)
      .then((s) => setActiveScenario(s.id, s.name))
      .catch(() => {});
  }, [activeScenarioId, activeScenarioName, setActiveScenario]);

  useEffect(() => {
    if (activeCallOffId == null || activeCallOffId <= 0 || activeCallOffName) return;
    api.callOffs
      .get(activeCallOffId)
      .then((c) => setActiveCallOff(c.id, c.name))
      .catch(() => {});
  }, [activeCallOffId, activeCallOffName, setActiveCallOff]);

  /** Link z ?scenarioId= do Administracji w trybie Capacity (np. powrót z podstron). */
  const adminQuery = scenarioNavQuery(activeScenarioId);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const sid = Number(sp.get('scenarioId'));
    if (Number.isFinite(sid) && sid > 0) {
      setAppSection('scenarios');
      return;
    }
    if (location.pathname === '/call-offs' || location.pathname.startsWith('/call-offs/')) {
      setAppSection('calloffs');
    }
  }, [location.search, location.pathname, setAppSection]);

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
      p === '/administracja/instrukcja' ||
      p === '/historia-zmian' ||
      p === '/scenariusze' ||
      p.startsWith('/scenariusze/');
    if (allowed) return;
    const sp = new URLSearchParams();
    if (activeScenarioId != null && activeScenarioId > 0) sp.set('scenarioId', String(activeScenarioId));
    const q = sp.toString();
    navigate(`/kalkulator${q ? `?${q}` : ''}`, { replace: true });
  }, [appSection, location.pathname, activeScenarioId, navigate]);

  useEffect(() => {
    if (appSection !== 'calloffs') return;
    const p = location.pathname;
    const allowed =
      p === '/call-offs' ||
      p.startsWith('/call-offs/') ||
      p === '/administracja' ||
      p === '/administracja/historia-zmian' ||
      p === '/administracja/instrukcja' ||
      p === '/historia-zmian';
    if (allowed) return;
    if (activeCallOffId != null && activeCallOffId > 0) {
      navigate(`/call-offs/${activeCallOffId}`, { replace: true });
    } else {
      navigate('/call-offs', { replace: true });
    }
  }, [appSection, location.pathname, activeCallOffId, navigate]);

  const scenarioMode = activeScenarioId != null && activeScenarioId > 0;
  const scenarioChrome = appSection === 'scenarios';
  const callOffChrome = appSection === 'calloffs';
  const theme = workspaceThemes[appSection];
  const headerAccent = theme.accent;
  const navTextMuted = workspaceAccentMuted(theme.accent);

  const switchSection = useCallback(
    async (next: AppSection) => {
      if (next === appSection) return;
      setAppSection(next);
      if (next === 'scenarios') {
        clearActiveCallOff();
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
          navigate({ pathname: '/kalkulator', search: sp.toString() }, { replace: true });
        } else {
          navigate('/kalkulator', { replace: true });
        }
      } else if (next === 'calloffs') {
        clearActiveScenario();
        let cid = activeCallOffId;
        if (cid == null || cid <= 0) {
          const pick = await pickLatestCallOff();
          if (pick) {
            setActiveCallOff(pick.id, pick.name);
            cid = pick.id;
          }
        }
        if (cid != null && cid > 0) {
          navigate(`/call-offs/${cid}`, { replace: true });
        } else {
          navigate('/call-offs', { replace: true });
        }
      } else {
        clearActiveScenario();
        clearActiveCallOff();
        const path = location.pathname;
        const workspaceOnlyRoute =
          path === '/scenariusze' ||
          path.startsWith('/scenariusze/') ||
          path === '/call-offs' ||
          path.startsWith('/call-offs/');
        if (workspaceOnlyRoute) {
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
      activeCallOffId,
      setActiveScenario,
      setActiveCallOff,
      clearActiveScenario,
      clearActiveCallOff,
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

  const callOffMainNav: { path: string; labelKey: string; end?: boolean; permission: string; isActivePath?: (pathname: string) => boolean }[] = [
    {
      path: activeCallOffId != null && activeCallOffId > 0 ? `/call-offs/${activeCallOffId}` : '/call-offs',
      labelKey: 'layout.calculator',
      end: true,
      permission: 'call_offs.view',
      isActivePath: (pathname) => /^\/call-offs\/\d+/.test(pathname),
    },
  ];

  const mainNav = (
    callOffChrome ? callOffMainNav : scenarioChrome ? scenarioMainNav : capacityMainNav
  ).filter((item) => hasPermission(item.permission));

  const scenarioListNav = { path: '/scenariusze', labelKey: 'layout.scenarioList', permission: 'scenarios.view', end: true as const };
  const callOffListNav = {
    path: '/call-offs',
    labelKey: 'layout.callOffList',
    permission: 'call_offs.view',
    end: true as const,
    isActivePath: (pathname: string) => pathname === '/call-offs',
  };

  const workspaceChrome = scenarioChrome || callOffChrome;

  const showAdminLink =
    workspaceChrome ||
    hasAnyPermission([
      'admin_database.view',
      'admin_settings.view',
      'change_history.view',
      'user_management.view',
      'role_management.view',
    ]);

  const showScenariosWorkspace = hasPermission('scenarios.view');
  const showCallOffsWorkspace = hasPermission('call_offs.view');

  const callOffMode = activeCallOffId != null && activeCallOffId > 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: theme.page_bg,
      }}
    >
      {scenarioChrome && (
        <div
          style={{
            background: workspaceBannerGradient(workspaceThemes.scenarios),
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
      {callOffChrome && (
        <div
          style={{
            background: workspaceBannerGradient(workspaceThemes.calloffs),
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
            <strong>{t('layout.callOffWorkspace')}</strong>
            {callOffMode ? (
              <span style={{ opacity: 0.92 }}> {t('layout.callOffWithActive')}</span>
            ) : (
              <span style={{ opacity: 0.9 }}> {t('layout.callOffNoActive')}</span>
            )}
          </span>
        </div>
      )}
      <header
        style={{
          background: theme.header_bg,
          color: '#333',
          padding: '0.5rem 1.25rem',
          minHeight: 52,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          borderBottom: `2px solid ${headerAccent}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: '1.25rem',
            color: navTextMuted,
            display: 'flex',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '0.25rem 0.75rem',
          }}
        >
          {ocuFeatureEnabled && !workspaceChrome ? (
            <button
              type="button"
              onClick={toggleCalculationProfile}
              title={t('layout.calculationProfileToggle')}
              style={{
                fontWeight: 700,
                fontSize: '1.25rem',
                color: navTextMuted,
                background: 'transparent',
                border: calculationProfile === 'ocu' ? `2px solid ${theme.accent}` : '2px solid transparent',
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
                color: navTextMuted,
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
                color: navTextMuted,
                opacity: 0.95,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              {t('layout.scenarioHash', { id: activeScenarioId })}
            </Link>
          ) : callOffChrome && callOffMode && activeCallOffName ? (
            <Link
              to={`/call-offs/${activeCallOffId}`}
              style={{
                fontWeight: 600,
                fontSize: '1.05rem',
                color: navTextMuted,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              · {activeCallOffName}
              <span style={{ fontWeight: 500, fontSize: '0.85rem', opacity: 0.88, marginLeft: 8 }}>#{activeCallOffId}</span>
            </Link>
          ) : callOffChrome && callOffMode && activeCallOffId ? (
            <Link
              to={`/call-offs/${activeCallOffId}`}
              style={{
                fontWeight: 600,
                fontSize: '1rem',
                color: navTextMuted,
                opacity: 0.95,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              · #{activeCallOffId}
            </Link>
          ) : null}
        </span>
        <nav style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          {mainNav.map(({ path, labelKey, end, isActivePath }) => (
            <MainNavLink
              key={path}
              path={path}
              label={t(labelKey)}
              end={end}
              isActivePath={isActivePath}
              appSection={appSection}
              activeScenarioId={activeScenarioId}
              setActiveScenario={setActiveScenario}
              navigate={navigate}
              navTheme={theme}
            />
          ))}
          {appSection === 'scenarios' && showScenariosWorkspace && (
            <MainNavLink
              key={scenarioListNav.path}
              path={scenarioListNav.path}
              label={t(scenarioListNav.labelKey)}
              end={scenarioListNav.end}
              appSection={appSection}
              activeScenarioId={activeScenarioId}
              setActiveScenario={setActiveScenario}
              navigate={navigate}
              navTheme={theme}
            />
          )}
          {appSection === 'calloffs' && showCallOffsWorkspace && (
            <MainNavLink
              key={callOffListNav.path}
              path={callOffListNav.path}
              label={t(callOffListNav.labelKey)}
              end={callOffListNav.end}
              isActivePath={callOffListNav.isActivePath}
              appSection={appSection}
              activeScenarioId={activeScenarioId}
              setActiveScenario={setActiveScenario}
              navigate={navigate}
              navTheme={theme}
            />
          )}
          {showAdminLink && (
          <NavLink
            to={`/administracja${adminQuery}`}
            style={({ isActive }) => ({
              padding: '0.5rem 0.75rem',
              color: isActive ? '#fff' : navTextMuted,
              textDecoration: 'none',
              borderRadius: 4,
              background: isActive ? theme.accent : 'transparent',
            })}
          >
            {t('layout.administration')}
          </NavLink>
          )}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {scenarioChrome && showScenariosWorkspace && <ScenarioNewControl activateOnCreate />}
          {callOffChrome && showCallOffsWorkspace && <CallOffNewComparisonControl />}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              userSelect: 'none',
              color: navTextMuted,
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
                border: `2px solid ${headerAccent}`,
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
                background: appSection === 'capacity' ? workspaceThemes.capacity.accent : 'transparent',
                color:
                  appSection === 'capacity'
                    ? '#fff'
                    : workspaceAccentMuted(workspaceThemes[appSection].accent),
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
                background: appSection === 'scenarios' ? workspaceThemes.scenarios.accent : 'transparent',
                color:
                  appSection === 'scenarios'
                    ? '#fff'
                    : workspaceAccentMuted(workspaceThemes[appSection].accent),
              }}
            >
              {t('layout.scenarios')}
            </button>
            <button
              type="button"
              onClick={() => void switchSection('calloffs')}
              disabled={!showCallOffsWorkspace}
              style={{
                padding: '0.45rem 0.85rem',
                border: 'none',
                borderLeft: `1px solid ${headerAccent}`,
                cursor: showCallOffsWorkspace ? 'pointer' : 'not-allowed',
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                opacity: showCallOffsWorkspace ? 1 : 0.45,
                background: appSection === 'calloffs' ? workspaceThemes.calloffs.accent : 'transparent',
                color:
                  appSection === 'calloffs'
                    ? '#fff'
                    : workspaceAccentMuted(workspaceThemes[appSection].accent),
              }}
            >
              {t('layout.callOffs')}
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
      <main
        style={{
          flex: 1,
          padding: '1.5rem',
          background: theme.main_bg,
        }}
      >
        {children}
      </main>
    </div>
  );
}
