/** Paleta porównawcza Autoneum (10 kolorów marki + odcienie 60%). */
export const AUTONEUM_COMPARE_PALETTE = [
  '#8A9300', // Dark Green
  '#008BC1', // Dark Blue
  '#E86A10', // Dark Orange
  '#B8C400', // Green Lime
  '#00B0E8', // Light Blue
  '#F59B47', // Light Orange
  '#7A7B7A', // Dark Grey
  '#66B9DA', // Dark Blue 60%
  '#B9BE66', // Dark Green 60%
  '#F1A670', // Dark Orange 60%
] as const;

export type DataVizColors = {
  production: string;
  contract: string;
  scenarioProduction: string;
  scenarioContract: string;
  callOff: string;
  deltaNegative: string;
  deltaPositive: string;
  refLineOverload: string;
  refLineFree: string;
  comparePalette: string[];
};

/** Domyślna kolorystyka wizualizacji danych — paleta korporacyjna Autoneum. */
export const DEFAULT_DATA_VIZ_COLORS: DataVizColors = {
  production: '#8A9300', // Dark Green — produkcja
  contract: '#E86A10', // Dark Orange — kontrakt
  scenarioProduction: '#008BC1', // Dark Blue — scenariusz produkcja
  scenarioContract: '#F59B47', // Light Orange — scenariusz kontrakt (odróżnienie od kontraktu)
  callOff: '#0091EA', // intensywny błękit — Call offs (SAP)
  deltaNegative: '#E86A10', // Dark Orange — brak czerwieni w palecie marki
  deltaPositive: '#8A9300', // Dark Green
  refLineOverload: '#E86A10', // linia 100% obciążenia
  refLineFree: '#8A9300', // linia 0% wolnego capacity
  comparePalette: [...AUTONEUM_COMPARE_PALETTE],
};

const HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

export function normalizeHexColor(v: unknown, fallback: string): string {
  const s = String(v ?? '').trim();
  return HEX_RE.test(s) ? s : fallback;
}

/** Wartość dla `<input type="color">` — tylko #RRGGBB. */
export function colorPickerValue(hex: string, fallback: string): string {
  const normalized = normalizeHexColor(hex, fallback);
  return normalized.slice(0, 7);
}

export function normalizeComparePalette(v: unknown, fallback: string[] = DEFAULT_DATA_VIZ_COLORS.comparePalette): string[] {
  let raw: unknown[] | null = null;
  if (Array.isArray(v)) raw = v;
  else if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) raw = parsed;
    } catch {
      raw = v.split(/[,;\s]+/).filter(Boolean);
    }
  }
  if (!raw?.length) return [...fallback];
  const out = raw.map((c, i) => normalizeHexColor(c, fallback[i % fallback.length] ?? fallback[0]));
  return out.length >= 3 ? out : [...fallback];
}

export type VisualSettingsColorFields = {
  data_viz_color_production?: unknown;
  data_viz_color_contract?: unknown;
  data_viz_color_scenario_production?: unknown;
  data_viz_color_scenario_contract?: unknown;
  data_viz_color_call_off?: unknown;
  data_viz_color_delta_negative?: unknown;
  data_viz_color_delta_positive?: unknown;
  data_viz_color_ref_line_overload?: unknown;
  data_viz_color_ref_line_free?: unknown;
  data_viz_compare_palette?: unknown;
};

export function dataVizColorsFromVisualSettings(v: VisualSettingsColorFields | null | undefined): DataVizColors {
  const d = DEFAULT_DATA_VIZ_COLORS;
  return {
    production: normalizeHexColor(v?.data_viz_color_production, d.production),
    contract: normalizeHexColor(v?.data_viz_color_contract, d.contract),
    scenarioProduction: normalizeHexColor(v?.data_viz_color_scenario_production, d.scenarioProduction),
    scenarioContract: normalizeHexColor(v?.data_viz_color_scenario_contract, d.scenarioContract),
    callOff: normalizeHexColor(v?.data_viz_color_call_off, d.callOff),
    deltaNegative: normalizeHexColor(v?.data_viz_color_delta_negative, d.deltaNegative),
    deltaPositive: normalizeHexColor(v?.data_viz_color_delta_positive, d.deltaPositive),
    refLineOverload: normalizeHexColor(v?.data_viz_color_ref_line_overload, d.refLineOverload),
    refLineFree: normalizeHexColor(v?.data_viz_color_ref_line_free, d.refLineFree),
    comparePalette: normalizeComparePalette(v?.data_viz_compare_palette, d.comparePalette),
  };
}
