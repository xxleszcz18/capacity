import { useCallback, useEffect, useMemo, useRef, useState, Fragment, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useScenarioMode } from '../context/ScenarioModeContext';
import { useEffectiveCalculationProfile } from '../context/OcuModeContext';
import { useContractVolumes } from '../context/ContractVolumesContext';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { localeDateTime } from '../i18n/reportLabels';
import { api } from '../api/client';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectFilter from '../components/MultiSelectFilter';
import MachineGroupsMultiFilter from '../components/MachineGroupsMultiFilter';
import DataLoadingOverlay, { DataLoadingBadge } from '../components/DataLoadingOverlay';
import { joinCsvFilter, formatMultiFilterSummary } from '../utils/filterParams';
import { machineStatusFromDb } from '../utils/machineStatusStyle';
import * as XLSX from 'xlsx';
import { excelExportCell } from '../utils/excelExportCell';
import { machineMatchesCalculatorFilter } from '../utils/machineSearchFilter';
import { compareInternalMachineNumbers } from '../utils/internalMachineNumber';
import SortableTh from '../components/SortableTh';
import { sortIndicator, sortRows, type SortDirection } from '../utils/tableSort';
import {
  buildDimensionApiParams,
  EMPTY_DIM_FILTERS,
  formatDimFilterSummary,
  hasActiveDimFilters,
  type DimFilterOp,
  type DimFiltersState,
} from '../utils/machineDimensionFilters';
import {
  buildHorizontalTimelineColumns,
  getTimelineColumnLoad,
  getVerticalExpansionRows,
  getVerticalCellLoad,
  getYearMarkers,
  getMonthMarkers,
  monthAbbrev,
  periodMachineMonthKey,
  periodMonthKey,
  type PeriodBreakdownMachine,
  type TimelineColumn,
  type YearSopEopMarkers,
} from '../utils/calculatorPeriodExpansion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function calendarYear(): number {
  return new Date().getFullYear();
}

type CalculatorMachineStatusFilter = 'active' | 'inactive' | 'RFQ' | 'all';

function calculatorMachineStatusOptions(t: (key: string) => string): { value: CalculatorMachineStatusFilter; label: string }[] {
  return [
    { value: 'active', label: t('calculator.machineStatusActive') },
    { value: 'RFQ', label: t('common.rfq') },
    { value: 'inactive', label: t('common.inactive') },
    { value: 'all', label: t('calculator.machineStatusAll') },
  ];
}

function calculatorMachineStatusLabel(v: CalculatorMachineStatusFilter, t: (key: string) => string): string {
  return calculatorMachineStatusOptions(t).find((o) => o.value === v)?.label ?? v;
}

function calculatorMachineStatusLabels(values: CalculatorMachineStatusFilter[], t: (key: string) => string): string {
  if (values.length === 0) return t('calculator.machineStatusAll');
  return values.map((v) => calculatorMachineStatusLabel(v, t)).join(', ');
}

type VisualSettings = {
  show_alternative_borders: boolean;
  show_rfq_badge: boolean;
  colorize_load_cells: boolean;
  colorize_sum_row: boolean;
  colorize_avg_row: boolean;
  reference_display: 'sap' | 'alias' | 'both';
  ok_enabled: boolean;
  ok_from: number;
  ok_to: number;
  ok_color: string;
  warn_enabled: boolean;
  warn_from: number;
  warn_to: number;
  warn_color: string;
  danger_enabled: boolean;
  danger_from: number;
  danger_to: number;
  danger_color: string;
  contractual_calculator_frame_color: string;
  calculator_page_size: number;
  load_expansion_direction?: 'horizontal' | 'vertical';
  show_sop_marker: boolean;
  show_eop_marker: boolean;
  period_month_header_color: string;
  period_month_frame_color: string;
  period_week_header_color: string;
  period_week_frame_color: string;
};

const defaultVisualSettings: VisualSettings = {
  show_alternative_borders: true,
  show_rfq_badge: true,
  colorize_load_cells: true,
  colorize_sum_row: true,
  colorize_avg_row: true,
  reference_display: 'both',
  ok_enabled: true,
  ok_from: 0,
  ok_to: 79.99,
  ok_color: '#c8e6c9',
  warn_enabled: true,
  warn_from: 80,
  warn_to: 99.99,
  warn_color: '#fff9c4',
  danger_enabled: true,
  danger_from: 100,
  danger_to: 1000000,
  danger_color: '#ffcdd2',
  contractual_calculator_frame_color: '#ff9800',
  calculator_page_size: 25,
  load_expansion_direction: 'horizontal',
  show_sop_marker: true,
  show_eop_marker: true,
  period_month_header_color: '#dbeafe',
  period_month_frame_color: '#3b82f6',
  period_week_header_color: '#e0e7ff',
  period_week_frame_color: '#6366f1',
};

function normalizeCalculatorPageSize(v: unknown): number {
  if (v === null || v === undefined || v === '') return 25;
  const n = Number(v);
  if (n === 0 || n === 25 || n === 50) return n;
  return 25;
}

function loadColor(percent: number, visual: VisualSettings): string {
  if (!visual.colorize_load_cells) return '#ffffff';
  if (visual.ok_enabled && percent >= visual.ok_from && percent <= visual.ok_to) return visual.ok_color;
  if (visual.warn_enabled && percent >= visual.warn_from && percent <= visual.warn_to) return visual.warn_color;
  if (visual.danger_enabled && percent >= visual.danger_from && percent <= visual.danger_to) return visual.danger_color;
  return '#e8f5e9';
}

/** Po trybie z warstwami tła trzeba je jawnie zdjąć przy powrocie do zwykłej komórki. */
const percentCellNoGradient: Pick<CSSProperties, 'backgroundImage' | 'backgroundOrigin' | 'backgroundClip'> = {
  backgroundImage: 'none',
  backgroundOrigin: 'padding-box',
  backgroundClip: 'border-box',
};

/** Mix operacji (część podstawowa / część alternatywna) — jednolity kolor zamiast gradientu na obramowaniu: gradient + transparent + `border-collapse: collapse` na `<td>` potrafi dawać fałszywą grubą białą ramkę. */
const ALT_BORDER_MIXED_SOLID = '#f4511e';

/** Obramowanie kafelka % wg wariantów alternatywnych na maszynie (operacje z drugim czasem cyklu). */
function percentCellStyle(
  pct: number,
  altBorder: 'none' | 'unused' | 'all_alt' | 'mixed' | undefined,
  visual: VisualSettings,
  allocEnabled = true
): CSSProperties {
  const bg = loadColor(pct, visual);
  const base: CSSProperties = {
    padding: 0,
    textAlign: 'center',
    cursor: allocEnabled ? 'pointer' : 'default',
    boxSizing: 'border-box',
    position: 'relative',
  };
  if (!visual.show_alternative_borders || !altBorder || altBorder === 'none') {
    return { ...base, ...percentCellNoGradient, background: bg, border: '1px solid #e0e0e0' };
  }
  if (altBorder === 'unused') {
    return { ...base, ...percentCellNoGradient, background: bg, border: '3px solid #ff9800' };
  }
  if (altBorder === 'all_alt') {
    return { ...base, ...percentCellNoGradient, background: bg, border: '3px solid #c62828' };
  }
  return {
    ...base,
    ...percentCellNoGradient,
    background: bg,
    border: `3px solid ${ALT_BORDER_MIXED_SOLID}`,
  };
}

type PeriodCellKind = 'year' | 'month' | 'week';

function periodCellStyle(
  pct: number,
  altBorder: 'none' | 'unused' | 'all_alt' | 'mixed' | undefined,
  visual: VisualSettings,
  periodKind: PeriodCellKind,
  allocEnabled = true
): CSSProperties {
  const base = percentCellStyle(pct, altBorder, visual, allocEnabled);
  if (periodKind === 'year') return base;
  const frame =
    periodKind === 'month' ? visual.period_month_frame_color ?? '#3b82f6' : visual.period_week_frame_color ?? '#6366f1';
  return { ...base, boxShadow: `inset 0 0 0 2px ${frame}` };
}

function renderSopEopMarkers(
  hasSop: boolean,
  hasEop: boolean,
  visual: VisualSettings,
  t: (key: string) => string
) {
  if (!hasSop && !hasEop) return null;
  return (
    <span style={{ position: 'absolute', top: 2, left: 2, display: 'flex', gap: 2, pointerEvents: 'none' }}>
      {visual.show_sop_marker && hasSop && (
        <span className="calc-sop-marker" title={t('calculator.sopMarker')}>
          SOP
        </span>
      )}
      {visual.show_eop_marker && hasEop && (
        <span className="calc-eop-marker" title={t('calculator.eopMarker')}>
          EOP
        </span>
      )}
    </span>
  );
}

function renderPeriodCellContent(
  loading: boolean,
  pct: number,
  markers: { has_sop: boolean; has_eop: boolean },
  visual: VisualSettings,
  t: (key: string) => string
) {
  if (loading) {
    return (
      <span className="calc-period-cell-loading" role="status" aria-live="polite">
        <span className="data-loading-spinner" aria-hidden="true" />
      </span>
    );
  }
  return (
    <>
      {renderSopEopMarkers(markers.has_sop, markers.has_eop, visual, t)}
      {pct}%
    </>
  );
}

function percentCellTitle(
  year: number,
  altBorder: 'none' | 'unused' | 'all_alt' | 'mixed' | undefined,
  detailBreakdown: { project_label?: string; detail_label: string; contribution_percent: number; has_rfq?: boolean }[] | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
  allocEnabled = true
): string {
  const open = allocEnabled ? t('calculator.tooltip.openAlloc', { year }) : '';
  const formatPct = (v: number) => {
    const rounded = Math.round(v * 100) / 100;
    if (rounded === 0 && v > 0) return '<0.01';
    return String(rounded).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  };
  const activeDetails =
    detailBreakdown?.filter((d) => Number(d.contribution_percent) > 0.005) ?? [];
  const detailLines =
    activeDetails.length > 0
      ? `\n\n${t('calculator.tooltip.detailsHeader')}\n${activeDetails
          .map((d) => {
            const projectPrefix = d.project_label ? `${d.project_label} · ` : '';
            const rfqSuffix = d.has_rfq ? ` (${t('common.rfq')})` : '';
            return `${projectPrefix}${d.detail_label}${rfqSuffix}: ${formatPct(d.contribution_percent)}%`;
          })
          .join('\n')}`
      : `\n\n${t('calculator.tooltip.noDetails')}`;
  if (!altBorder || altBorder === 'none') return `${open}${detailLines}`;
  if (altBorder === 'unused') return `${t('calculator.tooltip.altUnused')} ${open}${detailLines}`;
  if (altBorder === 'all_alt') return `${t('calculator.tooltip.altAll')} ${open}${detailLines}`;
  return `${t('calculator.tooltip.altMixed')} ${open}${detailLines}`;
}

function formatPctRange(from: number, to: number): string {
  const fmt = (n: number) => {
    const s = String(Math.round(n * 100) / 100);
    return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  };
  return `${fmt(from)}–${fmt(to)}%`;
}

function CalculatorLegend({
  visual,
  t,
}: {
  visual: VisualSettings;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const sw = (bg: string, border: string, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div
        aria-hidden
        style={{
          width: 40,
          height: 28,
          flexShrink: 0,
          borderRadius: 4,
          background: bg,
          border,
          boxSizing: 'border-box',
        }}
      />
      <span style={{ fontSize: 13, color: '#333', lineHeight: 1.35 }}>{label}</span>
    </div>
  );

  return (
    <section
      style={{
        marginTop: '1.5rem',
        padding: '1rem 1.25rem',
        background: '#f8fafc',
        border: '1px solid #dbe4f0',
        borderRadius: 8,
        maxWidth: 960,
      }}
    >
      <h2 style={{ margin: '0 0 0.75rem', fontSize: 16, fontWeight: 600, color: '#1a365d' }}>{t('calculator.legend.title')}</h2>
      <p style={{ margin: '0 0 1rem', fontSize: 13, color: '#555', lineHeight: 1.45 }}>
        {t('calculator.legend.settingsIntro')}{' '}
        <Link to="/administracja/ustawienia-bazy/wizualne" style={{ color: '#1565c0' }}>
          {t('navPath.admin')} → {t('navPath.databaseSettings')} → {t('navPath.visual')}
        </Link>
        .
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: 14, fontWeight: 600, color: '#37474f' }}>{t('calculator.legend.loadCellsTitle')}</h3>
          {!visual.colorize_load_cells ? (
            <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{t('calculator.legend.cellsDisabled')}</p>
          ) : (
            <>
              {visual.ok_enabled &&
                sw(visual.ok_color, '1px solid #e0e0e0', t('calculator.legend.rangeOk', { range: formatPctRange(visual.ok_from, visual.ok_to) }))}
              {visual.warn_enabled &&
                sw(visual.warn_color, '1px solid #e0e0e0', t('calculator.legend.rangeWarn', { range: formatPctRange(visual.warn_from, visual.warn_to) }))}
              {visual.danger_enabled &&
                sw(visual.danger_color, '1px solid #e0e0e0', t('calculator.legend.rangeDanger', { range: formatPctRange(visual.danger_from, visual.danger_to) }))}
              <p style={{ fontSize: 12, color: '#666', margin: '4px 0 0' }}>{t('calculator.legend.cellClickHint')}</p>
            </>
          )}
        </div>

        <div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: 14, fontWeight: 600, color: '#37474f' }}>{t('calculator.legend.altOpsTitle')}</h3>
          {!visual.show_alternative_borders ? (
            <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{t('calculator.legend.altBordersOff')}</p>
          ) : (
            <>
              {sw('#f5f5f5', '1px solid #e0e0e0', t('calculator.legend.altNone'))}
              {sw('#f5f5f5', '3px solid #ff9800', t('calculator.legend.altUnused'))}
              {sw('#f5f5f5', '3px solid #c62828', t('calculator.legend.altAll'))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div
                  aria-hidden
                  style={{
                    width: 40,
                    height: 28,
                    flexShrink: 0,
                    borderRadius: 4,
                    background: '#f5f5f5',
                    border: `3px solid ${ALT_BORDER_MIXED_SOLID}`,
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: 13, color: '#333', lineHeight: 1.35 }}>{t('calculator.legend.altMixed')}</span>
              </div>
            </>
          )}
        </div>

        <div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: 14, fontWeight: 600, color: '#37474f' }}>{t('calculator.legend.otherTitle')}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span
              style={{
                padding: '1px 6px',
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 700,
                background: '#A4C400CC',
                color: '#fff',
              }}
            >
              RFQ
            </span>
            <span style={{ fontSize: 13, color: '#333' }}>
              {visual.show_rfq_badge ? t('calculator.legend.rfqOn') : t('calculator.legend.rfqOff')}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', fontSize: 13, color: '#333' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 22, height: 18, background: '#eef5ff', border: '1px solid #e0e0e0', borderRadius: 2 }} />
              {t('calculator.legend.sumRow')}
              {!visual.colorize_sum_row ? t('calculator.legend.colorOff') : ''}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 22, height: 18, background: '#f3f8ff', border: '1px solid #e0e0e0', borderRadius: 2 }} />
              {t('calculator.legend.avgRow')}
              {!visual.colorize_avg_row ? t('calculator.legend.colorOff') : ''}
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#666', margin: '10px 0 0', lineHeight: 1.4 }}>{t('calculator.legend.footerContract')}</p>
        </div>
      </div>
    </section>
  );
}

function reportFileStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function pdfSafe(value: unknown): string {
  const map: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ż': 'z', 'ź': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ż': 'Z', 'Ź': 'Z',
    '—': '-', '–': '-',
  };
  return String(value ?? '').replace(/[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ—–]/g, (ch) => map[ch] ?? ch);
}

