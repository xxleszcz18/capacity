import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { machineStatusFromDb, machineStatusSelectStyle, type MachineStatusKey } from '../utils/machineStatusStyle';
import { useI18n } from '../context/I18nContext';

export type RfqMachineRow = {
  id: number;
  internal_number: string | number | null;
  machine_type: string;
  machine_status: unknown;
};

function collectRfqMachinesFromOperations(operations: any[] | undefined): RfqMachineRow[] {
  const seen = new Set<number>();
  const out: RfqMachineRow[] = [];
  for (const op of operations ?? []) {
    if (machineStatusFromDb(op?.machine_status) !== 'RFQ') continue;
    const id = Number(op.machine_id);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    const n = op.machine_number;
    const internal_number = n != null && String(n).trim() !== '' ? String(n).trim() : null;
    out.push({
      id,
      internal_number,
      machine_type: String(op.machine_type ?? ''),
      machine_status: op.machine_status,
    });
  }
  return out;
}

function MachineStatusQuickRow({
  machine,
  navigationSuffix,
  onSaved,
}: {
  machine: RfqMachineRow;
  navigationSuffix: string;
  onSaved: () => void;
}) {
  const { t, te } = useI18n();
  const [status, setStatus] = useState<MachineStatusKey>(machineStatusFromDb(machine.machine_status));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(machineStatusFromDb(machine.machine_status));
  }, [machine.id, machine.machine_status]);

  const save = () => {
    setSaving(true);
    api.machines
      .update(machine.id, { status })
      .then(() => onSaved())
      .catch((err: { message?: string }) => {
        alert(te(err?.message) || t('modals.rfqActivate.saveMachineFailed'));
      })
      .finally(() => setSaving(false));
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const machineUrl = `${origin}/maszyny/${machine.id}${navigationSuffix}`;

  const label =
    machine.internal_number != null
      ? t('modals.rfqActivate.machineLabel', { number: machine.internal_number })
      : t('modals.rfqActivate.machineHash', { id: machine.id });

  return (
    <div
      style={{
        marginBottom: 14,
        paddingBottom: 12,
        borderBottom: '1px solid rgba(255, 152, 0, 0.45)',
      }}
    >
      <div style={{ fontWeight: 600, color: '#bf360c', marginBottom: 4 }}>{label}</div>
      {machine.machine_type ? (
        <div style={{ fontSize: 13, color: '#6d4c41', marginBottom: 8 }}>{t('modals.rfqActivate.typeLabel')} {machine.machine_type}</div>
      ) : null}
      <p style={{ margin: '0 0 8px', wordBreak: 'break-all' }}>
        <a href={machineUrl} style={{ color: '#1565c0', fontWeight: 500 }}>
          {machineUrl}
        </a>
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: '#4e342e' }}>
          {t('machines.machineStatus')}{' '}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MachineStatusKey)}
            disabled={saving}
            style={machineStatusSelectStyle(status, { saving })}
          >
            <option value="active">{t('common.active')}</option>
            <option value="RFQ">{t('common.rfq')}</option>
            <option value="inactive">{t('common.inactive')}</option>
          </select>
        </label>
        <button
          type="button"
          onClick={save}
          disabled={saving || status === machineStatusFromDb(machine.machine_status)}
          style={{
            padding: '0.4rem 0.85rem',
            background: '#e65100',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: saving ? 'wait' : 'pointer',
            fontWeight: 600,
            opacity: saving || status === machineStatusFromDb(machine.machine_status) ? 0.65 : 1,
          }}
        >
          {saving ? t('common.saving') : t('modals.rfqActivate.saveMachine')}
        </button>
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  operations: any[] | undefined;
  navigationSearch: string;
  onClose: () => void;
  onMachinesUpdated: () => void;
  onConfirmActivateProject: () => void;
  projectActivateSaving?: boolean;
};

export default function ProjectActivateRfqMachinesModal({
  open,
  operations,
  navigationSearch,
  onClose,
  onMachinesUpdated,
  onConfirmActivateProject,
  projectActivateSaving,
}: Props) {
  const { t } = useI18n();
  const suffix = navigationSearch && navigationSearch.startsWith('?') ? navigationSearch : navigationSearch ? `?${navigationSearch}` : '';
  const rfqMachines = useMemo(() => collectRfqMachinesFromOperations(operations), [operations]);
  const canActivateProject = rfqMachines.length === 0;

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-rfq-activate-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 6000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.45)',
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'linear-gradient(180deg, #ffe0b2 0%, #fff3e0 28%, #fff8e1 100%)',
          border: '3px solid #ff9800',
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          padding: '1.35rem 1.5rem',
        }}
      >
        <h2 id="project-rfq-activate-title" style={{ marginTop: 0, marginBottom: 12, color: '#e65100', fontSize: '1.25rem' }}>
          {t('modals.rfqActivate.title')}
        </h2>
        <p style={{ margin: '0 0 12px', color: '#4e342e', lineHeight: 1.5 }}>
          {t('modals.rfqActivate.body')}
        </p>
        {rfqMachines.length === 0 ? (
          <p style={{ margin: '0 0 1rem', color: '#2e7d32', fontWeight: 600 }}>
            {t('modals.rfqActivate.noRfqLeft')}
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 10px', fontWeight: 600, color: '#bf360c' }}>{t('modals.rfqActivate.rfqMachines')}</p>
            {rfqMachines.map((m) => (
              <MachineStatusQuickRow key={m.id} machine={m} navigationSuffix={suffix} onSaved={onMachinesUpdated} />
            ))}
          </>
        )}
        {!canActivateProject && (
          <p style={{ margin: '0 0 1rem', fontSize: 13, color: '#6d4c41', fontStyle: 'italic' }}>
            {t('modals.rfqActivate.activateWhenClear')}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              background: '#9e9e9e',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!canActivateProject || projectActivateSaving}
            onClick={onConfirmActivateProject}
            style={{
              padding: '0.5rem 1rem',
              background: '#e65100',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: !canActivateProject || projectActivateSaving ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: !canActivateProject || projectActivateSaving ? 0.55 : 1,
            }}
          >
            {projectActivateSaving ? t('common.saving') : t('modals.rfqActivate.activateProject')}
          </button>
        </div>
      </div>
    </div>
  );
}
