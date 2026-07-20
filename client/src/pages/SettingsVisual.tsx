import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useI18n } from '../context/I18nContext';
import { useReferenceDisplay } from '../context/ReferenceDisplayContext';
import { useReloadDataVizColors } from '../context/DataVizColorsContext';
import { normalizeMachineDisplayMode } from '../utils/machineLabel';
import {
  dataVizColorsFromVisualSettings,
  DEFAULT_DATA_VIZ_COLORS,
  colorPickerValue,
  normalizeHexColor,
} from '../utils/dataVizColors';
import {
  DEFAULT_CALL_OFF_IMPORT_PANEL,
  DEFAULT_WORKSPACE_THEMES,
  callOffImportPanelFromVisualSettings,
  flattenWorkspaceThemes,
  workspaceThemesFromVisualSettings,
  type WorkspaceThemeColors,
  type WorkspaceThemeSettings,
} from '../utils/workspaceTheme';

type VisualSettings = {
  show_alternative_borders: boolean;
  show_rfq_badge: boolean;
  colorize_load_cells: boolean;
  colorize_sum_row: boolean;
  colorize_avg_row: boolean;
  reference_display: 'sap' | 'alias' | 'both';
  machine_display: 'sap' | 'internal' | 'both';
  data_viz_machine_bar_label: 'sap' | 'internal' | 'both';
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
  data_viz_default_year_from: number;
  data_viz_default_year_to: number;
  data_viz_color_production: string;
  data_viz_color_contract: string;
  data_viz_color_scenario_production: string;
  data_viz_color_scenario_contract: string;
  data_viz_color_delta_negative: string;
  data_viz_color_delta_positive: string;
  data_viz_color_ref_line_overload: string;
  data_viz_color_ref_line_free: string;
  data_viz_compare_palette: string[];
  load_expansion_direction: 'horizontal' | 'vertical';
  show_sop_marker: boolean;
  show_eop_marker: boolean;
  period_month_header_color: string;
  period_month_frame_color: string;
  period_week_header_color: string;
  period_week_frame_color: string;
  workspace_calloffs_import_bg: string;
  workspace_calloffs_import_border: string;
  workspace_calloffs_import_accent: string;
  workspace_calloffs_import_table_header_bg: string;
} & ReturnType<typeof flattenWorkspaceThemes>;

function calendarYearNow(): number {
  return new Date().getFullYear();
}

function normalizeYearSetting(v: unknown, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return fallback;
  return n;
}

function normalizeVisualResponse(v: Record<string, unknown>): VisualSettings {
  const yearFrom = normalizeYearSetting(
    (v as { data_viz_default_year_from?: unknown }).data_viz_default_year_from,
    calendarYearNow() - 1
  );
  const yearTo = normalizeYearSetting(
    (v as { data_viz_default_year_to?: unknown }).data_viz_default_year_to,
    calendarYearNow() + 10
  );
  const colors = dataVizColorsFromVisualSettings(v);
  const workspaceFlat = flattenWorkspaceThemes(workspaceThemesFromVisualSettings(v));
  const importPanel = callOffImportPanelFromVisualSettings(v);
  return {
    ...(v as VisualSettings),
    machine_display: normalizeMachineDisplayMode((v as { machine_display?: string }).machine_display),
    data_viz_machine_bar_label: normalizeMachineDisplayMode(
      (v as { data_viz_machine_bar_label?: string }).data_viz_machine_bar_label ?? 'internal'
    ),
    contractual_calculator_frame_color:
      (v as { contractual_calculator_frame_color?: string }).contractual_calculator_frame_color ?? '#ff9800',
    calculator_page_size: (() => {
      const n = Number((v as { calculator_page_size?: unknown }).calculator_page_size);
      if ((v as { calculator_page_size?: unknown }).calculator_page_size === null) return 25;
      if ((v as { calculator_page_size?: unknown }).calculator_page_size === undefined) return 25;
      return n === 0 || n === 25 || n === 50 ? n : 25;
    })(),
    data_viz_default_year_from: Math.min(yearFrom, yearTo),
    data_viz_default_year_to: Math.max(yearFrom, yearTo),
    data_viz_color_production: colors.production,
    data_viz_color_contract: colors.contract,
    data_viz_color_scenario_production: colors.scenarioProduction,
    data_viz_color_scenario_contract: colors.scenarioContract,
    data_viz_color_delta_negative: colors.deltaNegative,
    data_viz_color_delta_positive: colors.deltaPositive,
    data_viz_color_ref_line_overload: colors.refLineOverload,
    data_viz_color_ref_line_free: colors.refLineFree,
    data_viz_compare_palette: colors.comparePalette,
    load_expansion_direction:
      (v as { load_expansion_direction?: string }).load_expansion_direction === 'vertical' ? 'vertical' : 'horizontal',
    show_sop_marker: (v as { show_sop_marker?: boolean }).show_sop_marker !== false,
    show_eop_marker: (v as { show_eop_marker?: boolean }).show_eop_marker !== false,
    period_month_header_color: String((v as { period_month_header_color?: string }).period_month_header_color ?? '#dbeafe'),
    period_month_frame_color: String((v as { period_month_frame_color?: string }).period_month_frame_color ?? '#3b82f6'),
    period_week_header_color: String((v as { period_week_header_color?: string }).period_week_header_color ?? '#e0e7ff'),
    period_week_frame_color: String((v as { period_week_frame_color?: string }).period_week_frame_color ?? '#6366f1'),
    workspace_calloffs_import_bg: importPanel.panel_bg,
    workspace_calloffs_import_border: importPanel.panel_border,
    workspace_calloffs_import_accent: importPanel.accent,
    workspace_calloffs_import_table_header_bg: importPanel.table_header_bg,
    ...workspaceFlat,
  };
}

