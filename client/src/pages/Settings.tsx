import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useI18n } from '../context/I18nContext';
import { confirmDelete } from '../confirmDelete';
import SearchableSelect from '../components/SearchableSelect';
import SortableTh from '../components/SortableTh';
import { useTableSort, sortRows } from '../utils/tableSort';

type WdProfile = 'capacity' | 'ocu';

type WdTheme = {
  accent: string;
  background: string;
  border: string;
};

const CAPACITY_THEME: WdTheme = {
  accent: 'var(--cap-green)',
  background: '#f1f8f4',
  border: '2px solid var(--cap-green)',
};

const OCU_THEME: WdTheme = {
  accent: '#1565c0',
  background: '#e8f0fa',
  border: '2px solid #1565c0',
};

export default function Settings() {
  const { t } = useI18n();
  const [ocuFeatureEnabled, setOcuFeatureEnabled] = useState(false);

  useEffect(() => {
    api.settings.getBehavior().then((b) => setOcuFeatureEnabled(b.ocu_enabled === true)).catch(() => setOcuFeatureEnabled(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/administracja" style={{ color: 'var(--cap-green)' }}>{t('settings.backAdmin')}</Link>
      </div>
      <h1 style={{ marginTop: 0 }}>{t('settings.databaseSettings')}</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>{t('settings.chooseCategory')}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <Link
          to="/administracja/ustawienia-bazy/fazy-procesu"
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
          <strong style={{ fontSize: '1.1rem' }}>{t('settings.phasesTitle')}</strong>
          <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('settings.phasesDescManage')}</p>
        </Link>
        <Link
          to="/administracja/ustawienia-bazy/detale"
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
          <strong style={{ fontSize: '1.1rem' }}>{t('settings.detailsTitle')}</strong>
          <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('settings.detailsDescManage')}</p>
        </Link>
        <Link
          to="/administracja/ustawienia-bazy/typy-maszyn"
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
          <strong style={{ fontSize: '1.1rem' }}>{t('settings.machineTypesTitle')}</strong>
          <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('settings.machineTypesDescManage')}</p>
        </Link>
        <Link
          to="/administracja/ustawienia-bazy/wizualne"
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
          <strong style={{ fontSize: '1.1rem' }}>{t('settings.visualTitle')}</strong>
          <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: 14 }}>{t('settings.visualDescManage')}</p>
        </Link>
      </div>

      <WorkingDaysProfileBlock profile="capacity" theme={CAPACITY_THEME} />
      {ocuFeatureEnabled && <WorkingDaysProfileBlock profile="ocu" theme={OCU_THEME} />}
    </div>
  );
}

