import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useScenarioMode } from '../context/ScenarioModeContext';
import { useReferenceDisplay } from '../context/ReferenceDisplayContext';
import { formatDetailSapAliasLabel } from '../utils/detailLabel';
import { useI18n } from '../context/I18nContext';

type DeployBatch = { projectIds: number[]; partIds?: number[] };

function buildDeployBatches(parts: any[], fullProjectIds: number[], partialPartIds: number[]): DeployBatch[] {
  const full = [...new Set(fullProjectIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  const partial = [...new Set(partialPartIds.map(Number).filter((n) => Number.isFinite(n) && n > 0))].filter((pid) => {
    const pt = parts.find((p) => Number(p.id) === pid);
    if (!pt) return false;
    return !full.includes(Number(pt.project_id));
  });
  const batches: DeployBatch[] = [];
  if (full.length > 0) batches.push({ projectIds: full });
  if (partial.length > 0) {
    const projSet = new Set<number>();
    for (const pid of partial) {
      const pt = parts.find((p) => Number(p.id) === pid);
      if (pt) projSet.add(Number(pt.project_id));
    }
    const pList = [...projSet];
    if (pList.length > 0) batches.push({ projectIds: pList, partIds: partial });
  }
  return batches;
}

export default function ScenarioDeployDetail() {
  const { t, te } = useI18n();
  const { id } = useParams();
  const { setActiveScenario } = useScenarioMode();
  const { referenceDisplay } = useReferenceDisplay();

  const [scenario, setScenario] = useState<{
    id: number;
    name: string;
    scenario_scope?: string;
    created_at: string;
    updated_at?: string | null;
    source_scenario_id?: number | null;
    archived_at?: string | null;
    snapshot: any;
  } | null>(null);
  const [sourceParentName, setSourceParentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [scenarioTreeExpanded, setScenarioTreeExpanded] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<number[]>([]);
  const [selectedFullProjects, setSelectedFullProjects] = useState<number[]>([]);
  const [selectedPartialParts, setSelectedPartialParts] = useState<number[]>([]);

  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [deployChallengeLoading, setDeployChallengeLoading] = useState(false);
  const [deployPhrase, setDeployPhrase] = useState('');
  const [deployToken, setDeployToken] = useState('');
  const [deployInput, setDeployInput] = useState('');
  const [applySubmitBusy, setApplySubmitBusy] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoadError(null);
    setLoading(true);
    api.scenarios
      .get(Number(id))
      .then(setScenario)
      .catch((e) => setLoadError(te(e.message) || t('scenarioDeployExtra.loadFailed')))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!scenario) return;
    setActiveScenario(scenario.id, scenario.name);
  }, [scenario, setActiveScenario]);

  useEffect(() => {
    const sid = scenario?.source_scenario_id;
    if (sid != null && sid > 0) {
      api.scenarios
        .get(sid)
        .then((p) => setSourceParentName(p.name))
        .catch(() => setSourceParentName(null));
    } else {
      setSourceParentName(null);
    }
  }, [scenario?.source_scenario_id]);

  if (loading) return <p>{t('common.loading')}</p>;
  if (loadError) {
    return (
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/scenariusze/podsumowanie" style={{ color: 'var(--cap-green)' }}>
            {t('scenarioDeployExtra.detailBackSummary')}
          </Link>
        </div>
        <p style={{ color: 'var(--cap-red)' }}>{loadError}</p>
      </div>
    );
  }
  if (!scenario) return <p>{t('common.loadError')}</p>;

  const projects = scenario.snapshot?.projects ?? [];
  const parts = scenario.snapshot?.parts ?? [];
  const designations = scenario.snapshot?.part_designations ?? [];
  const allProjectIds = projects.map((p: any) => Number(p.id)).filter((n: number) => Number.isFinite(n));

  const sourceDescription =
    scenario.source_scenario_id != null && scenario.source_scenario_id > 0
      ? t('scenarioDeployExtra.sourceFromScenario', { name: sourceParentName ?? `#${scenario.source_scenario_id}` })
      : t('scenarioDeployExtra.sourceProduction');

  const isProjectExpanded = (pid: number) => expandedProjects.includes(pid);
  const toggleExpandProject = (pid: number) => {
    setExpandedProjects((prev) => (prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]));
  };

  const scenarioRootAllSelected =
    allProjectIds.length > 0 && allProjectIds.every((pid: number) => selectedFullProjects.includes(pid));

  const toggleScenarioRoot = () => {
    if (scenarioRootAllSelected) {
      setSelectedFullProjects([]);
      setSelectedPartialParts([]);
    } else {
      setSelectedFullProjects([...allProjectIds]);
      setSelectedPartialParts([]);
    }
  };

  const toggleFullProject = (pid: number) => {
    setSelectedFullProjects((prev) => {
      if (prev.includes(pid)) return prev.filter((x) => x !== pid);
      setSelectedPartialParts((pp) => pp.filter((partId) => Number(parts.find((pt: any) => Number(pt.id) === partId)?.project_id) !== pid));
      return [...prev, pid];
    });
  };

  const togglePartialPart = (partId: number, projectId: number) => {
    if (selectedFullProjects.includes(projectId)) return;
    setSelectedPartialParts((prev) => (prev.includes(partId) ? prev.filter((x) => x !== partId) : [...prev, partId]));
  };

  const labelPart = (pt: any) => {
    const pd = designations.find((d: any) => Number(d.id) === Number(pt.designation_id));
    return formatDetailSapAliasLabel(
      {
        sap_number: pd?.sap_number ?? null,
        alias: pd?.alias ?? null,
        free_text: pd?.free_text ?? null,
        designation: pt.designation ?? null,
        id: pt.id,
      },
      referenceDisplay
    );
  };

  const hasDeploySelection =
    selectedFullProjects.length > 0 ||
    selectedPartialParts.some((partId) => {
      const pt = parts.find((p: any) => Number(p.id) === partId);
      return pt && !selectedFullProjects.includes(Number(pt.project_id));
    });

  const openDeployModal = () => {
    if (!scenario?.id || scenario.archived_at || !hasDeploySelection) return;
    setApplyMessage(null);
    setDeployInput('');
    setDeployPhrase('');
    setDeployToken('');
    setApplyModalOpen(true);
    setDeployChallengeLoading(true);
    api.scenarios
      .deployChallenge(scenario.id)
      .then((r) => {
        setDeployPhrase(r.phrase);
        setDeployToken(r.deployToken);
      })
      .catch(() => {
        setDeployPhrase('');
        setDeployToken('');
      })
      .finally(() => setDeployChallengeLoading(false));
  };

  const submitDeploy = async () => {
    if (!scenario?.id || !deployToken) return;
    const phrase = deployInput.trim();
    const batches = buildDeployBatches(parts, selectedFullProjects, selectedPartialParts);
    if (batches.length === 0) {
      setApplyMessage(t('scenarioDeployExtra.selectProjectOrPart'));
      return;
    }
    setApplySubmitBusy(true);
    setApplyMessage(null);
    try {
      const messages: string[] = [];
      for (const b of batches) {
        const body: { challengePhrase: string; deployToken: string; projectIds: number[]; partIds?: number[] } = {
          challengePhrase: phrase,
          deployToken,
          projectIds: b.projectIds,
        };
        if (b.partIds && b.partIds.length > 0) body.partIds = b.partIds;
        const r = await api.scenarios.applySubsetToProduction(scenario.id, body);
        if (r?.message) messages.push(r.message);
      }
      setApplyModalOpen(false);
      setDeployInput('');
      setDeployPhrase('');
      setDeployToken('');
      setApplyMessage(messages.join(' ') || t('scenarioDeployExtra.deploySuccess'));
      const fresh = await api.scenarios.get(scenario.id);
      setScenario(fresh);
      setSelectedFullProjects([]);
      setSelectedPartialParts([]);
    } catch (e: any) {
      setApplyMessage(te(e?.message) || t('scenarioDeployExtra.applyFailed'));
    } finally {
      setApplySubmitBusy(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <Link to="/scenariusze/podsumowanie" style={{ color: 'var(--cap-green)' }}>
          {t('scenarioDeployExtra.detailBackSummary')}
        </Link>
        <Link to={`/scenariusze/${scenario.id}`} style={{ color: '#1565c0' }}>
          {t('scenarioDeployExtra.detailScenarioView')}
        </Link>
      </div>
      <h1 style={{ marginTop: 0 }}>{t('scenarioDeployExtra.detailDeployTitle', { name: scenario.name })}</h1>
      <p style={{ color: '#666' }}>
        {t('scenarioDeployExtra.scenarioIdSource', { id: scenario.id, source: sourceDescription })}
      </p>
      {scenario.archived_at && (
        <p style={{ fontSize: 14, color: '#6d4c41', marginBottom: 12 }}>
          {t('scenarioDeployExtra.archivedDeployBlocked')}
        </p>
      )}
      <p style={{ color: '#37474f', marginBottom: 12, maxWidth: 960, lineHeight: 1.55 }}>
        {t('scenarioDeployExtra.deployTreeIntro')}
      </p>
      {applyMessage && (
        <p
          style={{
            color:
              /nieprawidłow|wygasł|nie udało|błąd wgrywan|\bbłąd\b|wpisz dokładnie|brak tokena/i.test(applyMessage) ? 'var(--cap-red)' : '#2e7d32',
            marginBottom: 12,
          }}
        >
          {applyMessage}
        </p>
      )}
      <div
        style={{
          border: '1px solid #90caf9',
          borderRadius: 8,
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          marginBottom: 16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            padding: '10px 12px',
            background: '#e3f2fd',
            borderBottom: scenarioTreeExpanded ? '1px solid #bbdefb' : 'none',
          }}
        >
          <button
            type="button"
            aria-expanded={scenarioTreeExpanded}
            onClick={() => setScenarioTreeExpanded((v) => !v)}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 14,
              padding: '2px 6px',
              lineHeight: 1,
            }}
            title={scenarioTreeExpanded ? t('scenarioDeployExtra.collapse') : t('scenarioDeployExtra.expand')}
          >
            {scenarioTreeExpanded ? '▼' : '▶'}
          </button>
          <input
            type="checkbox"
            disabled={allProjectIds.length === 0 || !!scenario.archived_at}
            checked={scenarioRootAllSelected}
            onChange={toggleScenarioRoot}
            aria-label={t('scenarioDeployExtra.selectAllProjectsAria')}
          />
          <strong>{t('scenarioDeployExtra.scenarioVariantLabel')}</strong>
          <span style={{ fontWeight: 600 }}>{scenario.name}</span>
          <span style={{ color: '#546e7a', fontSize: 13 }}>
            (#{scenario.id}) · {sourceDescription}
          </span>
        </div>
        {scenarioTreeExpanded && (
          <div style={{ padding: '8px 8px 12px 16px' }}>
            {projects.map((p: any) => {
              const projParts = parts.filter((pt: any) => Number(pt.project_id) === Number(p.id));
              const pid = Number(p.id);
              const projExpanded = isProjectExpanded(pid);
              const fullProj = selectedFullProjects.includes(pid);
              return (
                <div key={p.id} style={{ marginBottom: 10, borderLeft: '3px solid #90caf9', paddingLeft: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      aria-expanded={projExpanded}
                      onClick={() => toggleExpandProject(pid)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: 13,
                        padding: '2px 6px',
                      }}
                      title={projExpanded ? t('scenarioDeployExtra.collapseParts') : t('scenarioDeployExtra.expandParts')}
                    >
                      {projExpanded ? '▼' : '▶'}
                    </button>
                    <input
                      type="checkbox"
                      disabled={!!scenario.archived_at}
                      checked={fullProj}
                      onChange={() => toggleFullProject(pid)}
                      aria-label={t('scenarioDeployExtra.selectFullProjectAria', { name: p.name })}
                    />
                    <strong style={{ fontSize: 14 }}>{t('scenarioDeployExtra.projectLabel')}</strong>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                    <span style={{ color: '#607d8b', fontSize: 13 }}>{p.client ? ` · ${p.client}` : ''}</span>
                  </div>
                  {projExpanded && (
                    <div style={{ marginLeft: 28, marginTop: 8, paddingLeft: 12, borderLeft: '2px solid #e0e0e0' }}>
                      {projParts.length === 0 ? (
                        <span style={{ color: '#999', fontSize: 13 }}>{t('scenarioDeployExtra.noPartsInProject')}</span>
                      ) : (
                        projParts.map((pt: any) => (
                          <label
                            key={pt.id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 8,
                              padding: '4px 0',
                              cursor: fullProj ? 'default' : 'pointer',
                              opacity: fullProj ? 0.65 : 1,
                              fontSize: 13,
                            }}
                          >
                            <input
                              type="checkbox"
                              disabled={!!scenario.archived_at || fullProj}
                              checked={fullProj || selectedPartialParts.includes(Number(pt.id))}
                              onChange={() => togglePartialPart(Number(pt.id), pid)}
                              aria-label={t('scenarioDeployExtra.selectPartAria', { name: labelPart(pt) })}
                            />
                            <span>
                              <strong>{t('scenarioDeployExtra.partLabel')}</strong> {labelPart(pt)} <span style={{ color: '#888' }}>{t('scenarioDeployExtra.partHash', { id: pt.id })}</span>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {projects.length === 0 && <p style={{ color: '#666', margin: '8px 0 0', fontSize: 14 }}>{t('scenarioDeployExtra.noProjects')}</p>}
          </div>
        )}
      </div>
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          disabled={!!scenario.archived_at || !hasDeploySelection}
          onClick={() => openDeployModal()}
          style={{
            padding: '0.55rem 1.1rem',
            background: scenario.archived_at || !hasDeploySelection ? '#bdbdbd' : '#c62828',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: scenario.archived_at || !hasDeploySelection ? 'not-allowed' : 'pointer',
            fontWeight: 600,
          }}
        >
          {t('scenarioDeployExtra.deploySelectedBtn')}
        </button>
      </div>

      {applyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => !applySubmitBusy && setApplyModalOpen(false)}
        >
          <div
            style={{ background: 'white', maxWidth: 480, width: '100%', padding: '1.25rem', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>{t('scenarioDeployExtra.confirmDeployTitle')}</h2>
            <p style={{ color: '#444', fontSize: 14, lineHeight: 1.5 }}>
              {t('scenarioDeployExtra.confirmDeployBody')}
            </p>
            {deployChallengeLoading ? (
              <p style={{ color: '#666' }}>{t('common.generating')}</p>
            ) : deployPhrase ? (
              <>
                <p style={{ marginBottom: 8, fontSize: 14 }}>{t('scenarioDeployExtra.retypeCode')}</p>
                <p
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 18,
                    letterSpacing: '0.08em',
                    padding: '0.75rem',
                    background: '#f5f5f5',
                    borderRadius: 4,
                    userSelect: 'all',
                    marginBottom: 12,
                  }}
                >
                  {deployPhrase}
                </p>
                <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>{t('scenarioDeployExtra.confirmCodeLabel')}</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={deployInput}
                  onChange={(e) => setDeployInput(e.target.value)}
                  disabled={applySubmitBusy}
                  style={{ width: '100%', padding: '0.5rem', fontSize: 16, marginBottom: 12, boxSizing: 'border-box' }}
                />
              </>
            ) : (
              <p style={{ color: 'var(--cap-red)' }}>{t('scenarioDeployExtra.codeFailed')}</p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" disabled={applySubmitBusy} onClick={() => setApplyModalOpen(false)} style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: 4, background: 'white' }}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={applySubmitBusy || deployChallengeLoading || !deployPhrase || !deployToken}
                onClick={() => void submitDeploy()}
                style={{ padding: '0.5rem 1rem', background: '#c62828', color: 'white', border: 'none', borderRadius: 4 }}
              >
                {applySubmitBusy ? t('scenarioDeployExtra.deploying') : t('scenarioDeployExtra.deployToProduction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
