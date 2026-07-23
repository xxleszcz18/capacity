import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';
import type { DualLoadBarRow } from '../../utils/capacityTrends';
import { useI18n } from '../../context/I18nContext';
import { useDataVizColors } from '../../context/DataVizColorsContext';
import { resolveYAxisDomain, type ChartLoadAxisRange, DEFAULT_LOAD_AXIS_RANGE } from '../../utils/chartLoadAxisRange';
import { applyChartMetric, type ChartMetricMode } from '../../utils/chartMetricMode';
import { OrderedLegendContent } from './OrderedLegendContent';

const PROD_KEY = 'production';
const CONTRACT_KEY = 'contract';
const CALL_OFF_KEY = 'callOff';

export type ExtraBarSeriesMeta = {
  key: string;
  name: string;
  color: string;
};

/** @deprecated Użyj ExtraBarSeriesMeta */
export type CallOffBarSeriesMeta = ExtraBarSeriesMeta;

type Props = {
  title: string;
  rows: DualLoadBarRow[];
  /** machine = nr maszyny na X; line = L{{n}} na X */
  xAxisKind: 'machine' | 'line';
  showProduction: boolean;
  showContract: boolean;
  /** Pojedynczy Call offs (gdy brak extraSeries z Call offs). */
  showCallOff?: boolean;
  callOffSeriesLabel?: string;
  /** Dodatkowe serie (Call offs, scenariusze). */
  extraSeries?: ExtraBarSeriesMeta[];
  /** Alias wsteczny — to samo co extraSeries. */
  callOffSeries?: ExtraBarSeriesMeta[];
  year: number;
  height?: number;
  emptyHint?: string;
  loadAxisRange?: ChartLoadAxisRange;
  metricMode?: ChartMetricMode;
  captureKey?: string;
};

