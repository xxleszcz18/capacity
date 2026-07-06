import type {
  CurrentViewContext,
  VisualizationReportOptions,
  BreakdownDetailLevel,
  ChartGridCols,
} from '../../utils/visualizationReportOptions';
import { buildCurrentViewExcelOptions, buildCurrentViewReportOptions, canGenerateReport, countReportSections } from '../../utils/visualizationReportOptions';
import ChartGridLayoutPicker from './ChartGridLayoutPicker';
import { useI18n } from '../../context/I18nContext';

type Props = {
  open: boolean;
  options: VisualizationReportOptions;
  onChange: (opts: VisualizationReportOptions) => void;
  onConfirm: () => void;
  onCancel: () => void;
  generating: boolean;
  currentView: CurrentViewContext;
  selectedLineCount: number;
  selectedMachineCount: number;
  totalLineCount: number;
  totalMachineCount: number;
};

function CheckRow({
  label,
  checked,
  onChange,
  disabled,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 3 }} />
        <span>{label}</span>
      </label>
      {checked && children ? <div style={{ marginLeft: 26, marginTop: 6 }}>{children}</div> : null}
    </div>
  );
}

function ScopeRadio({
  value,
  onChange,
  selectedCount,
  totalCount,
}: {
  value: 'selected' | 'all';
  onChange: (v: 'selected' | 'all') => void;
  selectedCount: number;
  totalCount: number;
}) {
  const { t } = useI18n();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
      <label style={{ cursor: 'pointer' }}>
        <input type="radio" checked={value === 'selected'} onChange={() => onChange('selected')} style={{ marginRight: 6 }} />
        {t('modals.vizReport.selected', { count: selectedCount })}
      </label>
      <label style={{ cursor: 'pointer' }}>
        <input type="radio" checked={value === 'all'} onChange={() => onChange('all')} style={{ marginRight: 6 }} />
        {t('modals.vizReport.allInFilter', { count: totalCount })}
      </label>
    </div>
  );
}

function ModeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 200,
        textAlign: 'left',
        padding: '12px 14px',
        borderRadius: 8,
        border: active ? '2px solid var(--cap-green, #2e7d32)' : '1px solid #ddd',
        background: active ? '#f1f8e9' : '#fafafa',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: active ? '#1b5e20' : '#333' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#666', lineHeight: 1.45 }}>{description}</div>
    </button>
  );
}

function DetailLevelRadio({
  value,
  onChange,
}: {
  value: BreakdownDetailLevel;
  onChange: (v: BreakdownDetailLevel) => void;
}) {
  const { t } = useI18n();
  const levels: BreakdownDetailLevel[] = ['year', 'client', 'project', 'detail'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' }}>
      {levels.map((level) => (
        <label key={level} style={{ cursor: 'pointer' }}>
          <input type="radio" checked={value === level} onChange={() => onChange(level)} style={{ marginRight: 6 }} />
          {t(`modals.vizReport.detailLevel_${level}` as 'modals.vizReport.detailLevel_year')}
        </label>
      ))}
    </div>
  );
}

function CurrentViewSummary({ ctx }: { ctx: CurrentViewContext }) {
  const { t } = useI18n();
  const preview = buildCurrentViewReportOptions(ctx);

  const items: string[] = [];
  if (ctx.tab === 'lines') {
    items.push(t('modals.vizReport.currentViewTabLines'));
    items.push(
      ctx.lineChartCombined
        ? t('modals.vizReport.currentViewCombinedLines', { count: ctx.selectedLineCount })
        : t('modals.vizReport.currentViewSeparateLines', { count: ctx.selectedLineCount, cols: ctx.chartGridCols })
    );
    items.push(t('modals.vizReport.currentViewDataTables'));
  } else if (ctx.tab === 'machines') {
    items.push(t('modals.vizReport.currentViewTabMachines'));
    items.push(
      ctx.machineChartCombined
        ? t('modals.vizReport.currentViewCombinedMachines', { count: ctx.selectedMachineCount })
        : t('modals.vizReport.currentViewSeparateMachines', { count: ctx.selectedMachineCount, cols: ctx.chartGridCols })
    );
    items.push(t('modals.vizReport.currentViewDataTables'));
  } else {
    items.push(t('modals.vizReport.currentViewTabAnalytics'));
    items.push(t('modals.vizReport.currentViewAnalyticsContent'));
  }

  if (ctx.selectedLineCount === 0 && ctx.tab === 'lines') {
    return <p style={{ margin: 0, fontSize: 13, color: '#c62828' }}>{t('dataViz.selectOneLine')}</p>;
  }
  if (ctx.selectedMachineCount === 0 && ctx.tab === 'machines') {
    return <p style={{ margin: 0, fontSize: 13, color: '#c62828' }}>{t('dataViz.selectOneMachine')}</p>;
  }

  void preview;
  return (
    <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13, color: '#444', lineHeight: 1.55 }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
      <li>{t('modals.vizReport.currentViewExpansions')}</li>
      <li>{t('modals.vizReport.currentViewFilters')}</li>
    </ul>
  );
}

