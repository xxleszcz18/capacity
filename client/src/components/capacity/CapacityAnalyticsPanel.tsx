import { Fragment, useId, useState, type ReactNode } from 'react';
import type { AnalyticsRow, CapacityMachineTrend } from '../../utils/capacityTrends';
import { machineLabel } from '../../utils/capacityTrends';
import type { DataVizColors } from '../../utils/dataVizColors';
import {
  analyticsRowForLine,
  analyticsRowForMachine,
  machinesOnLine as machinesOnLineFor,
  type AnalyticsTableDataContext,
} from '../../utils/analyticsTableExcel';
import { useI18n } from '../../context/I18nContext';
import { useDataVizColors } from '../../context/DataVizColorsContext';
import { useEffectiveCalculationProfile } from '../../context/OcuModeContext';
import CapacityAnalyticsDeltaChart from './CapacityAnalyticsDeltaChart';

export type AnalyticsTableExpandContext = {
  scope: 'line' | 'machine' | 'plant';
  analyticsLines: string[];
  analyticsMachineIds: number[];
  lines: string[];
  machinesProd: CapacityMachineTrend[];
  contractMachines: CapacityMachineTrend[];
  scenProdMachines?: CapacityMachineTrend[];
  scenContractMachines?: CapacityMachineTrend[];
  showScenarioProduction: boolean;
};

type Props = {
  entityLabel: string;
  rows: AnalyticsRow[];
  hasScenario: boolean;
  expandContext?: AnalyticsTableExpandContext;
};

const INDENT_STEP_PX = 28;
const CHEVRON_WIDTH = 14;

function TreeLabelCell({
  level,
  background,
  fontWeight,
  fontSize,
  expandable,
  open,
  onToggle,
  children,
}: {
  level: number;
  background?: string;
  fontWeight?: number | string;
  fontSize?: number;
  expandable?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  const chevron = (isOpen: boolean) => (isOpen ? '▾' : '▸');
  return (
    <td style={{ padding: '8px 10px', verticalAlign: 'middle', background, borderTop: '1px solid #eee' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: level * INDENT_STEP_PX }}>
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
              fontWeight: fontWeight ?? 600,
              fontSize: fontSize ?? 14,
              padding: 0,
              color: '#333',
            }}
            aria-expanded={open}
          >
            <span aria-hidden style={{ width: CHEVRON_WIDTH, textAlign: 'center', color: '#666' }}>
              {chevron(!!open)}
            </span>
            {children}
          </button>
        ) : (
          <>
            <span aria-hidden style={{ width: CHEVRON_WIDTH, flexShrink: 0 }} />
            <span style={{ fontWeight: fontWeight ?? 400, fontSize: fontSize ?? 14 }}>{children}</span>
          </>
        )}
      </div>
    </td>
  );
}

function ValueCells({ row, hasScenario, background }: { row: AnalyticsRow; hasScenario: boolean; background?: string }) {
  const vizColors = useDataVizColors();
  const cellStyle = { padding: '8px 10px', borderTop: '1px solid #eee', background };
  return (
    <>
      <td style={cellStyle}>{fmtPct(row.production)}</td>
      <td style={cellStyle}>{fmtPct(row.contract)}</td>
      <td style={{ ...cellStyle, color: deltaColorContractProd(row.deltaContractMinusProd, vizColors) }}>
        {fmtDelta(row.deltaContractMinusProd)}
      </td>
      {hasScenario && <td style={cellStyle}>{fmtPct(row.scenarioProduction)}</td>}
      {hasScenario && (
        <td style={{ ...cellStyle, color: deltaColorHigherIsBad(row.deltaScenarioProdMinusProd, vizColors) }}>
          {fmtDelta(row.deltaScenarioProdMinusProd)}
        </td>
      )}
    </>
  );
}

