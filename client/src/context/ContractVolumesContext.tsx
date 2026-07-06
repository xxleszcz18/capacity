import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'capacity_use_contractual_volumes';

function readStored(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) === '1';
}

export type ContractVolumesContextValue = {
  useContractualVolumes: boolean;
  setUseContractualVolumes: (v: boolean) => void;
};

const ContractVolumesContext = createContext<ContractVolumesContextValue | null>(null);

export function ContractVolumesProvider({ children }: { children: React.ReactNode }) {
  const [useContractualVolumes, setState] = useState(readStored);

  const setUseContractualVolumes = useCallback((v: boolean) => {
    setState(v);
    if (v) sessionStorage.setItem(STORAGE_KEY, '1');
    else sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ useContractualVolumes, setUseContractualVolumes }),
    [useContractualVolumes, setUseContractualVolumes]
  );

  return <ContractVolumesContext.Provider value={value}>{children}</ContractVolumesContext.Provider>;
}

export function useContractVolumes(): ContractVolumesContextValue {
  const v = useContext(ContractVolumesContext);
  if (!v) throw new Error('useContractVolumes: brak ContractVolumesProvider');
  return v;
}