function ExcelDataSummary({ ctx }: { ctx: CurrentViewContext }) {
  const { t } = useI18n();
  const preview = buildCurrentViewExcelOptions(ctx);
  const items: string[] = [];

  if (preview.lineTables) items.push(t('modals.vizReport.lineTrends'));
  if (preview.machineTables) items.push(t('modals.vizReport.machineTrends'));
  if (preview.analyticsTable) items.push(t('modals.vizReport.analyticsTable'));
  if (preview.linesOverview) items.push(t('modals.vizReport.linesOverview'));

  if (ctx.tab === 'lines' && ctx.selectedLineCount === 0) {
    return <p style={{ margin: 0, fontSize: 13, color: '#c62828' }}>{t('dataViz.selectOneLine')}</p>;
  }
  if (ctx.tab === 'machines' && ctx.selectedMachineCount === 0) {
    return <p style={{ margin: 0, fontSize: 13, color: '#c62828' }}>{t('dataViz.selectOneMachine')}</p>;
  }

  return (
    <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13, color: '#444', lineHeight: 1.55 }}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
      <li>{t('modals.vizReport.excelNoCharts')}</li>
      <li>{t('modals.vizReport.currentViewFilters')}</li>
    </ul>
  );
}

function ExcelTablesSection({
  options,
  patch,
  selectedLineCount,
  selectedMachineCount,
  totalLineCount,
  totalMachineCount,
}: {
  options: VisualizationReportOptions;
  patch: (partial: Partial<VisualizationReportOptions>) => void;
  selectedLineCount: number;
  selectedMachineCount: number;
  totalLineCount: number;
  totalMachineCount: number;
}) {
  const { t } = useI18n();
  const excelSectionCount = countReportSections({ ...options, mode: 'excelData' });

  return (
    <>
      <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14 }}>{t('modals.vizReport.sectionTables')}</p>
      <CheckRow label={t('modals.vizReport.lineTrends')} checked={options.lineTables} onChange={(v) => patch({ lineTables: v })} disabled={totalLineCount === 0}>
        <ScopeRadio value={options.lineTablesScope} onChange={(lineTablesScope) => patch({ lineTablesScope })} selectedCount={selectedLineCount} totalCount={totalLineCount} />
      </CheckRow>
      <CheckRow label={t('modals.vizReport.machineTrends')} checked={options.machineTables} onChange={(v) => patch({ machineTables: v })} disabled={totalMachineCount === 0}>
        <ScopeRadio value={options.machineTablesScope} onChange={(machineTablesScope) => patch({ machineTablesScope })} selectedCount={selectedMachineCount} totalCount={totalMachineCount} />
      </CheckRow>
      <CheckRow label={t('modals.vizReport.linesOverview')} checked={options.linesOverview} onChange={(v) => patch({ linesOverview: v })} disabled={totalLineCount === 0} />
      <div style={{ marginLeft: 26, marginBottom: 12 }}>
        <p style={{ margin: '0 0 6px', fontSize: 13, color: '#666' }}>{t('modals.vizReport.detailLevelLabel')}</p>
        <DetailLevelRadio value={options.breakdownDetailLevel} onChange={(breakdownDetailLevel) => patch({ breakdownDetailLevel })} />
      </div>

      <p style={{ margin: '16px 0 12px', fontWeight: 600, fontSize: 14 }}>{t('modals.vizReport.sectionAnalytics')}</p>
      <CheckRow label={t('modals.vizReport.analyticsTable')} checked={options.analyticsTable} onChange={(v) => patch({ analyticsTable: v })} />
      <CheckRow label={t('modals.vizReport.analyticsSummary')} checked={options.analyticsSummary} onChange={(v) => patch({ analyticsSummary: v })} disabled={!options.analyticsTable} />

      {excelSectionCount === 0 && (
        <p style={{ fontSize: 13, color: '#c62828', margin: '12px 0 0' }}>{t('modals.vizReport.selectSection')}</p>
      )}
    </>
  );
}

