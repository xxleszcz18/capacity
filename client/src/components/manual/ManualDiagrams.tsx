import type { CSSProperties, ReactNode } from 'react';
import { useI18n } from '../../context/I18nContext';

const boxBase: CSSProperties = {
  padding: '0.65rem 0.85rem',
  borderRadius: 8,
  border: '2px solid var(--cap-green)',
  background: '#f8fdf9',
  fontSize: 13,
  fontWeight: 600,
  textAlign: 'center',
  whiteSpace: 'pre-line',
  lineHeight: 1.35,
  minWidth: 88,
  flex: '1 1 88px',
};

const arrow: CSSProperties = {
  color: 'var(--cap-green)',
  fontSize: 20,
  fontWeight: 700,
  alignSelf: 'center',
  flexShrink: 0,
  padding: '0 0.15rem',
};

const panel: CSSProperties = {
  background: '#fafafa',
  border: '1px solid #e0e0e0',
  borderRadius: 10,
  padding: '1rem 1.1rem',
  margin: '1.25rem 0',
};

const caption: CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: 14,
  fontWeight: 700,
  color: '#333',
};

function FlowRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
      {children}
    </div>
  );
}

function Box({ label, accent }: { label: string; accent?: string }) {
  return (
    <div
      style={{
        ...boxBase,
        ...(accent ? { borderColor: accent, background: `${accent}14` } : {}),
      }}
    >
      {label}
    </div>
  );
}

function Arrow() {
  return <span style={arrow} aria-hidden>→</span>;
}

function DiagramPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={panel} role="img" aria-label={title}>
      <p style={caption}>{title}</p>
      {children}
    </div>
  );
}

export function DataModelDiagram() {
  const { t } = useI18n();
  const p = 'manual.diagrams.dataModel';
  return (
    <DiagramPanel title={t(`${p}.title`)}>
      <FlowRow>
        <Box label={t(`${p}.details`)} />
        <Arrow />
        <Box label={t(`${p}.projects`)} />
        <Arrow />
        <Box label={t(`${p}.operations`)} />
        <Arrow />
        <Box label={t(`${p}.machines`)} />
        <Arrow />
        <Box label={t(`${p}.calculator`)} accent="#1565c0" />
      </FlowRow>
    </DiagramPanel>
  );
}

export function ModesDiagram() {
  const { t } = useI18n();
  const p = 'manual.diagrams.modes';
  return (
    <DiagramPanel title={t(`${p}.title`)}>
      <FlowRow>
        <Box label={t(`${p}.production`)} />
        <span style={{ ...arrow, padding: '0 0.5rem' }}>⇄</span>
        <Box label={t(`${p}.scenario`)} accent="#1565c0" />
      </FlowRow>
      <p style={{ margin: '0.75rem 0 0', textAlign: 'center', fontSize: 13, color: '#666' }}>{t(`${p}.note`)}</p>
    </DiagramPanel>
  );
}

export function CalculationDiagram() {
  const { t } = useI18n();
  const p = 'manual.diagrams.calculation';
  return (
    <DiagramPanel title={t(`${p}.title`)}>
      <FlowRow>
        <Box label={t(`${p}.settings`)} />
        <Arrow />
        <Box label={t(`${p}.volumes`)} />
        <Arrow />
        <Box label={t(`${p}.ops`)} />
        <Arrow />
        <Box label={t(`${p}.result`)} accent="#c62828" />
      </FlowRow>
    </DiagramPanel>
  );
}

export function ProjectFlowDiagram() {
  const { t } = useI18n();
  const p = 'manual.diagrams.projectFlow';
  return (
    <DiagramPanel title={t(`${p}.title`)}>
      <FlowRow>
        <Box label={t(`${p}.s1`)} />
        <Arrow />
        <Box label={t(`${p}.s2`)} />
        <Arrow />
        <Box label={t(`${p}.s3`)} />
        <Arrow />
        <Box label={t(`${p}.s4`)} />
        <Arrow />
        <Box label={t(`${p}.s5`)} accent="#1565c0" />
      </FlowRow>
    </DiagramPanel>
  );
}

export function ScenarioDiagram() {
  const { t } = useI18n();
  const p = 'manual.diagrams.scenario';
  return (
    <DiagramPanel title={t(`${p}.title`)}>
      <FlowRow>
        <Box label={t(`${p}.live`)} />
        <Arrow />
        <Box label={t(`${p}.snap`)} accent="#1565c0" />
        <Arrow />
        <Box label={t(`${p}.calc`)} accent="#1565c0" />
        <Arrow />
        <Box label={t(`${p}.compare`)} accent="#6a1b9a" />
      </FlowRow>
    </DiagramPanel>
  );
}

export function AdminMapDiagram() {
  const { t } = useI18n();
  const p = 'manual.diagrams.adminMap';
  return (
    <DiagramPanel title={t(`${p}.title`)}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
        <Box label={t(`${p}.db`)} />
        <Box label={t(`${p}.adm`)} />
        <Box label={t(`${p}.viz`)} accent="#1565c0" />
        <Box label={t(`${p}.hist`)} />
      </div>
    </DiagramPanel>
  );
}

export function DependenciesDiagram() {
  const { t } = useI18n();
  const p = 'manual.diagrams.dependencies';
  return (
    <DiagramPanel title={t(`${p}.title`)}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
        <Box label={t(`${p}.phases`)} />
        <Box label={t(`${p}.types`)} />
        <Box label={t(`${p}.wd`)} />
        <Box label={t(`${p}.parts`)} />
        <Box label={t(`${p}.machines`)} />
      </div>
    </DiagramPanel>
  );
}

export type ManualDiagramId =
  | 'dataModel'
  | 'modes'
  | 'calculation'
  | 'projectFlow'
  | 'scenario'
  | 'adminMap'
  | 'dependencies';

const DIAGRAM_MAP: Record<ManualDiagramId, () => JSX.Element> = {
  dataModel: DataModelDiagram,
  modes: ModesDiagram,
  calculation: CalculationDiagram,
  projectFlow: ProjectFlowDiagram,
  scenario: ScenarioDiagram,
  adminMap: AdminMapDiagram,
  dependencies: DependenciesDiagram,
};

export function ManualDiagram({ id }: { id: ManualDiagramId }) {
  const Comp = DIAGRAM_MAP[id];
  return <Comp />;
}
