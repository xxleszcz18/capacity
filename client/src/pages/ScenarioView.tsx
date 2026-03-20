import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ScenarioView() {
  const { id } = useParams();
  const [scenario, setScenario] = useState<{ id: number; name: string; created_at: string; snapshot: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterKlient, setFilterKlient] = useState('');
  const [filterNazwa, setFilterNazwa] = useState('');
  const [filterSop, setFilterSop] = useState('');
  const [filterEop, setFilterEop] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    if (!id) return;
    api.scenarios.get(Number(id)).then(setScenario).finally(() => setLoading(false));
  }, [id]);

  if (loading || !scenario) return <p>Ładowanie…</p>;

  const projects = scenario.snapshot?.projects ?? [];
  const parts = scenario.snapshot?.parts ?? [];
  const operations = scenario.snapshot?.operations ?? [];
  const filteredProjects = projects.filter((p: any) => {
    if (filterKlient.trim() && !(p.client ?? '').toLowerCase().includes(filterKlient.trim().toLowerCase())) return false;
    if (filterNazwa.trim() && !(p.name ?? '').toLowerCase().includes(filterNazwa.trim().toLowerCase())) return false;
    if (filterSop.trim() && !String(p.sop ?? '').toLowerCase().includes(filterSop.trim().toLowerCase())) return false;
    if (filterEop.trim() && !String(p.eop ?? '').toLowerCase().includes(filterEop.trim().toLowerCase())) return false;
    if (filterStatus.trim() && p.status !== filterStatus) return false;
    return true;
  });

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/scenariusze" style={{ color: 'var(--cap-green)' }}>← Scenariusze</Link>
      </div>
      <h1 style={{ marginTop: 0 }}>Scenariusz: {scenario.name}</h1>
      <p style={{ color: '#666' }}>Utworzono: {new Date(scenario.created_at).toLocaleString('pl-PL')}</p>
      <p style={{ marginBottom: '1rem' }}>
        <Link to={`/kalkulator?scenarioId=${scenario.id}`} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', textDecoration: 'none', borderRadius: 4 }}>Kalkulator capacity wg tego scenariusza</Link>
      </p>
      <h2 style={{ marginTop: '1.5rem' }}>Projekty w scenariuszu</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Klient</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Nazwa</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>SOP</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>EOP</th>
            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
          </tr>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Klient" value={filterKlient} onChange={(e) => setFilterKlient(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr Nazwa" value={filterNazwa} onChange={(e) => setFilterNazwa(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr SOP" value={filterSop} onChange={(e) => setFilterSop(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <input type="text" placeholder="Filtr EOP" value={filterEop} onChange={(e) => setFilterEop(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
            </th>
            <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }}>
                <option value="">—</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="RFQ">RFQ</option>
              </select>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredProjects.map((p: any) => (
            <tr key={p.id}>
              <td style={{ padding: '0.75rem' }}>{p.client}</td>
              <td style={{ padding: '0.75rem' }}>{p.name}</td>
              <td style={{ padding: '0.75rem' }}>{p.sop}</td>
              <td style={{ padding: '0.75rem' }}>{p.eop}</td>
              <td style={{ padding: '0.75rem' }}>
                <span style={{ background: p.status === 'active' ? 'var(--cap-green)' : p.status === 'RFQ' ? '#ff9800' : '#9e9e9e', color: 'white', padding: '0.25rem 0.5rem', borderRadius: 4 }}>{p.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredProjects.length === 0 && <p style={{ color: '#666' }}>{projects.length === 0 ? 'Brak projektów w tym scenariuszu.' : 'Brak wyników dla podanego filtra.'}</p>}
      <p style={{ marginTop: '1rem', fontSize: 14, color: '#666' }}>W scenariuszu: {projects.length} projektów, {parts.length} części, {operations.length} operacji.</p>
    </div>
  );
}
