import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ReferenceDisplayProvider } from './context/ReferenceDisplayContext';
import { DataVizColorsProvider } from './context/DataVizColorsContext';
import { ScenarioModeProvider } from './context/ScenarioModeContext';
import { OcuModeProvider } from './context/OcuModeContext';
import { ContractVolumesProvider } from './context/ContractVolumesContext';
import { I18nProvider } from './context/I18nContext';

const Calculator = lazy(() => import('./pages/Calculator'));
const Machines = lazy(() => import('./pages/Machines'));
const MachineDetail = lazy(() => import('./pages/MachineDetail'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Scenarios = lazy(() => import('./pages/Scenarios'));
const CallOffs = lazy(() => import('./pages/CallOffs'));
const CallOffView = lazy(() => import('./pages/CallOffView'));
const ScenarioView = lazy(() => import('./pages/ScenarioView'));
const ScenarioEdit = lazy(() => import('./pages/ScenarioEdit'));
const Settings = lazy(() => import('./pages/Settings'));
const SettingsPhases = lazy(() => import('./pages/SettingsPhases'));
const SettingsDesignations = lazy(() => import('./pages/SettingsDesignations'));
const SettingsMachineTypes = lazy(() => import('./pages/SettingsMachineTypes'));
const SettingsVisual = lazy(() => import('./pages/SettingsVisual'));
const ChangeHistory = lazy(() => import('./pages/ChangeHistory'));
const Administration = lazy(() => import('./pages/Administration'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const AdminAttachments = lazy(() => import('./pages/AdminAttachments'));
const AdminOcuData = lazy(() => import('./pages/AdminOcuData'));
const AdminDataPreparation = lazy(() => import('./pages/AdminDataPreparation'));
const AdminDataVisualization = lazy(() => import('./pages/AdminDataVisualization'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminRoles = lazy(() => import('./pages/AdminRoles'));
const UsersAndPermissions = lazy(() => import('./pages/UsersAndPermissions'));
const UserManual = lazy(() => import('./pages/UserManual'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));

function RouteFallback() {
  return (
    <div style={{ padding: '1.5rem', color: '#666', fontSize: 14 }} role="status">
      Ładowanie…
    </div>
  );
}

function AppShell() {
  return (
    <ReferenceDisplayProvider>
      <DataVizColorsProvider>
        <ScenarioModeProvider>
          <OcuModeProvider>
            <ContractVolumesProvider>
              <Layout>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/kalkulator" replace />} />
                    <Route
                      path="/kalkulator"
                      element={
                        <ProtectedRoute permission="calculator.view">
                          <Calculator />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/maszyny"
                      element={
                        <ProtectedRoute permission="machines.view">
                          <Machines />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/maszyny/:id"
                      element={
                        <ProtectedRoute anyPermission={['machines.details', 'machines.edit']}>
                          <MachineDetail />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/projekty"
                      element={
                        <ProtectedRoute permission="projects.view">
                          <Projects />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/projekty/:id"
                      element={
                        <ProtectedRoute anyPermission={['projects.details', 'projects.edit', 'projects.create_rfq']}>
                          <ProjectDetail />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/detale"
                      element={
                        <ProtectedRoute permission="designations.view">
                          <SettingsDesignations />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/historia-zmian" element={<Navigate to="/administracja/historia-zmian" replace />} />
                    <Route
                      path="/administracja/historia-zmian"
                      element={
                        <ProtectedRoute permission="change_history.view">
                          <ChangeHistory />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/call-offs"
                      element={
                        <ProtectedRoute permission="call_offs.view">
                          <CallOffs />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/call-offs/:id"
                      element={
                        <ProtectedRoute permission="call_offs.view">
                          <CallOffView />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/scenariusze"
                      element={
                        <ProtectedRoute permission="scenarios.view">
                          <Scenarios />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/scenariusze/podsumowanie" element={<Navigate to="/scenariusze" replace />} />
                    <Route
                      path="/scenariusze/:id/edycja"
                      element={
                        <ProtectedRoute permission="scenarios.view">
                          <ScenarioEdit />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/scenariusze/:id/wdrozenie" element={<Navigate to="/scenariusze" replace />} />
                    <Route
                      path="/scenariusze/:id"
                      element={
                        <ProtectedRoute permission="scenarios.view">
                          <ScenarioView />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/wizualizacja-danych"
                      element={
                        <ProtectedRoute permission="admin_data_viz.view">
                          <AdminDataVisualization />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/administracja/wizualizacja-danych" element={<Navigate to="/wizualizacja-danych" replace />} />
                    <Route
                      path="/administracja/uzytkownicy-i-uprawnienia"
                      element={
                        <ProtectedRoute anyPermission={['user_management.view', 'role_management.view']}>
                          <UsersAndPermissions />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/administracja/uzytkownicy-i-uprawnienia/uzytkownicy"
                      element={
                        <ProtectedRoute permission="user_management.view">
                          <AdminUsers />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/administracja/uzytkownicy-i-uprawnienia/role"
                      element={
                        <ProtectedRoute permission="role_management.view">
                          <AdminRoles />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/uzytkownicy-i-uprawnienia" element={<Navigate to="/administracja/uzytkownicy-i-uprawnienia" replace />} />
                    <Route path="/uzytkownicy-i-uprawnienia/uzytkownicy" element={<Navigate to="/administracja/uzytkownicy-i-uprawnienia/uzytkownicy" replace />} />
                    <Route path="/uzytkownicy-i-uprawnienia/role" element={<Navigate to="/administracja/uzytkownicy-i-uprawnienia/role" replace />} />
                    <Route path="/administracja/uzytkownicy" element={<Navigate to="/administracja/uzytkownicy-i-uprawnienia/uzytkownicy" replace />} />
                    <Route path="/administracja/role" element={<Navigate to="/administracja/uzytkownicy-i-uprawnienia/role" replace />} />
                    <Route
                      path="/administracja"
                      element={
                        <ProtectedRoute>
                          <Administration />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/administracja/ustawienia-bazy"
                      element={
                        <ProtectedRoute permission="admin_database.view">
                          <Settings />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/administracja/ustawienia-bazy/fazy-procesu"
                      element={
                        <ProtectedRoute permission="admin_database.view">
                          <SettingsPhases />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/administracja/ustawienia-bazy/detale"
                      element={
                        <ProtectedRoute permission="designations.view">
                          <SettingsDesignations />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/administracja/ustawienia-bazy/typy-maszyn"
                      element={
                        <ProtectedRoute permission="admin_database.view">
                          <SettingsMachineTypes />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/administracja/ustawienia-bazy/wizualne"
                      element={
                        <ProtectedRoute permission="admin_database.view">
                          <SettingsVisual />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/administracja/ustawienia-administracyjne"
                      element={
                        <ProtectedRoute permission="admin_settings.view">
                          <AdminSettings />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/administracja/zalaczniki"
                      element={
                        <ProtectedRoute permission="admin_attachments.view">
                          <AdminAttachments />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/administracja/dane-do-ocu"
                      element={
                        <ProtectedRoute permission="admin_ocu.view">
                          <AdminOcuData />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/administracja/data-preparation"
                      element={
                        <ProtectedRoute permission="admin_data_preparation.view">
                          <AdminDataPreparation />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/administracja/instrukcja"
                      element={
                        <ProtectedRoute>
                          <UserManual />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/zmiana-hasla"
                      element={
                        <ProtectedRoute>
                          <ChangePassword />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/ustawienia" element={<Navigate to="/administracja/ustawienia-bazy" replace />} />
                    <Route path="/ustawienia/fazy-procesu" element={<Navigate to="/administracja/ustawienia-bazy/fazy-procesu" replace />} />
                    <Route path="/ustawienia/detale" element={<Navigate to="/administracja/ustawienia-bazy/detale" replace />} />
                    <Route path="/login" element={<Navigate to="/kalkulator" replace />} />
                  </Routes>
                </Suspense>
              </Layout>
            </ContractVolumesProvider>
          </OcuModeProvider>
        </ScenarioModeProvider>
      </DataVizColorsProvider>
    </ReferenceDisplayProvider>
  );
}

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
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/zapomniane-haslo" element={<ForgotPassword />} />
            <Route path="/reset-hasla" element={<ResetPassword />} />
            <Route path="/*" element={<AppShell />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </I18nProvider>
  );
}
