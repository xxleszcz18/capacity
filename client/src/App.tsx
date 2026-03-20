import { Routes, Route, NavLink } from 'react-router-dom';
import Layout from './components/Layout';
import Calculator from './pages/Calculator';
import Machines from './pages/Machines';
import MachineDetail from './pages/MachineDetail';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Scenarios from './pages/Scenarios';
import ScenarioView from './pages/ScenarioView';
import Settings from './pages/Settings';
import SettingsPhases from './pages/SettingsPhases';
import SettingsDesignations from './pages/SettingsDesignations';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Calculator />} />
        <Route path="/kalkulator" element={<Calculator />} />
        <Route path="/maszyny" element={<Machines />} />
        <Route path="/maszyny/:id" element={<MachineDetail />} />
        <Route path="/projekty" element={<Projects />} />
        <Route path="/projekty/:id" element={<ProjectDetail />} />
        <Route path="/scenariusze" element={<Scenarios />} />
        <Route path="/scenariusze/:id" element={<ScenarioView />} />
        <Route path="/ustawienia" element={<Settings />} />
        <Route path="/ustawienia/fazy-procesu" element={<SettingsPhases />} />
        <Route path="/ustawienia/detale" element={<SettingsDesignations />} />
      </Routes>
    </Layout>
  );
}
