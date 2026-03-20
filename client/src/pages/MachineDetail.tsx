import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { confirmDelete } from '../confirmDelete';

export default function MachineDetail() {
  const { id } = useParams();
  const [machine, setMachine] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'opis' | 'alternatywy' | 'projekty' | 'zajetosc'>('opis');
  const [capacityData, setCapacityData] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    api.machines.get(Number(id)).then(setMachine).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id || tab !== 'zajetosc') return;
    api.capacity.machine(Number(id), { yearFrom: 2026, yearTo: 2030 }).then(setCapacityData);
  }, [id, tab]);

  if (loading || !machine) return <p>Ładowanie…</p>;

  const tabs = [
    { id: 'opis' as const, label: 'Opis maszyny' },
    { id: 'alternatywy' as const, label: 'Alternatywy' },
    { id: 'projekty' as const, label: 'Projekty' },
    { id: 'zajetosc' as const, label: 'Zajętość' },
  ];

  return (
    <div style={{ display: 'flex', gap: '1.5rem' }}>
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/maszyny" style={{ color: 'var(--cap-green)' }}>← Maszyny</Link>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '0.5rem 0.75rem',
                textAlign: 'left',
                background: tab === t.id ? 'var(--cap-green)' : '#eee',
                color: tab === t.id ? 'white' : '#333',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ flex: 3 }}>
        {tab === 'opis' && (
          <MachineDescForm machine={machine} onUpdate={(m) => setMachine(m)} />
        )}
        {tab === 'alternatywy' && (
          <AlternativesSection
            machineId={machine.id}
            machineType={String(machine.type ?? '').trim()}
            alternatives={machine.alternatives ?? []}
            onUpdate={() => api.machines.get(machine.id).then(setMachine)}
          />
        )}
        {tab === 'projekty' && (
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Projekty</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f5f5f5' }}><th style={{ padding: '0.75rem', textAlign: 'left' }}>Klient</th><th style={{ padding: '0.75rem', textAlign: 'left' }}>Nazwa</th><th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th><th></th></tr></thead>
              <tbody>
                {(machine.projects ?? []).map((p: any) => (
                  <tr key={p.id}>
                    <td style={{ padding: '0.75rem' }}>{p.client}</td>
                    <td style={{ padding: '0.75rem' }}>{p.name}</td>
                    <td style={{ padding: '0.75rem' }}><span style={{ background: p.status === 'active' ? 'var(--cap-green)' : '#9e9e9e', color: 'white', padding: '0.25rem 0.5rem', borderRadius: 4 }}>{p.status}</span></td>
                    <td style={{ padding: '0.75rem' }}><Link to={`/projekty/${p.id}`} style={{ padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', textDecoration: 'none', borderRadius: 4 }}>Szczegóły</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'zajetosc' && capacityData && (
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Zajętość</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f5f5f5' }}><th style={{ padding: '0.75rem', textAlign: 'left' }}>Rok</th><th style={{ padding: '0.75rem', textAlign: 'left' }}>Obciążenie %</th><th style={{ padding: '0.75rem', textAlign: 'left' }}>Capacity szt/tydz</th></tr></thead>
              <tbody>
                {Object.entries(capacityData.years || {}).map(([y, d]: [string, any]) => (
                  <tr key={y}><td style={{ padding: '0.75rem' }}>{y}</td><td style={{ padding: '0.75rem' }}>{d.load_percent}%</td><td style={{ padding: '0.75rem' }}>{d.capacity_pcs_per_week}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const MACHINE_USAGE_OPTIONS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0];

function MachineDescForm({ machine, onUpdate }: { machine: any; onUpdate: (m: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [types, setTypes] = useState<string[]>([]);
  const [editInternalNumber, setEditInternalNumber] = useState(String(machine.internal_number ?? ''));
  const [editSapNumber, setEditSapNumber] = useState(machine.sap_number ?? '');
  const [editType, setEditType] = useState(machine.type ?? '');
  const [editOeeOverride, setEditOeeOverride] = useState(machine.oee_override != null ? String(machine.oee_override) : '');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>(machine.status === 'inactive' ? 'inactive' : 'active');
  const [editMachineUsage, setEditMachineUsage] = useState<number>(typeof machine.machine_usage === 'number' ? machine.machine_usage : 1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.machines.types().then(setTypes);
  }, []);

  useEffect(() => {
    setEditInternalNumber(String(machine.internal_number ?? ''));
    setEditSapNumber(machine.sap_number ?? '');
    setEditType(machine.type ?? '');
    setEditOeeOverride(machine.oee_override != null ? String(machine.oee_override) : '');
    setEditStatus(machine.status === 'inactive' ? 'inactive' : 'active');
    setEditMachineUsage(typeof machine.machine_usage === 'number' ? machine.machine_usage : 1);
  }, [machine.id, machine.internal_number, machine.sap_number, machine.type, machine.oee_override, machine.status, machine.machine_usage]);

  const handleSave = () => {
    if (!window.confirm('Czy na pewno chcesz zapisać zmiany?')) return;
    const internal_number = parseInt(editInternalNumber, 10);
    if (!Number.isInteger(internal_number) || internal_number <= 0) {
      alert('Numer maszyny musi być liczbą całkowitą większą od 0.');
      return;
    }
    if (!editType.trim()) {
      alert('Typ maszyny jest wymagany.');
      return;
    }
    setSaving(true);
    api.machines
      .update(machine.id, {
        internal_number,
        sap_number: editSapNumber.trim() || undefined,
        type: editType.trim() || undefined,
        oee_override: editOeeOverride === '' ? null : Number(editOeeOverride),
        status: editStatus,
        machine_usage: editMachineUsage,
      })
      .then((updated) => {
        onUpdate(updated);
        setEditing(false);
      })
      .catch((err) => {
        alert(err?.message || 'Błąd zapisu');
      })
      .finally(() => setSaving(false));
  };

  const usageVal = Math.max(0, Math.min(1, editMachineUsage));
  const usageRounded = Math.round(usageVal * 10) / 10;

  const inputStyle = { width: 120, padding: '0.35rem' as const };
  const inputStyleWide = { width: 200, padding: '0.35rem' as const };

  return (
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0 }}>Opis maszyny</h2>
      {!editing ? (
        <>
          <p style={{ marginBottom: 6 }}><strong>Numer maszyny:</strong> {machine.internal_number}</p>
          <p style={{ marginBottom: 6 }}><strong>Numer SAP maszyny:</strong> {machine.sap_number ?? '—'}</p>
          <p style={{ marginBottom: 6 }}><strong>Typ maszyny:</strong> {machine.type ?? '—'}</p>
          <p style={{ marginBottom: 6 }}><strong>Współczynnik OEE dla maszyny:</strong> {machine.oee_override != null ? machine.oee_override : '—'}</p>
          <p style={{ marginBottom: 6 }}><strong>Machine usage:</strong> {typeof machine.machine_usage === 'number' ? machine.machine_usage : 1}</p>
          <p style={{ marginBottom: 10 }}><strong>Status:</strong> {machine.status === 'active' ? 'Aktywna' : 'Nieaktywna'}</p>
          <button type="button" onClick={() => setEditing(true)} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Edytuj</button>
        </>
      ) : (
        <>
          <p style={{ marginBottom: 6 }}>
            <strong>Numer maszyny:</strong>{' '}
            <input type="number" min={1} value={editInternalNumber} onChange={(e) => setEditInternalNumber(e.target.value)} style={inputStyle} />
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>Numer SAP maszyny:</strong>{' '}
            <input type="text" value={editSapNumber} onChange={(e) => setEditSapNumber(e.target.value)} style={inputStyleWide} />
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>Typ maszyny:</strong>{' '}
            <select value={editType} onChange={(e) => setEditType(e.target.value)} style={{ padding: '0.35rem', minWidth: 120 }}>
              {[...new Set([...types, editType].filter(Boolean))].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>Współczynnik OEE dla maszyny:</strong>{' '}
            <input type="number" step="0.01" min={0} max={1} value={editOeeOverride} onChange={(e) => setEditOeeOverride(e.target.value)} style={{ width: 80, padding: '0.35rem' }} placeholder="np. 0.85" />
          </p>
          <p style={{ marginBottom: 6 }}>
            <strong>Machine usage:</strong>{' '}
            <select value={usageRounded} onChange={(e) => setEditMachineUsage(Number(e.target.value))} style={{ padding: '0.35rem' }}>
              {MACHINE_USAGE_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>0–1 (domyślnie 1); np. 0,5 podwaja capacity</span>
          </p>
          <p style={{ marginBottom: 10 }}>
            <strong>Status:</strong>{' '}
            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')} style={{ padding: '0.35rem' }}>
              <option value="active">Aktywna</option>
              <option value="inactive">Nieaktywna</option>
            </select>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '0.35rem 0.75rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>
              {saving ? 'Zapisywanie…' : 'Zapisz'}
            </button>
            <button type="button" onClick={() => setEditing(false)} style={{ padding: '0.35rem 0.75rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>Anuluj</button>
          </div>
        </>
      )}
    </div>
  );
}

function AlternativesSection({
  machineId,
  machineType,
  alternatives,
  onUpdate,
}: {
  machineId: number;
  machineType: string;
  alternatives: any[];
  onUpdate: () => void;
}) {
  const [addId, setAddId] = useState('');
  const [machineList, setMachineList] = useState<any[]>([]);

  useEffect(() => {
    api.machines.list({ status: 'active' }).then(setMachineList);
  }, []);

  const add = () => {
    const altId = Number(addId);
    if (!altId) return;
    api.alternatives.add(machineId, altId).then(onUpdate).catch(alert);
    setAddId('');
  };

  const remove = (altMachineId: number) => {
    const alt = alternatives.find((a: any) => a.id === altMachineId);
    const label = alt ? `${alt.internal_number} (${alt.type})` : String(altMachineId);
    if (!confirmDelete(`Czy usunąć maszynę ${label} z listy alternatyw? Tej operacji nie można cofnąć.`)) return;
    api.alternatives.remove(machineId, altMachineId).then(onUpdate);
  };

  const normType = (t: unknown) => String(t ?? '').trim();
  const sameGroup = (m: { type?: string }) => {
    const g = normType(machineType);
    return g !== '' && normType(m.type) === g;
  };

  const available = machineList
    .filter((m) => m.id !== machineId && !alternatives.some((a: any) => a.id === m.id))
    .sort((a, b) => {
      const aSame = sameGroup(a);
      const bSame = sameGroup(b);
      if (aSame && !bSame) return -1;
      if (!aSame && bSame) return 1;
      const byType = normType(a.type).localeCompare(normType(b.type), 'pl', { sensitivity: 'base' });
      if (byType !== 0) return byType;
      return (Number(a.internal_number) || 0) - (Number(b.internal_number) || 0);
    });

  return (
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0 }}>Alternatywy</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#f5f5f5' }}><th style={{ padding: '0.75rem', textAlign: 'left' }}>Maszyna</th><th style={{ padding: '0.75rem', textAlign: 'left' }}>SAP</th><th style={{ padding: '0.75rem', textAlign: 'left' }}></th></tr></thead>
        <tbody>
          {alternatives.map((a: any) => (
            <tr key={a.id}>
              <td style={{ padding: '0.75rem' }}>{a.internal_number} ({a.type})</td>
              <td style={{ padding: '0.75rem' }}>{a.sap_number || '-'}</td>
              <td style={{ padding: '0.75rem' }}><button type="button" onClick={() => remove(a.id)} style={{ background: '#c62828', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: 4 }}>Usuń</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: '1rem', display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={addId} onChange={(e) => setAddId(e.target.value)} style={{ padding: '0.5rem' }}>
          <option value="">-- wybierz maszynę --</option>
          {available.map((m) => <option key={m.id} value={m.id}>{m.internal_number} ({m.type})</option>)}
        </select>
        <button onClick={add} style={{ padding: '0.5rem 1rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>Nowa alternatywa</button>
      </div>
    </div>
  );
}
