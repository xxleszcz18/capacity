import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import { dataVizColorsFromVisualSettings, DEFAULT_DATA_VIZ_COLORS, type DataVizColors } from '../utils/dataVizColors';

type Ctx = {
  colors: DataVizColors;
  reloadDataVizColors: () => void;
};

const DataVizColorsContext = createContext<Ctx>({
  colors: DEFAULT_DATA_VIZ_COLORS,
  reloadDataVizColors: () => {},
});

export function DataVizColorsProvider({ children }: { children: ReactNode }) {
  const [colors, setColors] = useState<DataVizColors>(DEFAULT_DATA_VIZ_COLORS);

  const reloadDataVizColors = useCallback(() => {
    api.settings.visual
      .get()
      .then((v) => setColors(dataVizColorsFromVisualSettings(v as Record<string, unknown>)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    reloadDataVizColors();
  }, [reloadDataVizColors]);

  const value = useMemo(() => ({ colors, reloadDataVizColors }), [colors, reloadDataVizColors]);

  return <DataVizColorsContext.Provider value={value}>{children}</DataVizColorsContext.Provider>;
}

export function useDataVizColors(): DataVizColors {
  return useContext(DataVizColorsContext).colors;
}

export function useReloadDataVizColors(): () => void {
  return useContext(DataVizColorsContext).reloadDataVizColors;
}
