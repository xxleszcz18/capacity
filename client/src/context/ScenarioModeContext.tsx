import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_ID = 'capacity_active_scenario_id';
const STORAGE_NAME = 'capacity_active_scenario_name';
const STORAGE_CALL_OFF_ID = 'capacity_active_call_off_id';
const STORAGE_CALL_OFF_NAME = 'capacity_active_call_off_name';
const STORAGE_APP_SECTION = 'capacity_app_section';

export type AppSection = 'capacity' | 'scenarios' | 'calloffs';

export type ScenarioModeContextValue = {
  activeScenarioId: number | null;
  activeScenarioName: string | null;
  activeCallOffId: number | null;
  activeCallOffName: string | null;
  appSection: AppSection;
  setActiveScenario: (id: number, name: string) => void;
  clearActiveScenario: () => void;
  setActiveCallOff: (id: number, name: string) => void;
  clearActiveCallOff: () => void;
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

function readStoredCallOffId(): number | null {
  const raw = sessionStorage.getItem(STORAGE_CALL_OFF_ID);
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readStoredCallOffName(): string | null {
  const n = sessionStorage.getItem(STORAGE_CALL_OFF_NAME);
  return n && n.trim() ? n.trim() : null;
}

function readStoredAppSection(): AppSection {
  const raw = sessionStorage.getItem(STORAGE_APP_SECTION);
  if (raw === 'scenarios') return 'scenarios';
  if (raw === 'calloffs') return 'calloffs';
  return 'capacity';
}

export function ScenarioModeProvider({ children }: { children: React.ReactNode }) {
  const [activeScenarioId, setId] = useState<number | null>(readStoredId);
  const [activeScenarioName, setName] = useState<string | null>(readStoredName);
  const [activeCallOffId, setCallOffId] = useState<number | null>(readStoredCallOffId);
  const [activeCallOffName, setCallOffName] = useState<string | null>(readStoredCallOffName);
  const [appSection, setAppSectionState] = useState<AppSection>(readStoredAppSection);

  const persistScenario = useCallback((id: number | null, name: string | null) => {
    if (id != null && id > 0) {
      sessionStorage.setItem(STORAGE_ID, String(id));
      sessionStorage.setItem(STORAGE_NAME, name ?? '');
    } else {
      sessionStorage.removeItem(STORAGE_ID);
      sessionStorage.removeItem(STORAGE_NAME);
    }
  }, []);

  const persistCallOff = useCallback((id: number | null, name: string | null) => {
    if (id != null && id > 0) {
      sessionStorage.setItem(STORAGE_CALL_OFF_ID, String(id));
      sessionStorage.setItem(STORAGE_CALL_OFF_NAME, name ?? '');
    } else {
      sessionStorage.removeItem(STORAGE_CALL_OFF_ID);
      sessionStorage.removeItem(STORAGE_CALL_OFF_NAME);
    }
  }, []);

  const setActiveScenario = useCallback(
    (id: number, name: string) => {
      setId(id);
      setName(name);
      persistScenario(id, name);
    },
    [persistScenario]
  );

  const clearActiveScenario = useCallback(() => {
    setId(null);
    setName(null);
    persistScenario(null, null);
  }, [persistScenario]);

  const setActiveCallOff = useCallback(
    (id: number, name: string) => {
      setCallOffId(id);
      setCallOffName(name);
      persistCallOff(id, name);
    },
    [persistCallOff]
  );

  const clearActiveCallOff = useCallback(() => {
    setCallOffId(null);
    setCallOffName(null);
    persistCallOff(null, null);
  }, [persistCallOff]);

  const setAppSection = useCallback((section: AppSection) => {
    setAppSectionState(section);
    sessionStorage.setItem(STORAGE_APP_SECTION, section);
  }, []);

  const value = useMemo(
    () => ({
      activeScenarioId,
      activeScenarioName,
      activeCallOffId,
      activeCallOffName,
      appSection,
      setActiveScenario,
      clearActiveScenario,
      setActiveCallOff,
      clearActiveCallOff,
      setAppSection,
    }),
    [
      activeScenarioId,
      activeScenarioName,
      activeCallOffId,
      activeCallOffName,
      appSection,
      setActiveScenario,
      clearActiveScenario,
      setActiveCallOff,
      clearActiveCallOff,
      setAppSection,
    ]
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

/** Zapytanie `?callOffId=` do linków w trybie Call offs. */
export function callOffNavQuery(activeCallOffId: number | null): string {
  return activeCallOffId != null && activeCallOffId > 0 ? `?callOffId=${activeCallOffId}` : '';
}
