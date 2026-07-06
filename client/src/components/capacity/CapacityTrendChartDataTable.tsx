import { useCallback, useState, type ReactNode } from 'react';
import { api } from '../../api/client';
import { useI18n } from '../../context/I18nContext';
import type { TrendChartRow, TrendSeriesDef } from '../../utils/capacityTrends';
import type { BreakdownFetchParams } from '../../utils/capacityBreakdownExcel';
import { breakdownFetchParamsToApi } from '../../utils/capacityBreakdownExcel';
import { applyChartMetric, type ChartMetricMode } from '../../utils/chartMetricMode';

export type CapacityBreakdownSeriesKey = 'production' | 'contract' | 'scenario_production' | 'scenario_contract';

export type ChartBreakdownScope = {
  kind: 'line' | 'machine';
  line?: string;
  machineId?: number;
  fetchParams: BreakdownFetchParams;
};

type BreakdownResponse = Awaited<ReturnType<typeof api.capacity.breakdown>>;
type BreakdownSeries = NonNullable<BreakdownResponse['series'][CapacityBreakdownSeriesKey]>;
type BreakdownClient = BreakdownSeries['clients'][number];
type BreakdownProject = BreakdownClient['projects'][number];
type BreakdownDetail = BreakdownProject['details'][number];

function fmtMetricPct(value: number | null | undefined, mode: ChartMetricMode): string {
  const v = applyChartMetric(value, mode);
  return v != null ? `${v}%` : '—';
}

export function seriesBreakdownKey(seriesKey: string): CapacityBreakdownSeriesKey | null {
  if (seriesKey.endsWith('_scen_contract')) return 'scenario_contract';
  if (seriesKey.endsWith('_scen_prod')) return 'scenario_production';
  if (seriesKey.endsWith('_contract') || seriesKey.endsWith('_kon')) return 'contract';
  if (seriesKey.endsWith('_prod')) return 'production';
  return null;
}

function findClient(series: BreakdownSeries | undefined, client: string): BreakdownClient | undefined {
  return series?.clients.find((c) => c.client === client);
}

function findProject(series: BreakdownSeries | undefined, client: string, projectId: number): BreakdownProject | undefined {
  return findClient(series, client)?.projects.find((p) => p.project_id === projectId);
}

function findDetail(
  series: BreakdownSeries | undefined,
  client: string,
  projectId: number,
  detailLabel: string
): BreakdownDetail | undefined {
  return findProject(series, client, projectId)?.details.find((d) => d.detail_label === detailLabel);
}

function unionClients(breakdown: BreakdownResponse): BreakdownClient[] {
  const byClient = new Map<string, BreakdownClient>();
  for (const series of Object.values(breakdown.series)) {
    for (const client of series?.clients ?? []) {
      const existing = byClient.get(client.client);
      if (!existing) {
        byClient.set(client.client, {
          ...client,
          projects: client.projects.map((p) => ({ ...p, details: [...p.details] })),
        });
        continue;
      }
      for (const project of client.projects) {
        const existingProject = existing.projects.find((p) => p.project_id === project.project_id);
        if (!existingProject) {
          existing.projects.push({ ...project, details: [...project.details] });
          continue;
        }
        for (const detail of project.details) {
          if (!existingProject.details.some((d) => d.detail_label === detail.detail_label)) {
            existingProject.details.push(detail);
          }
        }
      }
    }
  }
  return [...byClient.values()].sort((a, b) => a.client.localeCompare(b.client, 'pl'));
}

type Props = {
  rows: TrendChartRow[];
  activeSeries: TrendSeriesDef[];
  breakdownScope?: ChartBreakdownScope;
  metricMode?: ChartMetricMode;
};

const INDENT_STEP_PX = 28;
const CHEVRON_WIDTH = 14;

function TreeLabelCell({
  level,
  background,
  fontWeight,
  fontSize,
  textColor,
  expandable,
  open,
  onToggle,
  children,
}: {
  level: number;
  background?: string;
  fontWeight?: number | string;
  fontSize?: number;
  textColor?: string;
  expandable?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  const chevron = (isOpen: boolean) => (isOpen ? '▾' : '▸');
  return (
    <td
      style={{
        padding: '6px 10px',
        verticalAlign: 'middle',
        background,
        borderTop: '1px solid #eee',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: level * INDENT_STEP_PX,
        }}
      >
        {expandable ? (
          <button
            type="button"
            onClick={onToggle}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              font: 'inherit',
              fontWeight: fontWeight ?? 'inherit',
              fontSize: fontSize ?? 'inherit',
              padding: 0,
              textAlign: 'left',
            }}
            aria-expanded={open}
          >
            <span aria-hidden style={{ width: CHEVRON_WIDTH, textAlign: 'center', color: '#666', flexShrink: 0 }}>
              {chevron(Boolean(open))}
            </span>
            <span>{children}</span>
          </button>
        ) : (
          <>
            <span aria-hidden style={{ width: CHEVRON_WIDTH, flexShrink: 0 }} />
            <span style={{ fontWeight, fontSize, color: textColor }}>{children}</span>
          </>
        )}
      </div>
    </td>
  );
}