const AUTO_SAVE_MS = 400;

export default function SettingsVisual() {
  const { t } = useI18n();
  const { reloadReferenceDisplay } = useReferenceDisplay();
  const reloadDataVizColors = useReloadDataVizColors();
  const [form, setForm] = useState<VisualSettings | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const skipNextSaveRef = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.settings.visual
      .get()
      .then((v) => {
        setForm(normalizeVisualResponse(v as Record<string, unknown>));
        setReady(true);
      })
      .catch((e) => setError(e.message || t('visual.readError')));
  }, [t]);

  const persist = useCallback(
    (payload: VisualSettings) => {
      setSaving(true);
      setError('');
      return api.settings.visual
        .update(payload)
        .then((v) => {
          skipNextSaveRef.current = true;
          setForm(normalizeVisualResponse(v as Record<string, unknown>));
          reloadReferenceDisplay();
          reloadDataVizColors();
          setMessage(t('common.saved'));
          if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
          messageTimerRef.current = setTimeout(() => setMessage(''), 2500);
        })
        .catch((e) => setError(e.message || t('visual.saveError')))
        .finally(() => setSaving(false));
    },
    [reloadReferenceDisplay, reloadDataVizColors, t]
  );

  useEffect(() => {
    if (!ready || !form) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persist(form);
    }, AUTO_SAVE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form, ready, persist]);

  useEffect(
    () => () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    },
    []
  );

  const setBool = (key: keyof VisualSettings, value: boolean) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };
  const setNum = (key: keyof VisualSettings, value: number) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };
  const setStr = (key: keyof VisualSettings, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };
  const setRefDisplay = (value: 'sap' | 'alias' | 'both') => {
    setForm((prev) => (prev ? { ...prev, reference_display: value } : prev));
  };
  const setMachineDisplay = (value: 'sap' | 'internal' | 'both') => {
    setForm((prev) => (prev ? { ...prev, machine_display: value } : prev));
  };

  const setMachineBarLabel = (value: 'sap' | 'internal' | 'both') => {
    setForm((prev) => (prev ? { ...prev, data_viz_machine_bar_label: value } : prev));
  };
  const setWorkspaceColor = (section: keyof WorkspaceThemeSettings, key: keyof WorkspaceThemeColors, value: string) => {
    const flatKey = `workspace_${section}_${key}` as keyof ReturnType<typeof flattenWorkspaceThemes>;
    setForm((prev) => (prev ? { ...prev, [flatKey]: value } : prev));
  };

  const workspaceSections: { id: keyof WorkspaceThemeSettings; titleKey: string; showBanner: boolean }[] = [
    { id: 'capacity', titleKey: 'visual.workspaceCapacity', showBanner: false },
    { id: 'scenarios', titleKey: 'visual.workspaceScenarios', showBanner: true },
    { id: 'calloffs', titleKey: 'visual.workspaceCallOffs', showBanner: true },
  ];

  if (!form) return <p>{t('common.loading')}</p>;

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/administracja/ustawienia-bazy" style={{ color: 'var(--cap-green)' }}>{t('settings.backDatabase')}</Link>
      </div>
      <h1 style={{ marginTop: 0 }}>{t('visual.title')}</h1>
      <p style={{ color: '#666', marginBottom: '0.5rem' }}>{t('visual.intro')}</p>
      {(saving || message || error) && (
        <p style={{ margin: '0 0 1rem', fontSize: 14, minHeight: 20 }}>
          {saving && <span style={{ color: '#666' }}>{t('common.saving')}</span>}
          {!saving && message && <span style={{ color: 'var(--cap-green)' }}>{message}</span>}
          {!saving && error && <span style={{ color: 'var(--cap-red)' }}>{error}</span>}
        </p>
      )}

      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('visual.detailRefs')}</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 10 }}>{t('visual.detailRefsHelp')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="refdisp" checked={form.reference_display === 'sap'} onChange={() => setRefDisplay('sap')} />
            {t('visual.sapOnly')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="refdisp" checked={form.reference_display === 'alias'} onChange={() => setRefDisplay('alias')} />
            {t('visual.aliasOnly')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="refdisp" checked={form.reference_display === 'both'} onChange={() => setRefDisplay('both')} />
            {t('visual.bothSapAlias')}
          </label>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('visual.machineRefs')}</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 10 }}>{t('visual.machineRefsHelp')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="machdisp" checked={form.machine_display === 'sap'} onChange={() => setMachineDisplay('sap')} />
            {t('visual.sapOnly')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="machdisp" checked={form.machine_display === 'internal'} onChange={() => setMachineDisplay('internal')} />
            {t('visual.internalOnly')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="machdisp" checked={form.machine_display === 'both'} onChange={() => setMachineDisplay('both')} />
            {t('visual.bothSapInternal')}
          </label>
        </div>
        <h4 style={{ margin: '18px 0 8px', fontSize: 14 }}>{t('visual.machineBarChartLabels')}</h4>
        <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 10 }}>{t('visual.machineBarChartLabelsHelp')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="machbarlabel"
              checked={form.data_viz_machine_bar_label === 'sap'}
              onChange={() => setMachineBarLabel('sap')}
            />
            {t('visual.sapOnly')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="machbarlabel"
              checked={form.data_viz_machine_bar_label === 'internal'}
              onChange={() => setMachineBarLabel('internal')}
            />
            {t('visual.internalOnly')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="machbarlabel"
              checked={form.data_viz_machine_bar_label === 'both'}
              onChange={() => setMachineBarLabel('both')}
            />
            {t('visual.bothSapInternal')}
          </label>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('visual.badges')}</h3>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={form.show_alternative_borders} onChange={(e) => setBool('show_alternative_borders', e.target.checked)} />
          <span style={{ marginLeft: 8 }}>{t('visual.altBorders')}</span>
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={form.show_rfq_badge} onChange={(e) => setBool('show_rfq_badge', e.target.checked)} />
          <span style={{ marginLeft: 8 }}>{t('visual.rfqBadge')}</span>
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={form.show_sop_marker} onChange={(e) => setBool('show_sop_marker', e.target.checked)} />
          <span style={{ marginLeft: 8 }}>{t('visual.sopMarker')}</span>
        </label>
        <label style={{ display: 'block' }}>
          <input type="checkbox" checked={form.show_eop_marker} onChange={(e) => setBool('show_eop_marker', e.target.checked)} />
          <span style={{ marginLeft: 8 }}>{t('visual.eopMarker')}</span>
        </label>
      </div>

      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('visual.loadExpansion')}</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 10 }}>{t('visual.loadExpansionHelp')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="loadexp"
              checked={form.load_expansion_direction === 'horizontal'}
              onChange={() => setForm((f) => (f ? { ...f, load_expansion_direction: 'horizontal' } : f))}
            />
            {t('visual.loadExpansionHorizontal')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="loadexp"
              checked={form.load_expansion_direction === 'vertical'}
              onChange={() => setForm((f) => (f ? { ...f, load_expansion_direction: 'vertical' } : f))}
            />
            {t('visual.loadExpansionVertical')}
          </label>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('visual.calculatorList')}</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 10 }}>{t('visual.pageSizeHelp')}</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {t('visual.pageSize')}
          <select
            value={String(form.calculator_page_size)}
            onChange={(e) => {
              const n = Number(e.target.value);
              setNum('calculator_page_size', n === 50 ? 50 : n === 0 ? 0 : 25);
            }}
            style={{ minWidth: 72, padding: '4px 8px', borderRadius: 6, border: '1px solid #ccc' }}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="0">{t('common.all')}</option>
          </select>
        </label>
      </div>

      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('visual.dataVizDefaults')}</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 10 }}>{t('visual.dataVizDefaultsHelp')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <label>
            {t('visual.dataVizYearFrom')}
            <input
              type="number"
              min={2000}
              max={2100}
              value={form.data_viz_default_year_from}
              onChange={(e) => setNum('data_viz_default_year_from', Number(e.target.value))}
              style={{ width: 88, marginLeft: 6, padding: 4 }}
            />
          </label>
          <label>
            {t('visual.dataVizYearTo')}
            <input
              type="number"
              min={2000}
              max={2100}
              value={form.data_viz_default_year_to}
              onChange={(e) => setNum('data_viz_default_year_to', Number(e.target.value))}
              style={{ width: 88, marginLeft: 6, padding: 4 }}
            />
          </label>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('visual.workspaceThemes')}</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 16 }}>{t('visual.workspaceThemesHelp')}</p>
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {workspaceSections.map(({ id, titleKey, showBanner }) => {
            const themes = workspaceThemesFromVisualSettings(form as Record<string, unknown>);
            const theme = themes[id];
            const defaults = DEFAULT_WORKSPACE_THEMES[id];
            return (
              <div key={id} style={{ border: '1px solid #eee', borderRadius: 8, padding: '1rem', background: '#fafafa' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>{t(titleKey)}</h4>
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                  <ColorField
                    label={t('visual.workspacePageBg')}
                    value={theme.page_bg}
                    fallback={defaults.page_bg}
                    onChange={(v) => setWorkspaceColor(id, 'page_bg', v)}
                  />
                  <ColorField
                    label={t('visual.workspaceMainBg')}
                    value={theme.main_bg}
                    fallback={defaults.main_bg}
                    onChange={(v) => setWorkspaceColor(id, 'main_bg', v)}
                  />
                  <ColorField
                    label={t('visual.workspaceHeaderBg')}
                    value={theme.header_bg}
                    fallback={defaults.header_bg}
                    onChange={(v) => setWorkspaceColor(id, 'header_bg', v)}
                  />
                  <ColorField
                    label={t('visual.workspaceAccent')}
                    value={theme.accent}
                    fallback={defaults.accent}
                    onChange={(v) => setWorkspaceColor(id, 'accent', v)}
                  />
                  {showBanner && (
                    <ColorField
                      label={t('visual.workspaceBannerBg')}
                      value={theme.banner_bg}
                      fallback={defaults.banner_bg}
                      onChange={(v) => setWorkspaceColor(id, 'banner_bg', v)}
                    />
                  )}
                </div>
                {id === 'calloffs' && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #e8e8e8' }}>
                    <strong style={{ display: 'block', marginBottom: 6, fontSize: 14 }}>{t('visual.callOffImportPanel')}</strong>
                    <p style={{ fontSize: 13, color: '#666', margin: '0 0 10px' }}>{t('visual.callOffImportPanelHelp')}</p>
                    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                      <ColorField
                        label={t('visual.callOffImportPanelBg')}
                        value={form.workspace_calloffs_import_bg}
                        fallback={DEFAULT_CALL_OFF_IMPORT_PANEL.panel_bg}
                        onChange={(v) => setStr('workspace_calloffs_import_bg', v)}
                      />
                      <ColorField
                        label={t('visual.callOffImportPanelBorder')}
                        value={form.workspace_calloffs_import_border}
                        fallback={DEFAULT_CALL_OFF_IMPORT_PANEL.panel_border}
                        onChange={(v) => setStr('workspace_calloffs_import_border', v)}
                      />
                      <ColorField
                        label={t('visual.callOffImportPanelAccent')}
                        value={form.workspace_calloffs_import_accent}
                        fallback={DEFAULT_CALL_OFF_IMPORT_PANEL.accent}
                        onChange={(v) => setStr('workspace_calloffs_import_accent', v)}
                      />
                      <ColorField
                        label={t('visual.callOffImportTableHeaderBg')}
                        value={form.workspace_calloffs_import_table_header_bg}
                        fallback={DEFAULT_CALL_OFF_IMPORT_PANEL.table_header_bg}
                        onChange={(v) => setStr('workspace_calloffs_import_table_header_bg', v)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('visual.periodColors')}</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 12 }}>{t('visual.periodColorsHelp')}</p>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          <ColorField label={t('visual.periodMonthHeader')} value={form.period_month_header_color} onChange={(v) => setStr('period_month_header_color', v)} />
          <ColorField label={t('visual.periodMonthFrame')} value={form.period_month_frame_color} onChange={(v) => setStr('period_month_frame_color', v)} />
          <ColorField label={t('visual.periodWeekHeader')} value={form.period_week_header_color} onChange={(v) => setStr('period_week_header_color', v)} />
          <ColorField label={t('visual.periodWeekFrame')} value={form.period_week_frame_color} onChange={(v) => setStr('period_week_frame_color', v)} />
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('visual.colorize')}</h3>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={form.colorize_load_cells} onChange={(e) => setBool('colorize_load_cells', e.target.checked)} />
          <span style={{ marginLeft: 8 }}>{t('visual.colorCells')}</span>
        </label>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <input type="checkbox" checked={form.colorize_sum_row} onChange={(e) => setBool('colorize_sum_row', e.target.checked)} />
          <span style={{ marginLeft: 8 }}>{t('visual.colorSum')}</span>
        </label>
        <label style={{ display: 'block' }}>
          <input type="checkbox" checked={form.colorize_avg_row} onChange={(e) => setBool('colorize_avg_row', e.target.checked)} />
          <span style={{ marginLeft: 8 }}>{t('visual.colorAvg')}</span>
        </label>
      </div>

      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('visual.contractFrame')}</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 10 }}>{t('visual.contractFrameHelp')}</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {t('visual.frameColor')}
          <HexColorInput value={form.contractual_calculator_frame_color} fallback="#ff9800" onChange={(v) => setStr('contractual_calculator_frame_color', v)} />
        </label>
      </div>

      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('visual.dataVizColors')}</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: 0, marginBottom: 12 }}>{t('visual.dataVizColorsHelp')}</p>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          <ColorField label={t('visual.dataVizColorProduction')} value={form.data_viz_color_production} onChange={(v) => setStr('data_viz_color_production', v)} />
          <ColorField label={t('visual.dataVizColorContract')} value={form.data_viz_color_contract} onChange={(v) => setStr('data_viz_color_contract', v)} />
          <ColorField
            label={t('visual.dataVizColorScenarioProd')}
            value={form.data_viz_color_scenario_production}
            onChange={(v) => setStr('data_viz_color_scenario_production', v)}
          />
          <ColorField
            label={t('visual.dataVizColorScenarioContract')}
            value={form.data_viz_color_scenario_contract}
            onChange={(v) => setStr('data_viz_color_scenario_contract', v)}
          />
          <ColorField
            label={t('visual.dataVizColorDeltaNegative')}
            value={form.data_viz_color_delta_negative}
            onChange={(v) => setStr('data_viz_color_delta_negative', v)}
          />
          <ColorField
            label={t('visual.dataVizColorDeltaPositive')}
            value={form.data_viz_color_delta_positive}
            onChange={(v) => setStr('data_viz_color_delta_positive', v)}
          />
          <ColorField
            label={t('visual.dataVizColorRefOverload')}
            value={form.data_viz_color_ref_line_overload}
            onChange={(v) => setStr('data_viz_color_ref_line_overload', v)}
          />
          <ColorField
            label={t('visual.dataVizColorRefFree')}
            value={form.data_viz_color_ref_line_free}
            onChange={(v) => setStr('data_viz_color_ref_line_free', v)}
          />
        </div>
        <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
          <strong>{t('visual.dataVizComparePalette')}</strong>
          <p style={{ fontSize: 13, color: '#666', margin: '6px 0 10px' }}>{t('visual.dataVizComparePaletteHelp')}</p>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {form.data_viz_compare_palette.map((color, idx) => (
              <ColorField
                key={idx}
                label={`${idx + 1}.`}
                value={color}
                onChange={(v) =>
                  setForm((prev) => {
                    if (!prev) return prev;
                    const next = [...prev.data_viz_compare_palette];
                    next[idx] = v;
                    return { ...prev, data_viz_compare_palette: next };
                  })
                }
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setForm((prev) =>
                prev ? { ...prev, data_viz_compare_palette: [...DEFAULT_DATA_VIZ_COLORS.comparePalette] } : prev
              )
            }
            style={{ marginTop: 10, padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fafafa' }}
          >
            {t('visual.dataVizResetPalette')}
          </button>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('visual.ranges')}</h3>
        <RangeEditor
          title={t('visual.rangeOk')}
          enabled={form.ok_enabled}
          from={form.ok_from}
          to={form.ok_to}
          color={form.ok_color}
          onEnabled={(v) => setBool('ok_enabled', v)}
          onFrom={(v) => setNum('ok_from', v)}
          onTo={(v) => setNum('ok_to', v)}
          onColor={(v) => setStr('ok_color', v)}
        />
        <RangeEditor
          title={t('visual.rangeWarn')}
          enabled={form.warn_enabled}
          from={form.warn_from}
          to={form.warn_to}
          color={form.warn_color}
          onEnabled={(v) => setBool('warn_enabled', v)}
          onFrom={(v) => setNum('warn_from', v)}
          onTo={(v) => setNum('warn_to', v)}
          onColor={(v) => setStr('warn_color', v)}
        />
        <RangeEditor
          title={t('visual.rangeDanger')}
          enabled={form.danger_enabled}
          from={form.danger_from}
          to={form.danger_to}
          color={form.danger_color}
          onEnabled={(v) => setBool('danger_enabled', v)}
          onFrom={(v) => setNum('danger_from', v)}
          onTo={(v) => setNum('danger_to', v)}
          onColor={(v) => setStr('danger_color', v)}
        />
      </div>
    </div>
  );
}

function HexColorInput({
  value,
  fallback,
  onChange,
}: {
  value: string;
  fallback: string;
  onChange: (v: string) => void;
}) {
  const valid = normalizeHexColor(value, fallback);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <input type="color" value={colorPickerValue(value, fallback)} onChange={(e) => onChange(e.target.value)} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onChange(valid)}
        placeholder="#RRGGBB"
        spellCheck={false}
        aria-invalid={value !== valid}
        style={{
          width: 92,
          padding: '4px 6px',
          fontSize: 12,
          fontFamily: 'monospace',
          border: `1px solid ${value !== valid ? '#e86a10' : '#ccc'}`,
          borderRadius: 4,
        }}
      />
    </span>
  );
}