export default function VisualizationReportModal({
  open,
  options,
  onChange,
  onConfirm,
  onCancel,
  generating,
  currentView,
  selectedLineCount,
  selectedMachineCount,
  totalLineCount,
  totalMachineCount,
}: Props) {
  const { t } = useI18n();
  if (!open) return null;

  const patch = (partial: Partial<VisualizationReportOptions>) => onChange({ ...options, ...partial });
  const isCurrentView = options.mode === 'currentView';
  const isExcelData = options.mode === 'excelData';
  const isAdvanced = options.mode === 'advanced';
  const canGenerate = canGenerateReport(options, currentView);
  const advancedSectionCount = countReportSections({ ...options, mode: 'advanced' });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="viz-report-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 16,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 10,
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <h2 id="viz-report-title" style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>
          {t('modals.vizReport.title')}
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#555', lineHeight: 1.5 }}>{t('modals.vizReport.intro')}</p>

        <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 14 }}>{t('modals.vizReport.modeLabel')}</p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <ModeCard
            active={isCurrentView}
            title={t('modals.vizReport.modeCurrentView')}
            description={t('modals.vizReport.modeCurrentViewDesc')}
            onClick={() => patch({ mode: 'currentView' })}
          />
          <ModeCard
            active={isAdvanced}
            title={t('modals.vizReport.modeAdvanced')}
            description={t('modals.vizReport.modeAdvancedDesc')}
            onClick={() => patch({ mode: 'advanced' })}
          />
          <ModeCard
            active={isExcelData}
            title={t('modals.vizReport.modeExcelData')}
            description={t('modals.vizReport.modeExcelDataDesc')}
            onClick={() => patch(buildCurrentViewExcelOptions(currentView))}
          />
        </div>

        {isCurrentView ? (
          <div style={{ padding: '12px 14px', background: '#f8f9fa', borderRadius: 8, border: '1px solid #eee', marginBottom: 16 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{t('modals.vizReport.currentViewTitle')}</p>
            <CurrentViewSummary ctx={currentView} />
          </div>
        ) : isExcelData ? (
          <>
            <div style={{ padding: '12px 14px', background: '#f8f9fa', borderRadius: 8, border: '1px solid #eee', marginBottom: 16 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{t('modals.vizReport.excelDataHintTitle')}</p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#555', lineHeight: 1.5 }}>{t('modals.vizReport.excelDataHint')}</p>
              <ExcelDataSummary ctx={currentView} />
            </div>
            <ExcelTablesSection
              options={options}
              patch={patch}
              selectedLineCount={selectedLineCount}
              selectedMachineCount={selectedMachineCount}
              totalLineCount={totalLineCount}
              totalMachineCount={totalMachineCount}
            />
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14 }}>{t('modals.vizReport.sectionCharts')}</p>
            <CheckRow label={t('modals.vizReport.lineCharts')} checked={options.lineCharts} onChange={(v) => patch({ lineCharts: v })} disabled={totalLineCount === 0}>
              <ScopeRadio value={options.lineChartsScope} onChange={(lineChartsScope) => patch({ lineChartsScope })} selectedCount={selectedLineCount} totalCount={totalLineCount} />
              <div style={{ marginTop: 8, fontSize: 13, color: '#555' }}>
                <label style={{ display: 'block', marginBottom: 4, cursor: 'pointer' }}>
                  <input type="radio" name="lineChartMode" checked={options.lineChartsMode === 'combined'} onChange={() => patch({ lineChartsMode: 'combined' })} style={{ marginRight: 6 }} />
                  {t('modals.vizReport.combinedChart')}
                </label>
                <label style={{ display: 'block', cursor: 'pointer' }}>
                  <input type="radio" name="lineChartMode" checked={options.lineChartsMode === 'separate'} onChange={() => patch({ lineChartsMode: 'separate' })} style={{ marginRight: 6 }} />
                  {t('modals.vizReport.separateLineCharts')}
                </label>
              </div>
              {options.lineChartsMode === 'separate' && (
                <div style={{ marginTop: 10 }}>
                  <ChartGridLayoutPicker value={options.chartGridCols} onChange={(chartGridCols: ChartGridCols) => patch({ chartGridCols })} />
                </div>
              )}
            </CheckRow>
            <CheckRow label={t('modals.vizReport.machineCharts')} checked={options.machineCharts} onChange={(v) => patch({ machineCharts: v })} disabled={totalMachineCount === 0}>
              <ScopeRadio value={options.machineChartsScope} onChange={(machineChartsScope) => patch({ machineChartsScope })} selectedCount={selectedMachineCount} totalCount={totalMachineCount} />
              <div style={{ marginTop: 8, fontSize: 13, color: '#555' }}>
                <label style={{ display: 'block', marginBottom: 4, cursor: 'pointer' }}>
                  <input type="radio" name="machineChartMode" checked={options.machineChartsMode === 'combined'} onChange={() => patch({ machineChartsMode: 'combined' })} style={{ marginRight: 6 }} />
                  {t('modals.vizReport.combinedMachineChart')}
                </label>
                <label style={{ display: 'block', cursor: 'pointer' }}>
                  <input type="radio" name="machineChartMode" checked={options.machineChartsMode === 'separate'} onChange={() => patch({ machineChartsMode: 'separate' })} style={{ marginRight: 6 }} />
                  {t('modals.vizReport.separateMachineCharts')}
                </label>
              </div>
              {options.machineChartsMode === 'separate' && (
                <div style={{ marginTop: 10 }}>
                  <ChartGridLayoutPicker value={options.chartGridCols} onChange={(chartGridCols: ChartGridCols) => patch({ chartGridCols })} />
                </div>
              )}
            </CheckRow>

            <p style={{ margin: '16px 0 12px', fontWeight: 600, fontSize: 14 }}>{t('modals.vizReport.sectionTables')}</p>
            <CheckRow label={t('modals.vizReport.lineTrends')} checked={options.lineTables} onChange={(v) => patch({ lineTables: v })} disabled={totalLineCount === 0}>
              <ScopeRadio value={options.lineTablesScope} onChange={(lineTablesScope) => patch({ lineTablesScope })} selectedCount={selectedLineCount} totalCount={totalLineCount} />
            </CheckRow>
            <CheckRow label={t('modals.vizReport.machineTrends')} checked={options.machineTables} onChange={(v) => patch({ machineTables: v })} disabled={totalMachineCount === 0}>
              <ScopeRadio value={options.machineTablesScope} onChange={(machineTablesScope) => patch({ machineTablesScope })} selectedCount={selectedMachineCount} totalCount={totalMachineCount} />
            </CheckRow>
            <CheckRow label={t('modals.vizReport.linesOverview')} checked={options.linesOverview} onChange={(v) => patch({ linesOverview: v })} disabled={totalLineCount === 0} />
            <div style={{ marginLeft: 26, marginBottom: 12 }}>
              <p style={{ margin: '0 0 6px', fontSize: 13, color: '#666' }}>{t('modals.vizReport.detailLevelLabel')}</p>
              <DetailLevelRadio value={options.breakdownDetailLevel} onChange={(breakdownDetailLevel) => patch({ breakdownDetailLevel })} />
            </div>

            <p style={{ margin: '16px 0 12px', fontWeight: 600, fontSize: 14 }}>{t('modals.vizReport.sectionAnalytics')}</p>
            <CheckRow label={t('modals.vizReport.analyticsTable')} checked={options.analyticsTable} onChange={(v) => patch({ analyticsTable: v })} />
            <CheckRow label={t('modals.vizReport.analyticsChart')} checked={options.analyticsChart} onChange={(v) => patch({ analyticsChart: v })} />
            <CheckRow label={t('modals.vizReport.analyticsSummary')} checked={options.analyticsSummary} onChange={(v) => patch({ analyticsSummary: v })} disabled={!options.analyticsTable} />

            {options.lineChartsMode === 'separate' && options.lineChartsScope === 'all' && totalLineCount > 12 && (
              <p style={{ fontSize: 12, color: '#e65100', margin: '8px 0 0' }}>{t('modals.vizReport.manyLinesWarn', { count: totalLineCount })}</p>
            )}
            {options.machineChartsMode === 'separate' && options.machineChartsScope === 'all' && totalMachineCount > 15 && (
              <p style={{ fontSize: 12, color: '#e65100', margin: '4px 0 0' }}>{t('modals.vizReport.manyMachinesWarn', { count: totalMachineCount })}</p>
            )}
            {advancedSectionCount === 0 && (
              <p style={{ fontSize: 13, color: '#c62828', margin: '12px 0 0' }}>{t('modals.vizReport.selectSection')}</p>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, paddingTop: 12, borderTop: '1px solid #eee' }}>
          <button type="button" onClick={onCancel} disabled={generating} style={{ padding: '0.5rem 1rem', border: '1px solid #ccc', borderRadius: 4, background: 'white' }}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={generating || !canGenerate}
            style={{
              padding: '0.5rem 1.2rem',
              background: 'var(--cap-green)',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              opacity: generating || !canGenerate ? 0.6 : 1,
            }}
          >
            {generating
              ? t('common.generating')
              : isExcelData
                ? t('modals.vizReport.generateExcel')
                : t('modals.vizReport.generatePdf')}
          </button>
        </div>
      </div>
    </div>
  );
}