function SeriesValueCell({
  series,
  value,
  background,
  metricMode = 'load',
}: {
  series: TrendSeriesDef;
  value: number | null | undefined;
  background?: string;
  metricMode?: ChartMetricMode;
}) {
  return (
    <td style={{ padding: '6px 10px', verticalAlign: 'middle', background, borderTop: '1px solid #eee' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 6,
          minWidth: 48,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: series.color,
            flexShrink: 0,
            opacity: 0.85,
          }}
        />
        <span>{fmtMetricPct(value, metricMode)}</span>
      </span>
    </td>
  );
}

export default function CapacityTrendChartDataTable({ rows, activeSeries, breakdownScope, metricMode = 'load' }: Props) {
  const { t } = useI18n();
  const [expandedYears, setExpandedYears] = useState<Set<number>>(() => new Set());
  const [expandedClients, setExpandedClients] = useState<Set<string>>(() => new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set());
  const [breakdownCache, setBreakdownCache] = useState<Map<number, BreakdownResponse>>(() => new Map());
  const [loadingYears, setLoadingYears] = useState<Set<number>>(() => new Set());
  const [errorYears, setErrorYears] = useState<Map<number, string>>(() => new Map());

  const uniqueSeriesKeys = [
    ...new Set(
      activeSeries.map((s) => seriesBreakdownKey(s.key)).filter((k): k is CapacityBreakdownSeriesKey => k != null)
    ),
  ];

  const loadBreakdown = useCallback(
    async (year: number) => {
      if (!breakdownScope || uniqueSeriesKeys.length === 0 || breakdownCache.has(year)) return;

      setLoadingYears((prev) => new Set(prev).add(year));
      setErrorYears((prev) => {
        const next = new Map(prev);
        next.delete(year);
        return next;
      });
      try {
        const res = await api.capacity.breakdown({
          year,
          series: uniqueSeriesKeys.join(','),
          line: breakdownScope.kind === 'line' ? breakdownScope.line : undefined,
          machineId: breakdownScope.kind === 'machine' ? breakdownScope.machineId : undefined,
          ...breakdownFetchParamsToApi(breakdownScope.fetchParams),
        });
        setBreakdownCache((prev) => new Map(prev).set(year, res));
      } catch (e) {
        setErrorYears((prev) => new Map(prev).set(year, e instanceof Error ? e.message : String(e)));
      } finally {
        setLoadingYears((prev) => {
          const next = new Set(prev);
          next.delete(year);
          return next;
        });
      }
    },
    [breakdownScope, uniqueSeriesKeys, breakdownCache]
  );

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else {
        next.add(year);
        void loadBreakdown(year);
      }
      return next;
    });
  };

  const toggleClient = (year: number, client: string) => {
    const key = `${year}|${client}`;
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleProject = (year: number, client: string, projectId: number) => {
    const key = `${year}|${client}|${projectId}`;
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const chevron = (open: boolean) => (open ? '▾' : '▸');

  const renderBreakdownRows = (breakdown: BreakdownResponse, year: number) => {
    const clients = unionClients(breakdown);
    if (!clients.length) {
      return (
        <tr>
          <td colSpan={activeSeries.length + 1} style={{ padding: '8px 10px 8px 36px', color: '#888', fontSize: 12, background: '#fafafa' }}>
            {t('dataViz.breakdownNoData')}
          </td>
        </tr>
      );
    }

    return clients.flatMap((clientNode) => {
      const clientKey = `${year}|${clientNode.client}`;
      const clientOpen = expandedClients.has(clientKey);
      const clientBg = '#fafafa';
      const clientRows = [
        <tr key={clientKey}>
          <TreeLabelCell
            level={1}
            background={clientBg}
            fontWeight={600}
            expandable
            open={clientOpen}
            onToggle={() => toggleClient(year, clientNode.client)}
          >
            {t('projects.client')}: {clientNode.client}
          </TreeLabelCell>
          {activeSeries.map((s) => {
            const bk = seriesBreakdownKey(s.key);
            const node = bk ? findClient(breakdown.series[bk], clientNode.client) : undefined;
            return <SeriesValueCell key={s.key} series={s} value={node?.load_percent} background={clientBg} metricMode={metricMode} />;
          })}
        </tr>,
      ];

      if (!clientOpen) return clientRows;

      for (const projectNode of clientNode.projects) {
        const projectKey = `${year}|${clientNode.client}|${projectNode.project_id}`;
        const projectOpen = expandedProjects.has(projectKey);
        const projectBg = '#f5f7f8';
        clientRows.push(
          <tr key={projectKey}>
            <TreeLabelCell
              level={2}
              background={projectBg}
              fontWeight={600}
              expandable
              open={projectOpen}
              onToggle={() => toggleProject(year, clientNode.client, projectNode.project_id)}
            >
              {t('projects.name')}: {projectNode.project_name}
            </TreeLabelCell>
            {activeSeries.map((s) => {
              const bk = seriesBreakdownKey(s.key);
              const node = bk ? findProject(breakdown.series[bk], clientNode.client, projectNode.project_id) : undefined;
              return <SeriesValueCell key={s.key} series={s} value={node?.load_percent} background={projectBg} metricMode={metricMode} />;
            })}
          </tr>
        );

        if (projectOpen) {
          for (const detailNode of projectNode.details) {
            const detailBg = '#f0f2f3';
            clientRows.push(
              <tr key={`${projectKey}|${detailNode.detail_label}`}>
                <TreeLabelCell level={3} background={detailBg} fontSize={12} textColor="#444">
                  <>
                    {t('layout.details')}: {detailNode.detail_label}
                    {detailNode.has_rfq ? (
                      <span style={{ marginLeft: 6, fontSize: 11, color: '#6a1b9a' }}>RFQ</span>
                    ) : null}
                  </>
                </TreeLabelCell>
                {activeSeries.map((s) => {
                  const bk = seriesBreakdownKey(s.key);
                  const node = bk
                    ? findDetail(breakdown.series[bk], clientNode.client, projectNode.project_id, detailNode.detail_label)
                    : undefined;
                  return <SeriesValueCell key={s.key} series={s} value={node?.load_percent} background={detailBg} metricMode={metricMode} />;
                })}
              </tr>
            );
          }
        }
      }

      return clientRows;
    });
  };

  return (
    <div style={{ marginTop: 12, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '38%' }} />
          {activeSeries.map((s) => (
            <col key={s.key} />
          ))}
        </colgroup>
        <thead>
          <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
            <th style={{ padding: '8px 10px' }}>{t('dataViz.colYear')}</th>
            {activeSeries.map((s) => (
              <th key={s.key} style={{ padding: '8px 10px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  {s.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        {rows.map((row) => {
          const yearOpen = expandedYears.has(row.year);
          const breakdown = breakdownCache.get(row.year);
          const loading = loadingYears.has(row.year);
          const error = errorYears.get(row.year);
          const canExpand = Boolean(breakdownScope && uniqueSeriesKeys.length);

          return (
            <tbody
              key={row.year}
              data-viz-export-table-part=""
              data-viz-export-table-year={String(row.year)}
            >
              <tr style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600, verticalAlign: 'middle' }}>
                  {canExpand ? (
                    <button
                      type="button"
                      onClick={() => toggleYear(row.year)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        font: 'inherit',
                        fontWeight: 600,
                        padding: 0,
                        color: '#333',
                      }}
                      aria-expanded={yearOpen}
                    >
                      <span aria-hidden style={{ width: 14, textAlign: 'center', color: '#666' }}>
                        {chevron(yearOpen)}
                      </span>
                      {row.year}
                    </button>
                  ) : (
                    row.year
                  )}
                </td>
                {activeSeries.map((s) => {
                  const bk = seriesBreakdownKey(s.key);
                  const breakdownValue = bk && breakdown ? breakdown.series[bk]?.load_percent : undefined;
                  const yearValue = breakdownValue ?? (row[s.key] as number | null | undefined);
                  return (
                    <td key={s.key} style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                      {fmtMetricPct(yearValue, metricMode)}
                    </td>
                  );
                })}
              </tr>
              {canExpand && yearOpen && loading && (
                <tr>
                  <td colSpan={activeSeries.length + 1} style={{ padding: '8px 10px 8px 24px', color: '#666', fontSize: 12, background: '#fafafa' }}>
                    {t('dataViz.breakdownLoading')}
                  </td>
                </tr>
              )}
              {canExpand && yearOpen && error && (
                <tr>
                  <td colSpan={activeSeries.length + 1} style={{ padding: '8px 10px 8px 24px', color: 'var(--cap-red, #c62828)', fontSize: 12, background: '#fafafa' }}>
                    {t('dataViz.breakdownFailed')}
                  </td>
                </tr>
              )}
              {canExpand && yearOpen && !loading && !error && breakdown && renderBreakdownRows(breakdown, row.year)}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
