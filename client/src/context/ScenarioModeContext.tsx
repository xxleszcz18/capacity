import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_ID = 'capacity_active_scenario_id';
const STORAGE_NAME = 'capacity_active_scenario_name';
const STORAGE_APP_SECTION = 'capacity_app_section';

export type AppSection = 'capacity' | 'scenarios';

export type ScenarioModeContextValue = {
  activeScenarioId: number | null;
  activeScenarioName: string | null;
  appSection: AppSection;
  setActiveScenario: (id: number, name: string) => void;
  clearActiveScenario: () => void;
  setAppSection: (section: AppSection) => void;
};

const ScenarioModeContext = createContext<ScenarioModeContextValue | null>(null);

function readStoredId(): number | null {
  const raw = sessionStorage.getItem(STORAGE_ID);
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readStoredName(): string | null {
  const n = sessionStorage.getItem(STORAGE_NAME);
  return n && n.trim() ? n.trim() : null;
}

function readStoredAppSection(): AppSection {
  const raw = sessionStorage.getItem(STORAGE_APP_SECTION);
  return raw === 'scenarios' ? 'scenarios' : 'capacity';
}

export function ScenarioModeProvider({ children }: { children: React.ReactNode }) {
  const [activeScenarioId, setId] = useState<number | null>(readStoredId);
  const [activeScenarioName, setName] = useState<string | null>(readStoredName);
  const [appSection, setAppSectionState] = useState<AppSection>(readStoredAppSection);

  const persist = useCallback((id: number | null, name: string | null) => {
    if (id != null && id > 0) {
      sessionStorage.setItem(STORAGE_ID, String(id));
      sessionStorage.setItem(STORAGE_NAME, name ?? '');
    } else {
      sessionStorage.removeItem(STORAGE_ID);
      sessionStorage.removeItem(STORAGE_NAME);
    }
  }, []);

  const setActiveScenario = useCallback(
    (id: number, name: string) => {
      setId(id);
      setName(name);
      persist(id, name);
    },
    [persist]
  );

  const clearActiveScenario = useCallback(() => {
    setId(null);
    setName(null);
    persist(null, null);
  }, [persist]);

  const setAppSection = useCallback((section: AppSection) => {
    setAppSectionState(section);
    sessionStorage.setItem(STORAGE_APP_SECTION, section);
  }, []);

  const value = useMemo(
    () => ({
      activeScenarioId,
      activeScenarioName,
      appSection,
      setActiveScenario,
      clearActiveScenario,
      setAppSection,
    }),
    [activeScenarioId, activeScenarioName, appSection, setActiveScenario, clearActiveScenario, setAppSection]
  );

  return <ScenarioModeContext.Provider value={value}>{children}</ScenarioModeContext.Provider>;
}

export function useScenarioMode(): ScenarioModeContextValue {
  const v = useContext(ScenarioModeContext);
  if (!v) throw new Error('useScenarioMode: brak ScenarioModeProvider');
  return v;
}

/** Zapytanie `?scenarioId=` do linków nawigacji w trybie scenariusza. */
export function scenarioNavQuery(activeScenarioId: number | null): string {
  return activeScenarioId != null && activeScenarioId > 0 ? `?scenarioId=${activeScenarioId}` : '';
}
