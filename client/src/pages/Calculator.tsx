import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

function calendarYear(): number {
  return new Date().getFullYear();
}

function loadColor(percent: number): string {
  if (percent <= 0) return '#e8f5e9';
  if (percent < 80) return '#c8e6c9';
  if (percent < 100) return '#fff9c4';
  return '#ffcdd2';
}

export default function Calculator() {
  const [searchParams] = useSearchParams();
  const scenarioId = searchParams.get('scenarioId') != null ? Number(searchParams.get('scenarioId')) : undefined;
  const [data, setData] = useState<{ yearFrom: number; yearTo: number; machines: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('Wszystkie');
  const [machinesFilter, setMachinesFilter] = useState('');
  const [yearFrom, setYearFrom] = useState(() => calendarYear());
  const [yearTo, setYearTo] = useState(() => calendarYear() + 10);
  const [filterNumer, setFilterNumer] = useState('');
  const [filterTyp, setFilterTyp] = useState('Wszystkie');
  const [types, setTypes] = useState<string[]>([]);
  const [overloaded, setOverloaded] = useState<any[]>([]);
  const [allocationModal, setAllocationModal] = useState<{ machineId: number; internal_number: number; preselectedYear?: number } | null>(null);

  useEffect(() => {
    api.machines.types().then(setTypes);
  }, []);

  const effectiveYearFrom = Math.min(yearFrom, yearTo);
  const effectiveYearTo = Math.max(yearFrom, yearTo);

  const fetchCalculator = useCallback(() => {
    const params: any = { yearFrom: effectiveYearFrom, yearTo: effectiveYearTo };
    if (typeFilter !== 'Wszystkie') params.type = typeFilter;
    if (machinesFilter.trim()) params.machines = machinesFilter.trim();
    if (scenarioId != null && !isNaN(scenarioId)) params.scenarioId = scenarioId;
    return api.capacity.calculator(params).then(setData);
  }, [effectiveYearFrom, effectiveYearTo, typeFilter, machinesFilter, scenarioId]);

  useEffect(() => {
    setLoading(true);
    fetchCalculator().finally(() => setLoading(false));
  }, [fetchCalculator]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      fetchCalculator();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchCalculator]);

  useEffect(() => {
    api.allocation.overloaded({ year: new Date().getFullYear(), threshold: 100 }).then((r) => setOverloaded(r.machines || []));
  }, []);

  if (loading && !data) return <p>Ładowanie…</p>;

  const years = data ? Array.from({ length: data.yearTo - data.yearFrom + 1 }, (_, i) => data.yearFrom + i) : [];

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Kalkulator {scenarioId != null && !isNaN(scenarioId) && <span style={{ fontSize: 16, fontWeight: 400, color: '#666' }}>(scenariusz)</span>}</h1>
      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <span style={{ fontWeight: 600 }}>Filtry:</span>
        <label>Rok od: <input type="number" min={2000} max={2100} value={yearFrom} onChange={(e) => setYearFrom(Number(e.target.value) || calendarYear())} style={{ padding: '0.5rem', width: 72 }} /></label>
        <label>Rok do: <input type="number" min={2000} max={2100} value={yearTo} onChange={(e) => setYearTo(Number(e.target.value) || calendarYear() + 10)} style={{ padding: '0.5rem', width: 72 }} /></label>
        <label>Typ maszyny: <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="Wszystkie">Wszystkie</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
        <label>Maszyny (numery oddzielone przecinkiem): <input type="text" value={machinesFilter} onChange={(e) => setMachinesFilter(e.target.value)} placeholder="np. 1005, 1011" style={{ padding: '0.5rem', width: 220 }} /></label>
      </div>
      {!scenarioId && overloaded.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#ffebee', borderRadius: 8 }}>
          <strong>Przeciążone maszyny:</strong>{' '}
          {overloaded.map((m) => (
            <span key={m.machine_id} style={{ marginRight: 8 }}>
              {m.internal_number} ({m.load_percent}%)
              <button onClick={() => setAllocationModal({ machineId: m.machine_id, internal_number: m.internal_number, preselectedYear: m.year })} style={{ marginLeft: 4, padding: '2px 6px', fontSize: 12, background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>Zaproponuj alokację</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', position: 'sticky', left: 0, background: '#f5f5f5', zIndex: 1 }}>Numer</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', position: 'sticky', left: 60, background: '#f5f5f5', zIndex: 1 }}>Typ</th>
              {years.map((y) => <th key={y} style={{ padding: '0.75rem', textAlign: 'center', minWidth: 56 }}>{y}</th>)}
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Szczegóły</th>
            </tr>
            <tr style={{ background: '#fafafa' }}>
              <th style={{ padding: '4px 6px', verticalAlign: 'top', position: 'sticky', left: 0, background: '#fafafa', zIndex: 1 }}>
                <input type="text" placeholder="Filtr Numer" value={filterNumer} onChange={(e) => setFilterNumer(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </th>
              <th style={{ padding: '4px 6px', verticalAlign: 'top', position: 'sticky', left: 60, background: '#fafafa', zIndex: 1 }}>
                <select value={filterTyp} onChange={(e) => setFilterTyp(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }}>
                  <option value="Wszystkie">Wszystkie</option>
                  {types.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </th>
              {years.map((y) => <th key={y} style={{ padding: '4px 6px', minWidth: 56 }}></th>)}
              <th style={{ padding: '4px 6px' }}></th>
            </tr>
          </thead>
          <tbody>
            {(data?.machines ?? [])
              .filter((m: any) => {
                if (filterNumer.trim() && !String(m.internal_number ?? '').includes(filterNumer.trim())) return false;
                if (filterTyp !== 'Wszystkie' && m.type !== filterTyp) return false;
                return true;
              })
              .map((m: any) => (
              <tr key={m.machine_id}>
                <td style={{ padding: '0.75rem', position: 'sticky', left: 0, background: 'white' }}>{m.internal_number}</td>
                <td style={{ padding: '0.75rem', position: 'sticky', left: 60, background: 'white' }}>{m.type}</td>
                {years.map((y) => {
                  const cell = m.years?.[y];
                  const pct = cell?.load_percent ?? 0;
                  return (
                    <td
                      key={y}
                      role="button"
                      tabIndex={0}
                      style={{ padding: '0.5rem', textAlign: 'center', background: loadColor(pct), border: '1px solid #e0e0e0', cursor: 'pointer' }}
                      title={`Kliknij, aby otworzyć alokację dla roku ${y}`}
                      onClick={() => setAllocationModal({ machineId: m.machine_id, internal_number: m.internal_number, preselectedYear: y })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setAllocationModal({ machineId: m.machine_id, internal_number: m.internal_number, preselectedYear: y });
                        }
                      }}
                    >
                      {pct}%
                    </td>
                  );
                })}
                <td style={{ padding: '0.75rem', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setAllocationModal({ machineId: m.machine_id, internal_number: m.internal_number })} style={{ padding: '0.25rem 0.5rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Przenieś wolumen</button>
                  <Link to={`/maszyny/${m.machine_id}`} style={{ padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', textDecoration: 'none', borderRadius: 4 }}>Szczegóły</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {allocationModal && data && (
        <AllocationModal
          machineId={allocationModal.machineId}
          internalNumber={allocationModal.internal_number}
          yearFrom={data.yearFrom}
          yearTo={data.yearTo}
          preselectedYear={allocationModal.preselectedYear}
          onClose={() => setAllocationModal(null)}
          onSuccess={() => {
            setLoading(true);
            fetchCalculator().finally(() => setLoading(false));
          }}
        />
      )}
    </div>
  );
}

function AllocationModal({
  machineId,
  internalNumber,
  yearFrom,
  yearTo,
  preselectedYear,
  onClose,
  onSuccess,
}: {
  machineId: number;
  internalNumber: number;
  yearFrom: number;
  yearTo: number;
  preselectedYear?: number;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const yearRange = Array.from({ length: yearTo - yearFrom + 1 }, (_, i) => yearFrom + i);
  const [year, setYear] = useState(preselectedYear ?? yearFrom);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [opId, setOpId] = useState<number | ''>('');
  const [targetId, setTargetId] = useState<number | ''>('');
  const [volumeToMove, setVolumeToMove] = useState('');
  const [volumeUnit, setVolumeUnit] = useState<'annual' | 'monthly' | 'weekly'>('annual');
  const [cycleTimeOnTarget, setCycleTimeOnTarget] = useState('');
  const [executing, setExecuting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setYear((prev) => (preselectedYear != null ? preselectedYear : prev));
  }, [preselectedYear]);

  useEffect(() => {
    const o = operations.find((x) => x.id === opId);
    if (!o) return;
    setVolumeUnit((o.effective_volume_unit ?? o.volume_unit ?? 'annual') as 'annual' | 'monthly' | 'weekly');
  }, [opId, operations]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.allocation.candidates(machineId, { year, maxLoad: 90 }).then((r) => r.candidates || []),
      api.machines.operations(machineId, { year }),
    ]).then(([cands, ops]) => {
      setCandidates(cands);
      setOperations(ops);
      if (ops.length) setOpId(ops[0].id);
      if (cands.length) setTargetId(cands[0].machine_id);
    }).finally(() => setLoading(false));
  }, [machineId, year]);

  const selectedOp = operations.find((o) => o.id === opId);
  const effectiveVol = selectedOp
    ? (selectedOp.effective_volume_value != null ? selectedOp.effective_volume_value : selectedOp.volume_value)
    : 0;
  const effectiveUnit = (selectedOp?.effective_volume_unit ?? selectedOp?.volume_unit ?? 'annual') as 'annual' | 'monthly' | 'weekly';

  const setFullVolume = () => {
    if (selectedOp) {
      const v = selectedOp.effective_volume_value != null ? selectedOp.effective_volume_value : selectedOp.volume_value;
      const u = (selectedOp.effective_volume_unit ?? selectedOp.volume_unit ?? 'annual') as 'annual' | 'monthly' | 'weekly';
      setVolumeToMove(String(v));
      setVolumeUnit(u);
    }
  };

  const execute = () => {
    if (!opId || !targetId || !volumeToMove) { setMessage({ type: 'err', text: 'Wybierz operację, maszynę docelową i podaj wolumen.' }); return; }
    const vol = Number(volumeToMove);
    if (!selectedOp || vol <= 0) { setMessage({ type: 'err', text: 'Wolumen musi być większy od 0.' }); return; }
    if (volumeUnit === effectiveUnit && vol > effectiveVol + 1e-9) {
      setMessage({ type: 'err', text: 'Wolumen nie może być większy niż wolumen operacji dla wybranego roku (w tej samej jednostce).' });
      return;
    }
    setMessage(null);
    setExecuting(true);
    const body: { operationId: number; targetMachineId: number; volumeToMove: number; volumeUnit: string; year: number; cycleTimeSecondsOnTarget?: number | null } = {
      operationId: opId,
      targetMachineId: targetId,
      volumeToMove: vol,
      volumeUnit,
      year,
    };
    const cycleVal = cycleTimeOnTarget.trim() ? Number(cycleTimeOnTarget) : null;
    if (cycleVal != null && !Number.isNaN(cycleVal) && cycleVal > 0) body.cycleTimeSecondsOnTarget = cycleVal;
    api.allocation.execute(body)
      .then(() => {
        setMessage({ type: 'ok', text: 'Alokacja wykonana.' });
        setVolumeToMove('');
        onSuccess?.();
      })
      .catch((e) => setMessage({ type: 'err', text: e.message || 'Błąd' }))
      .finally(() => setExecuting(false));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h2 style={{ marginTop: 0 }}>Alokacja – maszyna {internalNumber}</h2>
        <div style={{ marginBottom: 8 }}>
          <label>Rok: <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ padding: 4 }}>{yearRange.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
        </div>
        <p style={{ color: '#666' }}>Wolne maszyny (z gniazda lub z listy alternatyw), rok {year}:</p>
        {loading ? <p>Ładowanie…</p> : candidates.length === 0 ? <p style={{ color: 'var(--cap-red)' }}>Brak wolnych maszyn w gniazdzie ani na liście alternatyw.</p> : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
              <thead><tr style={{ background: '#f5f5f5' }}><th style={{ padding: '0.75rem', textAlign: 'left' }}>Nr</th><th style={{ padding: '0.75rem', textAlign: 'left' }}>Typ</th><th style={{ padding: '0.75rem', textAlign: 'left' }}>Obciążenie %</th><th style={{ padding: '0.75rem', textAlign: 'left' }}>Wolna capacity [s/tydz]</th></tr></thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.machine_id}>
                    <td style={{ padding: '0.75rem' }}>{c.internal_number}</td>
                    <td style={{ padding: '0.75rem' }}>{c.type}</td>
                    <td style={{ padding: '0.75rem' }}>{c.load_percent}%</td>
                    <td style={{ padding: '0.75rem' }}>{c.free_capacity_sec_per_week}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {operations.length > 0 && (
              <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>Wykonaj alokację</h3>
                <div style={{ display: 'grid', gap: '0.5rem', marginBottom: 8 }}>
                  <label>Operacja:{' '}
                    <select value={opId} onChange={(e) => setOpId(Number(e.target.value))}>
                      {operations.map((o) => {
                        const ev = o.effective_volume_value != null ? o.effective_volume_value : o.volume_value;
                        const eu = (o.effective_volume_unit ?? o.volume_unit ?? 'annual') as string;
                        const unitPl = eu === 'annual' ? 'rocznie' : eu === 'monthly' ? 'miesięcznie' : 'tygodniowo';
                        return (
                          <option key={o.id} value={o.id}>
                            {o.part_designation} – {o.phase_name} (wolumen {year}: {typeof ev === 'number' ? Math.round(ev * 1000) / 1000 : ev} {unitPl})
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label>Maszyna docelowa: <select value={targetId} onChange={(e) => setTargetId(Number(e.target.value))}> {candidates.map((c) => <option key={c.machine_id} value={c.machine_id}>{c.internal_number} ({c.type})</option>)} </select></label>
                  <label>Wolumen do przeniesienia: <input type="number" min={0} value={volumeToMove} onChange={(e) => setVolumeToMove(e.target.value)} placeholder={selectedOp ? String(effectiveVol) : ''} style={{ width: 100, marginLeft: 4 }} /> <select value={volumeUnit} onChange={(e) => setVolumeUnit(e.target.value as any)}><option value="annual">roczny</option><option value="monthly">miesięczny</option><option value="weekly">tygodniowy</option></select> <button type="button" onClick={setFullVolume} style={{ padding: '2px 8px', fontSize: 12 }}>Przenieś całość</button></label>
                  <label>Czas cyklu na maszynie docelowej [s]: <input type="number" min={0} step={1} value={cycleTimeOnTarget} onChange={(e) => setCycleTimeOnTarget(e.target.value)} placeholder="bez zmian" style={{ width: 100, marginLeft: 4 }} title="Opcjonalnie – puste = skopiuj ze źródła" /></label>
                </div>
                {message && <p style={{ color: message.type === 'err' ? 'var(--cap-red)' : 'var(--cap-green)', marginBottom: 8 }}>{message.text}</p>}
                <button onClick={execute} disabled={executing} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>{executing ? 'Zapisywanie…' : 'Wykonaj alokację'}</button>
              </div>
            )}
          </>
        )}
        <button onClick={onClose} style={{ marginTop: 12, padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>Zamknij</button>
      </div>
    </div>
  );
}
