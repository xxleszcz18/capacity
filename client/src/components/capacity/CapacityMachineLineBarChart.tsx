import { useId, useMemo } from 'react';
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

const PROD_KEY = 'production';
const CONTRACT_KEY = 'contract';
const CALL_OFF_KEY = 'callOff';

type Props = {
  title: string;
  rows: DualLoadBarRow[];
  /** machine = nr maszyny na X; line = L{{n}} na X */
  xAxisKind: 'machine' | 'line';
  showProduction: boolean;
  showContract: boolean;
  showCallOff?: boolean;
  callOffSeriesLabel?: string;
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

  const barData = useMemo(
    () =>
      rows.map((r) => {
        const axisShort =
          xAxisKind === 'line' ? t('dataViz.lineShortLabel', { line: r.shortLabel }) : r.shortLabel;
        const axisLabel =
          xAxisKind === 'line' ? t('dataViz.lineLabel', { line: r.label }) : r.label;
        return {
          key: r.key,
          axisShort,
          axisLabel,
          machineCount: r.machineCount,
          [PROD_KEY]: applyChartMetric(r.production, metricMode),
          [CONTRACT_KEY]: applyChartMetric(r.contract, metricMode),
          [CALL_OFF_KEY]: applyChartMetric(r.callOff ?? null, metricMode),
        };
      }),
    [rows, metricMode, t, xAxisKind]
  );

  const manyTicks =
    barData.length > 10 || (xAxisKind === 'machine' && barData.some((r) => String(r.axisShort).length > 8));
  const xAxisAngle = manyTicks ? -90 : 0;
  const xAxisHeight = manyTicks ? 56 : 28;
  const chartBottomMargin = manyTicks ? 12 : 4;

  const hasSeries = showProduction || showContract || showCallOff;
  const hasData =
    hasSeries &&
    barData.some(
      (r) =>
        (showProduction && r[PROD_KEY] != null) ||
        (showContract && r[CONTRACT_KEY] != null) ||
        (showCallOff && r[CALL_OFF_KEY] != null)
    );

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
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine
              y={refLineY}
              stroke={refLineColor}
              strokeDasharray="4 4"
              label={{ value: refLineLabel, position: 'insideTopRight', fontSize: 10, fill: refLineColor }}
            />
            {showProduction && (
              <Bar
                dataKey={PROD_KEY}
                name={t('reports.dataViz.seriesProd')}
                fill={vizColors.production}
                radius={[4, 4, 0, 0]}
              />
            )}
            {showContract && (
              <Bar
                dataKey={CONTRACT_KEY}
                name={t('reports.dataViz.seriesContract')}
                fill={vizColors.contract}
                radius={[4, 4, 0, 0]}
              />
            )}
            {showCallOff && (
              <Bar
                dataKey={CALL_OFF_KEY}
                name={callOffName}
                fill={vizColors.callOff}
                radius={[4, 4, 0, 0]}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
