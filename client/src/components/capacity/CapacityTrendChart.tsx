import { useId, useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';
import type { TrendChartRow, TrendSeriesDef } from '../../utils/capacityTrends';
import { useI18n } from '../../context/I18nContext';
import { useDataVizColors } from '../../context/DataVizColorsContext';
import { resolveYAxisDomain, type ChartLoadAxisRange, DEFAULT_LOAD_AXIS_RANGE } from '../../utils/chartLoadAxisRange';
import { transformTrendRows, type ChartMetricMode } from '../../utils/chartMetricMode';
import { flexHiKey, flexLoKey, seriesAppliesFlex, withFlexBandRows } from '../../utils/chartFlex';
import CapacityTrendChartDataTable, { type ChartBreakdownScope } from './CapacityTrendChartDataTable';
import { OrderedLegendContent } from './OrderedLegendContent';

type Props = {
  title: string;
  rows: TrendChartRow[];
  series: TrendSeriesDef[];
  height?: number;
  emptyHint?: string;
  /** Zakres osi Y — obciążenie %. */
  loadAxisRange?: ChartLoadAxisRange;
  /** Obciążenie vs wolne capacity (100% − obciążenie). */
  metricMode?: ChartMetricMode;
  /** Flex ±% od nominału — wstęga wokół linii (np. 15 → ±15%). */
  flexPercent?: number | null;
  /** Atrybuty do zrzutu wykresu do PDF (html2canvas). */
  captureKey?: string;
  /** Kontekst do rozwijanego podglądu klient → projekt → detal. */
  breakdownScope?: ChartBreakdownScope;
  /** Przycisk „Pokaż dane wg lat” — wyłącz np. dla wykresu łączonego. */
  allowDataTable?: boolean;
};

function fmtLoadPct(value: number | null | undefined): string {
  return value != null ? `${value}%` : '—';
}

export default function CapacityTrendChart({
  title,
  rows,
  series,
  height = 320,
  emptyHint,
  captureKey,
  breakdownScope,
  loadAxisRange = DEFAULT_LOAD_AXIS_RANGE,
  metricMode = 'load',
  flexPercent = null,
  allowDataTable = true,
}: Props) {
  const { t } = useI18n();
  const vizColors = useDataVizColors();
  const exportId = useId();
  const [showDataTable, setShowDataTable] = useState(false);
  const activeSeries = series.filter((s) => rows.some((r) => r[s.key] != null));
  const hasData = activeSeries.length > 0 && rows.length > 0;
  const canShowDataTable = allowDataTable && !captureKey;
  const showFlex = flexPercent != null && Number.isFinite(flexPercent) && flexPercent > 0;

  const displayRows = useMemo(() => {
    const metricRows = transformTrendRows(rows, series, metricMode);
    return withFlexBandRows(metricRows, series, showFlex ? flexPercent : null);
  }, [rows, series, metricMode, showFlex, flexPercent]);

  const yDomain = resolveYAxisDomain(loadAxisRange);
  const yAxisLabel = metricMode === 'freeCapacity' ? t('dataViz.freeCapacityPct') : t('dataViz.loadPct');
  const refLineY = metricMode === 'freeCapacity' ? 0 : 100;
  const refLineLabel = metricMode === 'freeCapacity' ? t('dataViz.refFreeCapacity0') : t('dataViz.refLoad100');
  const refLineColor = metricMode === 'freeCapacity' ? vizColors.refLineFree : vizColors.refLineOverload;

  const captureProps = captureKey
    ? { 'data-pdf-chart': captureKey, 'data-pdf-chart-title': title }
    : {};

  const chartBlockProps = captureKey
    ? {}
    : {
        'data-viz-export-block': '',
        'data-viz-export-block-type': 'chart',
        'data-viz-export-id': `${exportId}-chart`,
        'data-viz-export-title': title,
      };

  const tableBlockProps = captureKey
    ? {}
    : {
        'data-viz-export-block': '',
        'data-viz-export-block-type': 'table',
        'data-viz-export-id': `${exportId}-table`,
        'data-viz-export-title': `${title} — ${t('dataViz.showChartData')}`,
      };

  const cardStyle = {
    background: 'white',
    borderRadius: 8,
    padding: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid #eee',
    width: captureKey ? '100%' : undefined,
  } as const;

  return (
    <div {...captureProps} style={cardStyle}>
      <div {...chartBlockProps} style={captureKey ? undefined : { background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
          {hasData && canShowDataTable && (
            <button
              type="button"
              data-viz-export-hide=""
              onClick={() => setShowDataTable((v) => !v)}
              style={{
                padding: '4px 10px',
                fontSize: 13,
                border: '1px solid #ccc',
                borderRadius: 6,
                background: showDataTable ? '#f5f5f5' : '#fff',
                color: '#333',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {showDataTable ? t('dataViz.hideChartData') : t('dataViz.showChartData')}
            </button>
          )}
        </div>
        {!hasData ? (
          <p style={{ margin: 0, color: '#888', fontSize: 14 }}>{emptyHint ?? t('dataViz.emptyChartDefault')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={displayRows} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceff1" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                domain={yDomain}
                allowDataOverflow
                tickFormatter={(v) => `${v}%`}
                label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#666' } }}
              />
              <Tooltip
                formatter={(value, name) => {
                  if (Array.isArray(value)) return null;
                  return [fmtLoadPct(value as number | null), String(name ?? '')];
                }}
                labelFormatter={(y) => t('dataViz.tooltipYear', { year: y })}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                content={(props) => (
                  <OrderedLegendContent {...props} orderKeys={activeSeries.map((s) => s.key)} />
                )}
              />
              <ReferenceLine
                y={refLineY}
                stroke={refLineColor}
                strokeDasharray="4 4"
                label={{ value: refLineLabel, position: 'right', fontSize: 11, fill: refLineColor }}
              />
              {showFlex &&
                activeSeries.filter((s) => seriesAppliesFlex(s.key)).map((s) => (
                  <Area
                    key={`${s.key}__flex`}
                    type="monotone"
                    dataKey={(row: TrendChartRow) => {
                      const lo = row[flexLoKey(s.key)];
                      const hi = row[flexHiKey(s.key)];
                      if (lo == null || hi == null || !Number.isFinite(Number(lo)) || !Number.isFinite(Number(hi))) {
                        return null;
                      }
                      return [Number(lo), Number(hi)];
                    }}
                    name={`${s.label} Flex`}
                    stroke="none"
                    fill={s.color}
                    fillOpacity={0.5}
                    legendType="none"
                    tooltipType="none"
                    connectNulls={false}
                    isAnimationActive={false}
                    activeDot={false}
                  />
                ))}
              {activeSeries.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dash}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      {showDataTable && hasData && canShowDataTable && (
        <div {...tableBlockProps} style={{ marginTop: 12, background: 'white' }}>
          <CapacityTrendChartDataTable rows={rows} activeSeries={activeSeries} breakdownScope={breakdownScope} metricMode={metricMode} />
        </div>
      )}
    </div>
  );
}