/** Data URL PNG logo z `public/` do jsPDF.addImage (null przy błędzie ładowania). */
async function fetchPdfLogoDataUrl(): Promise<string | null> {
  try {
    const base = String(import.meta.env.BASE_URL || '/');
    const prefix = base.endsWith('/') ? base : `${base}/`;
    const res = await fetch(`${prefix}logo-autoneum.png`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addPdfHeaderLogo(doc: jsPDF, logoDataUrl: string | null) {
  if (!logoDataUrl) return;
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  const logoW = 112;
  const logoH = 26;
  doc.addImage(logoDataUrl, 'PNG', pageW - margin - logoW, 12, logoW, logoH);
}

/** Kolor tła komórki PDF (jspdf-autotable) z #RRGGBB. */
function hexToRgbForPdf(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  if (h.length === 6) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  return [255, 255, 255];
}

/** Szerokość tabeli kalkulatora na całą stronę (pt) + szerokości kolumn: 3×SAP/nr/typ + lata. */
function calculatorPdfTableLayout(doc: jsPDF, yearCount: number) {
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const tableW = Math.max(200, pageW - 2 * margin);
  const yearShare = 0.72;
  const fixedShare = 0.28;
  const wYearCol = (tableW * yearShare) / Math.max(1, yearCount);
  const wFixedCol = (tableW * fixedShare) / 3;
  const columnStyles: Record<string, { cellWidth: number; halign: 'left' | 'center' }> = Object.fromEntries([
    ['0', { cellWidth: wFixedCol, halign: 'left' }],
    ['1', { cellWidth: wFixedCol, halign: 'left' }],
    ['2', { cellWidth: wFixedCol, halign: 'left' }],
    ...Array.from({ length: yearCount }, (_, i) => [`${i + 3}`, { cellWidth: wYearCol, halign: 'center' as const }]),
  ]);
  return { margin, tableWidth: tableW, columnStyles };
}

export default function Calculator() {
  const { t, te, locale } = useI18n();
  const { hasPermission, hasAnyPermission } = useAuth();
  const canDownloadReports = hasPermission('calculator.download');
  const canAllocate = hasPermission('projects.edit');
  const canViewMachineDetails = hasAnyPermission(['machines.details', 'machines.edit']);
  const [searchParams] = useSearchParams();
  const scenarioFromUrl = searchParams.get('scenarioId') != null ? Number(searchParams.get('scenarioId')) : NaN;
  const { setActiveScenario, activeScenarioId: ctxScenarioId, activeScenarioName, appSection } = useScenarioMode();
  const { useContractualVolumes } = useContractVolumes();
  const scenarioId =
    Number.isFinite(scenarioFromUrl) && scenarioFromUrl > 0
      ? scenarioFromUrl
      : appSection === 'scenarios' && ctxScenarioId != null && ctxScenarioId > 0
        ? ctxScenarioId
        : undefined;
  const scenarioActive = scenarioId != null && !isNaN(scenarioId) && scenarioId > 0;
  const settingsProfile = useEffectiveCalculationProfile(scenarioActive);
  const [data, setData] = useState<{ yearFrom: number; yearTo: number; machines: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [clients, setClients] = useState<string[]>([]);
  const [machinesFilter, setMachinesFilter] = useState('');
  const [lineFilter, setLineFilter] = useState<string[]>([]);
  const [dimFilters, setDimFilters] = useState<DimFiltersState>(EMPTY_DIM_FILTERS);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [machinesPage, setMachinesPage] = useState(1);
  type CalcSortCol = 'sap' | 'internal' | 'type' | 'year';
  const [calcSortCol, setCalcSortCol] = useState<CalcSortCol>('internal');
  const [calcSortDir, setCalcSortDir] = useState<SortDirection>('asc');
  const [calcSortYear, setCalcSortYear] = useState<number | null>(null);
  const [machineStatusFilter, setMachineStatusFilter] = useState<CalculatorMachineStatusFilter[]>(['active']);
  const [groupFilter, setGroupFilter] = useState<number[]>([]);
  const [machineGroups, setMachineGroups] = useState<{ id: number; name: string }[]>([]);
  const [yearFrom, setYearFrom] = useState(() => calendarYear() - 1);
  const [yearTo, setYearTo] = useState(() => calendarYear() + 10);
  const [debouncedYearFrom, setDebouncedYearFrom] = useState(() => calendarYear() - 1);
  const [debouncedYearTo, setDebouncedYearTo] = useState(() => calendarYear() + 10);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedYearFrom(yearFrom);
      setDebouncedYearTo(yearTo);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [yearFrom, yearTo]);
  const [types, setTypes] = useState<string[]>([]);
  const [overloaded, setOverloaded] = useState<any[]>([]);
  const [overloadedBarHidden, setOverloadedBarHidden] = useState(() => {
    try {
      return localStorage.getItem('cap_calc_overloaded_bar_hidden') === '1';
    } catch {
      return false;
    }
  });
  const [allocationModal, setAllocationModal] = useState<{
    machineId: number;
    internal_number: string | number;
    preselectedYear?: number;
    /** Obciążenia % z tabeli kalkulatora — źródło prawdy dla wybranego roku. */
    calculatorYears?: Record<
      number,
      {
        load_percent?: number;
        detail_breakdown?: { project_label?: string; detail_label: string; contribution_percent: number; has_rfq?: boolean }[];
      }
    >;
  } | null>(null);
  const [reportScope, setReportScope] = useState<'filtered' | 'selected'>('filtered');
  const [reportMachineIds, setReportMachineIds] = useState<number[]>([]);
  const [reportIncludeMachineMeta, setReportIncludeMachineMeta] = useState(true);
  const [reportIncludeOperationDetails, setReportIncludeOperationDetails] = useState(false);
  const [reportIncludeSystemSettings, setReportIncludeSystemSettings] = useState(true);
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [viewPdfGenerating, setViewPdfGenerating] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [visualSettings, setVisualSettings] = useState<VisualSettings>(defaultVisualSettings);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(() => new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set());
  const [expandedMachines, setExpandedMachines] = useState<Set<number>>(() => new Set());
  const [expandedMachineMonths, setExpandedMachineMonths] = useState<Set<string>>(() => new Set());
  const [periodCache, setPeriodCache] = useState<Record<number, PeriodBreakdownMachine[]>>({});
  const periodCacheRef = useRef(periodCache);
  periodCacheRef.current = periodCache;
  const [sopEopMarkerIndex, setSopEopMarkerIndex] = useState<Map<number, Record<number, YearSopEopMarkers>>>(() => new Map());
  const [periodLoading, setPeriodLoading] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const headScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollSyncLock = useRef(false);

  useEffect(() => {
    const loadGroups = () => {
      api.machineGroups
        .list()
        .then((data) => setMachineGroups(Array.isArray(data) ? data.map((g) => ({ id: g.id, name: g.name })) : []))
        .catch(() => setMachineGroups([]));
    };
    api.machines.types().then(setTypes);
    loadGroups();
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadGroups();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  useEffect(() => {
    setMachinesPage(1);
  }, [groupFilter.join(',')]);
  useEffect(() => {
    api.projects.clients().then(setClients).catch(() => {});
  }, []);
  useEffect(() => {
    const loadVisual = () => {
      api.settings.visual
        .get()
        .then((v) => {
          const raw = v as VisualSettings;
          setVisualSettings({
            ...defaultVisualSettings,
            ...raw,
            calculator_page_size: normalizeCalculatorPageSize(raw.calculator_page_size),
            load_expansion_direction:
              raw.load_expansion_direction === 'vertical' ? 'vertical' : 'horizontal',
            show_sop_marker: raw.show_sop_marker !== false,
            show_eop_marker: raw.show_eop_marker !== false,
            period_month_header_color: raw.period_month_header_color ?? '#dbeafe',
            period_month_frame_color: raw.period_month_frame_color ?? '#3b82f6',
            period_week_header_color: raw.period_week_header_color ?? '#e0e7ff',
            period_week_frame_color: raw.period_week_frame_color ?? '#6366f1',
          });
        })
        .catch(() => {});
    };
    loadVisual();
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadVisual();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    if (scenarioId == null || isNaN(scenarioId) || scenarioId <= 0) return;
    api.scenarios
      .get(scenarioId)
      .then((s) => setActiveScenario(scenarioId, s.name))
      .catch(() => {});
  }, [scenarioId, setActiveScenario]);

  const effectiveYearFrom = Math.min(debouncedYearFrom, debouncedYearTo);
  const effectiveYearTo = Math.max(debouncedYearFrom, debouncedYearTo);

  const buildCalcApiParams = useCallback(
    (extra?: Record<string, unknown>) => {
      const params: Record<string, unknown> = { yearFrom: effectiveYearFrom, yearTo: effectiveYearTo, ...extra };
      const typesCsv = joinCsvFilter(typeFilter);
      if (typesCsv) params.types = typesCsv;
      const clientsCsv = joinCsvFilter(clientFilter);
      if (clientsCsv) params.clients = clientsCsv;
      if (scenarioId != null && !isNaN(scenarioId)) params.scenarioId = scenarioId;
      if (useContractualVolumes) params.useContractualVolumes = true;
      const statuses = joinCsvFilter(machineStatusFilter);
      if (statuses) params.machineStatuses = statuses;
      if (settingsProfile === 'ocu') params.settingsProfile = 'ocu';
      if (groupFilter.length > 0) params.groupIds = groupFilter.join(',');
      Object.assign(params, buildDimensionApiParams(dimFilters));
      return params;
    },
    [
      effectiveYearFrom,
      effectiveYearTo,
      typeFilter,
      clientFilter,
      machineStatusFilter,
      groupFilter,
      scenarioId,
      useContractualVolumes,
      dimFilters,
      settingsProfile,
    ]
  );

  const fetchCalculator = useCallback(() => {
    return api.capacity.calculator(buildCalcApiParams() as Parameters<typeof api.capacity.calculator>[0]).then(setData);
  }, [buildCalcApiParams]);

  useEffect(() => {
    setLoading(true);
    fetchCalculator().finally(() => setLoading(false));
  }, [fetchCalculator]);

  useEffect(() => {
    setPeriodCache({});
    setSopEopMarkerIndex(new Map());
    setExpandedYears(new Set());
    setExpandedMonths(new Set());
    setExpandedMachines(new Set());
    setExpandedMachineMonths(new Set());
  }, [buildCalcApiParams]);

  const expansionDirection = visualSettings.load_expansion_direction ?? 'horizontal';
  const isHorizontalExpansion = expansionDirection === 'horizontal';

  const toggleExpandedYear = useCallback(
    (year: number) => {
      if (!isHorizontalExpansion) return;
      setExpandedYears((prev) => {
        const next = new Set(prev);
        if (next.has(year)) {
          next.delete(year);
          setExpandedMonths((months) => {
            const nm = new Set(months);
            for (const k of months) {
              if (k.startsWith(`${year}-`)) nm.delete(k);
            }
            return nm;
          });
        } else {
          next.add(year);
          if (!periodCacheRef.current[year]) setPeriodLoading(true);
        }
        return next;
      });
    },
    [isHorizontalExpansion]
  );

  const toggleExpandedMonth = useCallback((year: number, month: number) => {
    const key = periodMonthKey(year, month);
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleExpandedMachine = useCallback(
    (machineId: number) => {
      if (isHorizontalExpansion) return;
      setExpandedMachines((prev) => {
        const next = new Set(prev);
        if (next.has(machineId)) {
          next.delete(machineId);
          setExpandedMachineMonths((months) => {
            const nm = new Set(months);
            for (const k of months) {
              if (k.startsWith(`${machineId}-`)) nm.delete(k);
            }
            return nm;
          });
        } else {
          next.add(machineId);
          for (let y = effectiveYearFrom; y <= effectiveYearTo; y++) {
            if (!periodCacheRef.current[y]) {
              setPeriodLoading(true);
              break;
            }
          }
        }
        return next;
      });
    },
    [isHorizontalExpansion, effectiveYearFrom, effectiveYearTo]
  );

  const toggleExpandedMachineMonth = useCallback((machineId: number, month: number) => {
    const key = periodMachineMonthKey(machineId, month);
    setExpandedMachineMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      fetchCalculator();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchCalculator]);

  useEffect(() => {
    if (!canAllocate) {
      setOverloaded([]);
      return;
    }
    api.allocation
      .overloaded({ year: new Date().getFullYear(), threshold: 100 })
      .then((r) => setOverloaded(r.machines || []))
      .catch(() => setOverloaded([]));
  }, [canAllocate]);
  useEffect(() => {
    const ids = new Set((data?.machines ?? []).map((m: any) => Number(m.machine_id)));
    setReportMachineIds((prev) => prev.filter((id) => ids.has(Number(id))));
  }, [data?.machines]);

  const allMachines = data?.machines ?? [];
  const lineOptions = useMemo(() => {
    const lines = new Set<string>();
    for (const m of allMachines) {
      const loc = m.location != null ? String(m.location).trim() : '';
      if (loc) lines.add(loc);
    }
    return Array.from(lines).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb) && String(na) === a && String(nb) === b) return na - nb;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [allMachines]);

  useEffect(() => {
    if (lineFilter.length === 0) return;
    const allowed = new Set(lineOptions);
    const next = lineFilter.filter((line) => allowed.has(line));
    if (next.length !== lineFilter.length) setLineFilter(next);
  }, [lineOptions, lineFilter]);

  const filteredMachines = useMemo(() => {
    const q = machinesFilter.trim();
    return allMachines.filter((m) => {
      if (q && !machineMatchesCalculatorFilter(m, q)) return false;
      if (lineFilter.length > 0) {
        const loc = m.location != null ? String(m.location).trim() : '';
        if (!lineFilter.includes(loc)) return false;
      }
      return true;
    });
  }, [allMachines, machinesFilter, lineFilter]);

  const handleCalcSort = (col: CalcSortCol, year?: number) => {
    if (col === 'year' && year != null) {
      if (calcSortCol === 'year' && calcSortYear === year) {
        setCalcSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setCalcSortCol('year');
        setCalcSortYear(year);
        setCalcSortDir('asc');
      }
      return;
    }
    setCalcSortYear(null);
    if (calcSortCol === col) setCalcSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setCalcSortCol(col);
      setCalcSortDir('asc');
    }
  };

  const sortedMachines = useMemo(
    () =>
      sortRows(filteredMachines, calcSortCol, calcSortDir, (m, col) => {
        if (col === 'year' && calcSortYear != null) {
          return Number(m.years?.[calcSortYear]?.load_percent ?? 0);
        }
        switch (col) {
          case 'sap':
            return String(m.sap_number ?? '');
          case 'internal':
            return String(m.internal_number ?? '');
          case 'type':
            return String(m.type ?? '');
          default:
            return '';
        }
      }),
    [filteredMachines, calcSortCol, calcSortDir, calcSortYear]
  );

  const calculatorPageSize = normalizeCalculatorPageSize(visualSettings.calculator_page_size);

  const machinesTotalPages = useMemo(() => {
    if (calculatorPageSize === 0) return 1;
    return Math.max(1, Math.ceil(sortedMachines.length / calculatorPageSize));
  }, [sortedMachines.length, calculatorPageSize]);

  const machinesCurrentPage = Math.min(Math.max(1, machinesPage), machinesTotalPages);

  const displayedMachines = useMemo(() => {
    if (calculatorPageSize === 0) return sortedMachines;
    const start = (machinesCurrentPage - 1) * calculatorPageSize;
    return sortedMachines.slice(start, start + calculatorPageSize);
  }, [sortedMachines, calculatorPageSize, machinesCurrentPage]);

  const yearsNeedingPeriodData = useMemo(() => {
    if (isHorizontalExpansion) {
      return [...expandedYears];
    }
    if (expandedMachines.size === 0) return [];
    const yr: number[] = [];
    for (let y = effectiveYearFrom; y <= effectiveYearTo; y++) yr.push(y);
    return yr;
  }, [expandedYears, expandedMachines, isHorizontalExpansion, effectiveYearFrom, effectiveYearTo]);

  useEffect(() => {
    const machineIds = displayedMachines
      .map((m: { machine_id?: number }) => Number(m.machine_id))
      .filter((id) => Number.isFinite(id))
      .join(',');
    if (!machineIds) {
      setSopEopMarkerIndex(new Map());
      return;
    }
    let cancelled = false;
    api.capacity
      .sopEopMarkers({
        ...(buildCalcApiParams() as Parameters<typeof api.capacity.sopEopMarkers>[0]),
        machineIds,
      })
      .then((res) => {
        if (cancelled) return;
        const map = new Map<number, Record<number, YearSopEopMarkers>>();
        for (const row of res.machines) {
          map.set(row.machine_id, row.years);
        }
        setSopEopMarkerIndex(map);
      })
      .catch(() => {
        if (!cancelled) setSopEopMarkerIndex(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [displayedMachines, buildCalcApiParams]);

  useEffect(() => {
    const missing = yearsNeedingPeriodData.filter((y) => !periodCache[y]);
    if (missing.length === 0) return;
    const machineIds = displayedMachines
      .map((m: { machine_id?: number }) => Number(m.machine_id))
      .filter((id) => Number.isFinite(id))
      .join(',');
    if (!machineIds) return;
    let cancelled = false;
    setPeriodLoading(true);
    Promise.all(
      missing.map((year) =>
        api.capacity
          .periodBreakdown({ ...(buildCalcApiParams() as Parameters<typeof api.capacity.periodBreakdown>[0]), year, machineIds })
          .then((res) => ({ year, machines: res.machines as PeriodBreakdownMachine[] }))
      )
    )
      .then((results) => {
        if (cancelled) return;
        setPeriodCache((prev) => {
          const next = { ...prev };
          for (const r of results) next[r.year] = r.machines;
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setPeriodLoading(false);
      });
    return () => {
      cancelled = true;
      setPeriodLoading(false);
    };
  }, [yearsNeedingPeriodData, periodCache, displayedMachines, buildCalcApiParams]);

  useEffect(() => {
    setMachinesPage(1);
  }, [
    typeFilter,
    clientFilter,
    machinesFilter,
    lineFilter,
    dimFilters,
    machineStatusFilter,
    calcSortCol,
    calcSortDir,
    calcSortYear,
    calculatorPageSize,
  ]);

  useEffect(() => {
    if (machinesPage > machinesTotalPages) setMachinesPage(machinesTotalPages);
  }, [machinesPage, machinesTotalPages]);

  const goToMachinesPage = (page: number) => {
    const next = Math.min(Math.max(1, page), machinesTotalPages);
    setMachinesPage(next);
    tableScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const syncTableHorizontalScroll = useCallback((from: 'head' | 'body') => {
    if (tableScrollSyncLock.current) return;
    const head = headScrollRef.current;
    const body = bodyScrollRef.current;
    if (!head || !body) return;
    tableScrollSyncLock.current = true;
    if (from === 'head') body.scrollLeft = head.scrollLeft;
    else head.scrollLeft = body.scrollLeft;
    tableScrollSyncLock.current = false;
  }, []);

  const showMachinesPagination = Boolean(data && calculatorPageSize > 0 && machinesTotalPages > 1);
  const machinesPaginationBar = showMachinesPagination ? (
    <div className="calculator-pagination" role="navigation" aria-label={t('calculator.pageNav')}>
      <button
        type="button"
        className="calculator-primary-btn"
        disabled={machinesCurrentPage <= 1}
        onClick={() => goToMachinesPage(machinesCurrentPage - 1)}
      >
        {t('calculator.pagePrev')}
      </button>
      <span className="calculator-pagination-meta">
        {t('calculator.pageOf', { page: machinesCurrentPage, total: machinesTotalPages })}
        {' · '}
        {t('calculator.pageSizeShown', {
          from: (machinesCurrentPage - 1) * calculatorPageSize + 1,
          to: Math.min(machinesCurrentPage * calculatorPageSize, sortedMachines.length),
          total: sortedMachines.length,
        })}
      </span>
      <button
        type="button"
        className="calculator-primary-btn"
        disabled={machinesCurrentPage >= machinesTotalPages}
        onClick={() => goToMachinesPage(machinesCurrentPage + 1)}
      >
        {t('calculator.pageNext')}
      </button>
    </div>
  ) : null;

  if (loading && !data) return <p>{t('common.loading')}</p>;

  const scenarioTitleSuffix =
    scenarioId != null &&
    !isNaN(scenarioId) &&
    ctxScenarioId === scenarioId &&
    activeScenarioName != null &&
    activeScenarioName.trim() !== ''
      ? `scenariusz: ${activeScenarioName.trim()}`
      : 'scenariusz';

  const years = data ? Array.from({ length: data.yearTo - data.yearFrom + 1 }, (_, i) => data.yearFrom + i) : [];
  const timelineColumns: TimelineColumn[] = isHorizontalExpansion
    ? buildHorizontalTimelineColumns(years, expandedYears, expandedMonths)
    : years.map((year) => ({ kind: 'year' as const, year }));
  const getMachineMonthsData = (machineId: number, year: number) =>
    periodCache[year]?.find((row) => row.machine_id === machineId)?.months;
  const isYearPeriodDataPending = (year: number) =>
    yearsNeedingPeriodData.includes(year) && !periodCache[year];
  const isPeriodColumnPending = (col: TimelineColumn) =>
    col.kind !== 'year' && (periodLoading || isYearPeriodDataPending(col.year));
  const renderPeriodExpandBtn = (title: string, expanded: boolean, onClick: () => void) => (
    <button
      type="button"
      className="calc-period-expand-btn"
      title={title}
      aria-expanded={expanded}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {expanded ? '▼' : '▶'}
    </button>
  );
  const reportMachineOptions = filteredMachines.map((m: any) => ({
    machine_id: Number(m.machine_id),
    sap_number: m.sap_number ?? '-',
    internal_number: m.internal_number ?? '-',
    type: m.type ?? '-',
  }));
  const reportTargetMachines = reportScope === 'selected'
    ? filteredMachines.filter((m: any) => reportMachineIds.includes(Number(m.machine_id)))
    : filteredMachines;
  const loadSummaryByYear = years.map((y) => {
    const sum = filteredMachines.reduce((acc: number, m: any) => acc + Number(m.years?.[y]?.load_percent ?? 0), 0);
    const avg = filteredMachines.length > 0 ? sum / filteredMachines.length : 0;
    return { year: y, sum, avg };
  });
  const pinnedSapWidth = 156;
  const pinnedNumberWidth = 143;
  const pinnedTypeWidth = 94;
  const detailsColWidth = 210;
  const yearColMinWidth = 56;
  const periodColMinWidth = 44;
  const extraPeriodCols = Math.max(0, timelineColumns.length - years.length);
  const calcTableMinWidth =
    pinnedSapWidth +
    pinnedNumberWidth +
    pinnedTypeWidth +
    detailsColWidth +
    years.length * yearColMinWidth +
    extraPeriodCols * periodColMinWidth;
  const calcTableStyle: CSSProperties = { minWidth: calcTableMinWidth };
  const calcTheadBg = '#f5f5f5';
  const calcTheadSticky: CSSProperties = { background: calcTheadBg };
  const calcTheadPinnedSticky: CSSProperties = { ...calcTheadSticky };

  const calculatorColgroup = (
    <colgroup>
      <col style={{ width: pinnedSapWidth }} />
      <col style={{ width: pinnedNumberWidth }} />
      <col style={{ width: pinnedTypeWidth }} />
      {timelineColumns.map((col) => (
        <col
          key={
            col.kind === 'year'
              ? `col-y-${col.year}`
              : col.kind === 'month'
                ? `col-m-${col.year}-${col.month}`
                : `col-w-${col.year}-${col.month}-${col.week}`
          }
          className={col.kind === 'year' ? 'calc-year-col' : 'calc-period-col'}
        />
      ))}
      <col style={{ width: detailsColWidth }} />
    </colgroup>
  );

  const calculatorHeadRow = (
    <tr>
      <SortableTh
        label={t('calculator.sapNumber')}
        active={calcSortCol === 'sap'}
        direction={calcSortDir}
        onClick={() => handleCalcSort('sap')}
        style={{ width: pinnedSapWidth, minWidth: pinnedSapWidth, maxWidth: pinnedSapWidth, position: 'sticky', left: 0, ...calcTheadPinnedSticky, whiteSpace: 'normal', lineHeight: 1.15 }}
        className="calc-th-pinned"
      />
      <SortableTh
        label={t('calculator.internalNumber')}
        active={calcSortCol === 'internal'}
        direction={calcSortDir}
        onClick={() => handleCalcSort('internal')}
        style={{ width: pinnedNumberWidth, minWidth: pinnedNumberWidth, maxWidth: pinnedNumberWidth, position: 'sticky', left: pinnedSapWidth, ...calcTheadPinnedSticky, whiteSpace: 'normal', lineHeight: 1.15 }}
        className="calc-th-pinned"
      />
      <SortableTh
        label={t('calculator.type')}
        active={calcSortCol === 'type'}
        direction={calcSortDir}
        onClick={() => handleCalcSort('type')}
        style={{ width: pinnedTypeWidth, minWidth: pinnedTypeWidth, maxWidth: pinnedTypeWidth, position: 'sticky', left: pinnedSapWidth + pinnedNumberWidth, ...calcTheadPinnedSticky, whiteSpace: 'normal', lineHeight: 1.15 }}
        className="calc-th-pinned"
      />
      {timelineColumns.map((col) => {
        if (col.kind === 'year') {
          const y = col.year;
          const yearExpanded = expandedYears.has(y);
          return (
            <th
              key={`head-y-${y}`}
              className="calc-year-col"
              style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none', ...calcTheadSticky }}
              onClick={() => handleCalcSort('year', y)}
              title={t('calculator.sortYearLoad')}
            >
              {y}
              {isHorizontalExpansion &&
                renderPeriodExpandBtn(
                  yearExpanded ? t('calculator.collapseYear') : t('calculator.expandYear'),
                  yearExpanded,
                  () => toggleExpandedYear(y)
                )}
              {calcSortCol === 'year' && calcSortYear === y ? sortIndicator(true, calcSortDir) : ''}
            </th>
          );
        }
        if (col.kind === 'month') {
          const monthKey = periodMonthKey(col.year, col.month);
          const monthExpanded = expandedMonths.has(monthKey);
          return (
            <th
              key={`head-m-${col.year}-${col.month}`}
              className="calc-period-col calc-period-col--month"
              style={{ background: visualSettings.period_month_header_color ?? '#dbeafe', ...calcTheadSticky }}
              title={t('calculator.periodMonthLabel', { year: col.year, month: monthAbbrev(col.month, locale) })}
            >
              {monthAbbrev(col.month, locale)}
              {renderPeriodExpandBtn(
                monthExpanded ? t('calculator.collapseMonth') : t('calculator.expandMonth'),
                monthExpanded,
                () => toggleExpandedMonth(col.year, col.month)
              )}
            </th>
          );
        }
        return (
          <th
            key={`head-w-${col.year}-${col.month}-${col.week}`}
            className="calc-period-col calc-period-col--week"
            style={{ background: visualSettings.period_week_header_color ?? '#e0e7ff', ...calcTheadSticky }}
            title={t('calculator.periodWeekLabel', {
              year: col.year,
              month: monthAbbrev(col.month, locale),
              week: col.week,
            })}
          >
            T{col.week}
          </th>
        );
      })}
      <th
        className="calc-details-col"
        style={{
          width: detailsColWidth,
          minWidth: detailsColWidth,
          maxWidth: detailsColWidth,
          ...calcTheadSticky,
        }}
        aria-label={t('common.details')}
      />
    </tr>
  );
  const clearAllFilters = () => {
    setYearFrom(calendarYear() - 1);
    setYearTo(calendarYear() + 10);
    setTypeFilter([]);
    setClientFilter([]);
    setMachinesFilter('');
    setLineFilter([]);
    setDimFilters(EMPTY_DIM_FILTERS);
    setAdvancedFiltersOpen(false);
    setMachineStatusFilter(['active']);
    setGroupFilter([]);
    setMachinesPage(1);
  };
  const toggleReportMachine = (machineId: number) => {
    setReportMachineIds((prev) => (prev.includes(machineId) ? prev.filter((id) => id !== machineId) : [...prev, machineId]));
  };
  const selectAllReportMachines = () => {
    setReportMachineIds(reportMachineOptions.map((m) => m.machine_id));
  };
  const clearReportMachines = () => {
    setReportMachineIds([]);
  };

  const exportCalculatorViewPdf = async () => {
    setReportMessage(null);
    if (!data) {
      setReportMessage(t('calculator.reportNoData'));
      return;
    }
    if (filteredMachines.length === 0) {
      setReportMessage(t('calculator.reportNoPdf'));
      return;
    }
    setViewPdfGenerating(true);
    try {
      const logoDataUrl = await fetchPdfLogoDataUrl();
      const rows = filteredMachines;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      addPdfHeaderLogo(doc, logoDataUrl);
      const clientLbl = formatMultiFilterSummary(clientFilter, t('common.allClients'));
      const typeLbl = formatMultiFilterSummary(typeFilter, t('common.all'));
      const lineLbl = formatMultiFilterSummary(lineFilter, t('common.all'));
      const dimLbl = formatDimFilterSummary(dimFilters, t);
      doc.setFontSize(16);
      doc.text(pdfSafe(t('reports.calculator.viewTitle')), 40, 36);
      doc.setFontSize(10);
      let lineY = 54;
      doc.text(pdfSafe(`${t('reports.calculator.printDate')}: ${localeDateTime(locale)}`), 40, lineY);
      lineY += 14;
      if (scenarioId != null && !isNaN(scenarioId)) {
        const sn = activeScenarioName?.trim();
        doc.text(
          pdfSafe(
            sn
              ? `${t('reports.calculator.scenario')}: ${sn}`
              : `${t('reports.calculator.scenarioId')}: ${scenarioId}`
          ),
          40,
          lineY
        );
        lineY += 14;
      }
      doc.text(
        pdfSafe(
          `${t('reports.calculator.yearRange')}: ${effectiveYearFrom}-${effectiveYearTo} | ${t('reports.calculator.client')}: ${clientLbl} | ${t('reports.calculator.type')}: ${typeLbl} | ${t('reports.calculator.machineStatus')}: ${calculatorMachineStatusLabels(machineStatusFilter, t)} | ${t('reports.calculator.lineNumbers')}: ${lineLbl} | ${t('reports.calculator.filterDimensions')}: ${dimLbl || '—'} | ${t('reports.calculator.machineNumbers')}: ${machinesFilter.trim() || '-'}`,
        ),
        40,
        lineY,
      );
      lineY += 14;
      doc.text(
        pdfSafe(
          `${t('reports.calculator.contractualVolumes')}: ${useContractualVolumes ? t('reports.calculator.yes') : t('reports.calculator.no')} | ${t('reports.calculator.machineCount')}: ${rows.length}`,
        ),
        40,
        lineY,
      );
      lineY += 18;

      const machineRows = rows.map((m: any) => [
        pdfSafe(m.sap_number ?? '-'),
        pdfSafe(String(m.internal_number ?? '-')),
        pdfSafe(String(m.type ?? '-')),
        ...years.map((y) => `${Number(m.years?.[y]?.load_percent ?? 0)}%`),
      ]);
      const sumRowPdf: any[] = [
        {
          content: pdfSafe(t('reports.calculator.sumLoad', { count: rows.length })),
          colSpan: 3,
          styles: {
            fontStyle: 'bold',
            halign: 'left',
            fillColor: [245, 245, 245] as [number, number, number],
            textColor: [0, 0, 0],
          },
        },
        ...loadSummaryByYear.map((s) => ({
          content: `${Math.round(s.sum)}%`,
          styles: {
            fontStyle: 'bold' as const,
            halign: 'center' as const,
            fillColor: hexToRgbForPdf(visualSettings.colorize_sum_row ? '#eef5ff' : '#ffffff'),
          },
        })),
      ];
      const avgRowPdf: any[] = [
        {
          content: pdfSafe(t('reports.calculator.avgLoad', { count: rows.length })),
          colSpan: 3,
          styles: {
            fontStyle: 'bold',
            halign: 'left',
            fillColor: [250, 250, 250] as [number, number, number],
            textColor: [0, 0, 0],
          },
        },
        ...loadSummaryByYear.map((s) => ({
          content: `${Math.round(s.avg)}%`,
          styles: {
            fontStyle: 'bold' as const,
            halign: 'center' as const,
            fillColor: hexToRgbForPdf(visualSettings.colorize_avg_row ? '#f3f8ff' : '#ffffff'),
          },
        })),
      ];

      const pdfLayout = calculatorPdfTableLayout(doc, years.length);
      autoTable(doc, {
        startY: lineY,
        margin: { left: pdfLayout.margin, right: pdfLayout.margin },
        tableWidth: pdfLayout.tableWidth,
        head: [[pdfSafe(t('reports.calculator.colSap')), pdfSafe(t('reports.calculator.colNumber')), pdfSafe(t('reports.calculator.colType')), ...years.map((y) => String(y))]],
        body: [...machineRows, sumRowPdf, avgRowPdf],
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 3, lineColor: [224, 224, 224], lineWidth: 0.1, fillColor: [255, 255, 255] },
        headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        columnStyles: pdfLayout.columnStyles,
        didParseCell: (data) => {
          if (data.section === 'head') {
            if (data.column.index < 3) data.cell.styles.halign = 'left';
            else data.cell.styles.halign = 'center';
            return;
          }
          if (data.section !== 'body') return;
          if (data.row.index >= rows.length) return;
          const c = data.column.index;
          if (c >= 3 && c < 3 + years.length) {
            const y = years[c - 3];
            const pct = Number(rows[data.row.index]?.years?.[y]?.load_percent ?? 0);
            data.cell.styles.fillColor = hexToRgbForPdf(loadColor(pct, visualSettings));
            data.cell.styles.halign = 'center';
          } else if (c < 3) {
            data.cell.styles.fillColor = [255, 255, 255];
            data.cell.styles.halign = 'left';
          }
        },
      });

      doc.save(`kalkulator_widok_${reportFileStamp()}.pdf`);
      setReportMessage(t('calculator.reportPdfOk'));
    } catch (e: any) {
      setReportMessage(te(e?.message) || t('calculator.reportPdfFail'));
    } finally {
      setViewPdfGenerating(false);
    }
  };

  const generateReport = async () => {
    setReportMessage(null);
    if (!data) return;
    if (reportScope === 'selected' && reportTargetMachines.length === 0) {
      setReportMessage(t('calculator.reportSelectMachine'));
      return;
    }
    setReportGenerating(true);
    try {
      const selected = reportTargetMachines;
      const summary = years.map((y) => {
        const sum = selected.reduce((acc: number, m: any) => acc + Number(m.years?.[y]?.load_percent ?? 0), 0);
        const avg = selected.length > 0 ? sum / selected.length : 0;
        return { y, sum, avg };
      });
      const settingsCache = new Map<number, any>();
      const getSettingsForYear = async (year: number) => {
        if (settingsCache.has(year)) return settingsCache.get(year);
        try {
          const s = await api.capacity.settings(year, settingsProfile === 'ocu' ? { settingsProfile: 'ocu' } : undefined);
          settingsCache.set(year, s);
          return s;
        } catch {
          const fallback = { working_weeks_per_year: 48 };
          settingsCache.set(year, fallback);
          return fallback;
        }
      };

      const machineMetaRows = reportIncludeMachineMeta && selected.length > 0
        ? await Promise.all(
            selected.map(async (m: any) => {
              try {
                const md = await api.machines.get(Number(m.machine_id));
                return {
                  machine_id: m.machine_id,
                  sap_number: md.sap_number ?? '',
                  internal_number: md.internal_number ?? '',
                  type: md.type ?? '',
                  status: md.status ?? '',
                  location: md.location ?? '',
                  oee_override: md.oee_override ?? '',
                  machine_usage: md.machine_usage ?? '',
                };
              } catch {
                return {
                  machine_id: m.machine_id,
                  sap_number: m.sap_number ?? '',
                  internal_number: m.internal_number ?? '',
                  type: m.type ?? '',
                  status: '',
                  location: '',
                  oee_override: '',
                  machine_usage: '',
                };
              }
            })
          )
        : [];

      const operationRows: any[] = [];
      if (reportIncludeOperationDetails && selected.length > 0) {
        for (const m of selected) {
          for (const y of years) {
            const settings = await getSettingsForYear(y);
            const workWeeks = Number(settings?.working_weeks_per_year ?? 48);
            const ops = await api.machines.operations(Number(m.machine_id), { year: y });
            for (const op of ops) {
              const baseWeekly = Math.round(volumeToWeeklyClient(Number(op.volume_value ?? 0), (op.volume_unit ?? 'annual') as 'annual' | 'monthly' | 'weekly', workWeeks) * 1e6) / 1e6;
              operationRows.push({
                machine_id: m.machine_id,
                sap_number: m.sap_number ?? '',
                internal_number: m.internal_number ?? '',
                year: y,
                operation_id: op.id ?? '',
                project_id: op.project_id ?? '',
                project_name: op.project_name ?? '',
                client: op.client ?? '',
                part_designation: op.part_designation ?? '',
                phase_name: op.phase_name ?? '',
                cycle_time_seconds: op.cycle_time_seconds ?? '',
                volume_value_base: baseWeekly,
                volume_unit_base: 'weekly',
                effective_volume_value: op.effective_volume_value ?? '',
                effective_volume_unit: op.effective_volume_unit ?? '',
                effective_volume_weekly: op.effective_volume_weekly ?? '',
                effective_volume_source: op.effective_volume_source ?? '',
              });
            }
          }
        }
      }

      const settingsRows: any[] = [];
      if (reportIncludeSystemSettings) {
        for (const y of years) {
          const s = await getSettingsForYear(y);
          settingsRows.push({
            year: y,
            working_days_year: s?.working_days_year ?? '',
            shifts_per_day: s?.shifts_per_day ?? '',
            hours_per_shift:
              s?.hours_per_shift != null
                ? s.hours_per_shift
                : s?.shift_time_seconds != null
                  ? Math.round((Number(s.shift_time_seconds) / 60) * 100) / 100
                  : '',
            shift_time_minutes: s?.shift_time_seconds ?? '',
            oee_default: s?.oee_default ?? s?.oee_factor ?? '',
            working_weeks_per_year: s?.working_weeks_per_year ?? '',
            startup_shutdown_seconds: s?.startup_shutdown_seconds ?? '',
          });
        }
      }
      const hasVal = (v: unknown) => v !== '' && v != null;
      const clientLbl = formatMultiFilterSummary(clientFilter, t('common.allClients'));
      const typeLbl = formatMultiFilterSummary(typeFilter, t('common.all'));
      const lineLbl = formatMultiFilterSummary(lineFilter, t('common.all'));
      const dimLbl = formatDimFilterSummary(dimFilters, t);
      const settingsColumns: { key: string; label: string }[] = [
        { key: 'year', label: t('reports.calculator.colYear') },
        { key: 'working_days_year', label: t('reports.calculator.settingsWorkingDays') },
        { key: 'working_weeks_per_year', label: t('reports.calculator.settingsWorkingWeeks') },
        { key: 'shifts_per_day', label: t('reports.calculator.settingsShifts') },
        { key: 'hours_per_shift', label: t('reports.calculator.settingsHoursShift') },
        { key: 'shift_time_minutes', label: t('reports.calculator.settingsMinutesShift') },
        { key: 'oee_default', label: t('reports.calculator.settingsDefaultOee') },
        { key: 'startup_shutdown_seconds', label: t('reports.calculator.settingsStartup') },
      ].filter((c) => c.key === 'year' || settingsRows.some((r) => hasVal(r[c.key])));

      if (reportFormat === 'excel') {
        const wb = XLSX.utils.book_new();
        const calculatorAoa: any[][] = [
          [t('reports.calculator.colSap'), t('reports.calculator.colNumber'), t('reports.calculator.colType'), ...years.map((y) => String(y))],
          ...selected.map((m: any) => [
            excelExportCell(m.sap_number ?? '') ?? '-',
            excelExportCell(m.internal_number ?? '') ?? '-',
            m.type ?? '-',
            ...years.map((y) => Math.round(Number(m.years?.[y]?.load_percent ?? 0))),
          ]),
          [t('reports.calculator.sumRow'), '', '', ...summary.map((s) => Math.round(s.sum))],
          [t('reports.calculator.avgRow'), '', '', ...summary.map((s) => Math.round(s.avg))],
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(calculatorAoa), t('reports.calculator.sheetCalculator'));

        const infoAoa: any[][] = [
          [t('reports.calculator.infoPrintDate'), localeDateTime(locale)],
          [t('reports.calculator.infoYearRange'), `${effectiveYearFrom}-${effectiveYearTo}`],
          [t('reports.calculator.filterClient'), clientLbl],
          [t('reports.calculator.filterMachineType'), typeLbl],
          [t('reports.calculator.filterMachineStatus'), calculatorMachineStatusLabels(machineStatusFilter, t)],
          [t('reports.calculator.filterLineNumbers'), lineLbl],
          [t('reports.calculator.filterDimensions'), dimLbl || '—'],
          [t('reports.calculator.filterMachineNumbers'), machinesFilter || '—'],
          [
            t('reports.calculator.infoReportMode'),
            reportScope === 'filtered' ? t('reports.calculator.modeFiltered') : t('reports.calculator.modeSelected'),
          ],
          [t('reports.calculator.infoMachineCount'), selected.length],
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(infoAoa), t('reports.calculator.sheetInfo'));

        if (machineMetaRows.length > 0) {
          const metaAoa: any[][] = [
            [
              t('reports.calculator.colMachineId'),
              t('reports.calculator.colSap'),
              t('reports.calculator.colNumber'),
              t('reports.calculator.colType'),
              t('projects.status'),
              t('reports.calculator.colLine'),
              t('reports.calculator.oeeOverride'),
              t('reports.calculator.machineUsage'),
            ],
            ...machineMetaRows.map((r) => [
              excelExportCell(r.machine_id),
              excelExportCell(r.sap_number),
              excelExportCell(r.internal_number),
              r.type,
              r.status,
              excelExportCell(r.location),
              excelExportCell(r.oee_override),
              excelExportCell(r.machine_usage),
            ]),
          ];
          XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaAoa), t('reports.calculator.sheetMachineParams'));
        }
        if (operationRows.length > 0) {
          const opsAoa: any[][] = [
            [
              t('reports.calculator.colMachineId'),
              t('reports.calculator.colSap'),
              t('reports.calculator.colNumber'),
              t('reports.calculator.colYear'),
              t('reports.calculator.colOpId'),
              t('reports.calculator.colProjectId'),
              t('reports.calculator.colProject'),
              t('reports.calculator.client'),
              t('reports.calculator.colPart'),
              t('reports.calculator.colPhase'),
              t('reports.calculator.colCycle'),
              t('reports.calculator.baseVolume'),
              t('reports.calculator.baseUnit'),
              t('reports.calculator.effectiveVolume'),
              t('reports.calculator.effectiveUnit'),
              t('reports.calculator.effectiveWeekly'),
              t('reports.calculator.volumeSource'),
            ],
            ...operationRows.map((r) => [
              excelExportCell(r.machine_id),
              excelExportCell(r.sap_number),
              excelExportCell(r.internal_number),
              excelExportCell(r.year),
              excelExportCell(r.operation_id),
              excelExportCell(r.project_id),
              r.project_name,
              r.client,
              r.part_designation,
              r.phase_name,
              excelExportCell(r.cycle_time_seconds),
              excelExportCell(r.volume_value_base),
              r.volume_unit_base,
              excelExportCell(r.effective_volume_value),
              r.effective_volume_unit,
              excelExportCell(r.effective_volume_weekly),
              r.effective_volume_source,
            ]),
          ];
          XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(opsAoa), t('reports.calculator.sheetOperations'));
        }
        if (settingsRows.length > 0) {
          const settingsAoa: any[][] = [
            settingsColumns.map((c) => c.label),
            ...settingsRows.map((s) => settingsColumns.map((c) => excelExportCell(s[c.key]))),
          ];
          XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(settingsAoa), t('reports.calculator.sheetSettings'));
        }

        XLSX.writeFile(wb, `raport_kalkulator_${reportFileStamp()}.xlsx`);
      } else {
        const logoDataUrl = await fetchPdfLogoDataUrl();
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        addPdfHeaderLogo(doc, logoDataUrl);
        doc.setFontSize(16);
        doc.text(pdfSafe(t('reports.calculator.reportTitle')), 40, 36);
        doc.setFontSize(10);
        doc.text(pdfSafe(`${t('reports.calculator.printDate')}: ${localeDateTime(locale)}`), 40, 54);
        doc.text(
          pdfSafe(
            `${t('reports.calculator.yearRange')}: ${effectiveYearFrom}-${effectiveYearTo} | ${t('reports.calculator.client')}: ${clientLbl} | ${t('reports.calculator.type')}: ${typeLbl} | ${t('reports.calculator.machineStatus')}: ${calculatorMachineStatusLabels(machineStatusFilter, t)} | ${t('reports.calculator.lineNumbers')}: ${lineLbl} | ${t('reports.calculator.filterDimensions')}: ${dimLbl || '—'} | ${t('reports.calculator.machineNumbers')}: ${machinesFilter || '-'}`,
          ),
          40,
          68
        );
        doc.text(
          pdfSafe(
            `${t('reports.calculator.reportMode')}: ${reportScope === 'filtered' ? t('reports.calculator.modeFiltered') : t('reports.calculator.modeSelected')} | ${t('reports.calculator.machineCount')}: ${selected.length}`,
          ),
          40,
          82
        );

        const reportPdfRows = selected;
        const machineRowsReport = reportPdfRows.map((m: any) => [
          pdfSafe(m.sap_number ?? '-'),
          pdfSafe(String(m.internal_number ?? '-')),
          pdfSafe(String(m.type ?? '-')),
          ...years.map((y) => `${Number(m.years?.[y]?.load_percent ?? 0)}%`),
        ]);
        const sumRowReportPdf: any[] = [
          {
            content: pdfSafe(t('reports.calculator.sumLoad', { count: reportPdfRows.length })),
            colSpan: 3,
            styles: {
              fontStyle: 'bold',
              halign: 'left',
              fillColor: [245, 245, 245] as [number, number, number],
              textColor: [0, 0, 0],
            },
          },
          ...summary.map((s) => ({
            content: `${Math.round(s.sum)}%`,
            styles: {
              fontStyle: 'bold' as const,
              halign: 'center' as const,
              fillColor: hexToRgbForPdf(visualSettings.colorize_sum_row ? '#eef5ff' : '#ffffff'),
            },
          })),
        ];
        const avgRowReportPdf: any[] = [
          {
            content: pdfSafe(t('reports.calculator.avgLoad', { count: reportPdfRows.length })),
            colSpan: 3,
            styles: {
              fontStyle: 'bold',
              halign: 'left',
              fillColor: [250, 250, 250] as [number, number, number],
              textColor: [0, 0, 0],
            },
          },
          ...summary.map((s) => ({
            content: `${Math.round(s.avg)}%`,
            styles: {
              fontStyle: 'bold' as const,
              halign: 'center' as const,
              fillColor: hexToRgbForPdf(visualSettings.colorize_avg_row ? '#f3f8ff' : '#ffffff'),
            },
          })),
        ];

        const reportPdfLayout = calculatorPdfTableLayout(doc, years.length);
        autoTable(doc, {
          startY: 94,
          margin: { left: reportPdfLayout.margin, right: reportPdfLayout.margin },
          tableWidth: reportPdfLayout.tableWidth,
          head: [[pdfSafe(t('reports.calculator.colSap')), pdfSafe(t('reports.calculator.colNumber')), pdfSafe(t('reports.calculator.colType')), ...years.map((y) => String(y))]],
          body: [...machineRowsReport, sumRowReportPdf, avgRowReportPdf],
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 3, lineColor: [224, 224, 224], lineWidth: 0.1, fillColor: [255, 255, 255] },
          headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [255, 255, 255] },
          columnStyles: reportPdfLayout.columnStyles,
          didParseCell: (data) => {
            if (data.section === 'head') {
              if (data.column.index < 3) data.cell.styles.halign = 'left';
              else data.cell.styles.halign = 'center';
              return;
            }
            if (data.section !== 'body') return;
            if (data.row.index >= reportPdfRows.length) return;
            const c = data.column.index;
            if (c >= 3 && c < 3 + years.length) {
              const y = years[c - 3];
              const pct = Number(reportPdfRows[data.row.index]?.years?.[y]?.load_percent ?? 0);
              data.cell.styles.fillColor = hexToRgbForPdf(loadColor(pct, visualSettings));
              data.cell.styles.halign = 'center';
            } else if (c < 3) {
              data.cell.styles.fillColor = [255, 255, 255];
              data.cell.styles.halign = 'left';
            }
          },
        });

        let nextY = ((doc as any).lastAutoTable?.finalY ?? 94) + 14;

        if (settingsRows.length > 0) {
          if (nextY > 500) {
            doc.addPage();
            nextY = 40;
          }
          doc.setFontSize(11);
          doc.text(pdfSafe(t('reports.calculator.settingsUsed')), 40, nextY);
          autoTable(doc, {
            startY: nextY + 6,
            head: [settingsColumns.map((c) => pdfSafe(c.label))],
            body: settingsRows.map((s) => settingsColumns.map((c) => String(s[c.key] ?? ''))),
            styles: { fontSize: 8 },
          });
          nextY = ((doc as any).lastAutoTable?.finalY ?? nextY) + 14;
        }

        if (machineMetaRows.length > 0) {
          if (nextY > 440) {
            doc.addPage();
            nextY = 40;
          }
          doc.setFontSize(11);
          doc.text(pdfSafe(t('reports.calculator.machineParams')), 40, nextY);
          autoTable(doc, {
            startY: nextY + 6,
            head: [[
              pdfSafe(t('reports.calculator.colMachineId')),
              pdfSafe(t('reports.calculator.colSap')),
              pdfSafe(t('reports.calculator.colNumber')),
              pdfSafe(t('reports.calculator.colType')),
              pdfSafe(t('projects.status')),
              pdfSafe(t('reports.calculator.colLine')),
              pdfSafe(t('reports.calculator.oeeOverride')),
              pdfSafe(t('reports.calculator.machineUsage')),
            ]],
            body: machineMetaRows.map((r) => [String(r.machine_id), pdfSafe(r.sap_number), pdfSafe(r.internal_number), pdfSafe(r.type), pdfSafe(r.status), pdfSafe(r.location), String(r.oee_override), String(r.machine_usage)]),
            styles: { fontSize: 7 },
          });
          nextY = ((doc as any).lastAutoTable?.finalY ?? nextY) + 14;
        }

        if (operationRows.length > 0) {
          doc.addPage();
          doc.setFontSize(11);
          doc.text(pdfSafe(t('reports.calculator.operationsDetail')), 40, 36);
          autoTable(doc, {
            startY: 42,
            head: [[
              pdfSafe(t('reports.calculator.colNumber')),
              pdfSafe(t('reports.calculator.colYear')),
              pdfSafe(t('reports.calculator.colOpId')),
              pdfSafe(t('reports.calculator.colProject')),
              pdfSafe(t('reports.calculator.client')),
              pdfSafe(t('reports.calculator.colPart')),
              pdfSafe(t('reports.calculator.colPhase')),
              pdfSafe(t('reports.calculator.colCycle')),
              pdfSafe(t('reports.calculator.baseVolume')),
              pdfSafe(t('reports.calculator.baseUnit')),
              pdfSafe(t('reports.calculator.effectiveVolume')),
              pdfSafe(t('reports.calculator.effectiveUnit')),
              pdfSafe(t('reports.calculator.effectiveWeekly')),
              pdfSafe(t('reports.calculator.volumeSource')),
            ]],
            body: operationRows.map((r) => [pdfSafe(r.internal_number), String(r.year), String(r.operation_id), pdfSafe(r.project_name), pdfSafe(r.client), pdfSafe(r.part_designation), pdfSafe(r.phase_name), String(r.cycle_time_seconds), String(r.volume_value_base), pdfSafe(r.volume_unit_base), String(r.effective_volume_value), pdfSafe(r.effective_volume_unit), String(r.effective_volume_weekly), pdfSafe(r.effective_volume_source)]),
            styles: { fontSize: 6 },
          });
        }

        doc.save(`raport_kalkulator_${reportFileStamp()}.pdf`);
      }

      setReportModalOpen(false);
      setReportMessage(t('calculator.reportGenerated', { count: selected.length }));
    } catch (e: any) {
      setReportMessage(te(e?.message) || t('calculator.reportFail'));
    } finally {
      setReportGenerating(false);
    }
  };

  return (
    <div
      style={
        useContractualVolumes
          ? {
              border: `6px solid ${visualSettings.contractual_calculator_frame_color ?? '#ff9800'}`,
              borderRadius: 14,
              padding: 12,
              boxSizing: 'border-box',
            }
          : undefined
      }
    >
      <div className="calculator-page-header">
        <h1 className="calculator-page-title">
          {t('calculator.title')}{' '}
          {scenarioId != null && !isNaN(scenarioId) && (
            <span style={{ fontSize: 16, fontWeight: 400, color: '#666' }}>({scenarioTitleSuffix})</span>
          )}
        </h1>
        <div className="calculator-page-actions">
          {canDownloadReports && (
          <button type="button" onClick={() => setReportModalOpen(true)} className="calculator-primary-btn">{t('calculator.report')}</button>
          )}
          <button
            type="button"
            className="calculator-primary-btn"
            onClick={exportCalculatorViewPdf}
            disabled={loading || viewPdfGenerating || !data || filteredMachines.length === 0}
          >
            {viewPdfGenerating ? t('common.generating') : t('calculator.printPdf')}
          </button>
        </div>
      </div>
      <div className="filters-toolbar filters-toolbar--inline">
        <span className="filters-label">{t('common.filters')}</span>
        <label>{t('calculator.yearFrom')} <input type="number" min={2000} max={2100} value={yearFrom} onChange={(e) => setYearFrom(Number(e.target.value) || calendarYear())} style={{ width: 72 }} /></label>
        <label>{t('calculator.yearTo')} <input type="number" min={2000} max={2100} value={yearTo} onChange={(e) => setYearTo(Number(e.target.value) || calendarYear() + 10)} style={{ width: 72 }} /></label>
        <label>{t('calculator.machineType')}{' '}
          <MultiSelectFilter
            className="cap-filter-select"
            options={types.map((typ) => ({ value: typ, label: typ }))}
            selected={typeFilter}
            onChange={setTypeFilter}
            allLabel={t('common.all')}
            clearLabel={t('common.clearFilters')}
            searchable
            searchPlaceholder={t('common.searchFilter')}
          />
        </label>
        <label>{t('calculator.machineStatus')}{' '}
          <MultiSelectFilter
            className="cap-filter-select"
            options={calculatorMachineStatusOptions(t).filter((o) => o.value !== 'all').map((o) => ({ value: o.value, label: o.label }))}
            selected={machineStatusFilter}
            onChange={(next) => setMachineStatusFilter(next as CalculatorMachineStatusFilter[])}
            allLabel={t('calculator.machineStatusAll')}
            clearLabel={t('common.clearFilters')}
          />
        </label>
        <label>{t('calculator.client')}{' '}
          <MultiSelectFilter
            className="cap-filter-select"
            options={clients.map((c) => ({ value: c, label: c }))}
            selected={clientFilter}
            onChange={setClientFilter}
            allLabel={t('common.allClients')}
            clearLabel={t('common.clearFilters')}
            searchable
            searchPlaceholder={t('common.searchFilter')}
          />
        </label>
        <label>
          {t('calculator.lineSearch')}{' '}
          <MultiSelectFilter
            className="cap-filter-select"
            options={lineOptions.map((line) => ({ value: line, label: line }))}
            selected={lineFilter}
            onChange={setLineFilter}
            allLabel={t('common.all')}
            clearLabel={t('common.clearFilters')}
            searchable
            searchPlaceholder={t('common.searchFilter')}
          />
        </label>
        <label>
          {t('calculator.machinesSearch')}{' '}
          <input
            type="search"
            className="calculator-machines-search"
            value={machinesFilter}
            onChange={(e) => setMachinesFilter(e.target.value)}
            placeholder={t('calculator.machinesPlaceholder')}
            autoComplete="off"
          />
        </label>
        <label>
          {t('calculator.machineGroups')}{' '}
          <MachineGroupsMultiFilter className="cap-filter-select" groups={machineGroups} selected={groupFilter} onChange={setGroupFilter} />
        </label>
        <div className="filter-actions">
          <DataLoadingBadge
            active={(loading && Boolean(data)) || periodLoading}
            label={periodLoading ? t('calculator.loadingPeriodBreakdown') : undefined}
          />
          <button type="button" className="calculator-primary-btn" onClick={clearAllFilters}>{t('common.clearFilters')}</button>
        </div>
      </div>
      <div className={`filters-toolbar filters-toolbar--advanced${hasActiveDimFilters(dimFilters) ? ' filters-toolbar--advanced-active' : ''}`}>
        <div className="calculator-advanced-filters-header">
          <button
            type="button"
            className="calculator-advanced-filters-toggle"
            onClick={() => setAdvancedFiltersOpen((o) => !o)}
            aria-expanded={advancedFiltersOpen}
          >
            {advancedFiltersOpen ? '▾' : '▸'} {t('calculator.advancedFilters')}
          </button>
          {!advancedFiltersOpen && hasActiveDimFilters(dimFilters) && (
            <span className="calculator-advanced-filters-applied">
              <strong>{t('calculator.advancedFiltersApplied')}</strong> {formatDimFilterSummary(dimFilters, t)}
            </span>
          )}
        </div>
        {advancedFiltersOpen && (
          <div className="calculator-advanced-filters-grid">
            {(
              [
                { key: 'width' as const, label: t('calculator.dimWidth') },
                { key: 'depth' as const, label: t('calculator.dimDepth') },
                { key: 'height' as const, label: t('calculator.dimHeight') },
                { key: 'stroke' as const, label: t('calculator.dimStroke') },
              ] as const
            ).map(({ key, label }) => (
              <label key={key} className="calculator-dim-filter-row">
                <span className="calculator-dim-filter-label">{label}</span>
                <select
                  className="calculator-dim-filter-op"
                  value={dimFilters[key].op}
                  onChange={(e) =>
                    setDimFilters((prev) => ({
                      ...prev,
                      [key]: { ...prev[key], op: e.target.value as DimFilterOp },
                    }))
                  }
                >
                  <option value="">{t('calculator.dimOpNone')}</option>
                  <option value="gte">{t('calculator.dimOpGte')}</option>
                  <option value="lte">{t('calculator.dimOpLte')}</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  className="calculator-dim-filter-value"
                  value={dimFilters[key].value}
                  onChange={(e) =>
                    setDimFilters((prev) => ({
                      ...prev,
                      [key]: { ...prev[key], value: e.target.value },
                    }))
                  }
                  placeholder={t('calculator.dimValuePlaceholder')}
                  disabled={!dimFilters[key].op}
                />
              </label>
            ))}
          </div>
        )}
      </div>
      {reportMessage && <p style={{ margin: '0 0 1rem', fontSize: 13, color: reportMessage.includes('nie') ? '#c62828' : '#2e7d32' }}>{reportMessage}</p>}
      {reportModalOpen && (
        <div onMouseDown={(e) => { if (e.target === e.currentTarget) setReportModalOpen(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onMouseDown={(e) => e.stopPropagation()} style={{ background: 'white', width: 'min(920px, 94vw)', maxHeight: '90vh', overflow: 'auto', borderRadius: 10, padding: '1rem 1.25rem' }}>
            <h3 style={{ marginTop: 0 }}>{t('reports.calculator.configTitle')}</h3>
            <div style={{ marginBottom: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label><input type="radio" name="reportFormat" checked={reportFormat === 'pdf'} onChange={() => setReportFormat('pdf')} /> {t('reports.calculator.formatPdf')}</label>
              <label><input type="radio" name="reportFormat" checked={reportFormat === 'excel'} onChange={() => setReportFormat('excel')} /> {t('reports.calculator.formatExcel')}</label>
            </div>
            <div style={{ marginBottom: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label><input type="radio" name="reportScope" checked={reportScope === 'filtered'} onChange={() => setReportScope('filtered')} /> {t('reports.calculator.scopeFiltered')}</label>
              <label><input type="radio" name="reportScope" checked={reportScope === 'selected'} onChange={() => setReportScope('selected')} /> {t('reports.calculator.scopeSelected')}</label>
            </div>
            {reportScope === 'selected' && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#444' }}>{t('reports.calculator.selectedCount', { count: reportMachineIds.length })}</span>
                  <button type="button" onClick={selectAllReportMachines} style={{ padding: '2px 8px', fontSize: 12 }}>{t('reports.calculator.selectAllMachines')}</button>
                  <button type="button" onClick={clearReportMachines} style={{ padding: '2px 8px', fontSize: 12 }}>{t('reports.calculator.clearSelection')}</button>
                </div>
                <div style={{ maxHeight: 150, overflow: 'auto', border: '1px solid #d9e4f0', borderRadius: 6, background: '#fff', padding: 6 }}>
                  {reportMachineOptions.map((m) => (
                    <label key={m.machine_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 10, marginBottom: 6, fontSize: 13 }}>
                      <input type="checkbox" checked={reportMachineIds.includes(m.machine_id)} onChange={() => toggleReportMachine(m.machine_id)} />
                      {m.sap_number} | {m.internal_number} ({m.type})
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginBottom: 12, display: 'grid', gap: 6 }}>
              <label><input type="checkbox" checked={reportIncludeMachineMeta} onChange={(e) => setReportIncludeMachineMeta(e.target.checked)} /> {t('reports.calculator.includeMachineMeta')}</label>
              <label>
                <input
                  type="checkbox"
                  checked={reportIncludeOperationDetails}
                  onChange={(e) => setReportIncludeOperationDetails(e.target.checked)}
                />{' '}
                {t('reports.calculator.includeOperations')}
              </label>
              <label><input type="checkbox" checked={reportIncludeSystemSettings} onChange={(e) => setReportIncludeSystemSettings(e.target.checked)} /> {t('reports.calculator.includeSettings')}</label>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#666' }}>{t('reports.calculator.configHint')}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setReportModalOpen(false)} style={{ padding: '0.45rem 0.8rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 6 }}>{t('common.cancel')}</button>
              <button type="button" onClick={generateReport} disabled={reportGenerating} style={{ padding: '0.45rem 0.8rem', background: '#1976d2', color: 'white', border: 'none', borderRadius: 6 }}>
                {reportGenerating ? t('common.generating') : reportFormat === 'pdf' ? t('reports.calculator.generatePdf') : t('reports.calculator.generateExcel')}
              </button>
            </div>
          </div>
        </div>
      )}
      <DataLoadingOverlay
        active={(loading && Boolean(data)) || periodLoading}
        label={periodLoading ? t('calculator.loadingPeriodBreakdown') : undefined}
        className="calculator-data-panel"
      >
      {!scenarioId && overloaded.length > 0 && overloadedBarHidden && (
        <div style={{ marginBottom: '0.75rem' }}>
          <button
            type="button"
            onClick={() => {
              setOverloadedBarHidden(false);
              try {
                localStorage.removeItem('cap_calc_overloaded_bar_hidden');
              } catch {
                /* ignore */
              }
            }}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: 13,
              background: '#ffebee',
              color: '#b71c1c',
              border: '1px solid #ffcdd2',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {t('calculator.showOverloadedBar', { count: overloaded.length })}
          </button>
        </div>
      )}
      {!scenarioId && overloaded.length > 0 && !overloadedBarHidden && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#ffebee', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
            <strong>{t('calculator.overloaded')}</strong>
            <button
              type="button"
              onClick={() => {
                setOverloadedBarHidden(true);
                try {
                  localStorage.setItem('cap_calc_overloaded_bar_hidden', '1');
                } catch {
                  /* ignore */
                }
              }}
              style={{
                flexShrink: 0,
                padding: '2px 8px',
                fontSize: 12,
                background: 'transparent',
                color: '#666',
                border: '1px solid #ccc',
                borderRadius: 4,
                cursor: 'pointer',
              }}
              title={t('calculator.hideOverloadedBar')}
            >
              {t('calculator.hideOverloadedBar')}
            </button>
          </div>
          <div>
            {overloaded.map((m) => (
              <span key={m.machine_id} style={{ marginRight: 8, display: 'inline-block', marginBottom: 4 }}>
                {m.internal_number} ({m.load_percent}%)
                <button
                  type="button"
                  disabled={!canAllocate}
                  onClick={() => {
                    if (!canAllocate) return;
                    setAllocationModal({
                      machineId: m.machine_id,
                      internal_number: m.internal_number,
                      preselectedYear: m.year,
                      calculatorYears: data?.machines?.find((x: any) => Number(x.machine_id) === Number(m.machine_id))
                        ?.years,
                    });
                  }}
                  className={`calc-action-btn ${canAllocate ? 'calc-action-btn--blue' : 'calc-action-btn--disabled'}`}
                  style={{ marginLeft: 4 }}
                  title={!canAllocate ? t('auth.forbidden') : undefined}
                >
                  {t('calculator.transferVolume')}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      {machinesPaginationBar}
      <div className="calculator-table-block" ref={tableScrollRef}>
        <div className="calculator-table-head-sticky">
          <div
            className="calculator-table-x-scroll calculator-table-x-scroll--hide-bar"
            ref={headScrollRef}
            onScroll={() => syncTableHorizontalScroll('head')}
          >
            <table className="calculator-table" style={calcTableStyle}>
              {calculatorColgroup}
              <thead>{calculatorHeadRow}</thead>
            </table>
          </div>
        </div>
        <div className="calculator-table-body-shell">
          <div className="calculator-table-x-scroll" ref={bodyScrollRef} onScroll={() => syncTableHorizontalScroll('body')}>
            <table className="calculator-table" style={calcTableStyle}>
              {calculatorColgroup}
              <tbody>
            {displayedMachines.map((m: any) => {
              const inScenarioCalc = scenarioId != null && Number.isFinite(scenarioId) && scenarioId > 0;
              const machineRowIsRfq = inScenarioCalc && machineStatusFromDb(m.machine_status) === 'RFQ';
              return (
              <Fragment key={m.machine_id}>
              <tr>
                <td style={{ width: pinnedSapWidth, minWidth: pinnedSapWidth, maxWidth: pinnedSapWidth, padding: '0.75rem', position: 'sticky', left: 0, background: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.sap_number ?? '-'}</td>
                <td
                  style={{
                    width: pinnedNumberWidth,
                    minWidth: pinnedNumberWidth,
                    maxWidth: pinnedNumberWidth,
                    padding: '0.75rem',
                    position: 'sticky',
                    left: pinnedSapWidth,
                    background: 'white',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <span>{m.internal_number ?? '-'}</span>
                  {!isHorizontalExpansion &&
                    renderPeriodExpandBtn(
                      expandedMachines.has(m.machine_id) ? t('calculator.collapseRow') : t('calculator.expandRow'),
                      expandedMachines.has(m.machine_id),
                      () => toggleExpandedMachine(m.machine_id)
                    )}
                  {machineRowIsRfq && (
                    <span
                      style={{
                        marginLeft: 6,
                        padding: '1px 6px',
                        borderRadius: 10,
                        fontSize: 10,
                        lineHeight: 1.2,
                        fontWeight: 700,
                        background: '#A4C400',
                        color: '#fff',
                        flexShrink: 0,
                      }}
                    >
                      RFQ
                    </span>
                  )}
                </td>
                <td style={{ width: pinnedTypeWidth, minWidth: pinnedTypeWidth, maxWidth: pinnedTypeWidth, padding: '0.75rem', position: 'sticky', left: pinnedSapWidth + pinnedNumberWidth, background: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.type}</td>
                {timelineColumns.map((col) => {
                  const yearForCell = col.year;
                  const cell = m.years?.[yearForCell];
                  const monthsData = col.kind === 'year' ? undefined : getMachineMonthsData(m.machine_id, yearForCell);
                  const pct = getTimelineColumnLoad(col, cell?.load_percent, monthsData);
                  const isYearCell = col.kind === 'year';
                  const altRaw = cell?.alternative_border as 'none' | 'unused' | 'all_alt' | 'mixed' | undefined;
                  const altB =
                    visualSettings.show_alternative_borders && isYearCell && pct > 0 ? altRaw : 'none';
                  const periodKind: PeriodCellKind = col.kind === 'year' ? 'year' : col.kind === 'month' ? 'month' : 'week';
                  const yearMarkers = getYearMarkers(sopEopMarkerIndex, m.machine_id, yearForCell);
                  const monthMarkers =
                    col.kind === 'year'
                      ? { has_sop: yearMarkers?.has_sop ?? false, has_eop: yearMarkers?.has_eop ?? false }
                      : col.kind === 'month'
                        ? {
                            has_sop: monthsData?.[col.month]?.has_sop ?? getMonthMarkers(yearMarkers, col.month).has_sop,
                            has_eop: monthsData?.[col.month]?.has_eop ?? getMonthMarkers(yearMarkers, col.month).has_eop,
                          }
                        : getMonthMarkers(yearMarkers, col.month);
                  const periodCellPending = isPeriodColumnPending(col);
                  return (
                    <td
                      key={
                        col.kind === 'year'
                          ? `cell-y-${m.machine_id}-${yearForCell}`
                          : col.kind === 'month'
                            ? `cell-m-${m.machine_id}-${yearForCell}-${col.month}`
                            : `cell-w-${m.machine_id}-${yearForCell}-${col.month}-${col.week}`
                      }
                      role={canAllocate && isYearCell ? 'button' : undefined}
                      tabIndex={canAllocate && isYearCell ? 0 : undefined}
                      className={
                        isYearCell
                          ? 'calc-year-col'
                          : col.kind === 'month'
                            ? 'calc-period-col calc-period-col--month'
                            : 'calc-period-col calc-period-col--week'
                      }
                      style={periodCellStyle(pct, altB, visualSettings, periodKind, canAllocate && isYearCell)}
                      title={
                        isYearCell
                          ? percentCellTitle(yearForCell, altB, cell?.detail_breakdown, t, canAllocate)
                          : undefined
                      }
                      onClick={
                        canAllocate && isYearCell
                          ? () =>
                              setAllocationModal({
                                machineId: m.machine_id,
                                internal_number: m.internal_number,
                                preselectedYear: yearForCell,
                                calculatorYears: m.years,
                              })
                          : undefined
                      }
                      onKeyDown={
                        canAllocate && isYearCell
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setAllocationModal({
                                  machineId: m.machine_id,
                                  internal_number: m.internal_number,
                                  preselectedYear: yearForCell,
                                  calculatorYears: m.years,
                                });
                              }
                            }
                          : undefined
                      }
                    >
                      {renderPeriodCellContent(periodCellPending, pct, monthMarkers, visualSettings, t)}
                      {visualSettings.show_rfq_badge && isYearCell && cell?.has_rfq && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 2,
                            right: 2,
                            padding: '1px 4px',
                            borderRadius: 10,
                            fontSize: 10,
                            lineHeight: 1.1,
                            fontWeight: 700,
                            background: '#A4C400CC',
                            color: '#fff',
                            pointerEvents: 'none',
                          }}
                        >
                          RFQ
                        </span>
                      )}
                    </td>
                  );
                })}
                <td
                  className="calc-details-col"
                  style={{
                    width: detailsColWidth,
                    minWidth: detailsColWidth,
                    maxWidth: detailsColWidth,
                  }}
                >
                  <div className="calc-details-actions">
                  <button
                    type="button"
                    disabled={!canAllocate}
                    onClick={() => {
                      if (!canAllocate) return;
                      setAllocationModal({
                        machineId: m.machine_id,
                        internal_number: m.internal_number,
                        calculatorYears: m.years,
                      });
                    }}
                    className={`calc-action-btn ${canAllocate ? 'calc-action-btn--green' : 'calc-action-btn--disabled'}`}
                    title={!canAllocate ? t('auth.forbidden') : undefined}
                  >
                    {t('calculator.transferVolume')}
                  </button>
                  {canViewMachineDetails ? (
                    <Link to={`/maszyny/${m.machine_id}`} className="calc-action-btn calc-action-btn--blue">
                      {t('common.details')}
                    </Link>
                  ) : (
                    <span className="calc-action-btn calc-action-btn--disabled" title={t('auth.forbidden')}>
                      {t('common.details')}
                    </span>
                  )}
                  </div>
                </td>
              </tr>
              {!isHorizontalExpansion &&
                getVerticalExpansionRows(m.machine_id, expandedMachines, expandedMachineMonths, years).map((row) => {
                  const monthExpanded = expandedMachineMonths.has(periodMachineMonthKey(m.machine_id, row.month));
                  return (
                    <tr key={`${m.machine_id}-${row.kind}-${row.month}${row.kind === 'week' ? `-${row.week}` : ''}`}>
                      <td
                        colSpan={3}
                        className={`calc-period-row-label calc-period-indent-${row.indent}`}
                        style={{ padding: '0.45rem 0.75rem', position: 'sticky', left: 0, background: '#fafbfc' }}
                      >
                        {row.kind === 'month' ? (
                          <>
                            {t('calculator.periodMonthOnly', { month: monthAbbrev(row.month, locale) })}
                            {renderPeriodExpandBtn(
                              monthExpanded ? t('calculator.collapseMonth') : t('calculator.expandMonth'),
                              monthExpanded,
                              () => toggleExpandedMachineMonth(m.machine_id, row.month)
                            )}
                          </>
                        ) : (
                          t('calculator.periodWeekOnly', { week: row.week })
                        )}
                      </td>
                      {years.map((y) => {
                        const monthsData = getMachineMonthsData(m.machine_id, y);
                        const pct = getVerticalCellLoad(y, row, monthsData);
                        const yearMarkers = getYearMarkers(sopEopMarkerIndex, m.machine_id, y);
                        const monthMarkers =
                          row.kind === 'month'
                            ? {
                                has_sop: monthsData?.[row.month]?.has_sop ?? getMonthMarkers(yearMarkers, row.month).has_sop,
                                has_eop: monthsData?.[row.month]?.has_eop ?? getMonthMarkers(yearMarkers, row.month).has_eop,
                              }
                            : getMonthMarkers(yearMarkers, row.month);
                        const periodKind: PeriodCellKind = row.kind === 'month' ? 'month' : 'week';
                        const periodCellPending = periodLoading || isYearPeriodDataPending(y);
                        const cellStyle = periodCellStyle(pct, 'none', visualSettings, periodKind, false);
                        return (
                          <td
                            key={`sub-val-${m.machine_id}-${y}-${row.kind}-${row.month}`}
                            className={
                              periodKind === 'month'
                                ? 'calc-period-col calc-period-col--month'
                                : 'calc-period-col calc-period-col--week'
                            }
                            style={cellStyle}
                          >
                            {renderPeriodCellContent(periodCellPending, pct, monthMarkers, visualSettings, t)}
                          </td>
                        );
                      })}
                      <td className="calc-details-col" style={{ background: '#fafbfc' }} />
                    </tr>
                  );
                })}
              </Fragment>
              );
            })}
            {filteredMachines.length > 0 && (
              <>
                <tr style={{ background: '#f5f5f5', fontWeight: 600 }}>
                  <td style={{ padding: '0.75rem', position: 'sticky', left: 0, background: '#f5f5f5', zIndex: 1 }} colSpan={3}>
                    {t('calculator.sumLoadsWithCount', { count: filteredMachines.length })}
                  </td>
                  {timelineColumns.map((col) => {
                    const sum = filteredMachines.reduce((acc: number, m: any) => {
                      const monthsData = col.kind === 'year' ? undefined : getMachineMonthsData(m.machine_id, col.year);
                      return (
                        acc +
                        getTimelineColumnLoad(col, m.years?.[col.year]?.load_percent, monthsData)
                      );
                    }, 0);
                    return (
                    <td
                      key={
                        col.kind === 'year'
                          ? `sum-y-${col.year}`
                          : col.kind === 'month'
                            ? `sum-m-${col.year}-${col.month}`
                            : `sum-w-${col.year}-${col.month}-${col.week}`
                      }
                      className={col.kind === 'year' ? 'calc-year-col' : 'calc-period-col'}
                      style={{
                        padding: '0.35rem 0',
                        textAlign: 'center',
                        border: '1px solid #e0e0e0',
                        background: visualSettings.colorize_sum_row ? '#eef5ff' : undefined,
                      }}
                    >
                      {isPeriodColumnPending(col) ? (
                        <span className="calc-period-cell-loading" aria-hidden="true">
                          <span className="data-loading-spinner" />
                        </span>
                      ) : (
                        `${Math.round(sum)}%`
                      )}
                    </td>
                    );
                  })}
                  <td style={{ padding: '0.75rem' }}></td>
                </tr>
                <tr style={{ background: '#fafafa', fontWeight: 600 }}>
                  <td style={{ padding: '0.75rem', position: 'sticky', left: 0, background: '#fafafa', zIndex: 1 }} colSpan={3}>
                    {t('calculator.avgLoadsWithCount', { count: filteredMachines.length })}
                  </td>
                  {timelineColumns.map((col) => {
                    const sum = filteredMachines.reduce((acc: number, m: any) => {
                      const monthsData = col.kind === 'year' ? undefined : getMachineMonthsData(m.machine_id, col.year);
                      return (
                        acc +
                        getTimelineColumnLoad(col, m.years?.[col.year]?.load_percent, monthsData)
                      );
                    }, 0);
                    const avg = filteredMachines.length > 0 ? sum / filteredMachines.length : 0;
                    return (
                    <td
                      key={
                        col.kind === 'year'
                          ? `avg-y-${col.year}`
                          : col.kind === 'month'
                            ? `avg-m-${col.year}-${col.month}`
                            : `avg-w-${col.year}-${col.month}-${col.week}`
                      }
                      className={col.kind === 'year' ? 'calc-year-col' : 'calc-period-col'}
                      style={{
                        padding: '0.35rem 0',
                        textAlign: 'center',
                        border: '1px solid #e0e0e0',
                        background: visualSettings.colorize_avg_row ? '#f3f8ff' : undefined,
                      }}
                    >
                      {isPeriodColumnPending(col) ? (
                        <span className="calc-period-cell-loading" aria-hidden="true">
                          <span className="data-loading-spinner" />
                        </span>
                      ) : (
                        `${Math.round(avg)}%`
                      )}
                    </td>
                    );
                  })}
                  <td style={{ padding: '0.75rem' }}></td>
                </tr>
              </>
            )}
          </tbody>
            </table>
          </div>
        </div>
      </div>
      {machinesPaginationBar}
      {!loading && data && allMachines.length === 0 && (
        <p style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#fff3e0', borderRadius: 8, maxWidth: 720 }}>
          {t('calculator.emptyNoActiveMachines')}
        </p>
      )}
      {!loading && data && allMachines.length > 0 && filteredMachines.length === 0 && (
        <p style={{ marginTop: '1rem', color: '#666' }}>{t('calculator.noMachinesFilter')}</p>
      )}
      <CalculatorLegend visual={visualSettings} t={t} />
      </DataLoadingOverlay>
      {allocationModal && data && canAllocate && (
        <AllocationModal
          machineId={allocationModal.machineId}
          internalNumber={allocationModal.internal_number}
          yearFrom={data.yearFrom}
          yearTo={data.yearTo}
          preselectedYear={allocationModal.preselectedYear}
          calculatorYears={allocationModal.calculatorYears}
          scenarioId={scenarioId != null && !isNaN(scenarioId) ? scenarioId : undefined}
          onClose={() => setAllocationModal(null)}
          onSuccess={() => {
            setLoading(true);
            fetchCalculator().finally(() => setLoading(false));
          }}
        />
      )}
    </div>
  );
}

type AllocationLoadHint = {
  current_load_percent: number;
  /** Udział grupy detalu w obciążeniu maszyny [%] — z API /allocation/hint. */
  op_load_percent: number;
  suggested_volume_to_reach_100: number;
  suggested_volume_unit: 'annual' | 'monthly' | 'weekly';
  effective_volume_value: number;
  effective_volume_unit: 'annual' | 'monthly' | 'weekly';
  load_ratio_sum: number;
  usage: number;
  op_ratio_contrib: number;
  weekly_volume_effective: number;
  working_weeks_per_year: number;
  year_fraction: number;
};

function operationLoadPercentOfMachine(
  loadRatioSum: number,
  opRatioContrib: number,
  machineLoadPercent: number
): number {
  if (loadRatioSum <= 1e-12 || opRatioContrib <= 1e-12) return 0;
  return (opRatioContrib / loadRatioSum) * machineLoadPercent;
}

/** Ujednolicenie z tabelą kalkulatora — API hint może być chwilowo niezsynchronizowane po zmianie roku. */
function applyCalculatorMachineLoadPercent(
  hint: AllocationLoadHint,
  machineLoadPercent: number | null | undefined
): AllocationLoadHint {
  if (machineLoadPercent == null || !Number.isFinite(machineLoadPercent)) return hint;
  const current = Math.round(machineLoadPercent);
  if (current === hint.current_load_percent) return hint;
  return {
    ...hint,
    current_load_percent: current,
    op_load_percent: operationLoadPercentOfMachine(hint.load_ratio_sum, hint.op_ratio_contrib, current),
  };
}

function calculatorLoadPercentForYear(
  calculatorYears: Record<number, { load_percent?: number }> | undefined,
  year: number
): number | null {
  const pct = calculatorYears?.[year]?.load_percent;
  return pct != null && Number.isFinite(Number(pct)) ? Number(pct) : null;
}

/** SAP detalu z operacji (do dopasowania z detail_breakdown kalkulatora). */
function operationSapNumber(op: { detail_sap_number?: unknown; sap?: unknown; part_designation?: unknown } | null | undefined): string {
  const direct = String(op?.detail_sap_number ?? op?.sap ?? '').trim();
  if (direct) return direct;
  const pd = String(op?.part_designation ?? '').trim();
  const m = pd.match(/^(\d+)/);
  return m ? m[1] : '';
}

/** Udział detalu w obciążeniu maszyny [%] — z tego samego źródła co tooltip komórki kalkulatora. */
function detailContributionForOperation(
  calculatorYears:
    | Record<number, { detail_breakdown?: { detail_label: string; contribution_percent: number }[] }>
    | undefined,
  year: number,
  op: { detail_sap_number?: unknown; sap?: unknown; part_designation?: unknown } | null | undefined
): number | null {
  const breakdown = calculatorYears?.[year]?.detail_breakdown;
  if (!breakdown?.length || !op) return null;
  const sap = operationSapNumber(op);
  const label = String(op.part_designation ?? '').trim();
  for (const d of breakdown) {
    const dl = String(d.detail_label ?? '');
    if (sap && dl.includes(sap)) return Number(d.contribution_percent);
    if (label && (dl === label || dl.startsWith(label) || label.startsWith(dl))) {
      return Number(d.contribution_percent);
    }
  }
  return null;
}

/**
 * Hint do trybu „pozostałe obciążenie %” — budowany synchronicznie z kalkulatora + listy operacji.
 * Nie zależy od wyścigu asynchronicznego /allocation/hint (stary hint dawał ~0,2% zamiast ~59%).
 */
function buildTargetPercentHint(params: {
  machineLoadPercent: number | null;
  groupWeeklyMovable: number;
  selectedOp: any | null | undefined;
  calculatorYears?: Record<
    number,
    { load_percent?: number; detail_breakdown?: { detail_label: string; contribution_percent: number }[] }
  >;
  year: number;
  apiHint: AllocationLoadHint | null;
}): AllocationLoadHint | null {
  const { machineLoadPercent, groupWeeklyMovable, selectedOp, calculatorYears, year, apiHint } = params;
  const machineLoad =
    machineLoadPercent ??
    calculatorLoadPercentForYear(calculatorYears, year) ??
    apiHint?.current_load_percent ??
    null;
  if (machineLoad == null || groupWeeklyMovable <= 1e-9) return null;

  const detailContrib = detailContributionForOperation(calculatorYears, year, selectedOp);
  const opLoad =
    detailContrib != null && Number.isFinite(detailContrib) && detailContrib > 1e-9
      ? detailContrib
      : apiHint != null && apiHint.op_load_percent > 1e-9
        ? apiHint.op_load_percent
        : apiHint != null && apiHint.load_ratio_sum > 1e-9
          ? operationLoadPercentOfMachine(apiHint.load_ratio_sum, apiHint.op_ratio_contrib, machineLoad)
          : null;
  if (opLoad == null || opLoad <= 1e-9) return null;

  const unit = (selectedOp?.effective_volume_unit ?? selectedOp?.volume_unit ?? apiHint?.suggested_volume_unit ?? 'annual') as VolumeUnit;

  return {
    current_load_percent: Math.round(machineLoad),
    op_load_percent: opLoad,
    suggested_volume_to_reach_100: 0,
    suggested_volume_unit: unit,
    effective_volume_value: Number(selectedOp?.effective_volume_value ?? selectedOp?.volume_value ?? 0),
    effective_volume_unit: unit,
    load_ratio_sum: apiHint?.load_ratio_sum ?? 0,
    usage: apiHint?.usage ?? 1,
    op_ratio_contrib: apiHint?.op_ratio_contrib ?? 0,
    weekly_volume_effective: groupWeeklyMovable,
    working_weeks_per_year: apiHint?.working_weeks_per_year ?? 48,
    year_fraction: apiHint?.year_fraction != null && apiHint.year_fraction > 1e-12 ? apiHint.year_fraction : 1,
  };
}

function volumeToWeeklyClient(
  volumeValue: number,
  volumeUnit: 'annual' | 'monthly' | 'weekly',
  workWeeks: number
): number {
  const w = Math.max(1, workWeeks);
  if (volumeUnit === 'weekly') return volumeValue;
  if (volumeUnit === 'annual') return volumeValue / w;
  return (volumeValue * 12) / w;
}

function weeklyToVolumeClient(
  weeklyValue: number,
  targetUnit: 'annual' | 'monthly' | 'weekly',
  workWeeks: number
): number {
  const w = Math.max(1, workWeeks);
  if (targetUnit === 'weekly') return weeklyValue;
  if (targetUnit === 'annual') return weeklyValue * w;
  return (weeklyValue * w) / 12;
}

/**
 * Tygodniowy wolumen efektywny grupy, do którego odnosi się op_load_percent.
 * To DOKŁADNIE ten sam wolumen, którego wkład w obciążenie maszyny wynosi op_load_percent,
 * więc tylko on może służyć do przeliczeń obciążenie% ↔ wolumen.
 */
function movableBaseWeekly(hint: AllocationLoadHint, groupWeeklyMovable?: number): number {
  const group = groupWeeklyMovable ?? 0;
  if (group > 1e-9) return group;
  return hint.weekly_volume_effective > 1e-9 ? hint.weekly_volume_effective : 0;
}

function projectRemainingMachineLoad(
  hint: AllocationLoadHint,
  moveWeeklyEffective: number,
  groupWeeklyMovable?: number
): number {
  const base = movableBaseWeekly(hint, groupWeeklyMovable);
  if (base <= 1e-12) return hint.current_load_percent;
  const applied = Math.min(base, Math.max(0, moveWeeklyEffective));
  const opLoadPercent =
    hint.op_load_percent > 1e-9
      ? hint.op_load_percent
      : operationLoadPercentOfMachine(hint.load_ratio_sum, hint.op_ratio_contrib, hint.current_load_percent);
  return Math.round(Math.max(0, hint.current_load_percent - (applied / base) * opLoadPercent));
}

/** Szacowane obciążenie % zwalnianej maszyny po przeniesieniu wpisanego wolumenu (zgodnie z API /allocation/hint). */
function loadPercentAfterTransfer(
  hint: AllocationLoadHint,
  volumeStr: string,
  volumeUnit: 'annual' | 'monthly' | 'weekly',
  groupWeeklyMovable?: number
): number | null {
  const v = Number(String(volumeStr).trim().replace(',', '.'));
  if (!Number.isFinite(v) || v < 0) return null;
  const { year_fraction, working_weeks_per_year } = hint;
  const base = movableBaseWeekly(hint, groupWeeklyMovable);
  if (base <= 1e-9) return hint.current_load_percent;
  const fractionY = year_fraction > 1e-12 ? year_fraction : 1;
  const moveWeekly = volumeToWeeklyClient(v, volumeUnit, working_weeks_per_year) * fractionY;
  return projectRemainingMachineLoad(hint, moveWeekly, groupWeeklyMovable);
}

/** Wolumen i podgląd % dla trybu „pozostałe obciążenie maszyny źródłowej” (zgodnie z API). */
function computeVolumeForRemainingMachineLoad(
  hint: AllocationLoadHint,
  remainingLoadPercent: number,
  groupWeeklyMovable?: number
): {
  volume: number;
  unit: VolumeUnit;
  projectedRemaining: number;
  moveWeeklyEffective: number;
  insufficient: boolean;
  alreadyAtOrBelow: boolean;
} {
  const remaining = Math.min(300, Math.max(0, remainingLoadPercent));
  const current = hint.current_load_percent;
  const u = hint.suggested_volume_unit as VolumeUnit;
  const base = movableBaseWeekly(hint, groupWeeklyMovable);

  if (current <= remaining + 1e-9) {
    return {
      volume: 0,
      unit: u,
      projectedRemaining: current,
      moveWeeklyEffective: 0,
      insufficient: false,
      alreadyAtOrBelow: true,
    };
  }
  if (base <= 1e-9) {
    return {
      volume: 0,
      unit: u,
      projectedRemaining: current,
      moveWeeklyEffective: 0,
      insufficient: true,
      alreadyAtOrBelow: false,
    };
  }

  const surplusLoadPercent = current - remaining;
  const opLoadPercent =
    hint.op_load_percent > 1e-9
      ? hint.op_load_percent
      : operationLoadPercentOfMachine(hint.load_ratio_sum, hint.op_ratio_contrib, current);

  if (opLoadPercent <= 1e-9) {
    return {
      volume: 0,
      unit: u,
      projectedRemaining: current,
      moveWeeklyEffective: 0,
      insufficient: true,
      alreadyAtOrBelow: false,
    };
  }

  // Ułamek wolumenu grupy do przeniesienia: ile trzeba zabrać, aby zdjąć `surplus` p.p. obciążenia.
  const fractionOfGroup = Math.min(1, Math.max(0, surplusLoadPercent / opLoadPercent));
  const moveWeeklyEff = fractionOfGroup * base;

  // Cała grupa zdejmuje tylko op_load_percent p.p. — gdy to za mało, nie da się zejść do celu jedną operacją.
  const projectedIfMoveAll = Math.round(Math.max(0, current - opLoadPercent));
  const insufficient = projectedIfMoveAll > remaining + 1;

  const fractionY = hint.year_fraction > 1e-12 ? hint.year_fraction : 1;
  const moveBaseWeekly = moveWeeklyEff / fractionY;
  let volume = 0;
  if (u === 'weekly') volume = moveBaseWeekly;
  else if (u === 'annual') volume = moveBaseWeekly * hint.working_weeks_per_year;
  else volume = (moveBaseWeekly * hint.working_weeks_per_year) / 12;

  const volRounded = Math.round(volume * 1e6) / 1e6;
  const projected = projectRemainingMachineLoad(hint, moveWeeklyEff, base);

  return {
    volume: volRounded,
    unit: u,
    projectedRemaining: projected ?? current,
    moveWeeklyEffective: moveWeeklyEff,
    insufficient,
    alreadyAtOrBelow: false,
  };
}

function weeklyTargetSurplusFromHint(
  hint: AllocationLoadHint,
  remainingLoadPercent: number,
  groupWeeklyMovable?: number
): number {
  return computeVolumeForRemainingMachineLoad(hint, remainingLoadPercent, groupWeeklyMovable).moveWeeklyEffective;
}

type VolumeUnit = 'annual' | 'monthly' | 'weekly';
type AllocationYearMode = 'single' | 'multi';
type AllocationValueMode = 'global' | 'perYear';
type AllocationTransferMode = 'full' | 'manual' | 'targetPercent';

function resolveAllocationWeeklyForYear(
  transferMode: AllocationTransferMode,
  totalWeeklyForYear: number,
  requestedWeekly: number,
  hint: AllocationLoadHint | null,
  sourceTargetLoadPercent: number,
  groupWeeklyMovable?: number
): { effectiveWeekly: number; capped: boolean; cappedByTargetPercent: boolean } {
  if (totalWeeklyForYear <= 1e-9) {
    return { effectiveWeekly: 0, capped: false, cappedByTargetPercent: false };
  }
  if (transferMode === 'full') {
    return { effectiveWeekly: totalWeeklyForYear, capped: false, cappedByTargetPercent: false };
  }
  if (transferMode === 'manual') {
    const effectiveWeekly = Math.min(Math.max(0, requestedWeekly), totalWeeklyForYear);
    return {
      effectiveWeekly,
      capped: effectiveWeekly < requestedWeekly - 1e-6,
      cappedByTargetPercent: false,
    };
  }
  const movable = Math.max(groupWeeklyMovable ?? 0, totalWeeklyForYear);
  const idealWeekly =
    hint != null ? weeklyTargetSurplusFromHint(hint, sourceTargetLoadPercent, movable) : 0;
  const effectiveWeekly = Math.min(Math.max(0, idealWeekly), totalWeeklyForYear);
  return {
    effectiveWeekly,
    capped: effectiveWeekly < idealWeekly - 1e-6,
    cappedByTargetPercent: effectiveWeekly < idealWeekly - 1e-6,
  };
}
type GroupedOperation = {
  key: string;
  representativeId: number;
  operationIds: number[];
  partDesignation: string;
  phaseName: string;
  totalWeekly: number;
  displayValue: number;
  displayUnit: VolumeUnit;
};

function AllocationModal({
  machineId,
  internalNumber,
  yearFrom,
  yearTo,
  preselectedYear,
  calculatorYears,
  scenarioId,
  onClose,
  onSuccess,
}: {
  machineId: number;
  internalNumber: number | string;
  yearFrom: number;
  yearTo: number;
  preselectedYear?: number;
  calculatorYears?: Record<
    number,
    {
      load_percent?: number;
      detail_breakdown?: { project_label?: string; detail_label: string; contribution_percent: number; has_rfq?: boolean }[];
    }
  >;
  /** Gdy ustawiony — alokacja zapisuje się w snapshotcie scenariusza, nie w produkcji. */
  scenarioId?: number;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { t, te } = useI18n();
  const { useContractualVolumes } = useContractVolumes();
  const volumeUnitLabel = (unit: VolumeUnit) =>
    unit === 'annual' ? t('common.unitAnnualShort') : unit === 'monthly' ? t('common.unitMonthlyShort') : t('common.unitWeeklyShort');
  const operationGroupKey = (op: any): string =>
    `${op.project_id ?? ''}:${op.part_id ?? ''}:${op.phase_id ?? ''}`;
  const operationWeekly = (op: any): number => {
    const w = Number(op?.effective_volume_weekly);
    if (Number.isFinite(w)) return w;
    const v = Number(op?.effective_volume_value ?? op?.volume_value ?? 0);
    const u = (op?.effective_volume_unit ?? op?.volume_unit ?? 'annual') as VolumeUnit;
    return volumeToWeeklyClient(v, u, 48);
  };
  const yearRange = Array.from({ length: yearTo - yearFrom + 1 }, (_, i) => yearFrom + i);
  const defaultYear = preselectedYear ?? yearFrom;
  const [year, setYear] = useState(defaultYear);
  const [yearMode, setYearMode] = useState<AllocationYearMode>('single');
  const [selectedYears, setSelectedYears] = useState<number[]>([defaultYear]);
  const [valueMode, setValueMode] = useState<AllocationValueMode>('global');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [opId, setOpId] = useState<number | ''>('');
  const [targetId, setTargetId] = useState<number | ''>('');
  const [volumeToMove, setVolumeToMove] = useState('');
  const [volumeUnit, setVolumeUnit] = useState<VolumeUnit>('annual');
  const [perYearValues, setPerYearValues] = useState<Record<number, { value: string; unit: VolumeUnit }>>({});
  type TargetCycleMode = 'unchanged' | 'custom' | 'alternative';
  const [targetCycleMode, setTargetCycleMode] = useState<TargetCycleMode>('unchanged');
  const [customCycleSeconds, setCustomCycleSeconds] = useState('');
  const [executing, setExecuting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [loadHint, setLoadHint] = useState<AllocationLoadHint | null>(null);
  const [loadHintOpIds, setLoadHintOpIds] = useState('');
  const [hintLoading, setHintLoading] = useState(false);
  const hintRequestSeq = useRef(0);
  const lastAppliedHintKey = useRef<string>('');
  const pendingSelectTargetMachineId = useRef<number | null>(null);
  const [alternativesList, setAlternativesList] = useState<any[]>([]);
  const [sourceMachineType, setSourceMachineType] = useState('');
  const [allMachinesList, setAllMachinesList] = useState<any[]>([]);
  const [addAltId, setAddAltId] = useState('');
  const [addingAlt, setAddingAlt] = useState(false);
  const [transferMode, setTransferMode] = useState<AllocationTransferMode>('manual');
  const [sourceTargetLoadPercent, setSourceTargetLoadPercent] = useState(100);
  const [yearMaxWeekly, setYearMaxWeekly] = useState<Record<number, number>>({});
  const groupedOperations: GroupedOperation[] = useMemo(() => {
    const map = new Map<string, GroupedOperation>();
    for (const op of operations) {
      const key = operationGroupKey(op);
      const opWeekly = Math.max(0, operationWeekly(op));
      const opDisplayValue = Number(op?.effective_volume_value ?? op?.volume_value ?? 0);
      const opDisplayUnit = (op?.effective_volume_unit ?? op?.volume_unit ?? 'annual') as VolumeUnit;
      if (!map.has(key)) {
        map.set(key, {
          key,
          representativeId: op.id,
          operationIds: [op.id],
          partDesignation: String(op.part_designation ?? ''),
          phaseName: String(op.phase_name ?? ''),
          totalWeekly: opWeekly,
          displayValue: opDisplayValue,
          displayUnit: opDisplayUnit,
        });
      } else {
        const curr = map.get(key)!;
        curr.operationIds.push(op.id);
        curr.totalWeekly += opWeekly;
        const rep = operations.find((x) => x.id === curr.representativeId);
        if ((rep ? operationWeekly(rep) : 0) < opWeekly) {
          curr.representativeId = op.id;
          curr.displayValue = opDisplayValue;
          curr.displayUnit = opDisplayUnit;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.representativeId - b.representativeId);
  }, [operations]);

  useEffect(() => {
    api.machines.list({ status: 'active' }).then(setAllMachinesList);
  }, []);

  useEffect(() => {
    setYear((prev) => (preselectedYear != null ? preselectedYear : prev));
    if (preselectedYear != null) {
      setSelectedYears([preselectedYear]);
      setYearMode('single');
    }
  }, [preselectedYear]);

  useEffect(() => {
    setPerYearValues((prev) => {
      const next = { ...prev };
      yearRange.forEach((y) => {
        if (!next[y]) next[y] = { value: '', unit: volumeUnit };
      });
      return next;
    });
  }, [yearRange, volumeUnit]);

  useEffect(() => {
    if (selectedYears.length === 0) return;
    if (selectedYears.includes(year)) return;
    setYear(selectedYears[0]);
  }, [selectedYears, year]);

  /** W trybie jednego roku lista wykonania musi być zsynchronizowana — inaczej zostają zaznaczenia z trybu wielu lat. */
  useEffect(() => {
    if (yearMode === 'single') {
      setSelectedYears([year]);
    }
  }, [yearMode, year]);

  useEffect(() => {
    if (transferMode !== 'manual' && valueMode === 'perYear') setValueMode('global');
  }, [transferMode, valueMode]);

  useEffect(() => {
    const o = operations.find((x) => x.id === opId);
    if (!o) return;
    setVolumeUnit((o.effective_volume_unit ?? o.volume_unit ?? 'annual') as 'annual' | 'monthly' | 'weekly');
  }, [opId, operations]);

  const allocScenarioParams =
    scenarioId != null && scenarioId > 0
      ? { scenarioId, ...(useContractualVolumes ? { useContractualVolumes: true as const } : {}) }
      : useContractualVolumes
        ? { useContractualVolumes: true as const }
        : {};

  const loadAllocationData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.allocation
        .candidates(machineId, { year, maxLoad: 90, includeOverloadedAlternatives: true, ...allocScenarioParams })
        .then((r) => r.candidates || []),
      api.machines.operations(machineId, { year, ...allocScenarioParams }),
      api.alternatives.list(machineId),
      api.machines.get(machineId).catch(() => null),
    ])
      .then(([cands, ops, alts, srcM]) => {
        setCandidates(cands);
        setOperations(ops);
        setAlternativesList(Array.isArray(alts) ? alts : []);
        if (srcM?.type != null) setSourceMachineType(String(srcM.type));
        setOpId((prev) => {
          if (typeof prev === 'number' && ops.some((o: any) => o.id === prev)) {
            const keep = ops.find((o: any) => o.id === prev);
            if (keep && operationWeekly(keep) > 0) return prev;
            if (keep) {
              const keepKey = operationGroupKey(keep);
              const sameGroup = ops.filter((o: any) => operationGroupKey(o) === keepKey);
              const best = sameGroup.sort((a: any, b: any) => operationWeekly(b) - operationWeekly(a))[0];
              if (best && operationWeekly(best) > 0) return best.id;
            }
          }
          const firstWithVolume = [...ops].sort((a: any, b: any) => operationWeekly(b) - operationWeekly(a)).find((o: any) => operationWeekly(o) > 0);
          if (firstWithVolume) return firstWithVolume.id;
          return ops.length ? ops[0].id : '';
        });
        setTargetId((prev) => {
          const want = pendingSelectTargetMachineId.current;
          if (want != null && cands.some((c: any) => c.machine_id === want)) {
            pendingSelectTargetMachineId.current = null;
            return want;
          }
          if (typeof prev === 'number' && cands.some((c: any) => c.machine_id === prev)) return prev;
          const free = cands.filter((c: any) => c.load_percent < 90);
          const pick = free.length ? free : cands;
          return pick.length ? pick[0].machine_id : '';
        });
      })
      .finally(() => setLoading(false));
  }, [machineId, year, scenarioId, useContractualVolumes]);

  useEffect(() => {
    loadAllocationData();
  }, [loadAllocationData]);

  const hintOperationIds = useMemo(() => {
    if (opId === '') return '';
    const group = groupedOperations.find((g) => g.representativeId === opId);
    return group?.operationIds?.length ? group.operationIds.join(',') : String(opId);
  }, [groupedOperations, opId]);

  useEffect(() => {
    setLoadHint(null);
    setLoadHintOpIds('');
  }, [machineId, year]);

  useEffect(() => {
    setLoadHint(null);
    setLoadHintOpIds('');
  }, [opId]);

  useEffect(() => {
    if (opId === '' || hintOperationIds === '') {
      setLoadHint(null);
      setHintLoading(false);
      return;
    }
    const seq = ++hintRequestSeq.current;
    setHintLoading(true);
    api
      .allocation
      .hint(machineId, { year, operationId: opId as number, operationIds: hintOperationIds, ...allocScenarioParams })
      .then((h) => {
        if (seq !== hintRequestSeq.current) return;
        setLoadHint(h as AllocationLoadHint);
        setLoadHintOpIds(hintOperationIds);
      })
      .catch(() => {
        if (seq !== hintRequestSeq.current) return;
        setLoadHint(null);
        setLoadHintOpIds('');
      })
      .finally(() => {
        if (seq === hintRequestSeq.current) setHintLoading(false);
      });
  }, [machineId, year, opId, hintOperationIds, scenarioId, useContractualVolumes]);

  const machineLoadFromCalculator = useMemo(
    () => calculatorLoadPercentForYear(calculatorYears, year),
    [calculatorYears, year]
  );

  const apiHintForOp =
    loadHint != null && loadHintOpIds === hintOperationIds && hintOperationIds !== '' ? loadHint : null;

  const effectiveLoadHint = useMemo(
    () =>
      apiHintForOp != null ? applyCalculatorMachineLoadPercent(apiHintForOp, machineLoadFromCalculator) : null,
    [apiHintForOp, machineLoadFromCalculator]
  );

  const displayedMachineLoadPercent =
    machineLoadFromCalculator ?? effectiveLoadHint?.current_load_percent ?? null;

  const selectedOp = operations.find((o) => o.id === opId);
  const altCycleSeconds = useMemo(() => {
    const a = Number(selectedOp?.alt_cycle_time_seconds);
    return Number.isFinite(a) && a > 0 ? a : null;
  }, [selectedOp]);

  useEffect(() => {
    setTargetCycleMode('unchanged');
    setCustomCycleSeconds('');
  }, [opId]);

  useEffect(() => {
    if (targetCycleMode === 'alternative' && altCycleSeconds == null) {
      setTargetCycleMode('unchanged');
    }
  }, [targetCycleMode, altCycleSeconds]);
  const selectedGroupKey = selectedOp ? operationGroupKey(selectedOp) : '';
  const selectedGroup = selectedGroupKey ? groupedOperations.find((g) => g.key === selectedGroupKey) : null;
  const selectedGroupWeekly = selectedGroup?.totalWeekly ?? (selectedOp ? operationWeekly(selectedOp) : 0);
  const yearsForAllocation = yearMode === 'single' ? [year] : [...selectedYears].sort((a, b) => a - b);
  const workWeeksHint = effectiveLoadHint?.working_weeks_per_year ?? loadHint?.working_weeks_per_year ?? 48;
  const groupWeeklyForYear = yearMaxWeekly[year] ?? selectedGroupWeekly;

  const targetPercentHint = useMemo(
    () =>
      buildTargetPercentHint({
        machineLoadPercent: machineLoadFromCalculator,
        groupWeeklyMovable: groupWeeklyForYear,
        selectedOp,
        calculatorYears,
        year,
        apiHint: effectiveLoadHint,
      }),
    [machineLoadFromCalculator, groupWeeklyForYear, selectedOp, calculatorYears, year, effectiveLoadHint]
  );

  useEffect(() => {
    if (!selectedGroupKey || yearsForAllocation.length === 0) {
      setYearMaxWeekly({});
      return;
    }
    let cancelled = false;
    Promise.all(
      yearsForAllocation.map(async (y) => {
        const opsForYear = await api.machines.operations(machineId, { year: y, ...allocScenarioParams });
        const groupOps = (opsForYear || []).filter((o: any) => operationGroupKey(o) === selectedGroupKey);
        const maxWeekly = groupOps.reduce((sum: number, o: any) => sum + Math.max(0, operationWeekly(o)), 0);
        return { y, maxWeekly };
      })
    ).then((rows) => {
      if (cancelled) return;
      const next: Record<number, number> = {};
      for (const r of rows) next[r.y] = r.maxWeekly;
      setYearMaxWeekly(next);
    });
    return () => {
      cancelled = true;
    };
  }, [machineId, selectedGroupKey, yearsForAllocation.join(','), scenarioId, useContractualVolumes]);

  const targetPercentCalc = useMemo(() => {
    if (transferMode !== 'targetPercent' || targetPercentHint == null) return null;
    return computeVolumeForRemainingMachineLoad(targetPercentHint, sourceTargetLoadPercent, groupWeeklyForYear);
  }, [transferMode, targetPercentHint, sourceTargetLoadPercent, groupWeeklyForYear]);

  const remainingLoadPercent = useMemo(() => {
    if (effectiveLoadHint == null || transferMode === 'full') return null;
    const groupW = groupWeeklyForYear;
    if (transferMode === 'targetPercent') {
      return targetPercentCalc?.projectedRemaining ?? null;
    }
    return loadPercentAfterTransfer(effectiveLoadHint, volumeToMove, volumeUnit, groupW);
  }, [effectiveLoadHint, transferMode, targetPercentCalc, volumeToMove, volumeUnit, groupWeeklyForYear]);

  const maxMovableInSelectedUnit =
    groupWeeklyForYear > 1e-9
      ? Math.round(weeklyToVolumeClient(groupWeeklyForYear, volumeUnit, workWeeksHint) * 1000) / 1000
      : null;
  const selectedUnitLabel = volumeUnitLabel(volumeUnit);

  const manualExceedsYears = useMemo(() => {
    if (transferMode !== 'manual' || yearsForAllocation.length === 0) return [] as number[];
    const exceeded: number[] = [];
    if (valueMode === 'perYear') {
      for (const y of yearsForAllocation) {
        const entry = perYearValues[y];
        const vol = Number(entry?.value ?? '');
        if (!Number.isFinite(vol) || vol <= 0) continue;
        const reqW = volumeToWeeklyClient(vol, entry?.unit ?? volumeUnit, workWeeksHint);
        const maxW = yearMaxWeekly[y] ?? 0;
        if (reqW > maxW + 1e-9) exceeded.push(y);
      }
      return exceeded;
    }
    const vol = Number(volumeToMove);
    if (!Number.isFinite(vol) || vol <= 0) return exceeded;
    const reqW = volumeToWeeklyClient(vol, volumeUnit, workWeeksHint);
    for (const y of yearsForAllocation) {
      const maxW = yearMaxWeekly[y] ?? 0;
      if (reqW > maxW + 1e-9) exceeded.push(y);
    }
    return exceeded;
  }, [transferMode, valueMode, volumeToMove, volumeUnit, perYearValues, yearsForAllocation, yearMaxWeekly, workWeeksHint]);

  const targetPercentPreview = useMemo(() => {
    if (!targetPercentCalc) return null;
    return { value: targetPercentCalc.volume, unit: targetPercentCalc.unit };
  }, [targetPercentCalc]);

  const targetPercentAlreadyBelow = targetPercentCalc?.alreadyAtOrBelow ?? false;
  const targetPercentInsufficient = targetPercentCalc?.insufficient ?? false;

  const executionYearsLabel = useMemo(() => {
    const yrs = yearMode === 'single' ? [year] : [...selectedYears].sort((a, b) => a - b);
    return yrs.join(', ');
  }, [yearMode, year, selectedYears]);

  const normType = (t: unknown) => String(t ?? '').trim();
  const sameGroup = (m: { type?: string }) => {
    const g = normType(sourceMachineType);
    return g !== '' && normType(m.type) === g;
  };
  const machinesAvailableAsNewAlt = allMachinesList
    .filter((m) => m.id !== machineId && !alternativesList.some((a: any) => a.id === m.id))
    .sort((a, b) => {
      const aSame = sameGroup(a);
      const bSame = sameGroup(b);
      if (aSame && !bSame) return -1;
      if (!aSame && bSame) return 1;
      const byType = normType(a.type).localeCompare(normType(b.type), 'pl', { sensitivity: 'base' });
      if (byType !== 0) return byType;
      return compareInternalMachineNumbers(a.internal_number, b.internal_number);
    });

  const freeCandidates = candidates.filter((c) => c.load_percent < 90);

  const addNewAlternative = () => {
    const altId = Number(addAltId);
    if (!Number.isFinite(altId) || altId <= 0) return;
    setAddingAlt(true);
    setMessage(null);
    pendingSelectTargetMachineId.current = altId;
    api.alternatives
      .add(machineId, altId)
      .then(() => {
        setAddAltId('');
        setMessage({ type: 'ok', text: t('calculator.altAdded') });
        loadAllocationData();
      })
      .catch((e) => {
        pendingSelectTargetMachineId.current = null;
        setMessage({ type: 'err', text: te(e.message) || t('calculator.altAddFail') });
      })
      .finally(() => setAddingAlt(false));
  };

  const execute = () => {
    const yearsToExecute = (yearMode === 'single' ? [year] : selectedYears)
      .filter((y, idx, arr) => arr.indexOf(y) === idx)
      .sort((a, b) => a - b);
    if (!opId || !targetId || yearsToExecute.length === 0) {
      setMessage({ type: 'err', text: t('calculator.allocation.selectOpMachineYear') });
      return;
    }
    if (!selectedOp) {
      setMessage({ type: 'err', text: t('calculator.allocation.operation') });
      return;
    }
    if (transferMode !== 'full' && yearsToExecute.length === 1 && selectedGroupWeekly <= 1e-9) {
      setMessage({ type: 'err', text: t('calculator.allocation.volumePositive') });
      return;
    }
    if (transferMode === 'manual') {
      if (valueMode === 'global') {
        const vol = Number(volumeToMove);
        if (!volumeToMove || vol <= 0) {
          setMessage({ type: 'err', text: t('calculator.allocation.volumePositive') });
          return;
        }
      } else {
        const invalidYear = yearsToExecute.find((y) => {
          const entry = perYearValues[y];
          const vol = Number(entry?.value ?? '');
          return !entry?.value || !Number.isFinite(vol) || vol <= 0;
        });
        if (invalidYear != null) {
          setMessage({ type: 'err', text: t('calculator.allocation.volumeYearRequired', { year: invalidYear }) });
          return;
        }
      }
    }
    if (transferMode === 'targetPercent' && targetPercentCalc?.alreadyAtOrBelow) {
      setMessage({
        type: 'err',
        text: t('calculator.allocation.alreadyBelowRemaining', {
          current: targetPercentHint?.current_load_percent ?? '—',
          target: sourceTargetLoadPercent,
        }),
      });
      return;
    }
    if (transferMode === 'targetPercent' && (targetPercentHint == null || targetPercentCalc == null)) {
      setMessage({ type: 'err', text: t('common.loading') });
      return;
    }
    if (targetCycleMode === 'custom') {
      const cv = Number(customCycleSeconds);
      if (!String(customCycleSeconds).trim() || !Number.isFinite(cv) || cv <= 0) {
        setMessage({ type: 'err', text: t('calculator.allocation.customCycleRequired') });
        return;
      }
    }
    if (targetCycleMode === 'alternative' && altCycleSeconds == null) {
      setMessage({ type: 'err', text: t('calculator.allocation.noAltCycle') });
      return;
    }
    const cyclePayload =
      targetCycleMode === 'custom'
        ? { cycleTimeSecondsOnTarget: Number(customCycleSeconds) }
        : targetCycleMode === 'alternative'
          ? { useAlternativeCycleOnTarget: true as const }
          : {};
    setMessage(null);
    setExecuting(true);
    (async () => {
      const workWeeksBase = effectiveLoadHint?.working_weeks_per_year ?? loadHint?.working_weeks_per_year ?? 48;
      const multiYearBatch = yearsToExecute.length > 1;

      const yearData = await Promise.all(
        yearsToExecute.map(async (yearItem) => {
          const opsForYear = await api.machines.operations(machineId, { year: yearItem, ...allocScenarioParams });
          const groupOps = (opsForYear || []).filter((o: any) => operationGroupKey(o) === selectedGroupKey);
          const totalWeeklyForYear = groupOps.reduce((sum: number, o: any) => sum + Math.max(0, operationWeekly(o)), 0);
          const py = perYearValues[yearItem];
          const moveVolume = valueMode === 'perYear' ? Number(py?.value ?? 0) : Number(volumeToMove);
          const moveUnit = valueMode === 'perYear' ? (py?.unit ?? volumeUnit) : volumeUnit;
          const requestedWeekly = volumeToWeeklyClient(moveVolume, moveUnit, workWeeksBase);

          let hintForYear: AllocationLoadHint | null = null;
          if (transferMode === 'targetPercent') {
            const repOp = groupOps.find((o: any) => Number(o.id) === Number(opId)) ?? groupOps[0];
            let apiHintY: AllocationLoadHint | null = null;
            try {
              const groupIds = groupOps.map((o: any) => Number(o.id)).filter((id: number) => Number.isFinite(id) && id > 0);
              const h = await api.allocation.hint(machineId, {
                year: yearItem,
                operationId: opId as number,
                operationIds: groupIds.length ? groupIds.join(',') : String(opId),
                ...allocScenarioParams,
              });
              if (h && typeof (h as { error?: string }).error !== 'string') {
                const calcPct = calculatorLoadPercentForYear(calculatorYears, yearItem);
                apiHintY = applyCalculatorMachineLoadPercent(h as AllocationLoadHint, calcPct);
              }
            } catch {
              apiHintY = null;
            }
            hintForYear = buildTargetPercentHint({
              machineLoadPercent: calculatorLoadPercentForYear(calculatorYears, yearItem),
              groupWeeklyMovable: totalWeeklyForYear,
              selectedOp: repOp,
              calculatorYears,
              year: yearItem,
              apiHint: apiHintY,
            });
          }

          const contributors = groupOps
            .map((o: any) => ({ id: Number(o.id), weekly: Math.max(0, operationWeekly(o)) }))
            .filter((o: { id: number; weekly: number }) => o.weekly > 1e-9)
            .sort((a: { id: number; weekly: number }, b: { id: number; weekly: number }) => b.weekly - a.weekly);

          return {
            yearItem,
            groupOps,
            totalWeeklyForYear,
            requestedWeekly,
            moveVolume,
            moveUnit,
            hintForYear,
            contributors,
          };
        })
      );

      const zeroYears = yearData.filter((d) => d.groupOps.length > 0 && d.totalWeeklyForYear <= 1e-9).map((d) => d.yearItem);
      if (zeroYears.length > 0) {
        throw new Error(t('calculator.allocation.zeroVolumeYears', { years: zeroYears.join(', ') }));
      }
      const missingOpYears = yearData.filter((d) => d.groupOps.length === 0).map((d) => d.yearItem);
      if (missingOpYears.length > 0) {
        throw new Error(`Operacja nie występuje w latach: ${missingOpYears.join(', ')}.`);
      }

      if (!multiYearBatch) {
        const d0 = yearData[0];
        const hint0 =
          transferMode === 'targetPercent'
            ? d0.hintForYear ??
              (d0.yearItem === year && targetPercentHint != null ? targetPercentHint : null)
            : effectiveLoadHint ?? d0.hintForYear ?? loadHint;
        const requestedWeekly =
          transferMode === 'full'
            ? d0.totalWeeklyForYear
            : transferMode === 'targetPercent'
              ? hint0 != null
                ? computeVolumeForRemainingMachineLoad(hint0, sourceTargetLoadPercent, d0.totalWeeklyForYear)
                    .moveWeeklyEffective
                : 0
              : d0.requestedWeekly;
        const resolved = resolveAllocationWeeklyForYear(
          transferMode,
          d0.totalWeeklyForYear,
          requestedWeekly,
          hint0,
          sourceTargetLoadPercent,
          d0.totalWeeklyForYear
        );
        if (resolved.effectiveWeekly <= 1e-9) {
          throw new Error(t('calculator.allocation.volumePositive'));
        }
        const execPlansSingle: {
          yearItem: number;
          effectiveWeekly: number;
          capped: boolean;
          cappedByTargetPercent: boolean;
          contributors: typeof d0.contributors;
        }[] = [
          {
            yearItem: d0.yearItem,
            effectiveWeekly: resolved.effectiveWeekly,
            capped: resolved.capped,
            cappedByTargetPercent: resolved.cappedByTargetPercent,
            contributors: d0.contributors,
          },
        ];
        if (execPlansSingle.length === 0) {
          throw new Error(t('calculator.allocation.allocationNoneDone'));
        }
        for (const plan of execPlansSingle) {
          let remainingWeekly = plan.effectiveWeekly;
          for (const c of plan.contributors) {
            if (remainingWeekly <= 1e-9) break;
            const partWeekly = Math.min(remainingWeekly, c.weekly);
            const body: {
              operationId: number;
              targetMachineId: number;
              volumeToMove: number;
              volumeUnit: string;
              year: number;
              cycleTimeSecondsOnTarget?: number | null;
              useAlternativeCycleOnTarget?: boolean;
              scenarioId?: number;
              useContractualVolumes?: boolean;
            } = {
              operationId: c.id,
              targetMachineId: targetId as number,
              volumeToMove: partWeekly,
              volumeUnit: 'weekly',
              year: plan.yearItem,
              ...cyclePayload,
            };
            if (scenarioId != null && scenarioId > 0) body.scenarioId = scenarioId;
            if (useContractualVolumes) body.useContractualVolumes = true;
            await api.allocation.execute(body);
            remainingWeekly -= partWeekly;
          }
          if (remainingWeekly > 1e-6) {
            throw new Error(t('calculator.allocation.allocationCoverFailed', { year: plan.yearItem }));
          }
        }
        const yearsDone = execPlansSingle.map((p) => p.yearItem);
        const cappedTargetYears = execPlansSingle.filter((p) => p.cappedByTargetPercent).map((p) => p.yearItem);
        const cappedManualYears = execPlansSingle.filter((p) => p.capped && !p.cappedByTargetPercent).map((p) => p.yearItem);
        let text =
          yearsDone.length > 0
            ? t('calculator.allocation.allocationDoneYear', { year: yearsDone[0] })
            : t('calculator.allocation.allocationDoneYear', { year: yearsToExecute[0] });
        if (cappedTargetYears.length > 0) {
          text += t('calculator.allocation.allocationCapped', {
            years: cappedTargetYears.join(', '),
            percent: sourceTargetLoadPercent,
          });
        }
        if (cappedManualYears.length > 0) {
          text += t('calculator.allocation.allocationCappedManual', { years: cappedManualYears.join(', ') });
        }
        setMessage({ type: 'ok', text });
        lastAppliedHintKey.current = '';
        loadAllocationData();
        onSuccess?.();
        return { handled: true as const };
      } else if (transferMode === 'manual') {
        const invalidReq = yearData.find((d) => !Number.isFinite(d.requestedWeekly) || d.requestedWeekly <= 0);
        if (invalidReq) {
          throw new Error(t('calculator.allocation.volumeYearRequired', { year: invalidReq.yearItem }));
        }
      }

      type ExecPlan = {
        yearItem: number;
        effectiveWeekly: number;
        capped: boolean;
        cappedByTargetPercent: boolean;
        contributors: { id: number; weekly: number }[];
      };
      const execPlans: ExecPlan[] = [];
      const skippedLow: number[] = [];

      for (const d of yearData) {
        const hintY =
          transferMode === 'targetPercent'
            ? d.hintForYear
            : multiYearBatch
              ? d.hintForYear
              : effectiveLoadHint ?? d.hintForYear ?? loadHint;
        const requestedWeekly =
          transferMode === 'full'
            ? d.totalWeeklyForYear
            : transferMode === 'targetPercent'
              ? hintY != null
                ? computeVolumeForRemainingMachineLoad(hintY, sourceTargetLoadPercent, d.totalWeeklyForYear)
                    .moveWeeklyEffective
                : 0
              : d.requestedWeekly;
        const resolved = resolveAllocationWeeklyForYear(
          transferMode,
          d.totalWeeklyForYear,
          requestedWeekly,
          hintY,
          sourceTargetLoadPercent,
          d.totalWeeklyForYear
        );
        if (resolved.effectiveWeekly <= 1e-6) {
          if (transferMode !== 'full' && d.requestedWeekly > 1e-6) skippedLow.push(d.yearItem);
          continue;
        }
        execPlans.push({
          yearItem: d.yearItem,
          effectiveWeekly: resolved.effectiveWeekly,
          capped: resolved.capped,
          cappedByTargetPercent: resolved.cappedByTargetPercent,
          contributors: d.contributors,
        });
      }

      if (execPlans.length === 0) {
        throw new Error(
          t('calculator.allocation.allocationNoneDone')
        );
      }

      for (const plan of execPlans) {
        let remainingWeekly = plan.effectiveWeekly;
        for (const c of plan.contributors) {
          if (remainingWeekly <= 1e-9) break;
          const partWeekly = Math.min(remainingWeekly, c.weekly);
          const body: {
            operationId: number;
            targetMachineId: number;
            volumeToMove: number;
            volumeUnit: string;
            year: number;
            cycleTimeSecondsOnTarget?: number | null;
            useAlternativeCycleOnTarget?: boolean;
            scenarioId?: number;
            useContractualVolumes?: boolean;
          } = {
            operationId: c.id,
            targetMachineId: targetId as number,
            volumeToMove: partWeekly,
            volumeUnit: 'weekly',
            year: plan.yearItem,
            ...cyclePayload,
          };
          if (scenarioId != null && scenarioId > 0) body.scenarioId = scenarioId;
          if (useContractualVolumes) body.useContractualVolumes = true;
          await api.allocation.execute(body);
          remainingWeekly -= partWeekly;
        }
        if (remainingWeekly > 1e-6) {
          throw new Error(t('calculator.allocation.allocationCoverFailed', { year: plan.yearItem }));
        }
      }

      return { handled: false as const, execPlans, skippedLow, multiYearBatch };
    })()
      .then((meta) => {
        if (!meta || meta.handled) return;
        const yearsDone = meta.execPlans.map((p) => p.yearItem);
        const cappedTargetYears = meta.execPlans.filter((p) => p.cappedByTargetPercent).map((p) => p.yearItem);
        const cappedManualYears = meta.execPlans
          .filter((p) => p.capped && !p.cappedByTargetPercent)
          .map((p) => p.yearItem);
        let text =
          meta.multiYearBatch && yearsDone.length > 0
            ? t('calculator.allocation.allocationDoneYears', { years: yearsDone.join(', ') })
            : t('calculator.allocation.allocationDoneYear', { year: yearsToExecute[0] });
        if (cappedTargetYears.length > 0) {
          text += t('calculator.allocation.allocationCapped', {
            years: cappedTargetYears.join(', '),
            percent: sourceTargetLoadPercent,
          });
        }
        if (cappedManualYears.length > 0) {
          text += t('calculator.allocation.allocationCappedManual', { years: cappedManualYears.join(', ') });
        }
        if (meta.skippedLow.length > 0) {
          text += t('calculator.allocation.allocationSkipped', { years: meta.skippedLow.join(', ') });
        }
        setMessage({
          type: 'ok',
          text,
        });
        lastAppliedHintKey.current = '';
        loadAllocationData();
        onSuccess?.();
      })
      .catch((e) => {
        const msg = String(e?.message || '');
        setMessage({ type: 'err', text: (te(msg) !== msg ? te(msg) : msg) || t('common.error') });
      })
      .finally(() => setExecuting(false));
  };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 620, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h2 style={{ marginTop: 0 }}>{t('calculator.allocation.modalTitle', { number: internalNumber })}</h2>
        <div style={{ marginBottom: 12, border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <strong>{t('calculator.allocation.scopeLabel')}:</strong>
            <label>
              <input type="radio" name="allocationScopeYearMode" checked={yearMode === 'single'} onChange={() => {
                setYearMode('single');
                setSelectedYears([year]);
              }} />
              {' '}
              {t('calculator.yearModeSingle')}
            </label>
            <label>
              <input type="radio" name="allocationScopeYearMode" checked={yearMode === 'multi'} onChange={() => {
                setYearMode('multi');
                if (selectedYears.length === 0) setSelectedYears([year]);
              }} />
              {' '}
              {t('calculator.allocation.yearModeMulti')}
            </label>
          </div>
          {yearMode === 'single' ? (
            <label>
              {t('calculator.allocation.yearLabel')}{' '}
              <SearchableSelect
                value={year}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setYear(y);
                  setSelectedYears([y]);
                  if (valueMode === 'perYear') {
                    setPerYearValues((prev) => ({
                      ...prev,
                      [y]: {
                        value: prev[y]?.value || volumeToMove,
                        unit: volumeUnit,
                      },
                    }));
                  }
                }}
                style={{ padding: 4 }}
              >
                {yearRange.map((y) => <option key={y} value={y}>{y}</option>)}
              </SearchableSelect>
            </label>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <button type="button" onClick={() => setSelectedYears([...yearRange])} style={{ padding: '2px 8px', fontSize: 12 }}>
                  {t('common.selectAll')}
                </button>
                <button type="button" onClick={() => setSelectedYears([])} style={{ padding: '2px 8px', fontSize: 12 }}>
                  {t('calculator.allocation.clearYears')}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {yearRange.map((y) => {
                  const checked = selectedYears.includes(y);
                  return (
                    <label key={y} style={{ border: '1px solid #ddd', borderRadius: 4, padding: '2px 6px' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedYears((prev) => [...prev, y].sort((a, b) => a - b));
                            if (valueMode === 'perYear') {
                              setPerYearValues((prev) => ({
                                ...prev,
                                [y]: {
                                  value: prev[y]?.value || volumeToMove,
                                  unit: volumeUnit,
                                },
                              }));
                            }
                          } else {
                            setSelectedYears((prev) => prev.filter((v) => v !== y));
                          }
                        }}
                      />
                      {' '}{y}
                    </label>
                  );
                })}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                {t('calculator.allocation.selectedYearsSummary', {
                  years:
                    selectedYears.length > 0
                      ? [...selectedYears].sort((a, b) => a - b).join(', ')
                      : t('calculator.allocation.selectedYearsNone'),
                })}
              </div>
            </div>
          )}
          <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 600, color: '#1565c0' }}>
            {t('calculator.allocation.executionYearsNotice', { years: executionYearsLabel })}
          </p>
        </div>
        <p style={{ color: '#666' }}>{t('calculator.allocation.freeMachines', { year })}</p>
        {loading ? (
          <p>{t('common.loading')}</p>
        ) : (
          <>
            {candidates.length === 0 ? (
              <p style={{ color: '#b45309', marginBottom: 8, fontSize: 14 }}>{t('calculator.allocation.noCandidatesHint')}</p>
            ) : freeCandidates.length === 0 ? (
              <p style={{ color: '#666', marginBottom: 8, fontSize: 14 }}>{t('calculator.allocation.noFreeCandidatesHint')}</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>{t('calculator.allocation.colNr')}</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>{t('calculator.allocation.colType')}</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>{t('calculator.allocation.colLoadPct')}</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>{t('calculator.allocation.colFreeCap')}</th>
                  </tr>
                </thead>
                <tbody>
                  {freeCandidates.map((c) => (
                    <tr key={c.machine_id}>
                      <td style={{ padding: '0.75rem' }}>{c.internal_number}</td>
                      <td style={{ padding: '0.75rem' }}>{c.type}</td>
                      <td style={{ padding: '0.75rem' }}>{c.load_percent}%</td>
                      <td style={{ padding: '0.75rem' }}>{c.free_capacity_sec_per_week}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: '1rem' }}>
              <h3 style={{ marginTop: 0, fontSize: 16 }}>{t('calculator.allocation.alternatives')}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <label style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  {t('calculator.allocation.altMachine')}{' '}
                  <SearchableSelect
                    value={candidates.length === 0 ? '' : String(targetId)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTargetId(v === '' ? '' : Number(v));
                    }}
                    disabled={candidates.length === 0}
                    style={{ minWidth: 180 }}
                    title={t('calculator.allocation.candidatesDropdownTitle')}
                  >
                    {candidates.length === 0 ? (
                      <option value="">{t('calculator.allocation.selectAltFirst')}</option>
                    ) : (
                      candidates.map((c) => (
                        <option key={c.machine_id} value={c.machine_id}>
                          {c.internal_number} ({c.type}){c.load_percent >= 90 ? ` — ${c.load_percent}%` : ''}
                        </option>
                      ))
                    )}
                  </SearchableSelect>
                </label>
                <SearchableSelect
                  value={addAltId}
                  onChange={(e) => setAddAltId(e.target.value)}
                  style={{ padding: '4px 6px', maxWidth: 200 }}
                  title={t('calculator.allocation.addAltDropdownTitle')}
                >
                  <option value="">{t('calculator.allocation.addAlt')}</option>
                  {machinesAvailableAsNewAlt.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.internal_number} ({m.type})
                    </option>
                  ))}
                </SearchableSelect>
                <button
                  type="button"
                  onClick={addNewAlternative}
                  disabled={addingAlt || !addAltId}
                  style={{ padding: '4px 10px', fontSize: 13, background: '#2196f3', color: 'white', border: 'none', borderRadius: 4 }}
                >
                  {addingAlt ? t('common.saving') : t('calculator.allocation.saveAlt')}
                </button>
              </div>
            </div>
            {message && <p style={{ color: message.type === 'err' ? 'var(--cap-red)' : 'var(--cap-green)', marginBottom: 8 }}>{message.text}</p>}
            {operations.length > 0 ? (
              <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>{t('calculator.allocation.executeTitle')}</h3>
                <div style={{ display: 'grid', gap: '0.5rem', marginBottom: 8 }}>
                  <label>{t('calculator.allocation.operation')}{' '}
                    <SearchableSelect value={opId} onChange={(e) => setOpId(Number(e.target.value))}>
                      {groupedOperations.map((g) => {
                        const ev = Math.round(g.displayValue * 1000) / 1000;
                        const eu = g.displayUnit as string;
                        const unitLbl = volumeUnitLabel(eu as VolumeUnit);
                        const totalWeeklyRounded = Math.round(g.totalWeekly * 1000) / 1000;
                        return (
                          <option key={g.key} value={g.representativeId}>
                            {t('calculator.allocation.operationLine', {
                              part: g.partDesignation,
                              phase: g.phaseName,
                              year,
                              value: ev,
                              unit: unitLbl,
                              weekly: totalWeeklyRounded,
                              weeklyLabel: t('calculator.allocation.weeklyLabel'),
                            })}
                          </option>
                        );
                      })}
                    </SearchableSelect>
                  </label>
                  {(displayedMachineLoadPercent != null || hintLoading) && (
                    <div style={{ fontSize: 12, color: '#555' }}>
                      {displayedMachineLoadPercent != null
                        ? t('calculator.allocation.currentLoad', { pct: displayedMachineLoadPercent })
                        : hintLoading
                          ? t('common.loading')
                          : null}
                      {maxMovableInSelectedUnit != null && transferMode !== 'full' && (
                        <span style={{ marginLeft: 10 }}>
                          · {t('calculator.allocation.maxVolume', { max: maxMovableInSelectedUnit, unit: selectedUnitLabel })}
                        </span>
                      )}
                    </div>
                  )}
                  <fieldset className="allocation-transfer-modes">
                    <legend>{t('calculator.allocation.transferModeTitle')}</legend>
                    <label className="allocation-mode-option">
                      <span className="allocation-mode-head">
                        <input
                          type="radio"
                          name="transferMode"
                          checked={transferMode === 'full'}
                          onChange={() => setTransferMode('full')}
                        />
                        <span>
                          {t('calculator.allocation.modeFull')}
                          <span className="allocation-mode-help">{t('calculator.allocation.modeFullHelp')}</span>
                        </span>
                      </span>
                    </label>
                    <label className="allocation-mode-option">
                      <span className="allocation-mode-head">
                        <input
                          type="radio"
                          name="transferMode"
                          checked={transferMode === 'manual'}
                          onChange={() => setTransferMode('manual')}
                        />
                        <span>
                          {t('calculator.allocation.modeManual')}
                          <span className="allocation-mode-help">{t('calculator.allocation.modeManualHelp')}</span>
                        </span>
                      </span>
                      {transferMode === 'manual' && (
                        <div className="allocation-mode-body">
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span>{t('calculator.allocation.volumeToMove')}</span>
                            <input
                              type="number"
                              min={0}
                              value={volumeToMove}
                              onChange={(e) => setVolumeToMove(e.target.value)}
                              style={{ width: 110 }}
                            />
                            <SearchableSelect value={volumeUnit} onChange={(e) => setVolumeUnit(e.target.value as VolumeUnit)}>
                              <option value="annual">{t('common.unitAnnual')}</option>
                              <option value="monthly">{t('common.unitMonthly')}</option>
                              <option value="weekly">{t('common.unitWeekly')}</option>
                            </SearchableSelect>
                          </div>
                          {manualExceedsYears.length > 0 && (
                            <p className="allocation-warn">
                              {t('calculator.allocation.manualExceedsWarning', { years: manualExceedsYears.join(', ') })}
                            </p>
                          )}
                          {remainingLoadPercent != null && (
                            <p style={{ color: '#555', margin: '6px 0 0', fontSize: 12 }}>
                              {t('calculator.allocation.remainingLoad', { pct: remainingLoadPercent })}
                            </p>
                          )}
                          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #ddd' }}>
                            <label style={{ marginRight: 12, fontSize: 12 }}>
                              <input type="radio" name="valueMode" checked={valueMode === 'global'} onChange={() => setValueMode('global')} />
                              {' '}
                              {t('calculator.allocation.sameForAllYears')}
                            </label>
                            <label style={{ fontSize: 12 }}>
                              <input
                                type="radio"
                                name="valueMode"
                                checked={valueMode === 'perYear'}
                                onChange={() => {
                                  setValueMode('perYear');
                                  setPerYearValues((prev) => {
                                    const next = { ...prev };
                                    yearsForAllocation.forEach((y) => {
                                      next[y] = { value: next[y]?.value || volumeToMove, unit: volumeUnit };
                                    });
                                    return next;
                                  });
                                }}
                              />
                              {' '}
                              {t('calculator.allocation.perYear')}
                            </label>
                            {valueMode === 'perYear' && (
                              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 12 }}>
                                <thead>
                                  <tr style={{ background: '#fafafa' }}>
                                    <th style={{ textAlign: 'left', padding: 6 }}>{t('common.year')}</th>
                                    <th style={{ textAlign: 'left', padding: 6 }}>{t('common.value')}</th>
                                    <th style={{ textAlign: 'left', padding: 6 }}>{t('common.unit')}</th>
                                    <th style={{ textAlign: 'left', padding: 6 }}>{t('calculator.allocation.maxCol')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {yearsForAllocation.map((y) => {
                                    const maxW = yearMaxWeekly[y] ?? 0;
                                    const u = (perYearValues[y]?.unit ?? volumeUnit) as VolumeUnit;
                                    const maxDisp = Math.round(weeklyToVolumeClient(maxW, u, workWeeksHint) * 1000) / 1000;
                                    return (
                                      <tr key={y}>
                                        <td style={{ padding: 6 }}>{y}</td>
                                        <td style={{ padding: 6 }}>
                                          <input
                                            type="number"
                                            min={0}
                                            value={perYearValues[y]?.value ?? ''}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              setPerYearValues((prev) => ({ ...prev, [y]: { value: v, unit: prev[y]?.unit ?? volumeUnit } }));
                                            }}
                                            style={{ width: 100 }}
                                          />
                                        </td>
                                        <td style={{ padding: 6 }}>
                                          <SearchableSelect
                                            value={u}
                                            onChange={(e) => {
                                              const nu = e.target.value as VolumeUnit;
                                              setPerYearValues((prev) => ({ ...prev, [y]: { value: prev[y]?.value ?? '', unit: nu } }));
                                            }}
                                          >
                                            <option value="annual">{t('common.unitAnnual')}</option>
                                            <option value="monthly">{t('common.unitMonthly')}</option>
                                            <option value="weekly">{t('common.unitWeekly')}</option>
                                          </SearchableSelect>
                                        </td>
                                        <td style={{ padding: 6, color: '#666' }}>
                                          {maxDisp} {volumeUnitLabel(u)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      )}
                    </label>
                    <label className="allocation-mode-option">
                      <span className="allocation-mode-head">
                        <input
                          type="radio"
                          name="transferMode"
                          checked={transferMode === 'targetPercent'}
                          onChange={() => setTransferMode('targetPercent')}
                        />
                        <span>
                          {t('calculator.allocation.modeTargetPercent')}
                          <span className="allocation-mode-help">{t('calculator.allocation.modeTargetPercentHelp')}</span>
                        </span>
                      </span>
                      {transferMode === 'targetPercent' && (
                        <div className="allocation-mode-body">
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {t('calculator.allocation.targetLoad')}
                            <input
                              type="number"
                              min={1}
                              max={300}
                              step={1}
                              value={sourceTargetLoadPercent}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                setSourceTargetLoadPercent(Number.isFinite(n) ? Math.min(300, Math.max(1, Math.round(n))) : 100);
                              }}
                              style={{ width: 56, padding: 4 }}
                              title={t('calculator.allocation.targetLoadInputTitle')}
                            />
                            <span style={{ color: '#666' }}>%</span>
                          </label>
                          {targetPercentAlreadyBelow && effectiveLoadHint != null && (
                            <p className="allocation-warn" style={{ marginTop: 8 }}>
                              {t('calculator.allocation.alreadyBelowRemaining', {
                                current: effectiveLoadHint.current_load_percent,
                                target: sourceTargetLoadPercent,
                              })}
                            </p>
                          )}
                          {targetPercentPreview != null && !targetPercentAlreadyBelow && (
                            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#37474f' }}>
                              {t('calculator.allocation.targetPercentPreview', {
                                value: targetPercentPreview.value,
                                unit: volumeUnitLabel(targetPercentPreview.unit),
                              })}
                            </p>
                          )}
                          {targetPercentInsufficient && !targetPercentAlreadyBelow && (
                            <p className="allocation-warn">
                              {t('calculator.allocation.targetPercentInsufficient', { percent: sourceTargetLoadPercent })}
                            </p>
                          )}
                          {remainingLoadPercent != null && !targetPercentAlreadyBelow && (
                            <p style={{ color: '#555', margin: '6px 0 0', fontSize: 12 }}>
                              {t('calculator.allocation.remainingLoadAfter', { pct: remainingLoadPercent })}
                            </p>
                          )}
                        </div>
                      )}
                    </label>
                  </fieldset>
                  <div
                    style={{
                      marginTop: 4,
                      padding: '10px 12px',
                      background: '#f8f9fa',
                      border: '1px solid #e0e4e8',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#37474f' }}>
                      {t('calculator.allocation.targetCycleTitle')}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="targetCycleMode"
                        checked={targetCycleMode === 'unchanged'}
                        onChange={() => setTargetCycleMode('unchanged')}
                        style={{ marginTop: 3 }}
                      />
                      <span style={{ fontSize: 13 }}>
                        {t('calculator.allocation.cycleUnchanged')}
                        <span style={{ display: 'block', fontSize: 12, color: '#666', fontWeight: 400, marginTop: 2 }}>
                          {t('calculator.allocation.cycleUnchangedHelp')}
                        </span>
                      </span>
                    </label>
                    <label style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="targetCycleMode"
                        checked={targetCycleMode === 'custom'}
                        onChange={() => setTargetCycleMode('custom')}
                      />
                      <span style={{ fontSize: 13 }}>{t('calculator.allocation.cycleNew')}</span>
                      <input
                        type="number"
                        min={0.01}
                        step={1}
                        value={customCycleSeconds}
                        onChange={(e) => {
                          setCustomCycleSeconds(e.target.value);
                          setTargetCycleMode('custom');
                        }}
                        disabled={targetCycleMode !== 'custom'}
                        placeholder={t('calculator.allocation.cyclePlaceholder')}
                        style={{ width: 88, padding: 4, opacity: targetCycleMode === 'custom' ? 1 : 0.55 }}
                        title={t('calculator.allocation.cycleCustomTitle')}
                      />
                      <span style={{ fontSize: 13, color: '#666' }}>s</span>
                    </label>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        cursor: altCycleSeconds != null ? 'pointer' : 'not-allowed',
                        opacity: altCycleSeconds != null ? 1 : 0.5,
                      }}
                    >
                      <input
                        type="radio"
                        name="targetCycleMode"
                        checked={targetCycleMode === 'alternative'}
                        disabled={altCycleSeconds == null}
                        onChange={() => altCycleSeconds != null && setTargetCycleMode('alternative')}
                        style={{ marginTop: 3 }}
                      />
                      <span style={{ fontSize: 13 }}>
                        {t('calculator.allocation.cycleAlt')}
                        {altCycleSeconds != null ? (
                          <span style={{ display: 'block', fontSize: 12, color: '#5d4037', fontWeight: 400, marginTop: 2 }}>
                            {t('calculator.allocation.cycleAltSuggested', { seconds: altCycleSeconds })}
                            {selectedOp?.alt_nests_count != null && Number(selectedOp.alt_nests_count) > 0
                              ? ` · ${t('calculator.allocation.nests')}: ${selectedOp.alt_nests_count}`
                              : ''}
                            {selectedOp?.alt_oee_override != null && Number(selectedOp.alt_oee_override) > 0
                              ? ` · ${t('calculator.allocation.altOee')}: ${Math.round(Number(selectedOp.alt_oee_override) * 100)}%`
                              : ''}
                          </span>
                        ) : (
                          <span style={{ display: 'block', fontSize: 12, color: '#9e9e9e', fontWeight: 400, marginTop: 2 }}>
                            {t('calculator.allocation.cycleAltNo')}
                          </span>
                        )}
                      </span>
                    </label>
                  </div>
                </div>
                <button onClick={execute} disabled={executing || candidates.length === 0 || targetId === ''} style={{ padding: '0.5rem 1rem', background: 'var(--cap-green)', color: 'white', border: 'none', borderRadius: 4 }}>{executing ? t('common.saving') : t('calculator.allocation.execute')}</button>
              </div>
            ) : (
              <p style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee', color: '#666', fontSize: 14 }}>
                {t('calculator.allocation.noOpsInYear', { year })}
              </p>
            )}
          </>
        )}
        <button onClick={onClose} style={{ marginTop: 12, padding: '0.5rem 1rem', background: '#9e9e9e', color: 'white', border: 'none', borderRadius: 4 }}>{t('common.close')}</button>
      </div>
    </div>
  );
}
