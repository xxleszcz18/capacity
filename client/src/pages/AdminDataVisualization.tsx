import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { api } from '../api/client';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectFilter from '../components/MultiSelectFilter';
import DataLoadingOverlay, { DataLoadingBadge } from '../components/DataLoadingOverlay';
import { AdminHubList } from '../components/AdminHubCards';
import { joinCsvFilter, formatMultiFilterSummary } from '../utils/filterParams';
import MachineDimensionFiltersPanel from '../components/MachineDimensionFiltersPanel';
import CapacityTrendChart from '../components/capacity/CapacityTrendChart';
import ChartGridLayoutPicker, { chartGridStyle, type ChartGridCols } from '../components/capacity/ChartGridLayoutPicker';
import ChartLoadAxisRangePicker from '../components/capacity/ChartLoadAxisRangePicker';
import ChartMetricModePicker from '../components/capacity/ChartMetricModePicker';
import type { ChartMetricMode } from '../utils/chartMetricMode';
import {
  DEFAULT_LOAD_AXIS_RANGE,
  type ChartLoadAxisRange,
} from '../utils/chartLoadAxisRange';
import CapacityAnalyticsPanel from '../components/capacity/CapacityAnalyticsPanel';
import CapacityAnalyticsDeltaChart from '../components/capacity/CapacityAnalyticsDeltaChart';
import VisualizationReportModal from '../components/capacity/VisualizationReportModal';
import {
  averageLoad,
  buildAnalyticsRows,
  buildTrendRows,
  calendarYear,
  lineKey,
  lineLoadPercent,
  linesLoadPercent,
  machineLabel,
  machineLoadPercent,
  machinesLoadPercent,
  uniqueLines,
  yearsRange,
  type CapacityTrendBundle,
  type TrendSeriesDef,
  type TrendTableBuildOptions,
} from '../utils/capacityTrends';
import {
  analyticsTableRows,
  downloadCapacityVisualizationPdf,
  buildLinesOverviewPdfSection,
  trendSectionFromGetters,
  type PdfChartPart,
  type VisualizationPdfSection,
} from '../utils/capacityVisualizationPdf';
import { buildAnalyticsExcelSection } from '../utils/analyticsTableExcel';
import {
  buildNumericLinesOverviewSection,
  buildNumericTrendSection,
  downloadCapacityVisualizationExcel,
} from '../utils/capacityVisualizationExcel';
import {
  buildBreakdownLinesOverviewSection,
  buildBreakdownTrendSection,
  type SeriesValues,
} from '../utils/capacityBreakdownExcel';
import { captureChartsBySelector, waitForChartsPaint, captureViewPanelForPdf } from '../utils/captureChartImage';
import {
  DEFAULT_VISUALIZATION_REPORT_OPTIONS,
  buildCurrentViewReportOptions,
  type VisualizationReportOptions,
  type CurrentViewContext,
} from '../utils/visualizationReportOptions';
import { useI18n } from '../context/I18nContext';
import { useEffectiveCalculationProfile } from '../context/OcuModeContext';
import { useDataVizColors } from '../context/DataVizColorsContext';
import { useAuth } from '../context/AuthContext';
import { getDataVizPdfStrings, localeDateTime } from '../i18n/reportLabels';
import {
  buildDimensionApiParams,
  EMPTY_DIM_FILTERS,
  hasActiveDimFilters,
  type DimFiltersState,
} from '../utils/machineDimensionFilters';

type TabId = 'lines' | 'machines' | 'analytics';
type MachineStatusFilter = 'active' | 'inactive' | 'RFQ' | 'all';

const panelStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: 8,
  padding: '1rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  border: '1px solid #eee',
};

async function fetchCapacityBundle(params: {
  yearFrom: number;
  yearTo: number;
  machineStatus: MachineStatusFilter[];
  type?: string[];
  client?: string[];
  useContractualVolumes?: boolean;
  scenarioId?: number;
  settingsProfile?: 'capacity' | 'ocu';
  dimFilters?: DimFiltersState;
}): Promise<CapacityTrendBundle> {
  const res = await api.capacity.calculator({
    yearFrom: params.yearFrom,
    yearTo: params.yearTo,
    machineStatuses: joinCsvFilter(params.machineStatus),
    types: joinCsvFilter(params.type ?? []),
    clients: joinCsvFilter(params.client ?? []),
    useContractualVolumes: params.useContractualVolumes,
    scenarioId: params.scenarioId,
    settingsProfile: params.scenarioId == null && params.settingsProfile === 'ocu' ? 'ocu' : undefined,
    ...buildDimensionApiParams(params.dimFilters ?? EMPTY_DIM_FILTERS),
  });
  return {
    yearFrom: res.yearFrom,
    yearTo: res.yearTo,
    machines: res.machines ?? [],
  };
}

const chartToolbarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px 24px',
  alignItems: 'center',
  marginBottom: 12,
};

function ChartViewToolbar({
  showGrid,
  chartGridCols,
  onChartGridColsChange,
  loadAxisRange,
  onLoadAxisRangeChange,
  chartMetricMode,
  onChartMetricModeChange,
  yAxisLabel,
}: {
  showGrid: boolean;
  chartGridCols: ChartGridCols;
  onChartGridColsChange: (v: ChartGridCols) => void;
  loadAxisRange: ChartLoadAxisRange;
  onLoadAxisRangeChange: (v: ChartLoadAxisRange) => void;
  chartMetricMode: ChartMetricMode;
  onChartMetricModeChange: (v: ChartMetricMode) => void;
  yAxisLabel: string;
}) {
  return (
    <div data-viz-export-chrome style={chartToolbarStyle}>
      {showGrid && <ChartGridLayoutPicker value={chartGridCols} onChange={onChartGridColsChange} />}
      <ChartMetricModePicker value={chartMetricMode} onChange={onChartMetricModeChange} />
      <ChartLoadAxisRangePicker value={loadAxisRange} onChange={onLoadAxisRangeChange} axisLabel={yAxisLabel} />
    </div>
  );
}

function ChipToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        padding: '4px 10px',
        margin: '0 6px 6px 0',
        borderRadius: 16,
        border: `1px solid ${checked ? 'var(--cap-green)' : '#ccc'}`,
        background: checked ? '#e8f5e9' : '#fafafa',
        color: checked ? '#1b5e20' : '#444',
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      {label}
    </button>
  );
}

