import { useId, useMemo, useState } from 'react';
import {
  Area,
  Bar,
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
import type { ChartSeriesType } from '../../utils/chartSeriesType';
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
  /** Liniowy lub słupkowy. */
  chartType?: ChartSeriesType;
  /** Flex ±% od nominału — wstęga wokół linii (np. 15 → ±15%). */
  flexPercent?: number | null;
  /** Atrybuty do zrzutu wykresu do PDF (html2canvas). */
  captureKey?: string;
  /** Kontekst do rozwijanego podglądu klient → projekt → detal. */
  breakdownScope?: ChartBreakdownScope;
  /** Przycisk „Pokaż dane…” — wyłącz np. dla wykresu łączonego. */
  allowDataTable?: boolean;
  /** Granularność osi / tabeli danych (rok / miesiąc / tydzień). */
  rangeMode?: 'year' | 'month' | 'week';
  /**
   * Powyżej tej liczby aktywnych serii legenda jest ukrywana (wykres pozostaje widoczny).
   * Domyślnie 12. Ustaw null/false, by zawsze pokazywać legendę.
   */
  legendMaxSeries?: number | null;
};

/** Próg: przy wielu liniach/maszynach na jednym wykresie legenda zasłania plot. */
const DEFAULT_LEGEND_MAX_SERIES = 12;

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
  chartType = 'line',
  flexPercent = null,
  allowDataTable = true,
  rangeMode = 'year',
  legendMaxSeries = DEFAULT_LEGEND_MAX_SERIES,
}: Props) {
  const { t } = useI18n();
  const vizColors = useDataVizColors();
  const exportId = useId();
  const [showDataTable, setShowDataTable] = useState(false);
  const activeSeries = series.filter((s) => rows.some((r) => r[s.key] != null));
  const hasData = activeSeries.length > 0 && rows.length > 0;
  const showLegend =
    legendMaxSeries == null || legendMaxSeries <= 0 || activeSeries.length <= legendMaxSeries;
  const xDataKey = rows.some((r) => r.periodLabel) ? 'periodLabel' : 'year';
  const canShowDataTable = allowDataTable && !captureKey;
  const isBar = chartType === 'bar';
  const showFlex = !isBar && flexPercent != null && Number.isFinite(flexPercent) && flexPercent > 0;
  const showDataLabel =
    rangeMode === 'week'
      ? t('dataViz.showChartDataWeek')
      : rangeMode === 'month'
        ? t('dataViz.showChartDataMonth')
        : t('dataViz.showChartData');
  const tableExportTitle = `${title} — ${showDataLabel}`;

  const displayRows = useMemo(() => {
    const metricRows = transformTrendRows(rows, series, metricMode);
    return withFlexBandRows(metricRows, series, showFlex ? flexPercent : null);
  }, [rows, series, metricMode, showFlex, flexPercent]);

  const yDomain = resolveYAxisDomain(loadAxisRange, metricMode);
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
        'data-viz-export-title': tableExportTitle,
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
              {showDataTable ? t('dataViz.hideChartData') : showDataLabel}
            </button>
          )}
        </div>
        {hasData && !showLegend && (
          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#666', lineHeight: 1.4 }}>
            {t('dataViz.legendHiddenManySeries', { count: activeSeries.length })}
          </p>
        )}
        {!hasData ? (
          <p style={{ margin: 0, color: '#888', fontSize: 14 }}>{emptyHint ?? t('dataViz.emptyChartDefault')}</p>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={displayRows} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eceff1" />
              <XAxis dataKey={xDataKey} tick={{ fontSize: 12 }} />
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
                labelFormatter={(label) =>
                  xDataKey === 'periodLabel'
                    ? String(label)
                    : t('dataViz.tooltipYear', { year: label })
                }
                itemSorter={(item) => {
                  const key = String(item.dataKey ?? item.name ?? '');
                  const idx = activeSeries.findIndex((s) => s.key === key);
                  return idx >= 0 ? idx : 1000;
                }}
              />
              {showLegend && (
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  content={(props) => (
                    <OrderedLegendContent {...props} orderKeys={activeSeries.map((s) => s.key)} />
                  )}
                />
              )}
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
              {activeSeries.map((s) =>
                isBar ? (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={s.color}
                    fillOpacity={s.dash ? 0.65 : 0.9}
                    maxBarSize={36}
                    isAnimationActive={false}
                  />
                ) : (
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
                )
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      {showDataTable && hasData && canShowDataTable && (
        <div {...tableBlockProps} style={{ marginTop: 12, background: 'white' }}>
          <CapacityTrendChartDataTable
            rows={rows}
            activeSeries={activeSeries}
            breakdownScope={breakdownScope}
            metricMode={metricMode}
            rangeMode={rangeMode}
          />
        </div>
      )}
    </div>
  );
}
