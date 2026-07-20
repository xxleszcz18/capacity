/** Progi kolorów komórek obciążenia — zgodne z ustawieniami wizualnymi kalkulatora. */

export type LoadVisualSettings = {
  colorize_load_cells: boolean;
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
};

export function loadColor(percent: number, visual: LoadVisualSettings): string {
  if (!visual.colorize_load_cells) return '#ffffff';
  if (visual.ok_enabled && percent >= visual.ok_from && percent <= visual.ok_to) return visual.ok_color;
  if (visual.warn_enabled && percent >= visual.warn_from && percent <= visual.warn_to) return visual.warn_color;
  if (visual.danger_enabled && percent >= visual.danger_from && percent <= visual.danger_to) return visual.danger_color;
  return '#e8f5e9';
}
