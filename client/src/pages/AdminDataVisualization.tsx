import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { api } from '../api/client';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectFilter from '../components/MultiSelectFilter';
import DataLoadingOverlay, { DataLoadingBadge } from '../components/DataLoadingOverlay';
import { AdminHubList } from '../components/AdminHubCards';
import { joinCsvFilter, formatMultiFilterSummary } from '../utils/filterParams';
import RfqTreeMultiFilter, {
  projectNamesForLine,
  projectNamesForMachine,
  linesForSelectedRfqOps,
  machineIdsForSelectedRfqOps,
  type RfqFilterTree,
} from '../components/RfqTreeMultiFilter';
import MachineDimensionFiltersPanel from '../components/MachineDimensionFiltersPanel';
import CapacityTrendChart from '../components/capacity/CapacityTrendChart';
import CapacityMachineLineBarChart from '../components/capacity/CapacityMachineLineBarChart';
import ChartGridLayoutPicker, { chartGridStyle, type ChartGridCols } from '../components/capacity/ChartGridLayoutPicker';
import ChartLoadAxisRangePicker from '../components/capacity/ChartLoadAxisRangePicker';
import ChartMetricModePicker from '../components/capacity/ChartMetricModePicker';
import type { ChartMetricMode } from '../utils/chartMetricMode';
import { parseFlexPercentInput } from '../utils/chartFlex';
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
  buildMachineBarRows,
  buildLineBarRows,
  callOffCalculatorToTrendBundle,
  callOffLoadPercent,
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
import { useReferenceDisplay } from '../context/ReferenceDisplayContext';
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
  buildMachineDimLookup,
  EMPTY_DIM_FILTERS,
  filterMachinesByDimensionFilters,
  hasActiveDimFilters,
  type DimFiltersState,
  type MachineDimLookup,
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
  settingsProfile?: 'capacity' | 'ocu';
  includeRfqOperationIds?: number[];
}): Promise<CapacityTrendBundle> {
  const res = await api.capacity.calculator({
    yearFrom: params.yearFrom,
    yearTo: params.yearTo,
    machineStatuses: joinCsvFilter(params.machineStatus),
    types: joinCsvFilter(params.type ?? []),
    clients: joinCsvFilter(params.client ?? []),
    useContractualVolumes: params.useContractualVolumes,
    settingsProfile: params.settingsProfile === 'ocu' ? 'ocu' : undefined,
    includeRfqOperationIds: joinCsvFilter((params.includeRfqOperationIds ?? []).map(String)),
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
  const { machineBarChartLabel } = useReferenceDisplay();
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
  const [rfqTree, setRfqTree] = useState<RfqFilterTree | null>(null);
  const [rfqOperationIds, setRfqOperationIds] = useState<number[]>([]);
  const [callOffComparisonId, setCallOffComparisonId] = useState<number | ''>('');
  const [callOffComparisons, setCallOffComparisons] = useState<
    { id: number; name: string; source_filename: string | null; date_from: string; date_to: string }[]
  >([]);
  const [lineChartCombined, setLineChartCombined] = useState(false);
  const [lineChartBars, setLineChartBars] = useState(false);
  const [lineBarYear, setLineBarYear] = useState<number | null>(null);
  const [machineChartCombined, setMachineChartCombined] = useState(false);
  const [machineChartLineBars, setMachineChartLineBars] = useState(false);
  const [machineLineBarYear, setMachineLineBarYear] = useState<number | null>(null);
  const [chartGridCols, setChartGridCols] = useState<ChartGridCols>(1);
  const [loadAxisRange, setLoadAxisRange] = useState<ChartLoadAxisRange>(DEFAULT_LOAD_AXIS_RANGE);
  const [chartMetricMode, setChartMetricMode] = useState<ChartMetricMode>('load');
  const [dimFilters, setDimFilters] = useState<DimFiltersState>(EMPTY_DIM_FILTERS);
  const [machineDimLookup, setMachineDimLookup] = useState<MachineDimLookup | null>(null);

  useEffect(() => {
    api.machines
      .list({ statuses: 'active,inactive,RFQ' })
      .then((rows) => setMachineDimLookup(buildMachineDimLookup(Array.isArray(rows) ? rows : [])))
      .catch(() => setMachineDimLookup(null));
  }, []);

  const [showProduction, setShowProduction] = useState(true);
  const [showContract, setShowContract] = useState(true);
  const [showCallOff, setShowCallOff] = useState(true);
  /** Flex ±% od nominału na wykresach liniowych (pusty = bez wstęgi). */
  const [flexPercentInput, setFlexPercentInput] = useState('');
  const flexPercent = useMemo(() => parseFlexPercentInput(flexPercentInput), [flexPercentInput]);

  const [prodRaw, setProd] = useState<CapacityTrendBundle | null>(null);
  const [contractRaw, setContract] = useState<CapacityTrendBundle | null>(null);
  const [callOffRaw, setCallOff] = useState<CapacityTrendBundle | null>(null);
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
  const hasCallOff = callOffComparisonId !== '' && Number(callOffComparisonId) > 0;
  const callOffSeriesLabel = useMemo(() => {
    if (!hasCallOff) return t('reports.dataViz.seriesCallOff');
    const cmp = callOffComparisons.find((c) => c.id === Number(callOffComparisonId));
    if (!cmp) return t('reports.dataViz.seriesCallOff');
    return cmp.source_filename
      ? t('reports.dataViz.seriesCallOffNamed', { name: cmp.name, file: cmp.source_filename })
      : t('reports.dataViz.seriesCallOffNamedShort', { name: cmp.name });
  }, [hasCallOff, callOffComparisonId, callOffComparisons, t]);

  const breakdownFetchParams = useMemo(
    () => ({
      yearFrom: effectiveYearFrom,
      yearTo: effectiveYearTo,
      machineStatus,
      type: typeFilter,
      client: clientFilter,
      settingsProfile,
      callOffComparisonId: hasCallOff ? Number(callOffComparisonId) : undefined,
      includeRfqOperationIds: rfqOperationIds,
      dimFilters,
    }),
    [effectiveYearFrom, effectiveYearTo, machineStatus, typeFilter, clientFilter, settingsProfile, hasCallOff, callOffComparisonId, dimFilters, rfqOperationIds]
  );

  const withRfqLegend = useCallback(
    (label: string, scope?: { line?: string; machineId?: number }) => {
      if (!rfqOperationIds.length) return label;
      let projects: string[] = [];
      if (scope?.machineId != null) {
        projects = projectNamesForMachine(rfqTree, rfqOperationIds, scope.machineId);
      } else if (scope?.line != null) {
        projects = projectNamesForLine(rfqTree, rfqOperationIds, scope.line);
      } else {
        return label;
      }
      if (!projects.length) return label;
      return t('reports.dataViz.seriesWithRfq', {
        label,
        projects: projects.join(', '),
      });
    },
    [rfqTree, rfqOperationIds, t]
  );

  useEffect(() => {
    api.callOffs
      .list({ archived: false })
      .then((list) =>
        setCallOffComparisons(
          list.map((c) => ({
            id: c.id,
            name: c.name,
            source_filename: c.source_filename ?? null,
            date_from: c.date_from,
            date_to: c.date_to,
          }))
        )
      )
      .catch(() => setCallOffComparisons([]));
    api.machines.types().then(setMachineTypes).catch(() => setMachineTypes([]));
    api.projects.clients().then(setClients).catch(() => setClients([]));
    api.projects
      .rfqFilterTree()
      .then((res) => setRfqTree({ clients: res.clients ?? [] }))
      .catch(() => setRfqTree({ clients: [] }));
  }, []);

  const tableOpts: TrendTableBuildOptions = useMemo(
    () => ({
      showProduction,
      showContract,
      hasScenario: false,
      showScenarioProduction: false,
      showScenarioContract: false,
    }),
    [showProduction, showContract]
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
      includeRfqOperationIds: rfqOperationIds,
    };
    const coid = hasCallOff ? Number(callOffComparisonId) : undefined;
    const tasks: Promise<void>[] = [
      fetchCapacityBundle(base).then(setProd),
      fetchCapacityBundle({ ...base, useContractualVolumes: true }).then(setContract),
    ];
    if (coid) {
      tasks.push(
        api.callOffs
          .calculator(coid, {
            yearFrom: effectiveYearFrom,
            yearTo: effectiveYearTo,
            machineStatuses: joinCsvFilter(machineStatus),
            types: joinCsvFilter(typeFilter),
            clients: joinCsvFilter(clientFilter),
            settingsProfile: settingsProfile === 'ocu' ? 'ocu' : undefined,
          })
          .then((res) => setCallOff(callOffCalculatorToTrendBundle(res)))
      );
    } else {
      setCallOff(null);
    }
    Promise.all(tasks)
      .catch((e: Error) => {
        setError(te(e?.message) || t('dataViz.loadFailed', { subsystem }));
        setProd(null);
        setContract(null);
        setCallOff(null);
      })
      .finally(() => setLoading(false));
  }, [
    effectiveYearFrom,
    effectiveYearTo,
    machineStatus,
    typeFilter,
    clientFilter,
    settingsProfile,
    rfqOperationIds,
    hasCallOff,
    callOffComparisonId,
    subsystem,
    t,
    te,
  ]);

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

  const prod = useMemo(() => {
    if (!prodRaw) return null;
    return {
      ...prodRaw,
      machines: filterMachinesByDimensionFilters(prodRaw.machines, dimFilters, machineDimLookup),
    };
  }, [prodRaw, dimFilters, machineDimLookup]);
  const contract = useMemo(() => {
    if (!contractRaw) return null;
    return {
      ...contractRaw,
      machines: filterMachinesByDimensionFilters(contractRaw.machines, dimFilters, machineDimLookup),
    };
  }, [contractRaw, dimFilters, machineDimLookup]);
  const callOff = useMemo(() => {
    if (!callOffRaw) return null;
    return {
      ...callOffRaw,
      machines: filterMachinesByDimensionFilters(callOffRaw.machines, dimFilters, machineDimLookup),
    };
  }, [callOffRaw, dimFilters, machineDimLookup]);

  const machinesProd = prod?.machines ?? [];
  const lines = useMemo(() => uniqueLines(machinesProd), [machinesProd]);

  const dataVizBusy = loading;

  /** Filtry zawężające zestaw maszyn/linii — przy nich domyślnie zaznaczamy wszystko widoczne. */
  const hasActiveFilter = useMemo(
    () =>
      clientFilter.length > 0 ||
      typeFilter.length > 0 ||
      machineStatus.length !== 1 ||
      machineStatus[0] !== 'active' ||
      hasActiveDimFilters(dimFilters),
    [clientFilter, typeFilter, machineStatus, dimFilters]
  );

  const rfqHostLines = useMemo(
    () => linesForSelectedRfqOps(rfqTree, rfqOperationIds),
    [rfqTree, rfqOperationIds]
  );
  const rfqHostMachineIds = useMemo(
    () => machineIdsForSelectedRfqOps(rfqTree, rfqOperationIds),
    [rfqTree, rfqOperationIds]
  );

  useEffect(() => {
    if (!lines.length) {
      setSelectedLines(new Set());
      return;
    }
    if (rfqOperationIds.length) {
      const scoped = rfqHostLines.filter((line) => lines.includes(line));
      if (scoped.length) {
        setSelectedLines(new Set(scoped));
        return;
      }
    }
    setSelectedLines((prev) => {
      const stillValid = lines.filter((line) => prev.has(line));
      if (stillValid.length > 0) return new Set(stillValid);
      return new Set(hasActiveFilter ? lines : lines.slice(0, Math.min(4, lines.length)));
    });
  }, [lines.join('|'), hasActiveFilter, rfqOperationIds.join(','), rfqHostLines.join('|')]);

  useEffect(() => {
    if (!machinesProd.length) {
      setSelectedMachineIds(new Set());
      return;
    }
    const ids = machinesProd.map((m) => m.machine_id);
    const idSet = new Set(ids);
    if (rfqOperationIds.length) {
      const scoped = rfqHostMachineIds.filter((id) => idSet.has(id));
      if (scoped.length) {
        setSelectedMachineIds(new Set(scoped));
        return;
      }
    }
    setSelectedMachineIds((prev) => {
      const stillValid = ids.filter((id) => prev.has(id));
      if (stillValid.length > 0) return new Set(stillValid);
      return new Set(hasActiveFilter ? ids : ids.slice(0, 3));
    });
  }, [
    machinesProd.map((m) => m.machine_id).join(','),
    hasActiveFilter,
    rfqOperationIds.join(','),
    rfqHostMachineIds.join(','),
  ]);

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
    getCallOff?: (year: number) => number | null,
    scope?: { line?: string; machineId?: number }
  ): TrendSeriesDef[] => {
    const out: TrendSeriesDef[] = [];
    if (showContract) {
      out.push({
        key: `${prefix}_contract`,
        label: withRfqLegend(t('reports.dataViz.seriesContract'), scope),
        color: vizColors.contract,
        getValue: getContract,
      });
    }
    if (showProduction) {
      out.push({
        key: `${prefix}_prod`,
        label: withRfqLegend(t('reports.dataViz.seriesProd'), scope),
        color: vizColors.production,
        getValue: getProd,
      });
    }
    if (hasCallOff && showCallOff && getCallOff) {
      out.push({
        key: `${prefix}_calloff`,
        label: callOffSeriesLabel,
        color: vizColors.callOff,
        dash: '2 3',
        getValue: getCallOff,
      });
    }
    return out;
  };

  const buildCombinedLineSeries = (): TrendSeriesDef[] => {
    const out: TrendSeriesDef[] = [];
    let colorIdx = 0;
    for (const line of Array.from(selectedLines)) {
      const nextColor = () => vizColors.comparePalette[colorIdx++ % vizColors.comparePalette.length];
      if (showContract) {
        out.push({
          key: `cmp_L${line}_kon`,
          label: withRfqLegend(t('reports.dataViz.lineSeriesContract', { line }), { line }),
          color: nextColor(),
          dash: '5 3',
          getValue: (year) => lineLoadPercent(contract?.machines ?? [], line, year),
        });
      }
      if (showProduction) {
        out.push({
          key: `cmp_L${line}_prod`,
          label: withRfqLegend(t('reports.dataViz.lineSeriesProd', { line }), { line }),
          color: nextColor(),
          getValue: (year) => lineLoadPercent(machinesProd, line, year),
        });
      }
      if (hasCallOff && showCallOff && callOff) {
        out.push({
          key: `cmp_L${line}_calloff`,
          label: t('reports.dataViz.lineSeriesCallOff', { line, name: callOffSeriesLabel }),
          color: nextColor(),
          dash: '2 3',
          getValue: (year) => callOffLoadPercent(callOff, year, { kind: 'line', line }),
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
      const label = machineLabel(m);
      const nextColor = () => vizColors.comparePalette[colorIdx++ % vizColors.comparePalette.length];
      if (showContract && cm) {
        out.push({
          key: `cmp_M${m.machine_id}_kon`,
          label: withRfqLegend(t('reports.dataViz.machineSeriesContract', { label }), { machineId: m.machine_id }),
          color: nextColor(),
          dash: '5 3',
          getValue: (year) => machineLoadPercent(cm, year),
        });
      }
      if (showProduction) {
        out.push({
          key: `cmp_M${m.machine_id}_prod`,
          label: withRfqLegend(t('reports.dataViz.machineSeriesProd', { label }), { machineId: m.machine_id }),
          color: nextColor(),
          getValue: (year) => machineLoadPercent(m, year),
        });
      }
      const com = callOff?.machines.find((x) => x.machine_id === m.machine_id);
      if (hasCallOff && showCallOff && com) {
        out.push({
          key: `cmp_M${m.machine_id}_calloff`,
          label: t('reports.dataViz.machineSeriesCallOff', { label, name: callOffSeriesLabel }),
          color: nextColor(),
          dash: '2 3',
          getValue: (year) => callOffLoadPercent(callOff, year, { kind: 'machine', machine: com }),
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
      callOff,
      years,
      showProduction,
      showContract,
      hasCallOff,
      showCallOff,
      callOffSeriesLabel,
      vizColors,
      withRfqLegend,
      t,
    ]
  );

  const combinedMachineSeries = useMemo(
    () => buildCombinedMachineSeries(),
    [
      selectedMachineIds,
      machinesProd,
      contract,
      callOff,
      years,
      showProduction,
      showContract,
      hasCallOff,
      showCallOff,
      callOffSeriesLabel,
      vizColors,
      withRfqLegend,
      t,
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
        flexPercent={flexPercent}
        allowDataTable={false}
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
        flexPercent={flexPercent}
        allowDataTable={false}
      />
    ) : null;

  const effectiveMachineLineBarYear = useMemo(() => {
    const y = machineLineBarYear ?? calendarYear();
    if (y < effectiveYearFrom) return effectiveYearFrom;
    if (y > effectiveYearTo) return effectiveYearTo;
    return y;
  }, [machineLineBarYear, effectiveYearFrom, effectiveYearTo]);

  const effectiveLineBarYear = useMemo(() => {
    const y = lineBarYear ?? calendarYear();
    if (y < effectiveYearFrom) return effectiveYearFrom;
    if (y > effectiveYearTo) return effectiveYearTo;
    return y;
  }, [lineBarYear, effectiveYearFrom, effectiveYearTo]);

  const machineLineBarRows = useMemo(
    () =>
      buildMachineBarRows(
        machinesProd,
        contract?.machines ?? [],
        selectedMachineIds,
        effectiveMachineLineBarYear,
        machineBarChartLabel,
        hasCallOff && showCallOff ? callOff?.machines : null,
        hasCallOff && showCallOff ? callOff?.dataYears : null
      ),
    [
      machinesProd,
      contract,
      selectedMachineIds,
      effectiveMachineLineBarYear,
      machineBarChartLabel,
      hasCallOff,
      showCallOff,
      callOff,
    ]
  );

  const lineBarRows = useMemo(
    () =>
      buildLineBarRows(
        machinesProd,
        contract?.machines ?? [],
        selectedLines,
        effectiveLineBarYear,
        hasCallOff && showCallOff ? callOff?.machines : null,
        hasCallOff && showCallOff ? callOff?.dataYears : null
      ),
    [machinesProd, contract, selectedLines, effectiveLineBarYear, hasCallOff, showCallOff, callOff]
  );

  const combinedMachineLineBarChart =
    machineChartLineBars && selectedMachineIds.size > 0 ? (
      <CapacityMachineLineBarChart
        title={t('dataViz.machineLineBarTitle', {
          year: effectiveMachineLineBarYear,
          count: selectedMachineIds.size,
        })}
        rows={machineLineBarRows}
        xAxisKind="machine"
        showProduction={showProduction}
        showContract={showContract}
        showCallOff={hasCallOff && showCallOff}
        callOffSeriesLabel={callOffSeriesLabel}
        year={effectiveMachineLineBarYear}
        height={380}
        emptyHint={t('dataViz.emptyMachines')}
        loadAxisRange={loadAxisRange}
        metricMode={chartMetricMode}
      />
    ) : null;

  const combinedLineBarChart =
    lineChartBars && selectedLines.size > 0 ? (
      <CapacityMachineLineBarChart
        title={t('dataViz.lineBarTitle', {
          year: effectiveLineBarYear,
          count: selectedLines.size,
        })}
        rows={lineBarRows}
        xAxisKind="line"
        showProduction={showProduction}
        showContract={showContract}
        showCallOff={hasCallOff && showCallOff}
        callOffSeriesLabel={callOffSeriesLabel}
        year={effectiveLineBarYear}
        height={380}
        emptyHint={t('dataViz.emptyLines')}
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
      (year) => callOffLoadPercent(callOff, year, { kind: 'line', line }),
      { line }
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
        flexPercent={flexPercent}
      />
    );
  })
    : [];

  const machineCharts = !machineChartCombined
    ? machinesProd
    .filter((m) => selectedMachineIds.has(m.machine_id))
    .map((m) => {
      const cm = contract?.machines.find((x) => x.machine_id === m.machine_id);
      const com = callOff?.machines.find((x) => x.machine_id === m.machine_id);
      const series = baseSeriesForEntity(
        `m_${m.machine_id}`,
        (year) => machineLoadPercent(m, year),
        (year) => (cm ? machineLoadPercent(cm, year) : null),
        (year) => (com ? callOffLoadPercent(callOff, year, { kind: 'machine', machine: com }) : null),
        { machineId: m.machine_id }
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
        flexPercent={flexPercent}
        />
      );
  })
    : [];

  const plantLoad = (bundle: CapacityTrendBundle | null, year: number): number | null => {
    if (!bundle?.machines.length) return null;
    if (bundle.dataYears?.length && !bundle.dataYears.includes(year)) return null;
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
    let getCallOffLoad: ((year: number) => number | null) | undefined;
    let label = '';

    if (analyticsScope === 'line' && analyticsLines.length > 0) {
      const lineSummary = analyticsLines.map((line) => t('dataViz.lineLabel', { line })).join(', ');
      label = t('reports.dataViz.analyticsLine', { line: lineSummary });
      getProduction = (y) => linesLoadPercent(machinesProd, analyticsLines, y);
      getContract = (y) => linesLoadPercent(contract?.machines ?? [], analyticsLines, y);
      getCallOffLoad =
        hasCallOff && callOff
          ? (y) => callOffLoadPercent(callOff, y, { kind: 'lines', lines: analyticsLines })
          : undefined;
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
      getCallOffLoad =
        hasCallOff && callOff
          ? (y) => callOffLoadPercent(callOff, y, { kind: 'machines', machineIds: analyticsMachineIds })
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
      getCallOffLoad = hasCallOff && callOff ? (y) => callOffLoadPercent(callOff, y, { kind: 'plant' }) : undefined;
    }

    return {
      label,
      rows: buildAnalyticsRows(
        years,
        getProduction,
        getContract,
        undefined,
        undefined,
        showCallOff ? getCallOffLoad : undefined
      ),
      avgProd: averageLoad(years.map(getProduction)),
      avgContract: averageLoad(years.map(getContract)),
      // Call offs: ta sama średnia co prod/kontrakt, ale tylko lata z danymi (bez null/0 / „—”).
      avgCallOff: averageLoad(
        (callOff?.dataYears?.length ? years.filter((y) => callOff.dataYears!.includes(y)) : years).map((y) =>
          showCallOff && getCallOffLoad ? getCallOffLoad(y) : null
        ),
        { skipZeros: true }
      ),
    };
  }, [
    analyticsScope,
    analyticsLines,
    analyticsMachineIds,
    machinesProd,
    contract,
    callOff,
    prod,
    years,
    hasCallOff,
    showCallOff,
    typeFilter,
    clientFilter,
    t,
  ]);

  const seriesLabels = useMemo(() => {
    const out: string[] = [];
    if (showContract) out.push(withRfqLegend(t('dataViz.contractCapacity', { subsystem })));
    if (showProduction) out.push(withRfqLegend(t('dataViz.prodCapacity', { subsystem })));
    if (hasCallOff && showCallOff) out.push(callOffSeriesLabel);
    return out;
  }, [showProduction, showContract, hasCallOff, showCallOff, callOffSeriesLabel, subsystem, withRfqLegend, t]);

  const buildTrendSection = (
    title: string,
    getProd: (year: number) => number | null,
    getContract: (year: number) => number | null
  ): VisualizationPdfSection => {
    const table = trendSectionFromGetters(locale, years, getProd, getContract, undefined, undefined, tableOpts);
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
      const pdfBase = {
        locale,
        strings: pdfStrings,
        yearFrom: effectiveYearFrom,
        yearTo: effectiveYearTo,
        machineStatusLabel: machineStatusPdfLabel,
        machineTypeLabel: machineTypePdfLabel,
        clientLabel: clientPdfLabel,
        scenarioName: null,
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
              (year) => lineLoadPercent(contract?.machines ?? [], line, year)
            )
          )
        : [];

      const machineSections: VisualizationPdfSection[] = opts.machineTables
        ? machinesForScope(opts.machineTablesScope).map((m) => {
            const cm = contract?.machines.find((x) => x.machine_id === m.machine_id);
            return buildTrendSection(
              t('reports.dataViz.machineTitleWithLine', { label: machineLabel(m), line: lineKey(m.location) }),
              (year) => machineLoadPercent(m, year),
              (year) => (cm ? machineLoadPercent(cm, year) : null)
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
              showProduction,
              showContract,
              showScenarioProduction: false,
            })
          : null;

      const anTable = analyticsTableRows(locale, analyticsRows.rows, false, hasCallOff && showCallOff);

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
        scenarioProduction: null,
        scenarioContract: null,
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
              const sheetTitle = t('reports.dataViz.machineTitleWithLine', {
                label: machineLabel(m),
                line: lineKey(m.location),
              });
              const machineYearTotals = (year: number): SeriesValues => ({
                production: machineLoadPercent(m, year),
                contract: cm ? machineLoadPercent(cm, year) : null,
                scenarioProduction: null,
                scenarioContract: null,
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
                showProduction,
                showContract,
                showScenarioProduction: false,
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
        hasScenario: false,
        hasCallOff: hasCallOff && showCallOff,
        detailLevel,
        context: {
          scope: analyticsScope,
          analyticsLines,
          analyticsMachineIds,
          lines,
          machinesProd,
          contractMachines: contract?.machines ?? [],
          callOffMachines: hasCallOff && showCallOff ? callOff?.machines : undefined,
          callOffDataYears: hasCallOff && showCallOff ? callOff?.dataYears : undefined,
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
          [pdfStrings.scenario, pdfStrings.noScenario],
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
        if (showContract) {
          series.push({
            key: `pdf_L${line}_kon`,
            label: withRfqLegend(t('reports.dataViz.lineSeriesContract', { line }), { line }),
            color: nextColor(),
            dash: '5 3',
            getValue: (year) => lineLoadPercent(contract?.machines ?? [], line, year),
          });
        }
        if (showProduction) {
          series.push({
            key: `pdf_L${line}_prod`,
            label: withRfqLegend(t('reports.dataViz.lineSeriesProd', { line }), { line }),
            color: nextColor(),
            getValue: (year) => lineLoadPercent(machinesProd, line, year),
          });
        }
        if (hasCallOff && showCallOff && callOff) {
          series.push({
            key: `pdf_L${line}_calloff`,
            label: t('reports.dataViz.lineSeriesCallOff', { line, name: callOffSeriesLabel }),
            color: nextColor(),
            dash: '2 3',
            getValue: (year) => callOffLoadPercent(callOff, year, { kind: 'line', line }),
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
        (year) => callOffLoadPercent(callOff, year, { kind: 'line', line }),
        { line }
      );
      return {
        captureKey: `line-${line}`,
        title: t('reports.dataViz.lineChartTitle', { line }),
        rows: buildTrendRows(years, series),
        series,
      };
    });
  }, [pdfCaptureActive, reportOptions.lineCharts, reportOptions.lineChartsMode, reportOptions.lineChartsScope, machinesProd, contract, callOff, years, selectedLines, lines, showProduction, showContract, hasCallOff, showCallOff, callOffSeriesLabel, vizColors, withRfqLegend, t]);

  const pdfMachineChartItems = useMemo(() => {
    if (!pdfCaptureActive || !reportOptions.machineCharts) return [];
    const targetMachines = machinesForScope(reportOptions.machineChartsScope);
    if (reportOptions.machineChartsMode === 'combined' && targetMachines.length > 0) {
      const series: TrendSeriesDef[] = [];
      let colorIdx = 0;
      for (const m of targetMachines) {
        const cm = contract?.machines.find((x) => x.machine_id === m.machine_id);
        const label = machineLabel(m);
        const nextColor = () => vizColors.comparePalette[colorIdx++ % vizColors.comparePalette.length];
        if (showContract && cm) {
          series.push({
            key: `pdf_M${m.machine_id}_k`,
            label: withRfqLegend(t('reports.dataViz.machineSeriesContract', { label }), { machineId: m.machine_id }),
            color: nextColor(),
            dash: '5 3',
            getValue: (year) => machineLoadPercent(cm, year),
          });
        }
        if (showProduction) {
          series.push({
            key: `pdf_M${m.machine_id}_p`,
            label: withRfqLegend(t('reports.dataViz.machineSeriesProd', { label }), { machineId: m.machine_id }),
            color: nextColor(),
            getValue: (year) => machineLoadPercent(m, year),
          });
        }
        const com = callOff?.machines.find((x) => x.machine_id === m.machine_id);
        if (hasCallOff && showCallOff && com) {
          series.push({
            key: `pdf_M${m.machine_id}_co`,
            label: t('reports.dataViz.machineSeriesCallOff', { label, name: callOffSeriesLabel }),
            color: nextColor(),
            dash: '2 3',
            getValue: (year) => callOffLoadPercent(callOff, year, { kind: 'machine', machine: com }),
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
      const com = callOff?.machines.find((x) => x.machine_id === m.machine_id);
      const series = baseSeriesForEntity(
        `pdf_m_${m.machine_id}`,
        (year) => machineLoadPercent(m, year),
        (year) => (cm ? machineLoadPercent(cm, year) : null),
        (year) => (com ? callOffLoadPercent(callOff, year, { kind: 'machine', machine: com }) : null),
        { machineId: m.machine_id }
      );
      return {
        captureKey: `machine-${m.machine_id}`,
        title: t('reports.dataViz.machineTitleWithLine', { label: machineLabel(m), line: lineKey(m.location) }),
        rows: buildTrendRows(years, series),
        series,
      };
    });
  }, [pdfCaptureActive, reportOptions.machineCharts, reportOptions.machineChartsMode, reportOptions.machineChartsScope, machinesProd, contract, callOff, years, selectedMachineIds, showProduction, showContract, hasCallOff, showCallOff, callOffSeriesLabel, vizColors, withRfqLegend, t]);

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
            {t('dataViz.rfqFilter')}{' '}
            <RfqTreeMultiFilter
              tree={rfqTree}
              selected={rfqOperationIds}
              onChange={setRfqOperationIds}
              noneLabel={t('dataViz.rfqNone')}
              clearLabel={t('common.clearFilters')}
              emptyLabel={t('dataViz.rfqEmpty')}
              loadingLabel={t('common.loading')}
              searchPlaceholder={t('common.searchFilter')}
              style={{ marginLeft: 4, minWidth: 180 }}
            />
          </label>
          <DataLoadingBadge active={dataVizBusy && Boolean(prod)} label={t('common.recalculating')} />
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
            disabled={!yearsReady || dataVizBusy || exportingPdf || !prod}
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

        <p style={{ margin: '10px 0 0', fontSize: 13, color: '#666', maxWidth: 820, lineHeight: 1.45 }}>
          {t('dataViz.dimFilterHint')}
        </p>
        <MachineDimensionFiltersPanel
          value={dimFilters}
          onChange={setDimFilters}
          titleKey="dataViz.advancedFiltersMachines"
          hintKey="dataViz.dimFilterHint"
          defaultOpen={hasActiveDimFilters(dimFilters)}
          busy={dataVizBusy}
          busyLabel={t('common.recalculating')}
        />
        <div style={{ marginTop: 8 }}>
          <DataLoadingBadge active={dataVizBusy} label={t('common.recalculating')} />
        </div>

        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid #eee',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '10px 14px',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>{t('dataViz.seriesOnCharts')}</span>
          <label style={{ fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={showContract} onChange={(e) => setShowContract(e.target.checked)} />
            <span
              aria-hidden
              style={{ width: 10, height: 10, borderRadius: '50%', background: vizColors.contract, flexShrink: 0 }}
            />
            {t('dataViz.contractCapacity', { subsystem })}
          </label>
          <label style={{ fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={showProduction} onChange={(e) => setShowProduction(e.target.checked)} />
            <span
              aria-hidden
              style={{ width: 10, height: 10, borderRadius: '50%', background: vizColors.production, flexShrink: 0 }}
            />
            {t('dataViz.prodCapacity', { subsystem })}
          </label>
          <label style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {t('dataViz.callOffCompare')}
            <SearchableSelect
              value={callOffComparisonId === '' ? '' : String(callOffComparisonId)}
              onChange={(e) => {
                const next = e.target.value ? Number(e.target.value) : '';
                setCallOffComparisonId(next);
                if (next !== '') setShowCallOff(true);
              }}
              style={{ padding: 4, minWidth: 280 }}
            >
              <option value="">{t('dataViz.noCallOff')}</option>
              {callOffComparisons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.source_filename
                    ? `${c.name} · ${c.date_from.slice(0, 10)}–${c.date_to.slice(0, 10)} · ${c.source_filename}`
                    : `${c.name} · ${c.date_from.slice(0, 10)}–${c.date_to.slice(0, 10)}`}
                </option>
              ))}
            </SearchableSelect>
          </label>
          {hasCallOff && (
            <label style={{ fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={showCallOff}
                onChange={(e) => setShowCallOff(e.target.checked)}
              />
              <span
                aria-hidden
                style={{ width: 10, height: 10, borderRadius: '50%', background: vizColors.callOff, flexShrink: 0 }}
              />
              {callOffSeriesLabel}
            </label>
          )}
          <label
            style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title={t('dataViz.flexHint')}
          >
            {t('dataViz.flex')}
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="decimal"
              placeholder="%"
              value={flexPercentInput}
              onChange={(e) => setFlexPercentInput(e.target.value)}
              style={{ width: 64, padding: '4px 6px' }}
              aria-label={t('dataViz.flex')}
            />
            <span style={{ color: '#666' }}>%</span>
          </label>
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

      <DataLoadingOverlay active={dataVizBusy && Boolean(prod)} label={t('common.recalculating')}>
      {tab === 'lines' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: '1rem', alignItems: 'start' }}>
          <div style={panelStyle}>
            <strong style={{ fontSize: 14 }}>{t('dataViz.selectLines')}</strong>
            <p style={{ margin: '6px 0 10px', fontSize: 12, color: '#777' }}>{t('dataViz.toggleLineChart')}</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={lineChartCombined} onChange={(e) => setLineChartCombined(e.target.checked)} />
              {t('dataViz.combinedLines')}
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: lineChartBars ? 8 : 10, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={lineChartBars}
                onChange={(e) => setLineChartBars(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                <span style={{ display: 'block' }}>{t('dataViz.combinedLinesBars')}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#666', marginTop: 2, lineHeight: 1.35 }}>
                  {t('dataViz.combinedLinesBarsHint')}
                </span>
              </span>
            </label>
            {lineChartBars && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13 }}>
                {t('dataViz.machineLineBarYear')}
                <input
                  type="number"
                  min={effectiveYearFrom}
                  max={effectiveYearTo}
                  value={effectiveLineBarYear}
                  onChange={(e) => setLineBarYear(Number(e.target.value) || calendarYear())}
                  style={{ width: 88, padding: '4px 6px' }}
                />
              </label>
            )}
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
            {!lines.length && !dataVizBusy && <p style={{ fontSize: 13, color: '#888' }}>{t('dataViz.noLinesInData')}</p>}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {combinedLineChart}
                  {combinedLineBarChart}
                  {!lineChartCombined && (
                    <div style={chartGridStyle(chartGridCols)}>{lineCharts}</div>
                  )}
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
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: machineChartLineBars ? 8 : 10, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={machineChartLineBars}
                onChange={(e) => setMachineChartLineBars(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                <span style={{ display: 'block' }}>{t('dataViz.combinedMachinesLineBars')}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#666', marginTop: 2, lineHeight: 1.35 }}>
                  {t('dataViz.combinedMachinesLineBarsHint')}
                </span>
              </span>
            </label>
            {machineChartLineBars && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13 }}>
                {t('dataViz.machineLineBarYear')}
                <input
                  type="number"
                  min={effectiveYearFrom}
                  max={effectiveYearTo}
                  value={effectiveMachineLineBarYear}
                  onChange={(e) => setMachineLineBarYear(Number(e.target.value) || calendarYear())}
                  style={{ width: 88, padding: '4px 6px' }}
                />
              </label>
            )}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {combinedMachineChart}
                  {combinedMachineLineBarChart}
                  {!machineChartCombined && (
                    <div style={chartGridStyle(chartGridCols)}>{machineCharts}</div>
                  )}
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
              flexPercent={flexPercent}
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
              flexPercent={flexPercent}
            />
          ))}
          {reportOptions.analyticsChart && (
            <CapacityAnalyticsDeltaChart
              captureKey="analytics-delta"
              title={t('dataViz.annualDiffTitle', { label: analyticsRows.label })}
              rows={analyticsRows.rows}
              hasScenario={false}
              hasCallOff={hasCallOff && showCallOff}
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
            {hasCallOff && showCallOff && analyticsRows.avgCallOff != null && (
              <SummaryCard label={callOffSeriesLabel} value={analyticsRows.avgCallOff} color={vizColors.callOff} />
            )}
          </AdminHubList>
          </div>

          <CapacityAnalyticsPanel
            entityLabel={analyticsRows.label}
            rows={analyticsRows.rows}
            hasScenario={false}
            hasCallOff={hasCallOff && showCallOff}
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
                    callOffMachines: hasCallOff && showCallOff ? callOff?.machines : undefined,
                    callOffDataYears: hasCallOff && showCallOff ? callOff?.dataYears : undefined,
                    showScenarioProduction: false,
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
