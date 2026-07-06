import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

export type CalculationSettingsProfile = 'capacity' | 'ocu';

const STORAGE_PROFILE = 'capacity_calculation_profile';

export type OcuModeContextValue = {
  ocuFeatureEnabled: boolean;
  calculationProfile: CalculationSettingsProfile;
  effectiveProfile: CalculationSettingsProfile;
  setCalculationProfile: (profile: CalculationSettingsProfile) => void;
  toggleCalculationProfile: () => void;
  refreshOcuFeature: () => Promise<void>;
};

const OcuModeContext = createContext<OcuModeContextValue | null>(null);

function readStoredProfile(): CalculationSettingsProfile {
  const raw = sessionStorage.getItem(STORAGE_PROFILE);
  return raw === 'ocu' ? 'ocu' : 'capacity';
}

export function OcuModeProvider({ children }: { children: React.ReactNode }) {
  const [ocuFeatureEnabled, setOcuFeatureEnabled] = useState(false);
  const [calculationProfile, setCalculationProfileState] = useState<CalculationSettingsProfile>(readStoredProfile);

  const refreshOcuFeature = useCallback(async () => {
    try {
      const behavior = await api.settings.getBehavior();
      setOcuFeatureEnabled(behavior.ocu_enabled === true);
    } catch {
      setOcuFeatureEnabled(false);
    }
  }, []);

  useEffect(() => {
    refreshOcuFeature();
  }, [refreshOcuFeature]);

  useEffect(() => {
    if (!ocuFeatureEnabled && calculationProfile === 'ocu') {
      setCalculationProfileState('capacity');
      sessionStorage.setItem(STORAGE_PROFILE, 'capacity');
    }
  }, [ocuFeatureEnabled, calculationProfile]);

  const setCalculationProfile = useCallback(
    (profile: CalculationSettingsProfile) => {
      if (profile === 'ocu' && !ocuFeatureEnabled) return;
      setCalculationProfileState(profile);
      sessionStorage.setItem(STORAGE_PROFILE, profile);
    },
    [ocuFeatureEnabled]
  );

  const toggleCalculationProfile = useCallback(() => {
    if (!ocuFeatureEnabled) return;
    setCalculationProfile(calculationProfile === 'ocu' ? 'capacity' : 'ocu');
  }, [calculationProfile, ocuFeatureEnabled, setCalculationProfile]);

  const value = useMemo(
    () => ({
      ocuFeatureEnabled,
      calculationProfile,
      effectiveProfile: ocuFeatureEnabled ? calculationProfile : 'capacity',
      setCalculationProfile,
      toggleCalculationProfile,
      refreshOcuFeature,
    }),
    [ocuFeatureEnabled, calculationProfile, setCalculationProfile, toggleCalculationProfile, refreshOcuFeature]
  );

  return <OcuModeContext.Provider value={value}>{children}</OcuModeContext.Provider>;
}

export function useOcuMode(): OcuModeContextValue {
  const ctx = useContext(OcuModeContext);
  if (!ctx) throw new Error('useOcuMode must be used within OcuModeProvider');
  return ctx;
}

/** Profil do API: w trybie scenariusza zawsze Capacity. */
export function useEffectiveCalculationProfile(scenarioActive: boolean): CalculationSettingsProfile {
  const { effectiveProfile } = useOcuMode();
  return scenarioActive ? 'capacity' : effectiveProfile;
}
