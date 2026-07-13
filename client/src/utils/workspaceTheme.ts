import type { AppSection } from '../context/ScenarioModeContext';

export type WorkspaceThemeColors = {
  page_bg: string;
  main_bg: string;
  header_bg: string;
  accent: string;
  /** Pasek obszaru roboczego (Scenariusze / Call offs). Gdy pusty — gradient z accent. */
  banner_bg: string;
};

export type WorkspaceThemeSettings = Record<AppSection, WorkspaceThemeColors>;

export const DEFAULT_WORKSPACE_THEMES: WorkspaceThemeSettings = {
  capacity: {
    page_bg: '#f7f8fa',
    main_bg: '#f7f8fa',
    header_bg: '#ffffff',
    accent: '#A4C400',
    banner_bg: '#A4C400',
  },
  scenarios: {
    page_bg: '#e4ecf7',
    main_bg: '#e8f0fa',
    header_bg: '#d8e4f5',
    accent: '#1565c0',
    banner_bg: '#1565c0',
  },
  calloffs: {
    page_bg: '#FFFDDA',
    main_bg: '#FFF8E3',
    header_bg: '#F0E8B8',
    accent: '#7A6510',
    banner_bg: '#A68920',
  },
};

export const DEFAULT_CALL_OFF_IMPORT_PANEL = {
  panel_bg: '#FFFDDA',
  panel_border: '#D4C88A',
  accent: '#7A6510',
  table_header_bg: '#F0E8B8',
} as const;

export type CallOffImportPanelColors = {
  panel_bg: string;
  panel_border: string;
  accent: string;
  table_header_bg: string;
};

export function callOffImportPanelFromVisualSettings(raw: Record<string, unknown>): CallOffImportPanelColors {
  return {
    panel_bg: normalizeHexColor(raw.workspace_calloffs_import_bg, DEFAULT_CALL_OFF_IMPORT_PANEL.panel_bg),
    panel_border: normalizeHexColor(raw.workspace_calloffs_import_border, DEFAULT_CALL_OFF_IMPORT_PANEL.panel_border),
    accent: normalizeHexColor(raw.workspace_calloffs_import_accent, DEFAULT_CALL_OFF_IMPORT_PANEL.accent),
    table_header_bg: normalizeHexColor(
      raw.workspace_calloffs_import_table_header_bg,
      DEFAULT_CALL_OFF_IMPORT_PANEL.table_header_bg
    ),
  };
}

const HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

export function normalizeHexColor(value: unknown, fallback: string): string {
  const s = String(value ?? '').trim();
  return HEX_RE.test(s) ? s : fallback;
}

function pickSection(raw: Record<string, unknown>, section: AppSection, key: keyof WorkspaceThemeColors): string {
  const apiKey = `workspace_${section}_${key}` as keyof typeof raw;
  return normalizeHexColor(raw[apiKey], DEFAULT_WORKSPACE_THEMES[section][key]);
}

export function workspaceThemesFromVisualSettings(raw: Record<string, unknown>): WorkspaceThemeSettings {
  return {
    capacity: {
      page_bg: pickSection(raw, 'capacity', 'page_bg'),
      main_bg: pickSection(raw, 'capacity', 'main_bg'),
      header_bg: pickSection(raw, 'capacity', 'header_bg'),
      accent: pickSection(raw, 'capacity', 'accent'),
      banner_bg: pickSection(raw, 'capacity', 'banner_bg'),
    },
    scenarios: {
      page_bg: pickSection(raw, 'scenarios', 'page_bg'),
      main_bg: pickSection(raw, 'scenarios', 'main_bg'),
      header_bg: pickSection(raw, 'scenarios', 'header_bg'),
      accent: pickSection(raw, 'scenarios', 'accent'),
      banner_bg: pickSection(raw, 'scenarios', 'banner_bg'),
    },
    calloffs: {
      page_bg: pickSection(raw, 'calloffs', 'page_bg'),
      main_bg: pickSection(raw, 'calloffs', 'main_bg'),
      header_bg: pickSection(raw, 'calloffs', 'header_bg'),
      accent: pickSection(raw, 'calloffs', 'accent'),
      banner_bg: pickSection(raw, 'calloffs', 'banner_bg'),
    },
  };
}

/** Ciemniejszy odcień akcentu (np. tekst nawigacji, koniec gradientu paska). */
export function workspaceAccentMuted(accent: string): string {
  const hex = normalizeHexColor(accent, '#333333').slice(0, 7);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.max(0, Math.min(255, Math.round(c * 0.72)));
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(mix(r))}${to2(mix(g))}${to2(mix(b))}`;
}

export function workspaceBannerGradient(theme: WorkspaceThemeColors): string {
  const start = normalizeHexColor(theme.banner_bg, theme.accent);
  const end = workspaceAccentMuted(start);
  return `linear-gradient(90deg, ${start} 0%, ${end} 100%)`;
}

export type WorkspaceThemeFlatKeys = {
  workspace_capacity_page_bg: string;
  workspace_capacity_main_bg: string;
  workspace_capacity_header_bg: string;
  workspace_capacity_accent: string;
  workspace_capacity_banner_bg: string;
  workspace_scenarios_page_bg: string;
  workspace_scenarios_main_bg: string;
  workspace_scenarios_header_bg: string;
  workspace_scenarios_accent: string;
  workspace_scenarios_banner_bg: string;
  workspace_calloffs_page_bg: string;
  workspace_calloffs_main_bg: string;
  workspace_calloffs_header_bg: string;
  workspace_calloffs_accent: string;
  workspace_calloffs_banner_bg: string;
};

export function flattenWorkspaceThemes(themes: WorkspaceThemeSettings): WorkspaceThemeFlatKeys {
  return {
    workspace_capacity_page_bg: themes.capacity.page_bg,
    workspace_capacity_main_bg: themes.capacity.main_bg,
    workspace_capacity_header_bg: themes.capacity.header_bg,
    workspace_capacity_accent: themes.capacity.accent,
    workspace_capacity_banner_bg: themes.capacity.banner_bg,
    workspace_scenarios_page_bg: themes.scenarios.page_bg,
    workspace_scenarios_main_bg: themes.scenarios.main_bg,
    workspace_scenarios_header_bg: themes.scenarios.header_bg,
    workspace_scenarios_accent: themes.scenarios.accent,
    workspace_scenarios_banner_bg: themes.scenarios.banner_bg,
    workspace_calloffs_page_bg: themes.calloffs.page_bg,
    workspace_calloffs_main_bg: themes.calloffs.main_bg,
    workspace_calloffs_header_bg: themes.calloffs.header_bg,
    workspace_calloffs_accent: themes.calloffs.accent,
    workspace_calloffs_banner_bg: themes.calloffs.banner_bg,
  };
}