export default function CapacityAnalyticsPanel({ entityLabel, rows, hasScenario, expandContext }: Props) {
  const { t } = useI18n();
  const tableExportId = useId();
  const settingsProfile = useEffectiveCalculationProfile(false);
  const subsystem = settingsProfile === 'ocu' ? t('dataViz.subsystemOcu') : t('dataViz.subsystemCapacity');
  const tableTitle = t('dataViz.compareTableTitle', { label: entityLabel });
  const [expandedYears, setExpandedYears] = useState<Set<number>>(() => new Set());
  const [expandedLines, setExpandedLines] = useState<Set<string>>(() => new Set());

  const canExpand = expandContext && expandContext.scope !== 'machine';

  const toggleYear = (year: number) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const toggleLine = (year: number, line: string) => {
    const key = `${year}|${line}`;
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const dataCtx = expandContext as AnalyticsTableDataContext | undefined;
  const machinesOnLine = (line: string) => machinesOnLineFor(line, dataCtx?.machinesProd ?? []);
  const rowForLine = (year: number, line: string) => analyticsRowForLine(year, line, dataCtx!);
  const rowForMachine = (year: number, m: Parameters<typeof analyticsRowForMachine>[1]) =>
    analyticsRowForMachine(year, m, dataCtx!);

  const linesForYear = (): string[] => {
    if (!expandContext) return [];
    if (expandContext.scope === 'line') return expandContext.analyticsLines.length ? expandContext.analyticsLines : [];
    return expandContext.lines;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        data-viz-export-block=""
        data-viz-export-block-type="table"
        data-viz-export-id={tableExportId}
        data-viz-export-title={tableTitle}
        style={{
          background: 'white',
          borderRadius: 8,
          padding: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid #eee',
          overflowX: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>{tableTitle}</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
              <th style={{ padding: '8px 10px' }}>{t('dataViz.colYear')}</th>
              <th style={{ padding: '8px 10px' }}>{t('dataViz.colProductionPct')}</th>
              <th style={{ padding: '8px 10px' }}>{t('dataViz.colContractPct')}</th>
              <th style={{ padding: '8px 10px' }}>{t('dataViz.colDeltaContractProd')}</th>
              {hasScenario && <th style={{ padding: '8px 10px' }}>{t('dataViz.colScenarioProdPct')}</th>}
              {hasScenario && <th style={{ padding: '8px 10px' }}>{t('dataViz.colDeltaScenarioProd')}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const yearOpen = expandedYears.has(r.year);
              const yearLines = linesForYear();
              const showLineLevel = expandContext?.scope === 'plant';

              return (
                <Fragment key={r.year}>
                  <tr>
                    <TreeLabelCell
                      level={0}
                      fontWeight={600}
                      expandable={!!canExpand && yearLines.length > 0}
                      open={yearOpen}
                      onToggle={() => toggleYear(r.year)}
                    >
                      {r.year}
                    </TreeLabelCell>
                    <ValueCells row={r} hasScenario={hasScenario} />
                  </tr>

                  {canExpand && yearOpen && showLineLevel &&
                    yearLines.map((line) => {
                      const lineKeyStr = `${r.year}|${line}`;
                      const lineOpen = expandedLines.has(lineKeyStr);
                      const lineMachines = machinesOnLine(line);
                      const lineRow = rowForLine(r.year, line);

                      return (
                        <Fragment key={lineKeyStr}>
                          <tr>
                            <TreeLabelCell
                              level={1}
                              background="#fafafa"
                              fontWeight={600}
                              expandable={lineMachines.length > 0}
                              open={lineOpen}
                              onToggle={() => toggleLine(r.year, line)}
                            >
                              {t('dataViz.lineLabel', { line })}
                            </TreeLabelCell>
                            <ValueCells row={lineRow} hasScenario={hasScenario} background="#fafafa" />
                          </tr>
                          {lineOpen &&
                            lineMachines.map((m) => {
                              const machineRow = rowForMachine(r.year, m);
                              return (
                                <tr key={`${lineKeyStr}|${m.machine_id}`}>
                                  <TreeLabelCell level={2} background="#f5f7f8" fontSize={13}>
                                    {machineLabel(m)}
                                  </TreeLabelCell>
                                  <ValueCells row={machineRow} hasScenario={hasScenario} background="#f5f7f8" />
                                </tr>
                              );
                            })}
                        </Fragment>
                      );
                    })}

                  {canExpand && yearOpen && expandContext?.scope === 'line' &&
                    linesForYear().flatMap((line) =>
                      machinesOnLine(line).map((m) => {
                        const machineRow = rowForMachine(r.year, m);
                        return (
                          <tr key={`${r.year}|${line}|m|${m.machine_id}`}>
                            <TreeLabelCell level={1} background="#fafafa" fontSize={13}>
                              {machineLabel(m)}
                            </TreeLabelCell>
                            <ValueCells row={machineRow} hasScenario={hasScenario} background="#fafafa" />
                          </tr>
                        );
                      })
                    )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#777' }}>{t('dataViz.deltaFootnote', { subsystem })}</p>
        {canExpand && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#777' }}>{t('dataViz.analyticsTableExpandHint')}</p>
        )}
      </div>

      <CapacityAnalyticsDeltaChart
        title={t('dataViz.annualDiffTitle', { label: entityLabel })}
        rows={rows}
        hasScenario={hasScenario}
      />
    </div>
  );
}

function fmtPct(v: number | null): string {
  return v != null ? `${v}%` : '—';
}

function fmtDelta(v: number | null): string {
  if (v == null) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v} p.p.`;
}

function deltaColorContractProd(v: number | null, colors: DataVizColors): string {
  if (v == null) return '#333';
  if (v < 0) return colors.deltaNegative;
  if (v > 0) return colors.deltaPositive;
  return '#333';
}

function deltaColorHigherIsBad(v: number | null, colors: DataVizColors): string {
  if (v == null) return '#333';
  if (v > 0) return colors.deltaNegative;
  if (v < 0) return colors.deltaPositive;
  return '#333';
}
