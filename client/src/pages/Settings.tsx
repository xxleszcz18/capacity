import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { confirmDelete } from '../confirmDelete';

export default function Settings() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; edit?: any }>({ open: false });
  const [filterRok, setFilterRok] = useState('');
  const [filterDni, setFilterDni] = useState('');
  const [filterOee, setFilterOee] = useState('');
  const [filterCzas, setFilterCzas] = useState('');
  const [filterCapacity, setFilterCapacity] = useState('');

  const load = () => {
    setLoading(true);
    api.settings.list().then(setList).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => setModal({ open: true });
  const openEdit = (edit: any) => setModal({ open: true, edit });

  const handleFromMonths = async (months: number[]) => {
    const { working_days_year } = await api.settings.fromMonths(months);
    return working_days_year;
  };

  if (loading) return <p>Ładowanie…</p>;
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Ustawienia</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>Wybierz kategorię ustawień do zarządzania.</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <Link
          to="/ustawienia/fazy-procesu"
          style={{
            display: 'block',
            padding: '1.25rem 1.5rem',
            minWidth: 220,
            background: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            borderRadius: 8,
            color: 'inherit',
            textDecoration: 'none',
            border: '1px solid #eee',
            cursor: 'pointer',
          }}
        >
          <strong style={{ fontSize: '1.1rem' }}>Fazy procesu</strong>
          <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>Lista faz używanych w operacjach (Piankowanie, Cięcie…). Dodawanie, edycja, usuwanie.</p>
        </Link>
        <Link
          to="/ustawienia/detale"
          style={{
            display: 'block',
            padding: '1.25rem 1.5rem',
            minWidth: 220,
            background: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            borderRadius: 8,
            color: 'inherit',
            textDecoration: 'none',
            border: '1px solid #eee',
            cursor: 'pointer',
          }}
        >
          <strong style={{ fontSize: '1.1rem' }}>Detale (oznaczenia)</strong>
          <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>Katalog detali: Nr SAP, Alias, Free text. Dodawanie, edycja, usuwanie.</p>
        </Link>
      </div>

      <section>
        <h2>Dni robocze</h2>
        <p style={{ fontSize: 14, color: '#555', marginBottom: '1rem' }}>Kolumna <strong>Capacity [s/tydz]</strong> to dostępny czas produkcyjny na tydzień w sekundach: (dni robocze / 52) × czas zmiany [min] × 60 × liczba zmian na dobę × OEE − czas uruchomienia/zakończenia [s]. Wartości służą do obliczeń w kalkulatorze obciążenia.</p>
        <div style={{ marginBottom: '1rem' }}>
          <button onClick={openCreate} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>
            Dodaj
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Rok</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Dni pracujące</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Współczynnik OEE</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Czas zmiany</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }} title="Dostępny czas produkcyjny na tydzień: (dni robocze/52) × czas zmiany [min] × 60 × liczba zmian na dobę × OEE − czas uruchomienia/zakończenia [s]">Capacity [s/tydz]</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}></th>
            </tr>
            <tr style={{ background: '#fafafa' }}>
              <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                <input type="text" placeholder="Filtr Rok" value={filterRok} onChange={(e) => setFilterRok(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </th>
              <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                <input type="text" placeholder="Filtr Dni" value={filterDni} onChange={(e) => setFilterDni(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </th>
              <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                <input type="text" placeholder="Filtr OEE" value={filterOee} onChange={(e) => setFilterOee(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </th>
              <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                <input type="text" placeholder="Filtr Czas" value={filterCzas} onChange={(e) => setFilterCzas(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </th>
              <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                <input type="text" placeholder="Filtr Capacity" value={filterCapacity} onChange={(e) => setFilterCapacity(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </th>
              <th style={{ padding: '4px 6px' }}></th>
            </tr>
          </thead>
          <tbody>
            {list
              .filter((row) => {
                if (filterRok.trim() && !String(row.year ?? '').includes(filterRok.trim())) return false;
                if (filterDni.trim() && !String(row.working_days_year ?? '').includes(filterDni.trim())) return false;
                if (filterOee.trim() && !String(row.oee_factor ?? '').includes(filterOee.trim())) return false;
                if (filterCzas.trim() && !String(row.shift_time_seconds ?? '').includes(filterCzas.trim())) return false;
                if (filterCapacity.trim() && !String(row.capacity ?? '').includes(filterCapacity.trim())) return false;
                return true;
              })
              .map((row) => (
              <tr key={row.id}>
                <td style={{ padding: '0.75rem' }}>{row.year}</td>
                <td style={{ padding: '0.75rem' }}>{row.working_days_year}</td>
                <td style={{ padding: '0.75rem' }}>{row.oee_factor}</td>
                <td style={{ padding: '0.75rem' }}>{row.shift_time_seconds}</td>
                <td style={{ padding: '0.75rem' }} title="Dostępny czas na produkcję w tym roku (sekundy na tydzień)">{row.capacity != null ? row.capacity.toLocaleString('pl-PL') : '-'}{row.capacity != null ? ' s/tydz' : ''}</td>
                <td style={{ padding: '0.75rem' }}>
                  <button onClick={() => openEdit(row)} style={{ marginRight: 8, padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>Zmień</button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirmDelete(`Czy na pewno usunąć ustawienia capacity dla roku ${row.year}? Tej operacji nie można cofnąć.`)) return;
                      api.settings.delete(row.id).then(load);
                    }}
                    style={{ padding: '0.25rem 0.5rem', background: '#c62828', color: 'white', border: 'none', borderRadius: 4 }}
                  >
                    Usuń
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {modal.open && (
          <SettingsModal
            edit={modal.edit}
            onClose={() => setModal({ open: false })}
            onSaved={() => { setModal({ open: false }); load(); }}
            onFromMonths={handleFromMonths}
          />
        )}
      </section>
    </div>
  );
}

function SettingsModal({ edit, onClose, onSaved, onFromMonths }: { edit?: any; onClose: () => void; onSaved: () => void; onFromMonths: (months: number[]) => Promise<number> }) {
  const [year, setYear] = useState(edit?.year ?? new Date().getFullYear());
  const [working_days_year, setWorking_days_year] = useState(edit?.working_days_year ?? 252);
  const [oee_factor, setOee_factor] = useState(edit?.oee_factor ?? 0.85);
  const [shift_time_seconds, setShift_time_seconds] = useState(edit?.shift_time_seconds ?? 450);
  const [startup_shutdown_seconds, setStartup_shutdown_seconds] = useState(edit?.startup_shutdown_seconds ?? 720);
  const [working_weeks_per_year, setWorking_weeks_per_year] = useState(edit?.working_weeks_per_year ?? 48);
  const [shifts_per_day, setShifts_per_day] = useState(edit?.shifts_per_day ?? 3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = () => {
    setError('');
    setSaving(true);
    const status = edit?.status ?? 'active';
    const body = edit
      ? { year, working_days_year, oee_factor, shift_time_seconds, startup_shutdown_seconds, working_weeks_per_year, shifts_per_day, status }
      : { year, working_days_year, oee_factor, shift_time_seconds, startup_shutdown_seconds, working_weeks_per_year, shifts_per_day, status, months: Array(12).fill(0) };
    (edit ? api.settings.update(edit.id, body) : api.settings.create(body))
      .then(onSaved)
      .catch((e) => setError(e.message || 'Błąd zapisu'))
      .finally(() => setSaving(false));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 520, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h2 style={{ marginTop: 0 }}>Dni robocze</h2>
        <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
          <label>Rok: <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} disabled={!!edit} style={{ marginLeft: 8, padding: 4 }} /></label>
          <label>Współczynnik OEE: <input type="number" step="0.01" value={oee_factor} onChange={(e) => setOee_factor(Number(e.target.value))} style={{ marginLeft: 8, padding: 4 }} /></label>
          <label>Czas zmiany (min): <input type="number" value={shift_time_seconds} onChange={(e) => setShift_time_seconds(Number(e.target.value))} style={{ marginLeft: 8, padding: 4 }} /></label>
          <label>Czas uruchomienie/zakończenie [s]: <input type="number" value={startup_shutdown_seconds} onChange={(e) => setStartup_shutdown_seconds(Number(e.target.value))} style={{ marginLeft: 8, padding: 4 }} /></label>
          <label>Dni robocze (rok): <input type="number" value={working_days_year} onChange={(e) => setWorking_days_year(Number(e.target.value))} style={{ marginLeft: 8, padding: 4 }} /></label>
          <label>Pracujące tygodnie w roku: <input type="number" min={1} max={52} value={working_weeks_per_year} onChange={(e) => setWorking_weeks_per_year(Number(e.target.value))} style={{ marginLeft: 8, padding: 4 }} title="Np. 48 – używane do przeliczania wolumenu rocznego na szt/tydzień" /></label>
          <label>Liczba zmian na dobę: <select value={shifts_per_day} onChange={(e) => setShifts_per_day(Number(e.target.value))} style={{ marginLeft: 8, padding: 4 }}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select></label>
        </div>
        {error && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={saving} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>Zapisz</button>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>Zamknij</button>
        </div>
      </div>
    </div>
  );
}