function ColorField({
  label,
  value,
  onChange,
  fallback = '#A4C400',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  fallback?: string;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 14 }}>
      <span style={{ minWidth: 0, flex: '1 1 140px' }}>{label}</span>
      <HexColorInput value={value} fallback={fallback} onChange={onChange} />
    </label>
  );
}

function RangeEditor(props: {
  title: string;
  enabled: boolean;
  from: number;
  to: number;
  color: string;
  onEnabled: (v: boolean) => void;
  onFrom: (v: number) => void;
  onTo: (v: number) => void;
  onColor: (v: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10, marginTop: 10 }}>
      <strong>{props.title}</strong>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, alignItems: 'center' }}>
        <label>
          <input type="checkbox" checked={props.enabled} onChange={(e) => props.onEnabled(e.target.checked)} />
          <span style={{ marginLeft: 8 }}>{t('visual.enabled')}</span>
        </label>
        <label>
          {t('visual.from')}
          <input type="number" step="0.01" value={props.from} onChange={(e) => props.onFrom(Number(e.target.value))} style={{ width: 90, marginLeft: 6, padding: 4 }} />
        </label>
        <label>
          {t('visual.to')}
          <input type="number" step="0.01" value={props.to} onChange={(e) => props.onTo(Number(e.target.value))} style={{ width: 90, marginLeft: 6, padding: 4 }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {t('visual.color')}
          <HexColorInput value={props.color} fallback="#cccccc" onChange={props.onColor} />
        </label>
      </div>
    </div>
  );
}
