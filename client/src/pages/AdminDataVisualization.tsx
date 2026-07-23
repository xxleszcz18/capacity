import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { api } from '../api/client';
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
  scenarioId?: number;
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
    scenarioId: params.scenarioId,
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
  const [callOffIds, setCallOffIds] = useState<number[]>([]);
  const [callOffComparisons, setCallOffComparisons] = useState<
    { id: number; name: string; source_filename: string | null; date_from: string; date_to: string }[]
  >([]);
  const [scenarioIds, setScenarioIds] = useState<number[]>([]);
  const [scenarios, setScenarios] = useState<{ id: number; name: string; created_at: string }[]>([]);
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
  const [showScenarioProduction, setShowScenarioProduction] = useState(true);
  const [showScenarioContract, setShowScenarioContract] = useState(true);
  /** Flex ±% od nominału na wykresach liniowych (pusty = bez wstęgi). */
  const [flexPercentInput, setFlexPercentInput] = useState('');
  const flexPercent = useMemo(() => parseFlexPercentInput(flexPercentInput), [flexPercentInput]);

  const [prodRaw, setProd] = useState<CapacityTrendBundle | null>(null);
  const [contractRaw, setContract] = useState<CapacityTrendBundle | null>(null);
  /** Bundle Call offs per comparison id (surowe, przed filtrem wymiarów). */
  const [callOffBundlesRaw, setCallOffBundlesRaw] = useState<Record<number, CapacityTrendBundle>>({});
  /** Pary prod/kontrakt per scenarioId (surowe, przed filtrem wymiarów). */
  const [scenarioBundlesRaw, setScenarioBundlesRaw] = useState<
    Record<number, { prod: CapacityTrendBundle; contract: CapacityTrendBundle }>
  >({});
  const [baseLoading, setBaseLoading] = useState(false);
  const [callOffLoading, setCallOffLoading] = useState(false);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const loading = baseLoading || callOffLoading || scenarioLoading;
  const loadBaseGenRef = useRef(0);
  const loadCallOffGenRef = useRef(0);
  const loadScenarioGenRef = useRef(0);
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
  const hasCallOff = callOffIds.length > 0;
  /** Analityka / słupki / kolumny PDF — jedna kolumna Call offs tylko przy pojedynczym wyborze. */
  const singleCallOffMode = callOffIds.length === 1;
  const hasScenario = scenarioIds.length > 0;
  /** Analityka / tabele PDF mają jedną kolumnę scenariusza — tylko przy pojedynczym wyborze. */
  const singleScenarioMode = scenarioIds.length === 1;

  const breakdownFetchParams = useMemo(
    () => ({
      yearFrom: effectiveYearFrom,
      yearTo: effectiveYearTo,
      machineStatus,
      type: typeFilter,
      client: clientFilter,
      settingsProfile,
      callOffComparisonId: singleCallOffMode ? callOffIds[0] : undefined,
      scenarioId: singleScenarioMode ? scenarioIds[0] : undefined,
      includeRfqOperationIds: rfqOperationIds,
      dimFilters,
    }),
    [effectiveYearFrom, effectiveYearTo, machineStatus, typeFilter, clientFilter, settingsProfile, singleCallOffMode, callOffIds, singleScenarioMode, scenarioIds, dimFilters, rfqOperationIds]
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
    api.scenarios
      .list({ archived: false })
      .then((list) =>
        setScenarios(
          list.map((s) => ({
            id: s.id,
            name: s.name,
            created_at: s.created_at,
          }))
        )
      )
      .catch(() => setScenarios([]));
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
      hasScenario: singleScenarioMode,
      showScenarioProduction: singleScenarioMode && showScenarioProduction,
      showScenarioContract: singleScenarioMode && showScenarioContract,
    }),
    [showProduction, showContract, singleScenarioMode, showScenarioProduction, showScenarioContract]
  );

  const vizBaseParams = useMemo(
    () => ({
      yearFrom: effectiveYearFrom,
      yearTo: effectiveYearTo,
      machineStatus,
      type: typeFilter,
      client: clientFilter,
      settingsProfile,
      includeRfqOperationIds: rfqOperationIds,
    }),
    [
      effectiveYearFrom,
      effectiveYearTo,
      machineStatus,
      typeFilter,
      clientFilter,
      settingsProfile,
      rfqOperationIds,
    ]
  );

  const loadBaseBundles = useCallback(async () => {
    const gen = ++loadBaseGenRef.current;
    setBaseLoading(true);
    setError('');
    try {
      const [prodBundle, contractBundle] = await Promise.all([
        fetchCapacityBundle(vizBaseParams),
        fetchCapacityBundle({ ...vizBaseParams, useContractualVolumes: true }),
      ]);
      if (gen !== loadBaseGenRef.current) return;
      setProd(prodBundle);
      setContract(contractBundle);
    } catch (e: unknown) {
      if (gen !== loadBaseGenRef.current) return;
      const msg = e instanceof Error ? e.message : '';
      setError(te(msg) || t('dataViz.loadFailed', { subsystem }));
      setProd(null);
      setContract(null);
    } finally {
      if (gen === loadBaseGenRef.current) setBaseLoading(false);
    }
  }, [vizBaseParams, subsystem, t, te]);

  const loadCallOffBundles = useCallback(async () => {
    const gen = ++loadCallOffGenRef.current;
    setCallOffLoading(true);
    setError('');
    // Od razu czyść stare serie — wykres nie miesza poprzednich Call offs z nowym wyborem.
    setCallOffBundlesRaw({});
    try {
      if (callOffIds.length === 0) {
        if (gen !== loadCallOffGenRef.current) return;
        return;
      }
      const pairs = await Promise.all(
        callOffIds.map(async (coid) => {
          const res = await api.callOffs.calculator(coid, {
            yearFrom: vizBaseParams.yearFrom,
            yearTo: vizBaseParams.yearTo,
            machineStatuses: joinCsvFilter(vizBaseParams.machineStatus),
            types: joinCsvFilter(vizBaseParams.type),
            clients: joinCsvFilter(vizBaseParams.client),
            settingsProfile: vizBaseParams.settingsProfile === 'ocu' ? 'ocu' : undefined,
          });
          return [coid, callOffCalculatorToTrendBundle(res)] as const;
        })
      );
      if (gen !== loadCallOffGenRef.current) return;
      const next: Record<number, CapacityTrendBundle> = {};
      for (const [coid, bundle] of pairs) next[coid] = bundle;
      setCallOffBundlesRaw(next);
    } catch (e: unknown) {
      if (gen !== loadCallOffGenRef.current) return;
      const msg = e instanceof Error ? e.message : '';
      setError(te(msg) || t('dataViz.loadFailed', { subsystem }));
      setCallOffBundlesRaw({});
    } finally {
      if (gen === loadCallOffGenRef.current) setCallOffLoading(false);
    }
  }, [callOffIds, vizBaseParams, subsystem, t, te]);

  const loadScenarioBundles = useCallback(async () => {
    const gen = ++loadScenarioGenRef.current;
    setScenarioLoading(true);
    setError('');
    setScenarioBundlesRaw({});
    try {
      if (scenarioIds.length === 0) {
        if (gen !== loadScenarioGenRef.current) return;
        return;
      }
      const pairs = await Promise.all(
        scenarioIds.map(async (sid) => {
          const [prodBundle, contractBundle] = await Promise.all([
            fetchCapacityBundle({ ...vizBaseParams, scenarioId: sid }),
            fetchCapacityBundle({ ...vizBaseParams, scenarioId: sid, useContractualVolumes: true }),
          ]);
          return [sid, { prod: prodBundle, contract: contractBundle }] as const;
        })
      );
      if (gen !== loadScenarioGenRef.current) return;
      const next: Record<number, { prod: CapacityTrendBundle; contract: CapacityTrendBundle }> = {};
      for (const [sid, pair] of pairs) next[sid] = pair;
      setScenarioBundlesRaw(next);
    } catch (e: unknown) {
      if (gen !== loadScenarioGenRef.current) return;
      const msg = e instanceof Error ? e.message : '';
      setError(te(msg) || t('dataViz.loadFailed', { subsystem }));
      setScenarioBundlesRaw({});
    } finally {
      if (gen === loadScenarioGenRef.current) setScenarioLoading(false);
    }
  }, [scenarioIds, vizBaseParams, subsystem, t, te]);

  /** Pełne odświeżenie (przycisk) — równolegle baza + Call offs + scenariusze. */
  const loadData = useCallback(() => {
    void loadBaseBundles();
    void loadCallOffBundles();
    void loadScenarioBundles();
  }, [loadBaseBundles, loadCallOffBundles, loadScenarioBundles]);

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
    void loadBaseBundles();
  }, [yearsReady, loadBaseBundles]);

  useEffect(() => {
    if (!yearsReady) return;
    void loadCallOffBundles();
  }, [yearsReady, loadCallOffBundles]);

  useEffect(() => {
    if (!yearsReady) return;
    void loadScenarioBundles();
  }, [yearsReady, loadScenarioBundles]);

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
  const callOffCompareList = useMemo(() => {
    const palette = vizColors.comparePalette;
    return callOffIds
      .map((id, index) => {
        const raw = callOffBundlesRaw[id];
        if (!raw) return null;
        const cmp = callOffComparisons.find((c) => c.id === id);
        const name = cmp?.name ?? `#${id}`;
        const label = cmp?.source_filename
          ? t('reports.dataViz.seriesCallOffNamed', { name, file: cmp.source_filename })
          : t('reports.dataViz.seriesCallOffNamedShort', { name });
        const color = index === 0 ? vizColors.callOff : palette[(index + 3) % palette.length];
        return {
          id,
          name,
          index,
          label,
          color,
          bundle: {
            ...raw,
            machines: filterMachinesByDimensionFilters(raw.machines, dimFilters, machineDimLookup),
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [callOffIds, callOffBundlesRaw, callOffComparisons, dimFilters, machineDimLookup, vizColors, t]);

  /** Pierwszy Call offs — analityka / słupki przy single select. */
  const callOff = singleCallOffMode ? callOffCompareList[0]?.bundle ?? null : null;
  const callOffSeriesLabel = callOffCompareList[0]?.label ?? t('reports.dataViz.seriesCallOff');

  const scenarioCompareList = useMemo(() => {
    const palette = vizColors.comparePalette;
    return scenarioIds
      .map((id, index) => {
        const raw = scenarioBundlesRaw[id];
        if (!raw) return null;
        const name = scenarios.find((s) => s.id === id)?.name ?? `#${id}`;
        const colorProd = index === 0 ? vizColors.scenarioProduction : palette[(index * 2) % palette.length];
        const colorContract =
          index === 0 ? vizColors.scenarioContract : palette[(index * 2 + 1) % palette.length];
        return {
          id,
          name,
          index,
          prod: {
            ...raw.prod,
            machines: filterMachinesByDimensionFilters(raw.prod.machines, dimFilters, machineDimLookup),
          },
          contract: {
            ...raw.contract,
            machines: filterMachinesByDimensionFilters(raw.contract.machines, dimFilters, machineDimLookup),
          },
          colorProd,
          colorContract,
          labelProd: t('dataViz.scenarioProdNamed', { name }),
          labelContract: t('dataViz.scenarioContractNamed', { name }),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [scenarioIds, scenarioBundlesRaw, scenarios, dimFilters, machineDimLookup, vizColors, t]);

  /** Pierwszy wybrany scenariusz — kolumny analityki / PDF przy single select. */
  const scenarioProd = singleScenarioMode ? scenarioCompareList[0]?.prod ?? null : null;
  const scenarioContract = singleScenarioMode ? scenarioCompareList[0]?.contract ?? null : null;
  const scenarioProdSeriesLabel = scenarioCompareList[0]?.labelProd ?? t('dataViz.scenarioProd');
  const scenarioContractSeriesLabel = scenarioCompareList[0]?.labelContract ?? t('dataViz.scenarioContract');

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
    _getCallOff?: (year: number) => number | null,
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
    if (showCallOff) {
      for (const co of callOffCompareList) {
        out.push({
          key: `${prefix}_co${co.id}_calloff`,
          label: co.label,
          color: co.color,
          dash: '2 3',
          getValue: (year) => {
            if (scope?.machineId != null) {
              const m = co.bundle.machines.find((x) => x.machine_id === scope.machineId);
              return m ? callOffLoadPercent(co.bundle, year, { kind: 'machine', machine: m }) : null;
            }
            if (scope?.line != null) {
              return callOffLoadPercent(co.bundle, year, { kind: 'line', line: scope.line });
            }
            return null;
          },
        });
      }
    }
    for (const scen of scenarioCompareList) {
      if (showScenarioContract) {
        out.push({
          key: `${prefix}_scen${scen.id}_scen_contract`,
          label: scen.labelContract,
          color: scen.colorContract,
          dash: '6 3',
          getValue: (year) => {
            if (scope?.machineId != null) {
              const sm = scen.contract.machines.find((x) => x.machine_id === scope.machineId);
              return sm ? machineLoadPercent(sm, year) : null;
            }
            if (scope?.line != null) {
              return lineLoadPercent(scen.contract.machines, scope.line, year);
            }
            return null;
          },
        });
      }
      if (showScenarioProduction) {
        out.push({
          key: `${prefix}_scen${scen.id}_scen_prod`,
          label: scen.labelProd,
          color: scen.colorProd,
          dash: '4 2',
          getValue: (year) => {
            if (scope?.machineId != null) {
              const sm = scen.prod.machines.find((x) => x.machine_id === scope.machineId);
              return sm ? machineLoadPercent(sm, year) : null;
            }
            if (scope?.line != null) {
              return lineLoadPercent(scen.prod.machines, scope.line, year);
            }
            return null;
          },
        });
      }
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
      if (showCallOff) {
        for (const co of callOffCompareList) {
          out.push({
            key: `cmp_L${line}_co${co.id}_calloff`,
            label: t('reports.dataViz.lineSeriesCallOff', { line, name: co.label }),
            color: nextColor(),
            dash: '2 3',
            getValue: (year) => callOffLoadPercent(co.bundle, year, { kind: 'line', line }),
          });
        }
      }
      for (const scen of scenarioCompareList) {
        if (showScenarioContract) {
          out.push({
            key: `cmp_L${line}_scen${scen.id}_scen_contract`,
            label: `${scen.labelContract} · L${line}`,
            color: nextColor(),
            dash: '6 3',
            getValue: (year) => lineLoadPercent(scen.contract.machines, line, year),
          });
        }
        if (showScenarioProduction) {
          out.push({
            key: `cmp_L${line}_scen${scen.id}_scen_prod`,
            label: `${scen.labelProd} · L${line}`,
            color: nextColor(),
            dash: '4 2',
            getValue: (year) => lineLoadPercent(scen.prod.machines, line, year),
          });
        }
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
      if (showCallOff) {
        for (const co of callOffCompareList) {
          const com = co.bundle.machines.find((x) => x.machine_id === m.machine_id);
          if (!com) continue;
          out.push({
            key: `cmp_M${m.machine_id}_co${co.id}_calloff`,
            label: t('reports.dataViz.machineSeriesCallOff', { label, name: co.label }),
            color: nextColor(),
            dash: '2 3',
            getValue: (year) => callOffLoadPercent(co.bundle, year, { kind: 'machine', machine: com }),
          });
        }
      }
      for (const scen of scenarioCompareList) {
        const scm = scen.contract.machines.find((x) => x.machine_id === m.machine_id);
        if (showScenarioContract && scm) {
          out.push({
            key: `cmp_M${m.machine_id}_scen${scen.id}_scen_contract`,
            label: `${scen.labelContract} · ${label}`,
            color: nextColor(),
            dash: '6 3',
            getValue: (year) => machineLoadPercent(scm, year),
          });
        }
        const sm = scen.prod.machines.find((x) => x.machine_id === m.machine_id);
        if (showScenarioProduction && sm) {
          out.push({
            key: `cmp_M${m.machine_id}_scen${scen.id}_scen_prod`,
            label: `${scen.labelProd} · ${label}`,
            color: nextColor(),
            dash: '4 2',
            getValue: (year) => machineLoadPercent(sm, year),
          });
        }
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
      callOffCompareList,
      scenarioCompareList,
      years,
      showProduction,
      showContract,
      showCallOff,
      showScenarioProduction,
      showScenarioContract,
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
      callOffCompareList,
      scenarioCompareList,
      years,
      showProduction,
      showContract,
      showCallOff,
      showScenarioProduction,
      showScenarioContract,
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

  const barExtraSources = useMemo(() => {
    const out: { key: string; machines: typeof machinesProd; dataYears?: number[] | null }[] = [];
    if (showCallOff) {
      for (const co of callOffCompareList) {
        out.push({
          key: `callOff_${co.id}`,
          machines: co.bundle.machines,
          dataYears: co.bundle.dataYears,
        });
      }
    }
    for (const scen of scenarioCompareList) {
      if (showScenarioContract) {
        out.push({
          key: `scen${scen.id}_contract`,
          machines: scen.contract.machines,
        });
      }
      if (showScenarioProduction) {
        out.push({
          key: `scen${scen.id}_prod`,
          machines: scen.prod.machines,
        });
      }
    }
    return out;
  }, [
    showCallOff,
    callOffCompareList,
    scenarioCompareList,
    showScenarioContract,
    showScenarioProduction,
  ]);

  const machineLineBarRows = useMemo(
    () =>
      buildMachineBarRows(
        machinesProd,
        contract?.machines ?? [],
        selectedMachineIds,
        effectiveMachineLineBarYear,
        machineBarChartLabel,
        barExtraSources
      ),
    [
      machinesProd,
      contract,
      selectedMachineIds,
      effectiveMachineLineBarYear,
      machineBarChartLabel,
      barExtraSources,
    ]
  );

  const lineBarRows = useMemo(
    () =>
      buildLineBarRows(
        machinesProd,
        contract?.machines ?? [],
        selectedLines,
        effectiveLineBarYear,
        barExtraSources
      ),
    [machinesProd, contract, selectedLines, effectiveLineBarYear, barExtraSources]
  );

  const barExtraSeries = useMemo(() => {
    const out: { key: string; name: string; color: string }[] = [];
    if (showCallOff) {
      for (const co of callOffCompareList) {
        out.push({
          key: `callOff_${co.id}`,
          name: callOffCompareList.length > 1 ? co.name : co.label,
          color: co.color,
        });
      }
    }
    for (const scen of scenarioCompareList) {
      if (showScenarioContract) {
        out.push({
          key: `scen${scen.id}_contract`,
          name: scen.labelContract,
          color: scen.colorContract,
        });
      }
      if (showScenarioProduction) {
        out.push({
          key: `scen${scen.id}_prod`,
          name: scen.labelProd,
          color: scen.colorProd,
        });
      }
    }
    return out;
  }, [
    showCallOff,
    callOffCompareList,
    scenarioCompareList,
    showScenarioContract,
    showScenarioProduction,
  ]);

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
        extraSeries={barExtraSeries}
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
        extraSeries={barExtraSeries}
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
    return machinesLoadPercent(
      bundle.machines,
      bundle.machines.map((m) => m.machine_id),
      year
    );
  };

  const analyticsRows = useMemo(() => {
    let getProduction: (year: number) => number | null;
    let getContract: (year: number) => number | null;
    let getScenarioProduction: ((year: number) => number | null) | undefined;
    let getScenarioContract: ((year: number) => number | null) | undefined;
    let getCallOffLoad: ((year: number) => number | null) | undefined;
    let label = '';

    if (analyticsScope === 'line' && analyticsLines.length > 0) {
      const lineSummary = analyticsLines.map((line) => t('dataViz.lineLabel', { line })).join(', ');
      label = t('reports.dataViz.analyticsLine', { line: lineSummary });
      getProduction = (y) => linesLoadPercent(machinesProd, analyticsLines, y);
      getContract = (y) => linesLoadPercent(contract?.machines ?? [], analyticsLines, y);
      getScenarioProduction =
        singleScenarioMode && showScenarioProduction && scenarioProd
          ? (y) => linesLoadPercent(scenarioProd.machines, analyticsLines, y)
          : undefined;
      getScenarioContract =
        singleScenarioMode && showScenarioContract && scenarioContract
          ? (y) => linesLoadPercent(scenarioContract.machines, analyticsLines, y)
          : undefined;
      getCallOffLoad =
        singleCallOffMode && callOff
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
      getScenarioProduction =
        singleScenarioMode && showScenarioProduction && scenarioProd
          ? (y) => machinesLoadPercent(scenarioProd.machines, analyticsMachineIds, y)
          : undefined;
      getScenarioContract =
        singleScenarioMode && showScenarioContract && scenarioContract
          ? (y) => machinesLoadPercent(scenarioContract.machines, analyticsMachineIds, y)
          : undefined;
      getCallOffLoad =
        singleCallOffMode && callOff
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
      getScenarioProduction =
        singleScenarioMode && showScenarioProduction ? (y) => plantLoad(scenarioProd, y) : undefined;
      getScenarioContract =
        singleScenarioMode && showScenarioContract ? (y) => plantLoad(scenarioContract, y) : undefined;
      getCallOffLoad = singleCallOffMode && callOff ? (y) => callOffLoadPercent(callOff, y, { kind: 'plant' }) : undefined;
    }

    return {
      label,
      rows: buildAnalyticsRows(
        years,
        getProduction,
        getContract,
        getScenarioProduction,
        getScenarioContract,
        showCallOff ? getCallOffLoad : undefined
      ),
      avgProd: averageLoad(years.map(getProduction)),
      avgContract: averageLoad(years.map(getContract)),
      avgScenarioProd: averageLoad(years.map((y) => (getScenarioProduction ? getScenarioProduction(y) : null))),
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
    scenarioProd,
    scenarioContract,
    prod,
    years,
    singleCallOffMode,
    showCallOff,
    singleScenarioMode,
    showScenarioProduction,
    showScenarioContract,
    typeFilter,
    clientFilter,
    t,
  ]);

  const seriesLabels = useMemo(() => {
    const out: string[] = [];
    if (showContract) out.push(withRfqLegend(t('dataViz.contractCapacity', { subsystem })));
    if (showProduction) out.push(withRfqLegend(t('dataViz.prodCapacity', { subsystem })));
    if (showCallOff) {
      for (const co of callOffCompareList) out.push(co.label);
    }
    for (const scen of scenarioCompareList) {
      if (showScenarioContract) out.push(scen.labelContract);
      if (showScenarioProduction) out.push(scen.labelProd);
    }
    return out;
  }, [
    showProduction,
    showContract,
    showCallOff,
    callOffCompareList,
    scenarioCompareList,
    showScenarioProduction,
    showScenarioContract,
    subsystem,
    withRfqLegend,
    t,
  ]);

  const buildTrendSection = (
    title: string,
    getProd: (year: number) => number | null,
    getContract: (year: number) => number | null,
    getScenarioProduction?: (year: number) => number | null,
    getScenarioContract?: (year: number) => number | null
  ): VisualizationPdfSection => {
    const table = trendSectionFromGetters(
      locale,
      years,
      getProd,
      getContract,
      getScenarioProduction,
      getScenarioContract,
      tableOpts
    );
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
        scenarioName: hasScenario
          ? scenarioCompareList.map((s) => s.name).join(', ') || null
          : null,
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
              singleScenarioMode && showScenarioProduction && scenarioProd
                ? (year) => lineLoadPercent(scenarioProd.machines, line, year)
                : undefined,
              singleScenarioMode && showScenarioContract && scenarioContract
                ? (year) => lineLoadPercent(scenarioContract.machines, line, year)
                : undefined
            )
          )
        : [];

      const machineSections: VisualizationPdfSection[] = opts.machineTables
        ? machinesForScope(opts.machineTablesScope).map((m) => {
            const cm = contract?.machines.find((x) => x.machine_id === m.machine_id);
            const sm = scenarioProd?.machines.find((x) => x.machine_id === m.machine_id);
            const scm = scenarioContract?.machines.find((x) => x.machine_id === m.machine_id);
            return buildTrendSection(
              t('reports.dataViz.machineTitleWithLine', { label: machineLabel(m), line: lineKey(m.location) }),
              (year) => machineLoadPercent(m, year),
              (year) => (cm ? machineLoadPercent(cm, year) : null),
              singleScenarioMode && showScenarioProduction && sm
                ? (year) => machineLoadPercent(sm, year)
                : undefined,
              singleScenarioMode && showScenarioContract && scm
                ? (year) => machineLoadPercent(scm, year)
                : undefined
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
              getScenarioProduction:
                singleScenarioMode && showScenarioProduction && scenarioProd
                  ? (line, year) => lineLoadPercent(scenarioProd.machines, line, year)
                  : undefined,
              showProduction,
              showContract,
              showScenarioProduction: singleScenarioMode && showScenarioProduction,
            })
          : null;

      const anTable = analyticsTableRows(
        locale,
        analyticsRows.rows,
        singleScenarioMode && showScenarioProduction,
        singleCallOffMode && showCallOff
      );

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
        scenarioProduction:
          singleScenarioMode && showScenarioProduction && scenarioProd
            ? lineLoadPercent(scenarioProd.machines, line, year)
            : null,
        scenarioContract:
          singleScenarioMode && showScenarioContract && scenarioContract
            ? lineLoadPercent(scenarioContract.machines, line, year)
            : null,
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
              const sm = scenarioProd?.machines.find((x) => x.machine_id === m.machine_id);
              const scm = scenarioContract?.machines.find((x) => x.machine_id === m.machine_id);
              const machineYearTotals = (year: number): SeriesValues => ({
                production: machineLoadPercent(m, year),
                contract: cm ? machineLoadPercent(cm, year) : null,
                scenarioProduction:
                  singleScenarioMode && showScenarioProduction && sm ? machineLoadPercent(sm, year) : null,
                scenarioContract:
                  singleScenarioMode && showScenarioContract && scm ? machineLoadPercent(scm, year) : null,
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
                getScenarioProduction: (line, year) => lineYearTotals(line, year).scenarioProduction,
                showProduction,
                showContract,
                showScenarioProduction: singleScenarioMode && showScenarioProduction,
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
        hasScenario: singleScenarioMode && showScenarioProduction,
        hasCallOff: singleCallOffMode && showCallOff,
        detailLevel,
        context: {
          scope: analyticsScope,
          analyticsLines,
          analyticsMachineIds,
          lines,
          machinesProd,
          contractMachines: contract?.machines ?? [],
          scenProdMachines:
            singleScenarioMode && showScenarioProduction ? scenarioProd?.machines : undefined,
          scenContractMachines:
            singleScenarioMode && showScenarioContract ? scenarioContract?.machines : undefined,
          callOffMachines: singleCallOffMode && showCallOff ? callOff?.machines : undefined,
          callOffDataYears: singleCallOffMode && showCallOff ? callOff?.dataYears : undefined,
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
          [pdfStrings.scenario, hasScenario ? scenarioCompareList.map((s) => s.name).join(', ') || pdfStrings.noScenario : pdfStrings.noScenario],
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
                opts.analyticsSummary && singleScenarioMode && showScenarioProduction
                  ? analyticsRows.avgScenarioProd
                  : null,
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
        if (showCallOff) {
          for (const co of callOffCompareList) {
            series.push({
              key: `pdf_L${line}_co${co.id}_calloff`,
              label: t('reports.dataViz.lineSeriesCallOff', { line, name: co.label }),
              color: nextColor(),
              dash: '2 3',
              getValue: (year) => callOffLoadPercent(co.bundle, year, { kind: 'line', line }),
            });
          }
        }
        for (const scen of scenarioCompareList) {
          if (showScenarioContract) {
            series.push({
              key: `pdf_L${line}_scen${scen.id}_scen_contract`,
              label: `${scen.labelContract} · L${line}`,
              color: nextColor(),
              dash: '6 3',
              getValue: (year) => lineLoadPercent(scen.contract.machines, line, year),
            });
          }
          if (showScenarioProduction) {
            series.push({
              key: `pdf_L${line}_scen${scen.id}_scen_prod`,
              label: `${scen.labelProd} · L${line}`,
              color: nextColor(),
              dash: '4 2',
              getValue: (year) => lineLoadPercent(scen.prod.machines, line, year),
            });
          }
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
  }, [pdfCaptureActive, reportOptions.lineCharts, reportOptions.lineChartsMode, reportOptions.lineChartsScope, machinesProd, contract, callOffCompareList, scenarioCompareList, years, selectedLines, lines, showProduction, showContract, showCallOff, showScenarioProduction, showScenarioContract, vizColors, withRfqLegend, t]);

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
        if (showCallOff) {
          for (const co of callOffCompareList) {
            const com = co.bundle.machines.find((x) => x.machine_id === m.machine_id);
            if (!com) continue;
            series.push({
              key: `pdf_M${m.machine_id}_co${co.id}_calloff`,
              label: t('reports.dataViz.machineSeriesCallOff', { label, name: co.label }),
              color: nextColor(),
              dash: '2 3',
              getValue: (year) => callOffLoadPercent(co.bundle, year, { kind: 'machine', machine: com }),
            });
          }
        }
        for (const scen of scenarioCompareList) {
          const scm = scen.contract.machines.find((x) => x.machine_id === m.machine_id);
          if (showScenarioContract && scm) {
            series.push({
              key: `pdf_M${m.machine_id}_scen${scen.id}_scen_contract`,
              label: `${scen.labelContract} · ${label}`,
              color: nextColor(),
              dash: '6 3',
              getValue: (year) => machineLoadPercent(scm, year),
            });
          }
          const sm = scen.prod.machines.find((x) => x.machine_id === m.machine_id);
          if (showScenarioProduction && sm) {
            series.push({
              key: `pdf_M${m.machine_id}_scen${scen.id}_scen_prod`,
              label: `${scen.labelProd} · ${label}`,
              color: nextColor(),
              dash: '4 2',
              getValue: (year) => machineLoadPercent(sm, year),
            });
          }
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
  }, [pdfCaptureActive, reportOptions.machineCharts, reportOptions.machineChartsMode, reportOptions.machineChartsScope, machinesProd, contract, callOffCompareList, scenarioCompareList, years, selectedMachineIds, showProduction, showContract, showCallOff, showScenarioProduction, showScenarioContract, vizColors, withRfqLegend, t]);

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
          <DataLoadingBadge active={dataVizBusy} label={t('common.recalculating')} />
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

        <MachineDimensionFiltersPanel
          value={dimFilters}
          onChange={setDimFilters}
          titleKey="dataViz.advancedFiltersMachines"
          hintKey={null}
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
            <MultiSelectFilter
              options={callOffComparisons.map((c) => ({
                value: c.id,
                label: c.source_filename
                  ? `${c.name} · ${c.date_from.slice(0, 10)}–${c.date_to.slice(0, 10)} · ${c.source_filename}`
                  : `${c.name} · ${c.date_from.slice(0, 10)}–${c.date_to.slice(0, 10)}`,
              }))}
              selected={callOffIds}
              onChange={(next) => {
                setCallOffIds(next);
                if (next.length > 0) setShowCallOff(true);
              }}
              allLabel={t('dataViz.noCallOff')}
              clearLabel={t('common.clearFilters')}
              searchable
              searchPlaceholder={t('common.searchFilter')}
              style={{ minWidth: 280 }}
            />
          </label>
          {hasCallOff && (
            <>
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
                {singleCallOffMode ? callOffSeriesLabel : t('reports.dataViz.seriesCallOff')}
              </label>
              {callOffCompareList.length > 1 &&
                callOffCompareList.map((co) => (
                  <span
                    key={co.id}
                    style={{
                      fontSize: 12,
                      color: '#555',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title={co.label}
                  >
                    <span
                      aria-hidden
                      style={{ width: 8, height: 8, borderRadius: '50%', background: co.color }}
                    />
                    {co.name}
                  </span>
                ))}
            </>
          )}
          <label style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {t('dataViz.scenarioCompare')}
            <MultiSelectFilter
              options={scenarios.map((s) => ({ value: s.id, label: s.name }))}
              selected={scenarioIds}
              onChange={(next) => {
                setScenarioIds(next);
                if (next.length > 0) {
                  setShowScenarioProduction(true);
                  setShowScenarioContract(true);
                }
              }}
              allLabel={t('dataViz.noScenario')}
              clearLabel={t('common.clearFilters')}
              searchable
              searchPlaceholder={t('common.searchFilter')}
              style={{ minWidth: 240 }}
            />
          </label>
          {hasScenario && (
            <>
              <label style={{ fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={showScenarioContract}
                  onChange={(e) => setShowScenarioContract(e.target.checked)}
                />
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: vizColors.scenarioContract,
                    flexShrink: 0,
                  }}
                />
                {singleScenarioMode ? scenarioContractSeriesLabel : t('dataViz.scenarioContract')}
              </label>
              <label style={{ fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={showScenarioProduction}
                  onChange={(e) => setShowScenarioProduction(e.target.checked)}
                />
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: vizColors.scenarioProduction,
                    flexShrink: 0,
                  }}
                />
                {singleScenarioMode ? scenarioProdSeriesLabel : t('dataViz.scenarioProd')}
              </label>
              {scenarioCompareList.length > 1 &&
                scenarioCompareList.map((scen) => (
                  <span
                    key={scen.id}
                    style={{
                      fontSize: 12,
                      color: '#555',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title={`${scen.labelContract} / ${scen.labelProd}`}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: scen.colorProd,
                      }}
                    />
                    {scen.name}
                  </span>
                ))}
            </>
          )}
          <label
            style={{
              fontSize: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginLeft: 4,
              padding: '5px 10px 5px 12px',
              borderRadius: 8,
              border: '1px solid #c9a227',
              background: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
              cursor: 'help',
            }}
            title={t('dataViz.flexHint')}
          >
            <span
              style={{
                fontWeight: 700,
                color: '#92400e',
                letterSpacing: '0.02em',
              }}
            >
              ± {t('dataViz.flex')}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="decimal"
              placeholder="%"
              value={flexPercentInput}
              onChange={(e) => setFlexPercentInput(e.target.value)}
              style={{
                width: 56,
                padding: '4px 6px',
                border: '1px solid #d4a017',
                borderRadius: 5,
                background: '#fffef8',
                fontWeight: 600,
                color: '#78350f',
              }}
              aria-label={t('dataViz.flex')}
            />
            <span style={{ color: '#92400e', fontWeight: 600 }}>%</span>
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

      <DataLoadingOverlay active={dataVizBusy} label={t('common.recalculating')}>
      <div
        style={
          dataVizBusy
            ? { opacity: 0, minHeight: 320, pointerEvents: 'none' as const }
            : undefined
        }
        aria-hidden={dataVizBusy || undefined}
      >
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
              hasScenario={singleScenarioMode && showScenarioProduction}
              hasCallOff={singleCallOffMode && showCallOff}
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
            {singleScenarioMode && showScenarioProduction && analyticsRows.avgScenarioProd != null && (
              <SummaryCard
                label={scenarioProdSeriesLabel}
                value={analyticsRows.avgScenarioProd}
                color={vizColors.scenarioProduction}
              />
            )}
            {singleCallOffMode && showCallOff && analyticsRows.avgCallOff != null && (
              <SummaryCard label={callOffSeriesLabel} value={analyticsRows.avgCallOff} color={vizColors.callOff} />
            )}
          </AdminHubList>
          </div>

          <CapacityAnalyticsPanel
            entityLabel={analyticsRows.label}
            rows={analyticsRows.rows}
            hasScenario={singleScenarioMode && showScenarioProduction}
            hasCallOff={singleCallOffMode && showCallOff}
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
                    scenProdMachines:
                      singleScenarioMode && showScenarioProduction ? scenarioProd?.machines : undefined,
                    scenContractMachines:
                      singleScenarioMode && showScenarioContract ? scenarioContract?.machines : undefined,
                    callOffMachines: singleCallOffMode && showCallOff ? callOff?.machines : undefined,
                    callOffDataYears: singleCallOffMode && showCallOff ? callOff?.dataYears : undefined,
                    showScenarioProduction: singleScenarioMode && showScenarioProduction,
                  }
            }
          />
        </div>
      )}
      </div>
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
