const BASE = '/api';

/** Build query string only from defined, non-empty params (no "undefined" in URL). */
function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: 'no-store',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

export const api = {
  settings: {
    list: () => request<any[]>('/settings'),
    get: (id: number) => request<any>(`/settings/${id}`),
    create: (body: any) => request<any>('/settings', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: any) => request<any>(`/settings/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/settings/${id}`, { method: 'DELETE' }),
    fromMonths: (months: number[]) => request<{ working_days_year: number }>('/settings/from-months', { method: 'POST', body: JSON.stringify({ months }) }),
    phases: {
      list: () => request<{ id: number; name: string }[]>('/settings/phases'),
      create: (name: string) => request<{ id: number; name: string }>('/settings/phases', { method: 'POST', body: JSON.stringify({ name }) }),
      update: (id: number, name: string) => request<{ id: number; name: string }>(`/settings/phases/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
      delete: (id: number) => request<void>(`/settings/phases/${id}`, { method: 'DELETE' }),
    },
    designations: {
      list: () => request<{ id: number; designation?: string; sap_number?: string | null; alias?: string | null; free_text?: string | null; slot_number?: string | null }[]>('/settings/designations'),
      create: (body: { sap_number?: string; alias?: string; free_text?: string; slot_number?: string; designation?: string }) => request<{ id: number; designation?: string; sap_number?: string | null; alias?: string | null; free_text?: string | null; slot_number?: string | null }>('/settings/designations', { method: 'POST', body: JSON.stringify(body) }),
      update: (id: number, body: { sap_number?: string; alias?: string; free_text?: string; slot_number?: string; designation?: string }) => request<any>(`/settings/designations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      delete: (id: number) => request<void>(`/settings/designations/${id}`, { method: 'DELETE' }),
    },
  },
  machines: {
    list: (params?: { status?: string; type?: string; search?: string }) => {
      const q = toQuery(params || {});
      return request<any[]>(`/machines${q}`);
    },
    types: () => request<string[]>('/machines/types'),
    get: (id: number) => request<any>(`/machines/${id}`),
    operations: (id: number, params?: { year?: number }) => {
      const q = toQuery(params || {});
      return request<any[]>(`/machines/${id}/operations${q}`);
    },

    create: (body: any) => request<any>('/machines', { method: 'POST', body: JSON.stringify(body) }),
    import: (machines: any[]) => request<{ created: number; skipped: number; errors: string[]; createdNumbers: number[]; skippedNumbers: number[] }>('/machines/import', { method: 'POST', body: JSON.stringify({ machines }) }),
    update: (id: number, body: any) => request<any>(`/machines/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/machines/${id}`, { method: 'DELETE' }),
  },
  nests: {
    list: () => request<any[]>('/nests'),
    get: (id: number) => request<any>(`/nests/${id}`),
    create: (body: any) => request<any>('/nests', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: any) => request<any>(`/nests/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/nests/${id}`, { method: 'DELETE' }),
    addMachine: (nestId: number, machineId: number) =>
      request<any[]>(`/nests/${nestId}/machines`, { method: 'POST', body: JSON.stringify({ machine_id: machineId }) }),
    removeMachine: (nestId: number, machineId: number) =>
      request<void>(`/nests/${nestId}/machines/${machineId}`, { method: 'DELETE' }),
  },
  alternatives: {
    list: (machineId: number) => request<any[]>(`/alternatives/machine/${machineId}`),
    add: (machineId: number, alternativeMachineId: number) =>
      request<any>('/alternatives', { method: 'POST', body: JSON.stringify({ machine_id: machineId, alternative_machine_id: alternativeMachineId }) }),
    remove: (machineId: number, alternativeMachineId: number) =>
      request<void>(`/alternatives/${machineId}/${alternativeMachineId}`, { method: 'DELETE' }),
  },
  projects: {
    list: (params?: { status?: string; client?: string; search?: string }) => {
      const q = toQuery(params || {});
      return request<any[]>(`/projects${q}`);
    },
    clients: () => request<string[]>('/projects/clients'),
    get: (id: number) => request<any>(`/projects/${id}`),
    getVolumes: (id: number) => request<{ year: number; volume_value: number; volume_unit: string }[]>(`/projects/${id}/volumes`),
    setVolumes: (id: number, volumes: { year: number; volume_value: number; volume_unit: string; include_in_calculator_after_eop?: number | boolean }[]) => request<any[]>(`/projects/${id}/volumes`, { method: 'PUT', body: JSON.stringify({ volumes }) }),
    create: (body: any) => request<any>('/projects', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: any) => request<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
    addPart: (projectId: number, body: any) => request<any>(`/projects/${projectId}/parts`, { method: 'POST', body: JSON.stringify(body) }),
    updatePart: (projectId: number, partId: number, body: any) => request<any>(`/projects/${projectId}/parts/${partId}`, { method: 'PUT', body: JSON.stringify(body) }),
    getPartVolumes: (projectId: number, partId: number) => request<{ year: number; volume_value: number; volume_unit: string }[]>(`/projects/${projectId}/parts/${partId}/volumes`),
    setPartVolumes: (projectId: number, partId: number, volumes: { year: number; volume_value: number; volume_unit: string }[]) => request<any[]>(`/projects/${projectId}/parts/${partId}/volumes`, { method: 'PUT', body: JSON.stringify({ volumes }) }),
    deletePart: (projectId: number, partId: number) => request<void>(`/projects/${projectId}/parts/${partId}`, { method: 'DELETE' }),
    phases: (projectId: number) => request<any[]>(`/projects/${projectId}/phases`),
    addOperation: (projectId: number, body: any) => request<any>(`/projects/${projectId}/operations`, { method: 'POST', body: JSON.stringify(body) }),
    updateOperation: (projectId: number, opId: number, body: any) => request<any>(`/projects/${projectId}/operations/${opId}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteOperation: (projectId: number, opId: number) => request<void>(`/projects/${projectId}/operations/${opId}`, { method: 'DELETE' }),
    getOperationVolumes: (projectId: number, opId: number) => request<{ year: number; volume_value: number; volume_unit: string }[]>(`/projects/${projectId}/operations/${opId}/volumes`),
    setOperationVolumeYear: (projectId: number, opId: number, body: { year: number; volume_value: number; volume_unit: string }) => request<any>(`/projects/${projectId}/operations/${opId}/volumes`, { method: 'PUT', body: JSON.stringify(body) }),
    setOperationVolumes: (projectId: number, opId: number, volumes: { year: number; volume_value: number; volume_unit: string }[]) => request<any[]>(`/projects/${projectId}/operations/${opId}/volumes`, { method: 'PUT', body: JSON.stringify({ volumes }) }),
    deleteOperationVolumeYear: (projectId: number, opId: number, year: number) => request<void>(`/projects/${projectId}/operations/${opId}/volumes/${year}`, { method: 'DELETE' }),
    addNote: (projectId: number, body: any) => request<any>(`/projects/${projectId}/notes`, { method: 'POST', body: JSON.stringify(body) }),
    deleteNote: (projectId: number, noteId: number) => request<void>(`/projects/${projectId}/notes/${noteId}`, { method: 'DELETE' }),
  },
  capacity: {
    calculator: (params?: { yearFrom?: number; yearTo?: number; type?: string; machines?: string; scenarioId?: number }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ yearFrom: number; yearTo: number; scenarioId: number | null; machines: any[] }>(`/capacity/calculator${q ? `?${q}` : ''}`);
    },
    machine: (machineId: number, params?: { yearFrom?: number; yearTo?: number }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<any>(`/capacity/machine/${machineId}${q ? `?${q}` : ''}`);
    },
    year: (year: number, params?: { type?: string; machines?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ year: number; machines: any[] }>(`/capacity/year/${year}${q ? `?${q}` : ''}`);
    },
    nests: (year: number) => request<any[]>(`/capacity/nests/year/${year}`),
  },
  allocation: {
    overloaded: (params?: { year?: number; threshold?: number }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ year: number; machines: any[] }>(`/allocation/overloaded${q ? `?${q}` : ''}`);
    },
    candidates: (machineId: number, params?: { year?: number; maxLoad?: number }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ candidates: any[] }>(`/allocation/candidates/${machineId}${q ? `?${q}` : ''}`);
    },
    execute: (body: { operationId: number; targetMachineId: number; volumeToMove: number; volumeUnit: string; cycleTimeSecondsOnTarget?: number | null }) =>
      request<any>('/allocation/execute', { method: 'POST', body: JSON.stringify(body) }),
  },
  scenarios: {
    list: () => request<{ id: number; name: string; created_at: string }[]>('/scenarios'),
    get: (id: number) => request<{ id: number; name: string; created_at: string; snapshot: any }>(`/scenarios/${id}`),
    create: (name: string) => request<{ id: number; name: string; created_at: string }>('/scenarios', { method: 'POST', body: JSON.stringify({ name }) }),
    delete: (id: number) => request<void>(`/scenarios/${id}`, { method: 'DELETE' }),
  },
};