export default function CapacityMachineLineBarChart({
  title,
  rows,
  xAxisKind,
  showProduction,
  showContract,
  showCallOff = false,
  callOffSeriesLabel,
  extraSeries,
  callOffSeries,
  year,
  height = 380,
  emptyHint,
  loadAxisRange = DEFAULT_LOAD_AXIS_RANGE,
  metricMode = 'load',
  captureKey,
}: Props) {
  const { t } = useI18n();
  const vizColors = useDataVizColors();
  const exportId = useId();
  const yDomain = resolveYAxisDomain(loadAxisRange);
  const yAxisLabel = metricMode === 'freeCapacity' ? t('dataViz.freeCapacityPct') : t('dataViz.loadPct');
  const refLineY = metricMode === 'freeCapacity' ? 0 : 100;
  const refLineLabel = metricMode === 'freeCapacity' ? t('dataViz.refFreeCapacity0') : t('dataViz.refLoad100');
  const refLineColor = metricMode === 'freeCapacity' ? vizColors.refLineFree : vizColors.refLineOverload;
  const callOffName = callOffSeriesLabel ?? t('reports.dataViz.seriesCallOff');
  const extras = extraSeries ?? callOffSeries ?? [];
  const hasExtras = extras.length > 0;
  const extraKeys = hasExtras ? extras.map((s) => s.key) : showCallOff ? [CALL_OFF_KEY] : [];

  const availableKeys = useMemo(() => {
    const keys: string[] = [];
    if (showContract) keys.push(CONTRACT_KEY);
    if (showProduction) keys.push(PROD_KEY);
    keys.push(...extraKeys);
    return keys;
  }, [showContract, showProduction, extraKeys]);

  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setHiddenKeys((prev) => {
      const next = new Set<string>();
      for (const k of prev) {
        if (availableKeys.includes(k)) next.add(k);
      }
      return next.size === prev.size && [...prev].every((k) => next.has(k)) ? prev : next;
    });
  }, [availableKeys]);

  const toggleSeries = useCallback((dataKey: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  }, []);

  const barData = useMemo(
    () =>
      rows.map((r) => {
        const axisShort =
          xAxisKind === 'line' ? t('dataViz.lineShortLabel', { line: r.shortLabel }) : r.shortLabel;
        const axisLabel =
          xAxisKind === 'line' ? t('dataViz.lineLabel', { line: r.label }) : r.label;
        const row: Record<string, string | number | null | undefined> = {
          key: r.key,
          axisShort,
          axisLabel,
          machineCount: r.machineCount,
          [PROD_KEY]: applyChartMetric(r.production, metricMode),
          [CONTRACT_KEY]: applyChartMetric(r.contract, metricMode),
        };
        if (hasExtras) {
          for (const s of extras) {
            const raw = r.seriesValues?.[s.key] ?? null;
            row[s.key] = applyChartMetric(raw, metricMode);
          }
        } else {
          row[CALL_OFF_KEY] = applyChartMetric(r.callOff ?? null, metricMode);
        }
        return row;
      }),
    [rows, metricMode, t, xAxisKind, hasExtras, extras]
  );

  const manyTicks =
    barData.length > 10 || (xAxisKind === 'machine' && barData.some((r) => String(r.axisShort).length > 8));
  const xAxisAngle = manyTicks ? -90 : 0;
  const xAxisHeight = manyTicks ? 56 : 28;
  const chartBottomMargin = manyTicks ? 12 : 4;

  const showContractBar = showContract && !hiddenKeys.has(CONTRACT_KEY);
  const showProductionBar = showProduction && !hiddenKeys.has(PROD_KEY);
  const visibleExtraKeys = extraKeys.filter((k) => !hiddenKeys.has(k));

  const hasConfiguredSeries = showProduction || showContract || extraKeys.length > 0;
  const hasData =
    hasConfiguredSeries &&
    barData.some(
      (r) =>
        (showProduction && r[PROD_KEY] != null) ||
        (showContract && r[CONTRACT_KEY] != null) ||
        extraKeys.some((k) => r[k] != null)
    );

  const legendOrder = [CONTRACT_KEY, PROD_KEY, ...extraKeys];

  const wrapProps = captureKey
    ? { 'data-pdf-chart': captureKey, 'data-pdf-chart-title': title }
    : {
        'data-viz-export-block': '',
        'data-viz-export-block-type': 'chart',
        'data-viz-export-id': exportId,
        'data-viz-export-title': title,
      };

  return (
    <div
      {...wrapProps}
      style={{
        background: 'white',
        borderRadius: 8,
        padding: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid #eee',
        width: '100%',
      }}
    >
      <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>{title}</h3>
      {!hasData ? (
        <p style={{ margin: 0, color: '#888', fontSize: 13 }}>{emptyHint ?? t('dataViz.emptyMachines')}</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={barData} margin={{ top: 8, right: 16, left: 0, bottom: chartBottomMargin }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eceff1" />
            <XAxis
              dataKey="axisShort"
              interval={0}
              height={xAxisHeight}
              tick={{ fontSize: manyTicks ? 10 : 12 }}
              angle={xAxisAngle}
              textAnchor={manyTicks ? 'end' : 'middle'}
              tickMargin={manyTicks ? 4 : 6}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              domain={yDomain}
              allowDataOverflow
              tickFormatter={(v) => `${v}%`}
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#666' } }}
            />
            <Tooltip
              formatter={(v, name) => [`${v != null ? v : '—'}%`, String(name ?? '')]}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as
                  | { axisLabel?: string; machineCount?: number }
                  | undefined;
                if (!row) return t('dataViz.tooltipYear', { year });
                if (xAxisKind === 'line') {
                  return t('dataViz.lineBarTooltip', {
                    line: row.axisLabel ?? '',
                    year,
                    count: row.machineCount ?? 0,
                  });
                }
                return t('dataViz.machineBarTooltip', {
                  machine: row.axisLabel ?? '',
                  year,
                });
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
              content={(props) => (
                <OrderedLegendContent
                  {...props}
                  orderKeys={legendOrder}
                  hiddenKeys={hiddenKeys}
                  onItemClick={toggleSeries}
                />
              )}
            />
            <ReferenceLine
              y={refLineY}
              stroke={refLineColor}
              strokeDasharray="4 4"
              label={{ value: refLineLabel, position: 'insideTopRight', fontSize: 10, fill: refLineColor }}
            />
            {showContract && (
              <Bar
                dataKey={CONTRACT_KEY}
                name={t('reports.dataViz.seriesContract')}
                fill={vizColors.contract}
                radius={[4, 4, 0, 0]}
                hide={!showContractBar}
              />
            )}
            {showProduction && (
              <Bar
                dataKey={PROD_KEY}
                name={t('reports.dataViz.seriesProd')}
                fill={vizColors.production}
                radius={[4, 4, 0, 0]}
                hide={!showProductionBar}
              />
            )}
            {hasExtras
              ? extras.map((s) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    fill={s.color}
                    radius={[4, 4, 0, 0]}
                    hide={!visibleExtraKeys.includes(s.key)}
                  />
                ))
              : showCallOff && (
                  <Bar
                    dataKey={CALL_OFF_KEY}
                    name={callOffName}
                    fill={vizColors.callOff}
                    radius={[4, 4, 0, 0]}
                    hide={hiddenKeys.has(CALL_OFF_KEY)}
                  />
                )}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