function WorkingDaysProfileBlock({ profile, theme }: { profile: WdProfile; theme: WdTheme }) {
  const { t } = useI18n();
  const [list, setList] = useState<any[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; edit?: any }>({ open: false });
  const [filterRok, setFilterRok] = useState('');
  const [filterDni, setFilterDni] = useState('');
  const [filterOee, setFilterOee] = useState('');
  const [filterCzas, setFilterCzas] = useState('');
  const [filterCapacity, setFilterCapacity] = useState('');

  const load = () => {
    setListLoading(true);
    const listApi = profile === 'ocu' ? api.settings.ocu.list() : api.settings.list();
    listApi.then(setList).finally(() => setListLoading(false));
  };

  useEffect(load, [profile]);

  type WdSortCol = 'year' | 'days' | 'oee' | 'shift' | 'capacity';
  const { sortCol, sortDir, toggle } = useTableSort<WdSortCol>('year');

  const displayList = useMemo(() => {
    const filtered = list.filter((row) => {
      if (filterRok.trim() && !String(row.year ?? '').includes(filterRok.trim())) return false;
      const days = row.working_days_year ?? row.resolved_working_days_year;
      if (filterDni.trim() && !String(days ?? '').includes(filterDni.trim())) return false;
      const oee = row.oee_factor ?? row.resolved_oee_factor;
      if (filterOee.trim() && !String(oee ?? '').includes(filterOee.trim())) return false;
      const shift = row.shift_time_seconds ?? row.resolved_shift_time_seconds;
      if (filterCzas.trim() && !String(shift ?? '').includes(filterCzas.trim())) return false;
      if (filterCapacity.trim() && !String(row.capacity ?? '').includes(filterCapacity.trim())) return false;
      return true;
    });
    return sortRows(filtered, sortCol, sortDir, (row, col) => {
      switch (col) {
        case 'year':
          return Number(row.year) || 0;
        case 'days':
          return Number(row.working_days_year ?? row.resolved_working_days_year) || 0;
        case 'oee':
          return Number(row.oee_factor ?? row.resolved_oee_factor) || 0;
        case 'shift':
          return Number(row.shift_time_seconds ?? row.resolved_shift_time_seconds) || 0;
        case 'capacity':
          return Number(row.capacity) || 0;
        default:
          return 0;
      }
    });
  }, [list, filterRok, filterDni, filterOee, filterCzas, filterCapacity, sortCol, sortDir]);

  const profileLabel = profile === 'ocu' ? 'OCU' : 'Capacity';

  return (
    <section
      style={{
        marginBottom: '2rem',
        padding: '1.25rem 1.35rem',
        borderRadius: 10,
        border: theme.border,
        background: theme.background,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '6px 14px',
            borderRadius: 6,
            background: theme.accent,
            color: '#fff',
            fontWeight: 700,
            fontSize: '1.05rem',
            letterSpacing: '0.02em',
          }}
        >
          {profileLabel}
        </span>
        <span style={{ fontSize: 14, color: '#444' }}>
          {profile === 'ocu' ? t('settings.wdProfileDescOcu') : t('settings.wdProfileDescCapacity')}
        </span>
      </div>

      <WorkingDaysDefaultsPanel profile={profile} theme={theme} />

      <h3 style={{ margin: '1.25rem 0 0.5rem', fontSize: '1rem', color: theme.accent }}>{t('settings.wdOverridesTitle')}</h3>
      <p style={{ fontSize: 13, color: '#555', margin: '0 0 1rem', lineHeight: 1.5 }}>{t('settings.wdOverridesHint')}</p>

      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setModal({ open: true })}
          style={{ padding: '0.5rem 1rem', background: theme.accent, color: 'white', border: 'none', borderRadius: 4 }}
        >
          {t('common.add')}
        </button>
      </div>

      {listLoading && list.length === 0 ? (
        <p style={{ fontSize: 14, color: '#666' }}>{t('common.loading')}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <SortableTh label={t('common.year')} active={sortCol === 'year'} direction={sortDir} onClick={() => toggle('year')} />
              <SortableTh label={t('settings.wdColWorkingDays')} active={sortCol === 'days'} direction={sortDir} onClick={() => toggle('days')} />
              <SortableTh label={t('settings.wdColOee')} active={sortCol === 'oee'} direction={sortDir} onClick={() => toggle('oee')} />
              <SortableTh label={t('settings.wdColShift')} active={sortCol === 'shift'} direction={sortDir} onClick={() => toggle('shift')} />
              <SortableTh
                label={t('settings.wdColCapacity')}
                active={sortCol === 'capacity'}
                direction={sortDir}
                onClick={() => toggle('capacity')}
                title={t('settings.wdCapacityTooltip')}
              />
              <th style={{ padding: '0.75rem', textAlign: 'left' }}></th>
            </tr>
            <tr style={{ background: '#fafafa' }}>
              <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                <input type="text" placeholder={t('common.filterColumn', { column: t('common.year') })} value={filterRok} onChange={(e) => setFilterRok(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </th>
              <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                <input type="text" placeholder={t('common.filterColumn', { column: t('settings.wdColWorkingDays') })} value={filterDni} onChange={(e) => setFilterDni(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </th>
              <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                <input type="text" placeholder={t('common.filterColumn', { column: t('settings.wdColOee') })} value={filterOee} onChange={(e) => setFilterOee(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </th>
              <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                <input type="text" placeholder={t('common.filterColumn', { column: t('settings.wdColShift') })} value={filterCzas} onChange={(e) => setFilterCzas(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </th>
              <th style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                <input type="text" placeholder={t('common.filterColumn', { column: t('settings.wdColCapacity') })} value={filterCapacity} onChange={(e) => setFilterCapacity(e.target.value)} style={{ width: '100%', padding: 4, fontSize: 12 }} />
              </th>
              <th style={{ padding: '4px 6px' }}></th>
            </tr>
          </thead>
          <tbody>
            {displayList.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: '0.75rem' }}>{row.year}</td>
                <td style={{ padding: '0.75rem' }}>
                  <OverrideCell raw={row.working_days_year} resolved={row.resolved_working_days_year} />
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <OverrideCell raw={row.oee_factor} resolved={row.resolved_oee_factor} />
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <OverrideCell raw={row.shift_time_seconds} resolved={row.resolved_shift_time_seconds} />
                </td>
                <td style={{ padding: '0.75rem' }} title={t('settings.wdCapacityCellTooltip')}>
                  {row.capacity != null ? row.capacity.toLocaleString('pl-PL') : '-'}
                  {row.capacity != null ? ` ${t('common.perWeek')}` : ''}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <button type="button" onClick={() => setModal({ open: true, edit: row })} style={{ marginRight: 8, padding: '0.25rem 0.5rem', background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}>{t('common.edit')}</button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirmDelete(`${t('settings.wdDeleteConfirm', { year: row.year })} ${t('common.irreversible')}`)) return;
                      (profile === 'ocu' ? api.settings.ocu.delete(row.id) : api.settings.delete(row.id)).then(load);
                    }}
                    style={{ padding: '0.25rem 0.5rem', background: '#c62828', color: 'white', border: 'none', borderRadius: 4 }}
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal.open && (
        <SettingsModal
          edit={modal.edit}
          profile={profile}
          theme={theme}
          onClose={() => setModal({ open: false })}
          onSaved={() => {
            setModal({ open: false });
            load();
          }}
        />
      )}
    </section>
  );
}

function OverrideCell({ raw, resolved }: { raw: number | null | undefined; resolved: number | null | undefined }) {
  const { t } = useI18n();
  if (raw == null || raw === ('' as any)) {
    return (
      <span style={{ color: '#888', fontStyle: 'italic' }} title={t('settings.wdFromDefaults')}>
        {resolved ?? '—'}
      </span>
    );
  }
  return <span>{raw}</span>;
}

type WdDefaults = {
  working_days_year: number;
  oee_factor: number;
  shift_time_seconds: number;
  startup_shutdown_seconds: number;
  working_weeks_per_year: number;
  shifts_per_day: number;
};

function WorkingDaysDefaultsPanel({ profile, theme }: { profile: WdProfile; theme: WdTheme }) {
  const { t, te } = useI18n();
  const [form, setForm] = useState<WdDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setMessage('');
    setError('');
    const loadDefaults = profile === 'ocu' ? api.settings.ocu.getDefaults() : api.settings.getDefaults();
    loadDefaults
      .then(setForm)
      .catch((e: any) => setError(te(e?.message) || t('common.loadError')))
      .finally(() => setLoading(false));
  }, [profile, t, te]);

  const setField = <K extends keyof WdDefaults>(key: K, value: WdDefaults[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = () => {
    if (!form) return;
    setSaving(true);
    setMessage('');
    setError('');
    const saveApi = profile === 'ocu' ? api.settings.ocu.setDefaults(form) : api.settings.setDefaults(form);
    saveApi
      .then((saved) => {
        setForm(saved);
        setMessage(t('settings.wdDefaultsSaved'));
      })
      .catch((e: any) => setError(te(e?.message) || t('common.saveError')))
      .finally(() => setSaving(false));
  };

  if (loading) return <p style={{ fontSize: 14, color: '#666' }}>{t('common.loading')}</p>;
  if (!form) return error ? <p style={{ color: 'var(--cap-red)' }}>{error}</p> : null;

  return (
    <div
      style={{
        padding: '1rem 1.1rem',
        background: '#fff',
        border: `1px solid ${theme.accent}`,
        borderRadius: 8,
        maxWidth: 560,
      }}
    >
      <h3 style={{ margin: '0 0 6px', fontSize: '1rem', color: theme.accent }}>{t('settings.wdDefaultsTitle')}</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#666', lineHeight: 1.5 }}>{t('settings.wdDefaultsHint')}</p>
      <div style={{ display: 'grid', gap: '0.65rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
          <span>{t('settings.wdModalOee')}</span>
          <input type="number" step="0.01" value={form.oee_factor} onChange={(e) => setField('oee_factor', Number(e.target.value))} style={{ width: 120, padding: 4 }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
          <span>{t('settings.wdModalShiftMin')}</span>
          <input type="number" value={form.shift_time_seconds} onChange={(e) => setField('shift_time_seconds', Number(e.target.value))} style={{ width: 120, padding: 4 }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
          <span>{t('settings.wdModalStartupShutdown')}</span>
          <input type="number" value={form.startup_shutdown_seconds} onChange={(e) => setField('startup_shutdown_seconds', Number(e.target.value))} style={{ width: 120, padding: 4 }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
          <span>{t('settings.wdModalWorkingDaysYear')}</span>
          <input type="number" value={form.working_days_year} onChange={(e) => setField('working_days_year', Number(e.target.value))} style={{ width: 120, padding: 4 }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
          <span>{t('settings.wdModalWorkingWeeks')}</span>
          <input type="number" min={1} max={52} value={form.working_weeks_per_year} onChange={(e) => setField('working_weeks_per_year', Number(e.target.value))} style={{ width: 120, padding: 4 }} title={t('settings.wdModalWorkingWeeksTitle')} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
          <span>{t('settings.wdModalShiftsPerDay')}</span>
          <SearchableSelect value={form.shifts_per_day} onChange={(e) => setField('shifts_per_day', Number(e.target.value))} style={{ width: 120, padding: 4 }}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </SearchableSelect>
        </label>
      </div>
      {error && <p style={{ color: 'var(--cap-red)', margin: '10px 0 0', fontSize: 13 }}>{error}</p>}
      {message && <p style={{ color: theme.accent, margin: '10px 0 0', fontSize: 13 }}>{message}</p>}
      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={save} disabled={saving} style={{ padding: '0.45rem 1rem', background: theme.accent, color: 'white', border: 'none', borderRadius: 4 }}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
}

type OptionalField = number | '';

function toOptionalField(v: number | null | undefined): OptionalField {
  return v == null ? '' : Number(v);
}

function SettingsModal({
  edit,
  profile,
  theme,
  onClose,
  onSaved,
}: {
  edit?: any;
  profile: WdProfile;
  theme: WdTheme;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, te } = useI18n();
  const [year, setYear] = useState(edit?.year ?? new Date().getFullYear());
  const [working_days_year, setWorking_days_year] = useState<OptionalField>(toOptionalField(edit?.working_days_year));
  const [oee_factor, setOee_factor] = useState<OptionalField>(toOptionalField(edit?.oee_factor));
  const [shift_time_seconds, setShift_time_seconds] = useState<OptionalField>(toOptionalField(edit?.shift_time_seconds));
  const [startup_shutdown_seconds, setStartup_shutdown_seconds] = useState<OptionalField>(toOptionalField(edit?.startup_shutdown_seconds));
  const [working_weeks_per_year, setWorking_weeks_per_year] = useState<OptionalField>(toOptionalField(edit?.working_weeks_per_year));
  const [shifts_per_day, setShifts_per_day] = useState<OptionalField>(toOptionalField(edit?.shifts_per_day));
  const [defaults, setDefaults] = useState<WdDefaults | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDefaults = profile === 'ocu' ? api.settings.ocu.getDefaults() : api.settings.getDefaults();
    loadDefaults.then(setDefaults).catch(() => setDefaults(null));
  }, [profile]);

  const fieldBody = {
    working_days_year: working_days_year === '' ? null : Number(working_days_year),
    oee_factor: oee_factor === '' ? null : Number(oee_factor),
    shift_time_seconds: shift_time_seconds === '' ? null : Number(shift_time_seconds),
    startup_shutdown_seconds: startup_shutdown_seconds === '' ? null : Number(startup_shutdown_seconds),
    working_weeks_per_year: working_weeks_per_year === '' ? null : Number(working_weeks_per_year),
    shifts_per_day: shifts_per_day === '' ? null : Number(shifts_per_day),
  };

  const save = () => {
    setError('');
    setSaving(true);
    const status = edit?.status ?? 'active';
    const body = edit
      ? { year, ...fieldBody, status }
      : { year, ...fieldBody, status, months: Array(12).fill(0) };
    (edit
      ? profile === 'ocu'
        ? api.settings.ocu.update(edit.id, body)
        : api.settings.update(edit.id, body)
      : profile === 'ocu'
        ? api.settings.ocu.create(body)
        : api.settings.create(body))
      .then(onSaved)
      .catch((e) => setError(te(e.message) || t('common.saveError')))
      .finally(() => setSaving(false));
  };

  const ph = (v: number | undefined) => (v != null ? String(v) : '');

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 520, width: '100%', maxHeight: '90vh', overflow: 'auto', borderTop: `4px solid ${theme.accent}` }}>
        <h2 style={{ marginTop: 0, color: theme.accent }}>{profile === 'ocu' ? 'OCU' : 'Capacity'} — {t('settings.wdOverridesTitle')}</h2>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 1rem' }}>{t('settings.wdModalOptionalHint')}</p>
        <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
          <label>{t('settings.wdModalYear')} <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} disabled={!!edit} style={{ marginLeft: 8, padding: 4 }} /></label>
          <label>{t('settings.wdModalOee')} <input type="number" step="0.01" value={oee_factor} placeholder={ph(defaults?.oee_factor)} onChange={(e) => setOee_factor(e.target.value === '' ? '' : Number(e.target.value))} style={{ marginLeft: 8, padding: 4 }} /></label>
          <label>{t('settings.wdModalShiftMin')} <input type="number" value={shift_time_seconds} placeholder={ph(defaults?.shift_time_seconds)} onChange={(e) => setShift_time_seconds(e.target.value === '' ? '' : Number(e.target.value))} style={{ marginLeft: 8, padding: 4 }} /></label>
          <label>{t('settings.wdModalStartupShutdown')} <input type="number" value={startup_shutdown_seconds} placeholder={ph(defaults?.startup_shutdown_seconds)} onChange={(e) => setStartup_shutdown_seconds(e.target.value === '' ? '' : Number(e.target.value))} style={{ marginLeft: 8, padding: 4 }} /></label>
          <label>{t('settings.wdModalWorkingDaysYear')} <input type="number" value={working_days_year} placeholder={ph(defaults?.working_days_year)} onChange={(e) => setWorking_days_year(e.target.value === '' ? '' : Number(e.target.value))} style={{ marginLeft: 8, padding: 4 }} /></label>
          <label>{t('settings.wdModalWorkingWeeks')} <input type="number" min={1} max={52} value={working_weeks_per_year} placeholder={ph(defaults?.working_weeks_per_year)} onChange={(e) => setWorking_weeks_per_year(e.target.value === '' ? '' : Number(e.target.value))} style={{ marginLeft: 8, padding: 4 }} title={t('settings.wdModalWorkingWeeksTitle')} /></label>
          <label>
            {t('settings.wdModalShiftsPerDay')}{' '}
            <SearchableSelect value={shifts_per_day === '' ? '' : shifts_per_day} onChange={(e) => setShifts_per_day(e.target.value === '' ? '' : Number(e.target.value))} style={{ marginLeft: 8, padding: 4 }}>
              <option value="">{t('settings.wdFromDefaults')}</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </SearchableSelect>
          </label>
        </div>
        {error && <p style={{ color: 'var(--cap-red)', marginBottom: 8 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={save} disabled={saving} style={{ padding: '0.5rem 1rem', background: theme.accent, color: 'white', border: 'none', borderRadius: 4 }}>{t('common.save')}</button>
          <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
