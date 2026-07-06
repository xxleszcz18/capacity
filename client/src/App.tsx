import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Calculator from './pages/Calculator';
import Machines from './pages/Machines';
import MachineDetail from './pages/MachineDetail';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Scenarios from './pages/Scenarios';
import ScenarioView from './pages/ScenarioView';
import ScenarioEdit from './pages/ScenarioEdit';
import Settings from './pages/Settings';
import SettingsPhases from './pages/SettingsPhases';
import SettingsDesignations from './pages/SettingsDesignations';
import SettingsMachineTypes from './pages/SettingsMachineTypes';
import SettingsVisual from './pages/SettingsVisual';
import ChangeHistory from './pages/ChangeHistory';
import Administration from './pages/Administration';
import AdminSettings from './pages/AdminSettings';
import AdminDataVisualization from './pages/AdminDataVisualization';
import UserManual from './pages/UserManual';
import { ReferenceDisplayProvider } from './context/ReferenceDisplayContext';
import { DataVizColorsProvider } from './context/DataVizColorsContext';
import { ScenarioModeProvider } from './context/ScenarioModeContext';
import { OcuModeProvider } from './context/OcuModeContext';
import { ContractVolumesProvider } from './context/ContractVolumesContext';
import { I18nProvider } from './context/I18nContext';

export default function App() {
  useEffect(() => {
    let query = '';
    let resetTimer: number | undefined;
    const reset = () => {
      query = '';
      if (resetTimer) window.clearTimeout(resetTimer);
      resetTimer = undefined;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active.tagName !== 'SELECT') return;
      const select = active as HTMLSelectElement;
      if (select.disabled || select.options.length === 0) return;
      if (e.key === 'Backspace') {
        query = query.slice(0, -1);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        query += e.key.toLowerCase();
      } else {
        return;
      }
      if (resetTimer) window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(reset, 900);
      const idx = Array.from(select.options).findIndex((o) =>
        String(o.textContent ?? '').toLowerCase().includes(query)
      );
      if (idx >= 0) {
        select.selectedIndex = idx;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      e.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      reset();
    };
  }, []);

  return (
    <I18nProvider>
    <ReferenceDisplayProvider>
    <DataVizColorsProvider>
    <ScenarioModeProvider>
    <OcuModeProvider>
    <ContractVolumesProvider>
    <Layout>
      <Routes>
        <Route path="/" element={<Calculator />} />
        <Route path="/kalkulator" element={<Calculator />} />
        <Route path="/maszyny" element={<Machines />} />
        <Route path="/maszyny/:id" element={<MachineDetail />} />
        <Route path="/projekty" element={<Projects />} />
        <Route path="/projekty/:id" element={<ProjectDetail />} />
        <Route path="/detale" element={<SettingsDesignations />} />
        <Route path="/historia-zmian" element={<Navigate to="/administracja/historia-zmian" replace />} />
        <Route path="/administracja/historia-zmian" element={<ChangeHistory />} />
        <Route path="/scenariusze" element={<Scenarios />} />
        <Route path="/scenariusze/podsumowanie" element={<Navigate to="/scenariusze" replace />} />
        <Route path="/scenariusze/:id/edycja" element={<ScenarioEdit />} />
        <Route path="/scenariusze/:id/wdrozenie" element={<Navigate to="/scenariusze" replace />} />
        <Route path="/scenariusze/:id" element={<ScenarioView />} />
        <Route path="/administracja" element={<Administration />} />
        <Route path="/administracja/ustawienia-bazy" element={<Settings />} />
        <Route path="/administracja/ustawienia-bazy/fazy-procesu" element={<SettingsPhases />} />
        <Route path="/administracja/ustawienia-bazy/detale" element={<SettingsDesignations />} />
        <Route path="/administracja/ustawienia-bazy/typy-maszyn" element={<SettingsMachineTypes />} />
        <Route path="/administracja/ustawienia-bazy/wizualne" element={<SettingsVisual />} />
        <Route path="/administracja/ustawienia-administracyjne" element={<AdminSettings />} />
        <Route path="/administracja/wizualizacja-danych" element={<AdminDataVisualization />} />
        <Route path="/administracja/instrukcja" element={<UserManual />} />
        <Route path="/ustawienia" element={<Navigate to="/administracja/ustawienia-bazy" replace />} />
        <Route path="/ustawienia/fazy-procesu" element={<Navigate to="/administracja/ustawienia-bazy/fazy-procesu" replace />} />
        <Route path="/ustawienia/detale" element={<Navigate to="/administracja/ustawienia-bazy/detale" replace />} />
      </Routes>
    </Layout>
    </ContractVolumesProvider>
    </OcuModeProvider>
    </ScenarioModeProvider>
    </DataVizColorsProvider>
    </ReferenceDisplayProvider>
    </I18nProvider>
  );
}