export default function AdminDataVisualization() {
  const { t, te, locale } = useI18n();
  const { hasPermission } = useAuth();
  const canDownloadReports = hasPermission('admin_data_viz.download');
  const vizColors = useDataVizColors();
  const settingsProfile = useEffectiveCalculationProfile(false);
  const subsystem = useMemo(
    () => (settingsProfile === 'ocu' ? t('dataViz.subsystemOcu') : t('dataViz.subsystemCapacity')),
    [settingsProfile, t]
  );
  const pdfStrings = useMemo(() => getDataVizPdfStrings(locale, settingsProfile), [locale, settingsProfile]);
  const [tab, setTab] = useState<TabId>('lines');
  const [yearFrom, setYearFrom] = useState<number | null>(null);
  const [yearTo, setYearTo] = useState<number | null>(null);
  const [yearsReady, setYearsReady] = useState(false);
  const [machineStatus, setMachineStatus] = useState<MachineStatusFilter[]>(['active']);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [machineTypes, setMachineTypes] = useState<string[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [scenarioId, setScenarioId] = useState<number | ''>('');
  const [scenarios, setScenarios] = useState<{ id: number; name: string }[]>([]);
  const [lineChartCombined, setLineChartCombined] = useState(false);
  const [machineChartCombined, setMachineChartCombined] = useState(false);
  const [chartGridCols, setChartGridCols] = useState<ChartGridCols>(1);
  const [loadAxisRange, setLoadAxisRange] = useState<ChartLoadAxisRange>(DEFAULT_LOAD_AXIS_RANGE);
  const [chartMetricMode, setChartMetricMode] = useState<ChartMetricMode>('load');
  const [dimFilters, setDimFilters] = useState<DimFiltersState>(EMPTY_DIM_FILTERS);

  const [showProduction, setShowProduction] = useState(true);
  const [showContract, setShowContract] = useState(true);
  const [showScenarioProduction, setShowScenarioProduction] = useState(true);
  const [showScenarioContract, setShowScenarioContract] = useState(false);

  const [prod, setProd] = useState<CapacityTrendBundle | null>(null);
  const [contract, setContract] = useState<CapacityTrendBundle | null>(null);
  const [scenProd, setScenProd] = useState<CapacityTrendBundle | null>(null);
  const [scenContract, setScenContract] = useState<CapacityTrendBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportOptions, setReportOptions] = useState<VisualizationReportOptions>(DEFAULT_VISUALIZATION_REPORT_OPTIONS);
  const [pdfCaptureActive, setPdfCaptureActive] = useState(false);
  const pdfChartHostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [pdfMessage, setPdfMessage] = useState('');

  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [selectedMachineIds, setSelectedMachineIds] = useState<Set<number>>(new Set());

  const [analyticsScope, setAnalyticsScope] = useState<'line' | 'machine' | 'plant'>('line');
  const [analyticsLines, setAnalyticsLines] = useState<string[]>([]);
  const [analyticsMachineIds, setAnalyticsMachineIds] = useState<number[]>([]);

  const effectiveYearFrom = Math.min(yearFrom ?? calendarYear() - 1, yearTo ?? calendarYear() + 10);
  const effectiveYearTo = Math.max(yearFrom ?? calendarYear() - 1, yearTo ?? calendarYear() + 10);
  const years = yearsRange(effectiveYearFrom, effectiveYearTo);
  const hasScenario = scenarioId !== '' && Number(scenarioId) > 0;

  const breakdownFetchParams = useMemo(
    () => ({
      yearFrom: effectiveYearFrom,
      yearTo: effectiveYearTo,
      machineStatus,
      type: typeFilter,
      client: clientFilter,
      scenarioId: hasScenario ? Number(scenarioId) : undefined,
      settingsProfile,
      ...buildDimensionApiParams(dimFilters),
    }),
    [effectiveYearFrom, effectiveYearTo, machineStatus, typeFilter, clientFilter, hasScenario, scenarioId, settingsProfile, dimFilters]
  );

  useEffect(() => {
    api.scenarios.list({ archived: false }).then((list) => setScenarios(list.map((s) => ({ id: s.id, name: s.name })))).catch(() => setScenarios([]));
    api.machines.types().then(setMachineTypes).catch(() => setMachineTypes([]));
    api.projects.clients().then(setClients).catch(() => setClients([]));
  }, []);

  const tableOpts: TrendTableBuildOptions = useMemo(
    () => ({
      showProduction,
      showContract,
      hasScenario,
      showScenarioProduction,
      showScenarioContract,
    }),
    [showProduction, showContract, hasScenario, showScenarioProduction, showScenarioContract]
  );

  const loadData = useCallback(() => {
    setLoading(true);
    setError('');
    const base = {
      yearFrom: effectiveYearFrom,
      yearTo: effectiveYearTo,
      machineStatus,
      type: typeFilter,
      client: clientFilter,
      settingsProfile,
      dimFilters,
    };
    const sid = hasScenario ? Number(scenarioId) : undefined;
    const tasks: Promise<void>[] = [
      fetchCapacityBundle(base).then(setProd),
      fetchCapacityBundle({ ...base, useContractualVolumes: true }).then(setContract),
    ];
    if (sid) {
      tasks.push(fetchCapacityBundle({ ...base, scenarioId: sid }).then(setScenProd));
      tasks.push(fetchCapacityBundle({ ...base, scenarioId: sid, useContractualVolumes: true }).then(setScenContract));
    } else {
      setScenProd(null);
      setScenContract(null);
    }
    Promise.all(tasks)
      .catch((e: Error) => {
        setError(te(e?.message) || t('dataViz.loadFailed', { subsystem }));
        setProd(null);
        setContract(null);
        setScenProd(null);
        setScenContract(null);
      })
      .finally(() => setLoading(false));
  }, [effectiveYearFrom, effectiveYearTo, machineStatus, typeFilter, clientFilter, hasScenario, scenarioId, settingsProfile, dimFilters, subsystem, t, te]);

  useEffect(() => {
    api.settings.visual
      .get()
      .then((v) => {
        setYearFrom(v.data_viz_default_year_from);
        setYearTo(v.data_viz_default_year_to);
        setYearsReady(true);
      })
      .catch(() => {
        setYearFrom(calendarYear() - 1);
        setYearTo(calendarYear() + 10);
        setYearsReady(true);
      });
  }, []);

  useEffect(() => {
    if (!yearsReady) return;
    loadData();
  }, [loadData, yearsReady]);

  const machinesProd = prod?.machines ?? [];
  const lines = useMemo(() => uniqueLines(machinesProd), [machinesProd]);

  const hasActiveFilter = useMemo(
    () =>
      clientFilter.length > 0 ||
      typeFilter.length > 0 ||
      machineStatus.length !== 1 ||
      machineStatus[0] !== 'active' ||
      hasScenario ||
      hasActiveDimFilters(dimFilters),
    [clientFilter, typeFilter, machineStatus, hasScenario, dimFilters]
  );

  useEffect(() => {
    if (lines.length) {
      setSelectedLines(new Set(hasActiveFilter ? lines : lines.slice(0, Math.min(4, lines.length))));
    } else {
      setSelectedLines(new Set());
    }
  }, [lines.join('|'), hasActiveFilter]);

  useEffect(() => {
    if (machinesProd.length) {
      setSelectedMachineIds(
        new Set(
          hasActiveFilter
            ? machinesProd.map((m) => m.machine_id)
            : machinesProd.slice(0, 3).map((m) => m.machine_id)
        )
      );
    } else {
      setSelectedMachineIds(new Set());
    }
  }, [machinesProd.map((m) => m.machine_id).join(','), hasActiveFilter]);

  useEffect(() => {
    if (analyticsScope === 'line' && analyticsLines.length === 0 && lines.length) setAnalyticsLines([lines[0]]);
    if (analyticsScope === 'machine' && analyticsMachineIds.length === 0 && machinesProd.length) {
      setAnalyticsMachineIds([machinesProd[0].machine_id]);
    }
  }, [analyticsScope, lines.join(','), machinesProd.map((m) => m.machine_id).join(',')]);

  const baseSeriesForEntity = (
    prefix: string,
    getProd: (year: number) => number | null,
    getContract: (year: number) => number | null,
    getScenProd?: (year: number) => number | null,
    getScenContract?: (year: number) => number | null
  ): TrendSeriesDef[] => {
    const out: TrendSeriesDef[] = [];
    if (showProduction) {
      out.push({ key: `${prefix}_prod`, label: t('reports.dataViz.seriesProd'), color: vizColors.production, getValue: getProd });
    }
    if (showContract) {
      out.push({ key: `${prefix}_contract`, label: t('reports.dataViz.seriesContract'), color: vizColors.contract, getValue: getContract });
    }
    if (hasScenario && showScenarioProduction && getScenProd) {
      out.push({
        key: `${prefix}_scen_prod`,
        label: t('reports.dataViz.seriesScenProd'),
        color: vizColors.scenarioProduction,
        dash: '6 4',
        getValue: getScenProd,
      });
    }
    if (hasScenario && showScenarioContract && getScenContract) {
      out.push({
        key: `${prefix}_scen_contract`,
        label: t('reports.dataViz.seriesScenContract'),
        color: vizColors.scenarioContract,
        dash: '4 4',
        getValue: getScenContract,
      });
    }
    return out;
  };

  const buildCombinedLineSeries = (): TrendSeriesDef[] => {
    const out: TrendSeriesDef[] = [];
    let colorIdx = 0;
    for (const line of Array.from(selectedLines)) {
      const nextColor = () => vizColors.comparePalette[colorIdx++ % vizColors.comparePalette.length];
      if (showProduction) {
        out.push({
          key: `cmp_L${line}_prod`,
          label: t('reports.dataViz.lineSeriesProd', { line }),
          color: nextColor(),
          getValue: (year) => lineLoadPercent(machinesProd, line, year),
        });
      }
      if (showContract) {
        out.push({
          key: `cmp_L${line}_kon`,
          label: t('reports.dataViz.lineSeriesContract', { line }),
          color: nextColor(),
          dash: '5 3',
          getValue: (year) => lineLoadPercent(contract?.machines ?? [], line, year),
        });
      }
      if (hasScenario && showScenarioProduction && scenProd) {
        out.push({
          key: `cmp_L${line}_scenp`,
          label: t('reports.dataViz.lineSeriesScenProd', { line }),
          color: nextColor(),
          dash: '6 4',
          getValue: (year) => lineLoadPercent(scenProd.machines, line, year),
        });
      }
    }
    return out;
  };

  const buildCombinedMachineSeries = (): TrendSeriesDef[] => {
    const out: TrendSeriesDef[] = [];
    let colorIdx = 0;
    for (const m of machinesProd.filter((x) => selectedMachineIds.has(x.machine_id))) {
      const cm = contract?.machines.find((x) => x.machine_id === m.machine_id);
      const sm = scenProd?.machines.find((x) => x.machine_id === m.machine_id);
      const label = machineLabel(m);
      const nextColor = () => vizColors.comparePalette[colorIdx++ % vizColors.comparePalette.length];
      if (showProduction) {
        out.push({
          key: `cmp_M${m.machine_id}_prod`,
          label: t('reports.dataViz.machineSeriesProd', { label }),
          color: nextColor(),
          getValue: (year) => machineLoadPercent(m, year),
        });
      }
      if (showContract && cm) {
        out.push({
          key: `cmp_M${m.machine_id}_kon`,
          label: t('reports.dataViz.machineSeriesContract', { label }),
          color: nextColor(),
          dash: '5 3',
          getValue: (year) => machineLoadPercent(cm, year),
        });
      }
      if (hasScenario && showScenarioProduction && sm) {
        out.push({
          key: `cmp_M${m.machine_id}_scen`,
          label: t('reports.dataViz.machineSeriesScen', { label }),
          color: nextColor(),
          dash: '6 4',
          getValue: (year) => machineLoadPercent(sm, year),
        });
      }
    }
    return out;
  };

  const combinedLineSeries = useMemo(
    () => buildCombinedLineSeries(),
    [
      selectedLines,
      machinesProd,
      contract,
      scenProd,
      years,
      showProduction,
      showContract,
      hasScenario,
      showScenarioProduction,
    ]
  );

  const combinedMachineSeries = useMemo(
    () => buildCombinedMachineSeries(),
    [
      selectedMachineIds,
      machinesProd,
      contract,
      scenProd,
      years,
      showProduction,
      showContract,
      hasScenario,
      showScenarioProduction,
    ]
  );

  const chartYAxisLabel =
    chartMetricMode === 'freeCapacity' ? t('dataViz.freeCapacityAxisLabel') : t('dataViz.loadAxisLabel');

  const combinedLineChart =
    lineChartCombined && selectedLines.size > 0 ? (
      <CapacityTrendChart
        title={`Porównanie linii (${Array.from(selectedLines).join(', ')})`}
        rows={buildTrendRows(years, combinedLineSeries)}
        series={combinedLineSeries}
        height={380}
        emptyHint={t('dataViz.emptyLines')}
        loadAxisRange={loadAxisRange}
        metricMode={chartMetricMode}
      />
    ) : null;

  const combinedMachineChart =
    machineChartCombined && selectedMachineIds.size > 0 ? (
      <CapacityTrendChart
        title={`Porównanie maszyn (${selectedMachineIds.size} wybranych)`}
        rows={buildTrendRows(years, combinedMachineSeries)}
        series={combinedMachineSeries}
        height={380}
        emptyHint={t('dataViz.emptyMachines')}
        loadAxisRange={loadAxisRange}
        metricMode={chartMetricMode}
      />
    ) : null;

  const lineCharts = !lineChartCombined
    ? Array.from(selectedLines).map((line) => {
    const series = baseSeriesForEntity(
      `line_${line}`,
      (year) => lineLoadPercent(machinesProd, line, year),
      (year) => lineLoadPercent(contract?.machines ?? [], line, year),
      (year) => (scenProd ? lineLoadPercent(scenProd.machines, line, year) : null),
      (year) => (scenContract ? lineLoadPercent(scenContract.machines, line, year) : null)
    );
    return (
      <CapacityTrendChart
        key={line}
        title={t('reports.dataViz.lineChartTitle', { line })}
        rows={buildTrendRows(years, series)}
        series={series}
        emptyHint={t('dataViz.emptyLineMachines')}
        breakdownScope={{ kind: 'line', line, fetchParams: breakdownFetchParams }}
        loadAxisRange={loadAxisRange}
        metricMode={chartMetricMode}
      />
    );
  })
    : [];

  const machineCharts = !machineChartCombined
    ? machinesProd
    .filter((m) => selectedMachineIds.has(m.machine_id))
    .map((m) => {
      const cm = contract?.machines.find((x) => x.machine_id === m.machine_id);
      const sm = scenProd?.machines.find((x) => x.machine_id === m.machine_id);
      const scm = scenContract?.machines.find((x) => x.machine_id === m.machine_id);
      const series = baseSeriesForEntity(
        `m_${m.machine_id}`,
        (year) => machineLoadPercent(m, year),
        (year) => (cm ? machineLoadPercent(cm, year) : null),
        (year) => (sm ? machineLoadPercent(sm, year) : null),
        (year) => (scm ? machineLoadPercent(scm, year) : null)
      );
      return (
        <CapacityTrendChart
          key={m.machine_id}
          title={t('reports.dataViz.machineTitleWithLine', { label: machineLabel(m), line: lineKey(m.location) })}
          rows={buildTrendRows(years, series)}
          series={series}
          breakdownScope={{ kind: 'machine', machineId: m.machine_id, fetchParams: breakdownFetchParams }}
          loadAxisRange={loadAxisRange}
        metricMode={chartMetricMode}
        />
      );
  })
    : [];

  const plantLoad = (bundle: CapacityTrendBundle | null, year: number): number | null => {
    if (!bundle?.machines.length) return null;
    let req = 0;
    let avail = 0;
    for (const m of bundle.machines) {
      const y = m.years[year];
      if (!y) continue;
      req += y.required_sec_per_week ?? 0;
      avail += y.availability_sec_per_week ?? 0;
    }
    if (avail <= 0) return req > 0 ? 100 : null;
    return Math.round((req / avail) * 100);
  };

  const analyticsRows = useMemo(() => {
    let getProduction: (year: number) => number | null;
    let getContract: (year: number) => number | null;
    let getScenarioProduction: ((year: number) => number | null) | undefined;
    let getScenarioContract: ((year: number) => number | null) | undefined;
    let label = '';

    if (analyticsScope === 'line' && analyticsLines.length > 0) {
      const lineSummary = analyticsLines.map((line) => t('dataViz.lineLabel', { line })).join(', ');
      label = t('reports.dataViz.analyticsLine', { line: lineSummary });
      getProduction = (y) => linesLoadPercent(machinesProd, analyticsLines, y);
      getContract = (y) => linesLoadPercent(contract?.machines ?? [], analyticsLines, y);
      getScenarioProduction = scenProd ? (y) => linesLoadPercent(scenProd.machines, analyticsLines, y) : undefined;
      getScenarioContract = scenContract ? (y) => linesLoadPercent(scenContract.machines, analyticsLines, y) : undefined;
    } else if (analyticsScope === 'machine' && analyticsMachineIds.length > 0) {
      const machineSummary = analyticsMachineIds
        .map((id) => {
          const m = machinesProd.find((x) => x.machine_id === id);
          return m ? machineLabel(m) : `#${id}`;
        })
        .join(', ');
      label = t('reports.dataViz.analyticsMachine', { label: machineSummary });
      getProduction = (y) => machinesLoadPercent(machinesProd, analyticsMachineIds, y);
      getContract = (y) => machinesLoadPercent(contract?.machines ?? [], analyticsMachineIds, y);
      getScenarioProduction = scenProd ? (y) => machinesLoadPercent(scenProd.machines, analyticsMachineIds, y) : undefined;
      getScenarioContract = scenContract
        ? (y) => machinesLoadPercent(scenContract.machines, analyticsMachineIds, y)
        : undefined;
    } else {
      const filterBits = [
        typeFilter.length > 0 ? `${t('reports.dataViz.filterType')}: ${formatMultiFilterSummary(typeFilter, t('common.all'))}` : '',
        clientFilter.length > 0 ? `${t('reports.dataViz.filterClient')}: ${formatMultiFilterSummary(clientFilter, t('common.allClients'))}` : '',
      ].filter(Boolean);
      label = filterBits.length
        ? t('dataViz.wholeFilter', { filters: filterBits.join(', ') })
        : t('dataViz.wholeAllMachines');
      getProduction = (y) => plantLoad(prod, y);
      getContract = (y) => plantLoad(contract, y);
      getScenarioProduction = scenProd ? (y) => plantLoad(scenProd, y) : undefined;
      getScenarioContract = scenContract ? (y) => plantLoad(scenContract, y) : undefined;
    }

    return {
      label,
      rows: buildAnalyticsRows(years, getProduction, getContract, getScenarioProduction, getScenarioContract),
      avgProd: averageLoad(years.map(getProduction)),
      avgContract: averageLoad(years.map(getContract)),
    };
  }, [analyticsScope, analyticsLines, analyticsMachineIds, machinesProd, contract, scenProd, scenContract, prod, years, hasScenario, typeFilter, clientFilter, t]);

  const seriesLabels = useMemo(() => {
    const out: string[] = [];
    if (showProduction) out.push(t('dataViz.prodCapacity', { subsystem }));
    if (showContract) out.push(t('dataViz.contractCapacity', { subsystem }));
    if (hasScenario && showScenarioProduction) out.push(t('dataViz.scenarioProd'));
    if (hasScenario && showScenarioContract) out.push(t('dataViz.scenarioContract'));
    return out;
  }, [showProduction, showContract, hasScenario, showScenarioProduction, showScenarioContract, t]);

  const buildTrendSection = (
    title: string,
    getProd: (year: number) => number | null,
    getContract: (year: number) => number | null,
    getScenProd?: (year: number) => number | null,
    getScenContract?: (year: number) => number | null
  ): VisualizationPdfSection => {
    const table = trendSectionFromGetters(locale, years, getProd, getContract, getScenProd, getScenContract, tableOpts);
    return { title, ...table };
  };

  const linesForScope = (scope: 'selected' | 'all') =>
    scope === 'selected' ? Array.from(selectedLines) : lines;

  const machinesForScope = (scope: 'selected' | 'all') =>
    scope === 'selected' ? machinesProd.filter((m) => selectedMachineIds.has(m.machine_id)) : machinesProd;

  const currentViewContext: CurrentViewContext = useMemo(
    () => ({
      tab,
      lineChartCombined,
      machineChartCombined,
      chartGridCols,
      selectedLineCount: selectedLines.size,
      selectedMachineCount: selectedMachineIds.size,
    }),
    [tab, lineChartCombined, machineChartCombined, chartGridCols, selectedLines.size, selectedMachineIds.size]
  );

  const runPdfExport = async (opts: VisualizationReportOptions) => {
    if (!prod || loading) {
      setPdfMessage(t('dataViz.waitForData'));
      return;
    }
    setExportingPdf(true);
    setReportModalOpen(false);
    setPdfMessage('');
    try {
      const machineStatusPdfLabel = formatMultiFilterSummary(
        machineStatus,
        t('dataViz.statusAll'),
        {
          active: t('dataViz.statusActiveRfq'),
          RFQ: t('dataViz.statusRfqOnly'),
          inactive: t('dataViz.statusInactive'),
          all: t('dataViz.statusAll'),
        },
      );
      const machineTypePdfLabel = formatMultiFilterSummary(typeFilter, t('common.all'));
      const clientPdfLabel = formatMultiFilterSummary(clientFilter, t('common.allClients'));
      const scenarioName = hasScenario ? scenarios.find((s) => s.id === Number(scenarioId))?.name ?? String(scenarioId) : null;

      const pdfBase = {
        locale,
        strings: pdfStrings,
        yearFrom: effectiveYearFrom,
        yearTo: effectiveYearTo,
        machineStatusLabel: machineStatusPdfLabel,
        machineTypeLabel: machineTypePdfLabel,
        clientLabel: clientPdfLabel,
        scenarioName,
        seriesLabels,
      };

      if (opts.mode === 'currentView') {
        await waitForChartsPaint(400);
        const panelId = tab === 'lines' ? 'lines' : tab === 'machines' ? 'machines' : 'analytics';
        const panel = document.querySelector(`[data-viz-export-panel="${panelId}"]`) as HTMLElement | null;
        if (!panel) throw new Error(t('dataViz.chartPrepFailed'));
        const cardImages = await captureViewPanelForPdf(panel);
        const viewTitle =
          tab === 'lines'
            ? t('modals.vizReport.currentViewPartLines')
            : tab === 'machines'
              ? t('modals.vizReport.currentViewPartMachines')
              : t('modals.vizReport.currentViewPartAnalytics');
        const isCombined = tab === 'lines' ? lineChartCombined : tab === 'machines' ? machineChartCombined : true;
        const gridCols = isCombined ? 1 : chartGridCols;
        await downloadCapacityVisualizationPdf({
          ...pdfBase,
          lineSections: [],
          machineSections: [],
          viewCapture: {
            partTitle: viewTitle,
            gridCols,
            images: cardImages.map(({ title, dataUrl, blockType }) => ({ title, dataUrl, blockType })),
          },
        });
        setPdfMessage(t('dataViz.pdfDownloaded'));
        return;
      }

      const lineSections: VisualizationPdfSection[] = opts.lineTables
        ? linesForScope(opts.lineTablesScope).map((line) =>
            buildTrendSection(
              t('reports.dataViz.lineTitle', { line }),
              (year) => lineLoadPercent(machinesProd, line, year),
              (year) => lineLoadPercent(contract?.machines ?? [], line, year),
              (year) => (scenProd ? lineLoadPercent(scenProd.machines, line, year) : null),
              (year) => (scenContract ? lineLoadPercent(scenContract.machines, line, year) : null)
            )
          )
        : [];

      const machineSections: VisualizationPdfSection[] = opts.machineTables
        ? machinesForScope(opts.machineTablesScope).map((m) => {
            const cm = contract?.machines.find((x) => x.machine_id === m.machine_id);
            const sm = scenProd?.machines.find((x) => x.machine_id === m.machine_id);
            const scm = scenContract?.machines.find((x) => x.machine_id === m.machine_id);
            return buildTrendSection(
              t('reports.dataViz.machineTitleWithLine', { label: machineLabel(m), line: lineKey(m.location) }),
              (year) => machineLoadPercent(m, year),
              (year) => (cm ? machineLoadPercent(cm, year) : null),
              (year) => (sm ? machineLoadPercent(sm, year) : null),
              (year) => (scm ? machineLoadPercent(scm, year) : null)
            );
          })
        : [];

      const linesOverviewSection =
        opts.linesOverview && lines.length
          ? buildLinesOverviewPdfSection({
              locale,
              lines,
              years,
              getProduction: (line, year) => lineLoadPercent(machinesProd, line, year),
              getContract: (line, year) => lineLoadPercent(contract?.machines ?? [], line, year),
              getScenarioProduction: scenProd
                ? (line, year) => lineLoadPercent(scenProd.machines, line, year)
                : undefined,
              showProduction,
              showContract,
              showScenarioProduction: hasScenario && showScenarioProduction,
            })
          : null;

      const anTable = analyticsTableRows(locale, analyticsRows.rows, hasScenario);

      const needsCharts = opts.lineCharts || opts.machineCharts || opts.analyticsChart;
      let chartParts: PdfChartPart[] = [];

      if (needsCharts) {
        flushSync(() => setPdfCaptureActive(true));
        await waitForChartsPaint(1000);
        const host = pdfChartHostRef.current;
        if (!host) throw new Error(t('dataViz.chartPrepFailed'));
        const captured = await captureChartsBySelector(host);

        const lineImgs = captured.filter((c) => c.key.startsWith('line-'));
        const machineImgs = captured.filter((c) => c.key.startsWith('machine-'));
        const analyticsImgs = captured.filter((c) => c.key.startsWith('analytics-'));

        if (opts.lineCharts && lineImgs.length) {
          chartParts.push({
            partTitle: pdfStrings.chartLines,
            images: lineImgs.map((c) => ({ title: c.title, dataUrl: c.dataUrl })),
            gridCols: opts.lineChartsMode === 'separate' ? opts.chartGridCols : 1,
          });
        }
        if (opts.machineCharts && machineImgs.length) {
          chartParts.push({
            partTitle: pdfStrings.chartMachines,
            images: machineImgs.map((c) => ({ title: c.title, dataUrl: c.dataUrl })),
            gridCols: opts.machineChartsMode === 'separate' ? opts.chartGridCols : 1,
          });
        }
        if (opts.analyticsChart && analyticsImgs.length) {
          chartParts.push({ partTitle: t('dataViz.analyticsChartTitle'), images: analyticsImgs.map((c) => ({ title: c.title, dataUrl: c.dataUrl })) });
        }
        setPdfCaptureActive(false);
      }

      await downloadCapacityVisualizationPdf({
        ...pdfBase,
        lineSections,
        machineSections,
        chartParts: chartParts.length ? chartParts : undefined,
        linesOverview: linesOverviewSection ?? undefined,
        analyticsSection: opts.analyticsTable
          ? {
              title: analyticsRows.label,
              headers: anTable.headers,
              rows: anTable.body,
              avgProduction: opts.analyticsSummary ? analyticsRows.avgProd : null,
              avgContract: opts.analyticsSummary ? analyticsRows.avgContract : null,
              avgScenarioProduction:
                opts.analyticsSummary && hasScenario ? averageLoad(analyticsRows.rows.map((r) => r.scenarioProduction)) : undefined,
            }
          : undefined,
      });
      setPdfMessage(t('dataViz.pdfDownloaded'));
    } catch (e: unknown) {
      setPdfMessage(e instanceof Error ? te(e.message) : t('dataViz.pdfFailed'));
      setPdfCaptureActive(false);
    } finally {
      setExportingPdf(false);
    }
  };

  const runExcelExport = async (opts: VisualizationReportOptions) => {
    if (!prod || loading) {
      setPdfMessage(t('dataViz.waitForData'));
      return;
    }
    setExportingPdf(true);
    setReportModalOpen(false);
    setPdfMessage(t('dataViz.excelPreparing'));
    try {
      const machineStatusPdfLabel = formatMultiFilterSummary(
        machineStatus,
        t('dataViz.statusAll'),
        {
          active: t('dataViz.statusActiveRfq'),
          RFQ: t('dataViz.statusRfqOnly'),
          inactive: t('dataViz.statusInactive'),
          all: t('dataViz.statusAll'),
        },
      );
      const machineTypePdfLabel = formatMultiFilterSummary(typeFilter, t('common.all'));
      const clientPdfLabel = formatMultiFilterSummary(clientFilter, t('common.allClients'));
      const scenarioName = hasScenario ? scenarios.find((s) => s.id === Number(scenarioId))?.name ?? String(scenarioId) : null;
      const detailLevel = opts.breakdownDetailLevel;
      const breakdownColLabels = {
        year: t('reports.trend.year'),
        client: t('projects.client'),
        project: t('projects.name'),
        detail: t('layout.details'),
      };
      const breakdownFetch = { ...breakdownFetchParams, dimFilters };

      const lineYearTotals = (line: string, year: number): SeriesValues => ({
        production: lineLoadPercent(machinesProd, line, year),
        contract: lineLoadPercent(contract?.machines ?? [], line, year),
        scenarioProduction: scenProd ? lineLoadPercent(scenProd.machines, line, year) : null,
        scenarioContract: scenContract ? lineLoadPercent(scenContract.machines, line, year) : null,
      });

      const lineSections = opts.lineTables
        ? await Promise.all(
            linesForScope(opts.lineTablesScope).map(async (line) => {
              const sheetTitle = t('reports.dataViz.lineTitle', { line });
              if (detailLevel === 'year') {
                const table = buildNumericTrendSection(
                  locale,
                  years,
                  (year) => lineYearTotals(line, year).production,
                  (year) => lineYearTotals(line, year).contract,
                  (year) => lineYearTotals(line, year).scenarioProduction,
                  (year) => lineYearTotals(line, year).scenarioContract,
                  tableOpts
                );
                return { sheetTitle, ...table };
              }
              const table = await buildBreakdownTrendSection({
                locale,
                years,
                detailLevel,
                tableOpts,
                colLabels: breakdownColLabels,
                scope: { line },
                fetchParams: breakdownFetch,
                getYearTotals: (year) => lineYearTotals(line, year),
              });
              return { sheetTitle, ...table };
            })
          )
        : [];

      const machineSections = opts.machineTables
        ? await Promise.all(
            machinesForScope(opts.machineTablesScope).map(async (m) => {
              const cm = contract?.machines.find((x) => x.machine_id === m.machine_id);
              const sm = scenProd?.machines.find((x) => x.machine_id === m.machine_id);
              const scm = scenContract?.machines.find((x) => x.machine_id === m.machine_id);
              const sheetTitle = t('reports.dataViz.machineTitleWithLine', {
                label: machineLabel(m),
                line: lineKey(m.location),
              });
              const machineYearTotals = (year: number): SeriesValues => ({
                production: machineLoadPercent(m, year),
                contract: cm ? machineLoadPercent(cm, year) : null,
                scenarioProduction: sm ? machineLoadPercent(sm, year) : null,
                scenarioContract: scm ? machineLoadPercent(scm, year) : null,
              });
              if (detailLevel === 'year') {
                const table = buildNumericTrendSection(
                  locale,
                  years,
                  (year) => machineYearTotals(year).production,
                  (year) => machineYearTotals(year).contract,
                  (year) => machineYearTotals(year).scenarioProduction,
                  (year) => machineYearTotals(year).scenarioContract,
                  tableOpts
                );
                return { sheetTitle, ...table };
              }
              const table = await buildBreakdownTrendSection({
                locale,
                years,
                detailLevel,
                tableOpts,
                colLabels: breakdownColLabels,
                scope: { machineId: m.machine_id },
                fetchParams: breakdownFetch,
                getYearTotals: machineYearTotals,
              });
              return { sheetTitle, ...table };
            })
          )
        : [];

      const linesOverviewSection =
        opts.linesOverview && lines.length
          ? detailLevel === 'year'
            ? buildNumericLinesOverviewSection({
                locale,
                lines,
                years,
                getProduction: (line, year) => lineYearTotals(line, year).production,
                getContract: (line, year) => lineYearTotals(line, year).contract,
                getScenarioProduction: scenProd
                  ? (line, year) => lineYearTotals(line, year).scenarioProduction
                  : undefined,
                showProduction,
                showContract,
                showScenarioProduction: hasScenario && showScenarioProduction,
              })
            : await buildBreakdownLinesOverviewSection({
                locale,
                lines,
                years,
                detailLevel,
                tableOpts,
                colLabels: breakdownColLabels,
                lineLabel: t('reports.trend.line'),
                fetchParams: breakdownFetch,
                getYearTotals: lineYearTotals,
                sheetTitle: t('reports.dataViz.linesOverviewTitle'),
              })
          : undefined;

      const anTable = buildAnalyticsExcelSection({
        locale,
        yearRows: analyticsRows.rows,
        hasScenario,
        detailLevel,
        context: {
          scope: analyticsScope,
          analyticsLines,
          analyticsMachineIds,
          lines,
          machinesProd,
          contractMachines: contract?.machines ?? [],
          scenProdMachines: scenProd?.machines,
          scenContractMachines: scenContract?.machines,
        },
        colLabels: {
          year: t('dataViz.colYear'),
          line: t('reports.trend.line'),
          machine: t('machines.machineCol'),
          formatLine: (line) => t('dataViz.lineLabel', { line }),
        },
      });

      downloadCapacityVisualizationExcel({
        locale,
        docTitle: pdfStrings.docTitle,
        infoSheetLabel: t('modals.vizReport.excelInfoSheet'),
        metaRows: [
          [pdfStrings.reportDate, localeDateTime(locale)],
          [pdfStrings.yearRange, `${effectiveYearFrom}–${effectiveYearTo}`],
          [pdfStrings.machineStatus, machineStatusPdfLabel],
          [pdfStrings.machineType, machineTypePdfLabel],
          [pdfStrings.client, clientPdfLabel],
          [pdfStrings.scenario, scenarioName ?? pdfStrings.noScenario],
          [pdfStrings.seriesOnCharts, seriesLabels.join(', ') || '-'],
          [t('modals.vizReport.detailLevelLabel'), t(`modals.vizReport.detailLevel_${detailLevel}` as 'modals.vizReport.detailLevel_year')],
        ],
        lineSections,
        machineSections,
        linesOverview: linesOverviewSection,
        analyticsSection: opts.analyticsTable
          ? {
              sheetTitle: t('modals.vizReport.analyticsTable'),
              objectLabel: pdfStrings.objectLabel,
              objectName: analyticsRows.label,
              headers: anTable.headers,
              rows: anTable.rows,
              avgProduction: opts.analyticsSummary ? analyticsRows.avgProd : null,
              avgContract: opts.analyticsSummary ? analyticsRows.avgContract : null,
              avgScenarioProduction:
                opts.analyticsSummary && hasScenario
                  ? averageLoad(analyticsRows.rows.map((r) => r.scenarioProduction))
                  : undefined,
              avgProductionLabel: pdfStrings.avgProduction,
              avgContractLabel: pdfStrings.avgContract,
              avgScenarioProdLabel: pdfStrings.avgScenarioProd,
            }
          : undefined,
      });
      setPdfMessage(t('dataViz.excelDownloaded'));
    } catch (e: unknown) {
      setPdfMessage(e instanceof Error ? te(e.message) : t('dataViz.excelFailed'));
    } finally {
      setExportingPdf(false);
    }
  };

  const pdfLineChartItems = useMemo(() => {
    if (!pdfCaptureActive || !reportOptions.lineCharts) return [];
    const targetLines = linesForScope(reportOptions.lineChartsScope);
    if (reportOptions.lineChartsMode === 'combined' && targetLines.length > 0) {
      const series: TrendSeriesDef[] = [];
      let colorIdx = 0;
      for (const line of targetLines) {
        const nextColor = () => vizColors.comparePalette[colorIdx++ % vizColors.comparePalette.length];
        if (showProduction) {
          series.push({
            key: `pdf_L${line}_prod`,
            label: t('reports.dataViz.lineSeriesProd', { line }),
            color: nextColor(),
            getValue: (year) => lineLoadPercent(machinesProd, line, year),
          });
        }
        if (showContract) {
          series.push({
            key: `pdf_L${line}_kon`,
            label: t('reports.dataViz.lineSeriesContract', { line }),
            color: nextColor(),
            dash: '5 3',
            getValue: (year) => lineLoadPercent(contract?.machines ?? [], line, year),
          });
        }
      }
      return [
        {
          captureKey: 'line-combined',
          title: t('reports.dataViz.lineCompareTitle', { lines: targetLines.join(', ') }),
          rows: buildTrendRows(years, series),
          series,
        },
      ];
    }
    return targetLines.map((line) => {
      const prefix = `pdf_line_${line}`;
      const series = baseSeriesForEntity(
        prefix,
        (year) => lineLoadPercent(machinesProd, line, year),
        (year) => lineLoadPercent(contract?.machines ?? [], line, year),
        (year) => (scenProd ? lineLoadPercent(scenProd.machines, line, year) : null),
        (year) => (scenContract ? lineLoadPercent(scenContract.machines, line, year) : null)
      );
      return {
        captureKey: `line-${line}`,
        title: t('reports.dataViz.lineChartTitle', { line }),
        rows: buildTrendRows(years, series),
        series,
      };
    });
  }, [pdfCaptureActive, reportOptions.lineCharts, reportOptions.lineChartsMode, reportOptions.lineChartsScope, machinesProd, contract, scenProd, scenContract, years, selectedLines, lines, showProduction, showContract, hasScenario, showScenarioProduction, showScenarioContract, vizColors, t]);

  const pdfMachineChartItems = useMemo(() => {
    if (!pdfCaptureActive || !reportOptions.machineCharts) return [];
    const targetMachines = machinesForScope(reportOptions.machineChartsScope);
    if (reportOptions.machineChartsMode === 'combined' && targetMachines.length > 0) {
      const series: TrendSeriesDef[] = [];
      let colorIdx = 0;
      for (const m of targetMachines) {
        const cm = contract?.machines.find((x) => x.machine_id === m.machine_id);
        const sm = scenProd?.machines.find((x) => x.machine_id === m.machine_id);
        const label = machineLabel(m);
        const nextColor = () => vizColors.comparePalette[colorIdx++ % vizColors.comparePalette.length];
        if (showProduction) {
          series.push({
            key: `pdf_M${m.machine_id}_p`,
            label: t('reports.dataViz.machineSeriesProd', { label }),
            color: nextColor(),
            getValue: (year) => machineLoadPercent(m, year),
          });
        }
        if (showContract && cm) {
          series.push({
            key: `pdf_M${m.machine_id}_k`,
            label: t('reports.dataViz.machineSeriesContract', { label }),
            color: nextColor(),
            dash: '5 3',
            getValue: (year) => machineLoadPercent(cm, year),
          });
        }
        if (hasScenario && showScenarioProduction && sm) {
          series.push({
            key: `pdf_M${m.machine_id}_s`,
            label: t('reports.dataViz.machineSeriesScen', { label }),
            color: nextColor(),
            dash: '6 4',
            getValue: (year) => machineLoadPercent(sm, year),
          });
        }
      }
      return [
        {
          captureKey: 'machine-combined',
          title: t('reports.dataViz.machineCompareTitle', { count: targetMachines.length }),
          rows: buildTrendRows(years, series),
          series,
        },
      ];
    }
    return targetMachines.map((m) => {
      const cm = contract?.machines.find((x) => x.machine_id === m.machine_id);
      const sm = scenProd?.machines.find((x) => x.machine_id === m.machine_id);
      const scm = scenContract?.machines.find((x) => x.machine_id === m.machine_id);
      const series = baseSeriesForEntity(
        `pdf_m_${m.machine_id}`,
        (year) => machineLoadPercent(m, year),
        (year) => (cm ? machineLoadPercent(cm, year) : null),
        (year) => (sm ? machineLoadPercent(sm, year) : null),
        (year) => (scm ? machineLoadPercent(scm, year) : null)
      );
      return {
        captureKey: `machine-${m.machine_id}`,
        title: t('reports.dataViz.machineTitleWithLine', { label: machineLabel(m), line: lineKey(m.location) }),
        rows: buildTrendRows(years, series),
        series,
      };
    });
  }, [pdfCaptureActive, reportOptions.machineCharts, reportOptions.machineChartsMode, reportOptions.machineChartsScope, machinesProd, contract, scenProd, scenContract, years, selectedMachineIds, showProduction, showContract, hasScenario, showScenarioProduction, showScenarioContract, t]);

  const tabBtn = (id: TabId, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{
        padding: '0.5rem 1rem',
        border: 'none',
        borderBottom: tab === id ? '3px solid var(--cap-green)' : '3px solid transparent',
        background: tab === id ? '#f1f8e9' : 'transparent',
        fontWeight: tab === id ? 600 : 400,
        cursor: 'pointer',
        color: tab === id ? '#1b5e20' : '#444',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <h1 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {t('dataViz.title')}
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 4,
            border: settingsProfile === 'ocu' ? '2px solid #1565c0' : '2px solid var(--cap-green)',
            color: settingsProfile === 'ocu' ? '#1565c0' : 'var(--cap-green)',
          }}
        >
          {subsystem}
        </span>
      </h1>
      <p style={{ color: '#555', marginBottom: '0.5rem', maxWidth: 720, lineHeight: 1.5 }}>{t('dataViz.intro', { subsystem })}</p>
      <p style={{ color: '#777', marginBottom: '1rem', maxWidth: 720, fontSize: 13 }}>{t('dataViz.modeActive', { subsystem })}</p>

      <div style={{ ...panelStyle, marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', alignItems: 'flex-end' }}>
          <label>
            {t('dataViz.yearFrom')}{' '}
            <input
              type="number"
              min={2000}
              max={2100}
              value={yearFrom ?? ''}
              onChange={(e) => setYearFrom(Number(e.target.value) || calendarYear())}
              style={{ width: 72, padding: 4, marginLeft: 4 }}
            />
          </label>
          <label>
            {t('dataViz.yearTo')}{' '}
            <input
              type="number"
              min={2000}
              max={2100}
              value={yearTo ?? ''}
              onChange={(e) => setYearTo(Number(e.target.value) || calendarYear() + 10)}
              style={{ width: 72, padding: 4, marginLeft: 4 }}
            />
          </label>
          <label>
            {t('dataViz.machineStatus')}{' '}
            <MultiSelectFilter
              options={[
                { value: 'active', label: t('dataViz.statusActiveRfq') },
                { value: 'RFQ', label: t('dataViz.statusRfqOnly') },
                { value: 'inactive', label: t('dataViz.statusInactive') },
              ]}
              selected={machineStatus}
              onChange={(next) => setMachineStatus(next as MachineStatusFilter[])}
              allLabel={t('dataViz.statusAll')}
              clearLabel={t('common.clearFilters')}
              style={{ marginLeft: 4, minWidth: 140 }}
            />
          </label>
          <label>
            {t('dataViz.machineType')}{' '}
            <MultiSelectFilter
              options={machineTypes.map((typ) => ({ value: typ, label: typ }))}
              selected={typeFilter}
              onChange={setTypeFilter}
              allLabel={t('common.all')}
              clearLabel={t('common.clearFilters')}
              searchable
              searchPlaceholder={t('common.searchFilter')}
              style={{ marginLeft: 4, minWidth: 120 }}
            />
          </label>
          <label>
            {t('dataViz.client')}{' '}
            <MultiSelectFilter
              options={clients.map((c) => ({ value: c, label: c }))}
              selected={clientFilter}
              onChange={setClientFilter}
              allLabel={t('common.allClients')}
              clearLabel={t('common.clearFilters')}
              searchable
              searchPlaceholder={t('common.searchFilter')}
              style={{ marginLeft: 4, minWidth: 160 }}
            />
          </label>
          <label>
            {t('dataViz.scenarioCompare')}{' '}
            <SearchableSelect
              value={scenarioId === '' ? '' : String(scenarioId)}
              onChange={(e) => setScenarioId(e.target.value ? Number(e.target.value) : '')}
              style={{ marginLeft: 4, padding: 4, minWidth: 200 }}
            >
              <option value="">{t('dataViz.noScenario')}</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SearchableSelect>
          </label>
          <DataLoadingBadge active={loading && Boolean(prod)} />
          <button
            type="button"
            onClick={loadData}
            disabled={!yearsReady || loading || exportingPdf}
            style={{ padding: '0.45rem 1rem', background: '#607d8b', color: 'white', border: 'none', borderRadius: 4 }}
          >
            {loading ? t('common.recalculating') : t('dataViz.refreshData')}
          </button>
          {canDownloadReports && (
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            disabled={!yearsReady || loading || exportingPdf || !prod}
            title={t('dataViz.reportTitle')}
            style={{
              padding: '0.45rem 1rem',
              background: 'var(--cap-green)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              opacity: loading || exportingPdf || !prod ? 0.65 : 1,
            }}
          >
            {exportingPdf ? t('dataViz.exportGenerating') : t('dataViz.exportReport')}
          </button>
          )}
        </div>

        {tab === 'machines' && (
          <>
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#666', maxWidth: 820, lineHeight: 1.45 }}>
              {t('dataViz.dimFilterHint')}
            </p>
            <MachineDimensionFiltersPanel value={dimFilters} onChange={setDimFilters} titleKey="dataViz.advancedFiltersMachines" />
          </>
        )}

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #eee' }}>
          <span style={{ fontWeight: 600, fontSize: 14, marginRight: 10 }}>{t('dataViz.seriesOnCharts')}</span>
          <label style={{ marginRight: 14, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={showProduction} onChange={(e) => setShowProduction(e.target.checked)} style={{ marginRight: 6 }} />
            {t('dataViz.prodCapacity', { subsystem })}
          </label>
          <label style={{ marginRight: 14, fontSize: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={showContract} onChange={(e) => setShowContract(e.target.checked)} style={{ marginRight: 6 }} />
            {t('dataViz.contractCapacity', { subsystem })}
          </label>
          {hasScenario && (
            <>
              <label style={{ marginRight: 14, fontSize: 14, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showScenarioProduction}
                  onChange={(e) => setShowScenarioProduction(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                {t('dataViz.scenarioProd')}
              </label>
              <label style={{ fontSize: 14, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showScenarioContract}
                  onChange={(e) => setShowScenarioContract(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                {t('dataViz.scenarioContract')}
              </label>
            </>
          )}
        </div>
      </div>

      {error && (
        <p style={{ padding: '0.75rem', background: '#ffebee', color: '#c62828', borderRadius: 8, marginBottom: '1rem' }}>{error}</p>
      )}
      {pdfMessage && (
        <p
          style={{
            padding: '0.75rem',
            background: pdfMessage.includes('pobrany') ? '#e8f5e9' : '#fff3e0',
            color: pdfMessage.includes('pobrany') ? '#2e7d32' : '#e65100',
            borderRadius: 8,
            marginBottom: '1rem',
          }}
        >
          {pdfMessage}
        </p>
      )}

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #ddd', marginBottom: '1rem' }}>
        {tabBtn('lines', t('dataViz.tabLines'))}
        {tabBtn('machines', t('dataViz.tabMachines'))}
        {tabBtn('analytics', t('dataViz.tabAnalytics'))}
      </div>

      <DataLoadingOverlay active={loading && Boolean(prod)}>
      {tab === 'lines' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: '1rem', alignItems: 'start' }}>
          <div style={panelStyle}>
            <strong style={{ fontSize: 14 }}>{t('dataViz.selectLines')}</strong>
            <p style={{ margin: '6px 0 10px', fontSize: 12, color: '#777' }}>{t('dataViz.toggleLineChart')}</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={lineChartCombined} onChange={(e) => setLineChartCombined(e.target.checked)} />
              {t('dataViz.combinedLines')}
            </label>
            {lines.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={lines.every((line) => selectedLines.has(line))}
                    onChange={() => {
                      const allSelected = lines.every((line) => selectedLines.has(line));
                      setSelectedLines(allSelected ? new Set() : new Set(lines));
                    }}
                  />
                  {t('dataViz.selectAllLines', { count: lines.length })}
                </label>
                <span style={{ fontSize: 12, color: '#777' }}>{t('dataViz.selectedLinesCount', { count: selectedLines.size })}</span>
              </div>
            )}
            {lines.map((line) => (
              <ChipToggle
                key={line}
                label={t('dataViz.lineLabel', { line })}
                checked={selectedLines.has(line)}
                onChange={(on) => {
                  setSelectedLines((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(line);
                    else next.delete(line);
                    return next;
                  });
                }}
              />
            ))}
            {!lines.length && !loading && <p style={{ fontSize: 13, color: '#888' }}>{t('dataViz.noLinesInData')}</p>}
          </div>
          <div data-viz-export-panel="lines">
            {selectedLines.size === 0 ? (
              <p style={{ color: '#888' }}>{t('dataViz.selectOneLine')}</p>
            ) : (
              <>
                <ChartViewToolbar
                  showGrid={!lineChartCombined}
                  chartGridCols={chartGridCols}
                  onChartGridColsChange={setChartGridCols}
                  loadAxisRange={loadAxisRange}
                  onLoadAxisRangeChange={setLoadAxisRange}
                  chartMetricMode={chartMetricMode}
                  onChartMetricModeChange={setChartMetricMode}
                  yAxisLabel={chartYAxisLabel}
                />
                <div style={lineChartCombined ? { display: 'flex', flexDirection: 'column', gap: '1rem' } : chartGridStyle(chartGridCols)}>
                  {lineChartCombined ? combinedLineChart : lineCharts}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'machines' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: '1rem', alignItems: 'start' }}>
          <div style={{ ...panelStyle, maxHeight: 420, overflowY: 'auto' }}>
            <strong style={{ fontSize: 14 }}>{t('dataViz.selectMachines')}</strong>
            {hasActiveDimFilters(dimFilters) && (
              <p style={{ margin: '6px 0 8px', fontSize: 12, color: '#1565c0' }}>
                {t('dataViz.dimFilterActiveSummary', { count: machinesProd.length })}
              </p>
            )}
            <p style={{ margin: '6px 0 10px', fontSize: 12, color: '#777' }}>{t('dataViz.deselectHint')}</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={machineChartCombined} onChange={(e) => setMachineChartCombined(e.target.checked)} />
              {t('dataViz.combinedMachines')}
            </label>
            {machinesProd.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={machinesProd.every((m) => selectedMachineIds.has(m.machine_id))}
                    onChange={() => {
                      const allSelected = machinesProd.every((m) => selectedMachineIds.has(m.machine_id));
                      setSelectedMachineIds(
                        allSelected ? new Set() : new Set(machinesProd.map((m) => m.machine_id))
                      );
                    }}
                  />
                  {t('dataViz.selectAllMachines', { count: machinesProd.length })}
                </label>
                <span style={{ fontSize: 12, color: '#777' }}>{t('dataViz.selectedMachinesCount', { count: selectedMachineIds.size })}</span>
              </div>
            )}
            {machinesProd.map((m) => (
              <ChipToggle
                key={m.machine_id}
                label={`${t('dataViz.machineChipLine', { label: machineLabel(m), line: lineKey(m.location) })}`}
                checked={selectedMachineIds.has(m.machine_id)}
                onChange={(on) => {
                  setSelectedMachineIds((prev) => {
                    const next = new Set(prev);
                    if (on) next.add(m.machine_id);
                    else next.delete(m.machine_id);
                    return next;
                  });
                }}
              />
            ))}
          </div>
          <div data-viz-export-panel="machines">
            {selectedMachineIds.size === 0 ? (
              <p style={{ color: '#888' }}>{t('dataViz.selectOneMachine')}</p>
            ) : (
              <>
                <ChartViewToolbar
                  showGrid={!machineChartCombined}
                  chartGridCols={chartGridCols}
                  onChartGridColsChange={setChartGridCols}
                  loadAxisRange={loadAxisRange}
                  onLoadAxisRangeChange={setLoadAxisRange}
                  chartMetricMode={chartMetricMode}
                  onChartMetricModeChange={setChartMetricMode}
                  yAxisLabel={chartYAxisLabel}
                />
                <div style={machineChartCombined ? { display: 'flex', flexDirection: 'column', gap: '1rem' } : chartGridStyle(chartGridCols)}>
                  {machineChartCombined ? combinedMachineChart : machineCharts}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <VisualizationReportModal
        open={reportModalOpen}
        options={reportOptions}
        onChange={setReportOptions}
        onConfirm={() => {
          const effective =
            reportOptions.mode === 'currentView'
              ? buildCurrentViewReportOptions(currentViewContext)
              : reportOptions;
          if (effective.mode === 'excelData') void runExcelExport(effective);
          else void runPdfExport(effective);
        }}
        onCancel={() => setReportModalOpen(false)}
        generating={exportingPdf}
        currentView={currentViewContext}
        selectedLineCount={selectedLines.size}
        selectedMachineCount={selectedMachineIds.size}
        totalLineCount={lines.length}
        totalMachineCount={machinesProd.length}
      />

      {pdfCaptureActive && (
        <div
          ref={pdfChartHostRef}
          aria-hidden
          style={{
            position: 'fixed',
            left: -12000,
            top: 0,
            width: reportOptions.chartGridCols === 3 ? 1280 : reportOptions.chartGridCols === 2 ? 960 : 860,
            display: 'grid',
            gridTemplateColumns: `repeat(${reportOptions.chartGridCols}, minmax(0, 1fr))`,
            gap: 12,
            background: '#fff',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          {pdfLineChartItems.map((item) => (
            <CapacityTrendChart
              key={item.captureKey}
              captureKey={item.captureKey}
              title={item.title}
              rows={item.rows}
              series={item.series}
              height={300}
              loadAxisRange={loadAxisRange}
        metricMode={chartMetricMode}
            />
          ))}
          {pdfMachineChartItems.map((item) => (
            <CapacityTrendChart
              key={item.captureKey}
              captureKey={item.captureKey}
              title={item.title}
              rows={item.rows}
              series={item.series}
              height={300}
              loadAxisRange={loadAxisRange}
        metricMode={chartMetricMode}
            />
          ))}
          {reportOptions.analyticsChart && (
            <CapacityAnalyticsDeltaChart
              captureKey="analytics-delta"
              title={t('dataViz.annualDiffTitle', { label: analyticsRows.label })}
              rows={analyticsRows.rows}
              hasScenario={hasScenario}
              height={280}
            />
          )}
        </div>
      )}

      {exportingPdf && !pdfCaptureActive && (
        <p style={{ padding: '0.75rem', background: '#e3f2fd', color: '#1565c0', borderRadius: 8, marginBottom: '1rem' }}>
          {t('dataViz.pdfPreparing')}
        </p>
      )}

      {tab === 'analytics' && (
        <div data-viz-export-panel="analytics">
          <div data-viz-export-chrome>
            <div style={{ ...panelStyle, marginBottom: '1rem' }}>
            <span style={{ fontWeight: 600, marginRight: 12 }}>{t('dataViz.compareLabel')}</span>
            <label style={{ marginRight: 14, cursor: 'pointer' }}>
              <input
                type="radio"
                name="anScope"
                checked={analyticsScope === 'line'}
                onChange={() => setAnalyticsScope('line')}
                style={{ marginRight: 6 }}
              />
              {t('dataViz.scopeLine')}
            </label>
            <label style={{ marginRight: 14, cursor: 'pointer' }}>
              <input
                type="radio"
                name="anScope"
                checked={analyticsScope === 'machine'}
                onChange={() => setAnalyticsScope('machine')}
                style={{ marginRight: 6 }}
              />
              {t('dataViz.scopeMachine')}
            </label>
            <label style={{ marginRight: 16, cursor: 'pointer' }}>
              <input
                type="radio"
                name="anScope"
                checked={analyticsScope === 'plant'}
                onChange={() => setAnalyticsScope('plant')}
                style={{ marginRight: 6 }}
              />
              {t('dataViz.scopePlant')}
            </label>
            {analyticsScope === 'line' && (
              <MultiSelectFilter
                options={lines.map((l) => ({ value: l, label: t('dataViz.lineLabel', { line: l }) }))}
                selected={analyticsLines}
                onChange={setAnalyticsLines}
                allLabel={t('common.all')}
                clearLabel={t('common.clearFilters')}
                style={{ minWidth: 140 }}
              />
            )}
            {analyticsScope === 'machine' && (
              <MultiSelectFilter
                options={machinesProd.map((m) => ({
                  value: m.machine_id,
                  label: t('dataViz.machineOptionWithLine', { label: machineLabel(m), line: lineKey(m.location) }),
                }))}
                selected={analyticsMachineIds}
                onChange={setAnalyticsMachineIds}
                allLabel={t('common.all')}
                clearLabel={t('common.clearFilters')}
                searchable
                searchPlaceholder={t('common.searchFilter')}
                style={{ minWidth: 220 }}
              />
            )}
          </div>

          <AdminHubList style={{ marginBottom: '1rem' }}>
            <SummaryCard label={t('dataViz.avgLoadProd')} value={analyticsRows.avgProd} color={vizColors.production} />
            <SummaryCard label={t('dataViz.avgLoadContract')} value={analyticsRows.avgContract} color={vizColors.contract} />
            {hasScenario && analyticsRows.rows.some((r) => r.scenarioProduction != null) && (
              <SummaryCard
                label={t('dataViz.avgLoadScenario')}
                value={averageLoad(analyticsRows.rows.map((r) => r.scenarioProduction))}
                color={vizColors.scenarioProduction}
              />
            )}
          </AdminHubList>
          </div>

          <CapacityAnalyticsPanel
            entityLabel={analyticsRows.label}
            rows={analyticsRows.rows}
            hasScenario={hasScenario}
            expandContext={
              analyticsScope === 'machine'
                ? undefined
                : {
                    scope: analyticsScope,
                    analyticsLines,
                    analyticsMachineIds,
                    lines,
                    machinesProd,
                    contractMachines: contract?.machines ?? [],
                    scenProdMachines: scenProd?.machines,
                    scenContractMachines: scenContract?.machines,
                    showScenarioProduction,
                  }
            }
          />
        </div>
      )}
      </DataLoadingOverlay>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div
      style={{
        padding: '12px 16px',
        background: 'white',
        borderRadius: 8,
        borderLeft: `4px solid ${color}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value != null ? `${value}%` : '—'}</div>
    </div>
  );
}
