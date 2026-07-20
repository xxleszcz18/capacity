import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import { normalizeReferenceDisplayMode, type ReferenceDisplayMode } from '../utils/detailLabel';
import { normalizeMachineDisplayMode, type MachineDisplayMode } from '../utils/machineLabel';

type Ctx = {
  referenceDisplay: ReferenceDisplayMode;
  machineDisplay: MachineDisplayMode;
  /** Etykiety osi X — wykres słupkowy maszyn (wizualizacja danych). */
  machineBarChartLabel: MachineDisplayMode;
  reloadReferenceDisplay: () => void;
};

const ReferenceDisplayContext = createContext<Ctx>({
  referenceDisplay: 'both',
  machineDisplay: 'internal',
  machineBarChartLabel: 'internal',
  reloadReferenceDisplay: () => {},
});

export function ReferenceDisplayProvider({ children }: { children: ReactNode }) {
  const [referenceDisplay, setReferenceDisplay] = useState<ReferenceDisplayMode>('both');
  const [machineDisplay, setMachineDisplay] = useState<MachineDisplayMode>('internal');
  const [machineBarChartLabel, setMachineBarChartLabel] = useState<MachineDisplayMode>('internal');

  const reloadReferenceDisplay = useCallback(() => {
    api.settings.visual
      .get()
      .then((v) => {
        setReferenceDisplay(normalizeReferenceDisplayMode((v as { reference_display?: string }).reference_display));
        setMachineDisplay(normalizeMachineDisplayMode((v as { machine_display?: string }).machine_display));
        setMachineBarChartLabel(
          normalizeMachineDisplayMode(
            (v as { data_viz_machine_bar_label?: string }).data_viz_machine_bar_label ?? 'internal'
          )
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    reloadReferenceDisplay();
  }, [reloadReferenceDisplay]);

  const value = useMemo(
    () => ({ referenceDisplay, machineDisplay, machineBarChartLabel, reloadReferenceDisplay }),
    [referenceDisplay, machineDisplay, machineBarChartLabel, reloadReferenceDisplay]
  );

  return <ReferenceDisplayContext.Provider value={value}>{children}</ReferenceDisplayContext.Provider>;
}

export function useReferenceDisplay(): Ctx {
  return useContext(ReferenceDisplayContext);
}
