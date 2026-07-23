import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ManualDiagram, type ManualDiagramId } from '../components/manual/ManualDiagrams';
import { useI18n } from '../context/I18nContext';
import { scenarioNavQuery, useScenarioMode } from '../context/ScenarioModeContext';

type SectionDef = {
  id: string;
  diagram?: ManualDiagramId;
  paragraphs: string[];
  steps?: string[];
  subsections?: { titleKey: string; bodyKey: string }[];
  list?: string[];
};

const SECTIONS: SectionDef[] = [
  {
    id: 'overview',
    paragraphs: ['p1', 'p2', 'p3'],
    steps: ['step1', 'step2', 'step3', 'step4', 'step5'],
  },
  {
    id: 'auth',
    paragraphs: ['p1', 'p2'],
    steps: ['step1', 'step2', 'step3'],
    list: ['role1', 'role2', 'role3'],
  },
  {
    id: 'header',
    diagram: 'modes',
    paragraphs: ['p1'],
    subsections: [
      { titleKey: 'contractualTitle', bodyKey: 'contractual' },
      { titleKey: 'capacityTitle', bodyKey: 'capacity' },
      { titleKey: 'callOffsTitle', bodyKey: 'callOffs' },
      { titleKey: 'ocuTitle', bodyKey: 'ocu' },
      { titleKey: 'langTitle', bodyKey: 'lang' },
    ],
  },
  {
    id: 'dataModel',
    diagram: 'dataModel',
    paragraphs: ['p1', 'p2'],
    list: ['dep1', 'dep2', 'dep3', 'dep4', 'dep5'],
  },
  {
    id: 'calculator',
    diagram: 'calculation',
    paragraphs: ['p1', 'p2', 'p3', 'p4'],
    steps: ['step1', 'step2', 'step3', 'step4', 'step5'],
    subsections: [
      { titleKey: 'summaryTitle', bodyKey: 'summary' },
      { titleKey: 'allocTitle', bodyKey: 'alloc' },
      { titleKey: 'filtersTitle', bodyKey: 'filters' },
    ],
  },
  {
    id: 'machines',
    paragraphs: ['p1', 'p2'],
    steps: ['step1', 'step2', 'step3'],
  },
  {
    id: 'projects',
    diagram: 'projectFlow',
    paragraphs: ['p1', 'p2'],
    steps: ['step1', 'step2', 'step3', 'step4', 'step5'],
  },
  {
    id: 'details',
    paragraphs: ['p1', 'p2'],
  },
  {
    id: 'scenarios',
    diagram: 'scenario',
    paragraphs: ['p1', 'p2', 'p3'],
    steps: ['step1', 'step2', 'step3', 'step4', 'step5'],
  },
  {
    id: 'callOffs',
    diagram: 'callOffs',
    paragraphs: ['p1', 'p2'],
    steps: ['step1', 'step2', 'step3', 'step4'],
  },
  {
    id: 'dataViz',
    diagram: 'dataViz',
    paragraphs: ['p1', 'p2', 'p3'],
    steps: ['step1', 'step2', 'step3', 'step4'],
    subsections: [
      { titleKey: 'seriesTitle', bodyKey: 'series' },
      { titleKey: 'aggTitle', bodyKey: 'agg' },
      { titleKey: 'flexTitle', bodyKey: 'flex' },
    ],
  },
  {
    id: 'admin',
    diagram: 'adminMap',
    paragraphs: ['p1'],
    subsections: [
      { titleKey: 'dbTitle', bodyKey: 'db' },
      { titleKey: 'admTitle', bodyKey: 'adm' },
      { titleKey: 'usersTitle', bodyKey: 'users' },
      { titleKey: 'histTitle', bodyKey: 'hist' },
    ],
  },
  {
    id: 'formulas',
    diagram: 'dependencies',
    paragraphs: ['p1'],
    list: ['avail', 'weekly', 'required', 'load', 'sop', 'maxType', 'isoWeek'],
  },
];

const sectionStyle: CSSProperties = {
  background: 'white',
  borderRadius: 10,
  padding: '1.25rem 1.5rem',
  marginBottom: '1.25rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  border: '1px solid #eee',
  scrollMarginTop: 80,
};

const tocStyle: CSSProperties = {
  background: 'white',
  borderRadius: 10,
  padding: '1rem 1.25rem',
  marginBottom: '1.5rem',
  border: '1px solid #eee',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

function ManualSection({
  section,
  t,
}: {
  section: SectionDef;
  t: (key: string) => string;
}) {
  const base = `manual.sections.${section.id}`;
  return (
    <section id={section.id} style={sectionStyle}>
      <h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>{t(`${base}.title`)}</h2>

      {section.paragraphs.map((key) => (
        <p key={key} style={{ lineHeight: 1.6, color: '#333' }}>
          {t(`${base}.${key}`)}
        </p>
      ))}

      {section.subsections?.map((sub) => (
        <div key={sub.titleKey} style={{ margin: '1rem 0' }}>
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem', color: 'var(--cap-green)' }}>
            {t(`${base}.${sub.titleKey}`)}
          </h3>
          <p style={{ margin: 0, lineHeight: 1.6, color: '#444' }}>{t(`${base}.${sub.bodyKey}`)}</p>
        </div>
      ))}

      {section.steps && section.steps.length > 0 && (
        <>
          <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>
            {(() => {
              const key = `${base}.stepsTitle`;
              const label = t(key);
              return label !== key ? label : t('manual.stepsLabel');
            })()}
          </p>
          <ol style={{ margin: '0 0 1rem', paddingLeft: '1.35rem', lineHeight: 1.65 }}>
            {section.steps.map((key) => (
              <li key={key} style={{ marginBottom: '0.35rem' }}>
                {t(`${base}.${key}`)}
              </li>
            ))}
          </ol>
        </>
      )}

      {section.list && (
        <ul style={{ margin: '0 0 1rem', paddingLeft: '1.35rem', lineHeight: 1.65 }}>
          {section.list.map((key) => (
            <li key={key} style={{ marginBottom: '0.35rem' }}>
              {t(`${base}.${key}`)}
            </li>
          ))}
        </ul>
      )}

      {section.diagram && <ManualDiagram id={section.diagram} />}
    </section>
  );
}

export default function UserManual() {
  const { t } = useI18n();
  const { activeScenarioId, appSection } = useScenarioMode();
  const adminBackTo =
    appSection === 'scenarios' ? `/administracja${scenarioNavQuery(activeScenarioId)}` : '/administracja';

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={adminBackTo} style={{ color: 'var(--cap-green)' }}>
          {t('manual.backAdmin')}
        </Link>
      </div>

      <h1 style={{ marginTop: 0 }}>{t('manual.title')}</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: 1.55 }}>{t('manual.subtitle')}</p>

      <nav style={tocStyle} aria-label={t('manual.toc')}>
        <strong style={{ display: 'block', marginBottom: '0.65rem' }}>{t('manual.toc')}</strong>
        <ol style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.9 }}>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} style={{ color: 'var(--cap-green)', textDecoration: 'none' }}>
                {t(`manual.sections.${s.id}.title`)}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {SECTIONS.map((section) => (
        <ManualSection key={section.id} section={section} t={t} />
      ))}
    </div>
  );
}
