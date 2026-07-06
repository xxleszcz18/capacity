const ENV_API = (import.meta.env.VITE_API_BASE ?? '').toString().trim().replace(/\/+$/, '');
const BASE = ENV_API || '/api';

/** Zgodny z `CAPACITY_DATA_IMPORT_SCHEMA_TAG` na backendzie — weryfikacja pobranego szablonu. */
export const CAPACITY_DATA_IMPORT_SCHEMA_EXPECTED = 'operacje-v2';
export const MACHINES_IMPORT_CONFIRM = 'IMPORTUJ_MASZYNY';

function mapFetchFailure(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return new Error(
      'Brak połączenia z serwerem API (Failed to fetch). Uruchom backend (npm run dev w katalogu server, port 3001). Front Vite musi działać z proxy /api albo ustaw w pliku .env klienta VITE_API_BASE na pełny adres API, np. http://127.0.0.1:3001/api'
    );
  }
  return e instanceof Error ? e : new Error(msg);
}

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
  const init: RequestInit = { cache: 'no-store', ...options };
  const headers = new Headers(init.headers as HeadersInit | undefined);
  const hasBody = init.body != null && init.body !== '';
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  init.headers = headers;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch (e) {
    throw mapFetchFailure(e);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

export const api = {
  admin: {
    getBackupSettings: () =>
      request<{
        backup_enabled: boolean;
        backup_frequency_days: number;
        backup_output_dir: string;
        absolute_output_dir: string;
        absolute_attachments_output_dir: string;
        project_attachments_output_dir: string;
        last_backup_at: string;
        last_backup_file: string;
        volumes_autosave_enabled: boolean;
        ocu_enabled: boolean;
      }>('/admin/backup-settings'),
    setBackupSettings: (body: {
      backup_enabled?: boolean;
      backup_frequency_days?: number;
      backup_output_dir?: string;
      project_attachments_output_dir?: string;
      volumes_autosave_enabled?: boolean;
      ocu_enabled?: boolean;
    }) =>
      request<{
        backup_enabled: boolean;
        backup_frequency_days: number;
        backup_output_dir: string;
        absolute_output_dir: string;
        absolute_attachments_output_dir: string;
        project_attachments_output_dir: string;
        last_backup_at: string;
        last_backup_file: string;
        volumes_autosave_enabled: boolean;
        ocu_enabled: boolean;
      }>('/admin/backup-settings', { method: 'PUT', body: JSON.stringify(body) }),
    backupNow: () => request<{ ok: boolean; file_path: string; created_at: string }>('/admin/backup-now', { method: 'POST' }),
    pickBackupDirectory: () => request<{ chosen: boolean; path: string }>('/admin/pick-backup-directory', { method: 'POST' }),
    pickAttachmentsDirectory: () => request<{ chosen: boolean; path: string }>('/admin/pick-attachments-directory', { method: 'POST' }),
    startPickLocation: (body: { target: 'backup' | 'attachments' | 'backup-file'; initial_dir?: string }) =>
      request<{ job_id: string }>('/admin/pick-location/start', { method: 'POST', body: JSON.stringify(body) }),
    getPickLocationResult: (jobId: string) =>
      request<{ status: 'pending' | 'done' | 'cancelled' | 'error'; path?: string; error?: string }>(
        `/admin/pick-location/result/${encodeURIComponent(jobId)}`,
      ),
    waitForPickLocation: async (target: 'backup' | 'attachments' | 'backup-file', initialDir?: string) => {
      const { job_id } = await api.admin.startPickLocation({ target, initial_dir: initialDir });
      const started = Date.now();
      while (Date.now() - started < 10 * 60 * 1000) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        const result = await api.admin.getPickLocationResult(job_id);
        if (result.status === 'pending') continue;
        if (result.status === 'error') throw new Error(result.error || 'Nie udało się otworzyć wyboru lokalizacji.');
        return { chosen: result.status === 'done' && !!result.path, path: result.path || '' };
      }
      throw new Error('Przekroczono czas oczekiwania na wybór lokalizacji.');
    },
    previewStoragePath: (path: string, kind: 'attachments' | 'backup' = 'attachments') =>
      request<{ absolute_path: string }>('/admin/preview-storage-path', {
        method: 'POST',
        body: JSON.stringify({ path, kind }),
      }),
    listBackupFiles: () => request<{ name: string; path: string; modified_at: string; size_bytes: number }[]>('/admin/backup-files'),
    pickBackupFile: () => request<{ chosen: boolean; path: string }>('/admin/pick-backup-file', { method: 'POST' }),
    restoreFromBackup: (body: { backup_file_path: string }) =>
      request<{ ok: boolean; restored_from: string; safety_backup_file: string; restored_at: string }>('/admin/restore-from-backup', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    clearDatabase: (body: { confirm: string; create_backup: boolean }) =>
      request<{
        ok: boolean;
        cleared_at: string;
        tables_cleared: string[];
        rows_deleted: Record<string, number>;
        backup_file?: string;
        backup_at?: string;
      }>('/admin/clear-database', { method: 'POST', body: JSON.stringify(body) }),
    /** Pobiera .xlsx: arkusz na tabelę + _INSTRUKCJA. `onlyTables` → tylko wskazane arkusze (szablon pod import częściowy). */
    downloadCapacityBundleTemplate: async (onlyTables?: string[]) => {
      const qs =
        onlyTables?.length != null && onlyTables.length > 0
          ? `?onlyTables=${encodeURIComponent(JSON.stringify(onlyTables))}`
          : '';
      let res: Response;
      try {
        res = await fetch(`${BASE}/admin/capacity-bundle-template.xlsx${qs}`, { cache: 'no-store' });
      } catch (e) {
        throw mapFetchFailure(e);
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        onlyTables?.length != null && onlyTables.length > 0 ? 'capacity_baza_szablon_wybrane.xlsx' : 'capacity_baza_szablon.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    },
    /** Multipart: confirm === IMPORTUJ_BAZE, opcjonalnie onlyTables (JSON), na końcu plik. Pola tekstowe muszą być przed `file` — inaczej multer bywa bez `onlyTables` w req.body i import częściowy jest traktowany jak pełny. */
    importCapacityBundle: async (file: File, confirm: string, onlyTables?: string[]) => {
      const fd = new FormData();
      fd.append('confirm', confirm);
      if (onlyTables?.length) fd.append('onlyTables', JSON.stringify(onlyTables));
      fd.append('file', file);
      let res: Response;
      try {
        res = await fetch(`${BASE}/admin/capacity-bundle-import`, { method: 'POST', body: fd });
      } catch (e) {
        throw mapFetchFailure(e);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
      return data as { ok: boolean; tables_imported: string[]; rows_counts: Record<string, number>; partial: boolean };
    },
    /** Diagnostyka: czy backend ma endpoint szablonu v2 (`operacje-v2`). */
    fetchCapacityDataImportSchemaDiagnostics: async (): Promise<
      | { ok: true; schemaTag: string; templateFilename: string }
      | { ok: false; detail: string }
    > => {
      try {
        const res = await fetch(`${BASE}/admin/capacity-data-import-schema.txt${toQuery({ t: Date.now() })}`, {
          cache: 'no-store',
        });
        if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
        const text = await res.text();
        const lines = text
          .trim()
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        return {
          ok: true,
          schemaTag: lines[0] ?? '',
          templateFilename: lines[1] ?? '',
        };
      } catch (e) {
        return { ok: false, detail: mapFetchFailure(e).message };
      }
    },
    /** Lista arkuszy i nagłówków — ta sama wersja co capacity-data-template.xlsx (bez pobierania pliku). */
    fetchCapacityDataImportTemplateInfo: () =>
      request<{
        schemaTag: string;
        downloadFilename: string;
        sheets: string[];
        machinesSheetHeaders: string[];
        instructionRow1MustInclude: string;
      }>('/admin/capacity-data-template-info.json'),
    downloadCapacityDataTemplate: async (): Promise<{ backendSchemaHeader: string | null }> => {
      let res: Response;
      try {
        res = await fetch(`${BASE}/admin/capacity-data-template.xlsx${toQuery({ t: Date.now() })}`, {
          cache: 'no-store',
        });
      } catch (e) {
        throw mapFetchFailure(e);
      }
      const backendSchemaHeader = res.headers.get('X-Capacity-Data-Import-Schema');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const apiErr = (data as { error?: string }).error;
        if (res.status === 404) {
          throw new Error(
            apiErr ||
              'Endpoint importu danych nie został znaleziony (404). Zrestartuj serwer backend (w katalogu server: npm run dev) i odśwież stronę.',
          );
        }
        throw new Error(apiErr || res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      let filename = 'capacity_szablon_import_danych_v2.xlsx';
      const cd = res.headers.get('Content-Disposition');
      if (cd) {
        const m = /filename="([^"]+)"/i.exec(cd);
        if (m?.[1]) filename = m[1];
      }
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      return { backendSchemaHeader };
    },
    importCapacityData: async (
      file: File,
      confirm: string,
      options?: { mode?: 'merge' | 'replace' }
    ) => {
      const fd = new FormData();
      fd.append('confirm', confirm);
      fd.append('mode', options?.mode === 'replace' ? 'replace' : 'merge');
      fd.append('file', file);
      let res: Response;
      try {
        res = await fetch(`${BASE}/admin/capacity-data-import`, { method: 'POST', body: fd });
      } catch (e) {
        throw mapFetchFailure(e);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const apiErr = (data as { error?: string }).error;
        if (res.status === 404) {
          throw new Error(
            apiErr ||
              'Endpoint importu danych nie został znaleziony (404). Zrestartuj serwer backend (w katalogu server: npm run dev).',
          );
        }
        throw new Error(apiErr || res.statusText);
      }
      return data as {
        ok: boolean;
        backup_file?: string;
        backup_at?: string;
        counts: {
          machines_created: number;
          machines_updated: number;
          machines_deleted?: number;
          projects_created: number;
          projects_updated: number;
          projects_deleted?: number;
          designations_created: number;
          designations_updated: number;
          designations_deleted?: number;
          parts_created: number;
          parts_skipped: number;
          parts_deleted?: number;
          volumes_upserted: number;
          volumes_deleted?: number;
          operations_created: number;
          operations_updated: number;
          operations_deleted?: number;
          phases_created?: number;
        };
        warnings: string[];
        mode?: 'merge' | 'replace';
      };
    },
    downloadMachinesImportTemplate: async () => {
      let res: Response;
      try {
        res = await fetch(`${BASE}/admin/machines-import-template.xlsx${toQuery({ t: Date.now() })}`, { cache: 'no-store' });
      } catch (e) {
        throw mapFetchFailure(e);
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'maszyny_import.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    },
    importMachines: async (file: File, confirm: string) => {
      const fd = new FormData();
      fd.append('confirm', confirm);
      fd.append('file', file);
      let res: Response;
      try {
        res = await fetch(`${BASE}/admin/machines-import`, { method: 'POST', body: fd });
      } catch (e) {
        throw mapFetchFailure(e);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
      return data as {
        ok: boolean;
        created: number;
        updated: number;
        skipped: number;
        errors: string[];
        types_added: string[];
        backup_file?: string;
        backup_at?: string;
      };
    },
  },
  settings: {
    list: () => request<any[]>('/settings'),
    get: (id: number) => request<any>(`/settings/${id}`),
    create: (body: any) => request<any>('/settings', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: any) => request<any>(`/settings/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/settings/${id}`, { method: 'DELETE' }),
    fromMonths: (months: number[]) => request<{ working_days_year: number }>('/settings/from-months', { method: 'POST', body: JSON.stringify({ months }) }),
    getDefaults: () =>
      request<{
        working_days_year: number;
        oee_factor: number;
        shift_time_seconds: number;
        startup_shutdown_seconds: number;
        working_weeks_per_year: number;
        shifts_per_day: number;
      }>('/settings/defaults'),
    setDefaults: (body: {
      working_days_year?: number;
      oee_factor?: number;
      shift_time_seconds?: number;
      startup_shutdown_seconds?: number;
      working_weeks_per_year?: number;
      shifts_per_day?: number;
    }) =>
      request<{
        working_days_year: number;
        oee_factor: number;
        shift_time_seconds: number;
        startup_shutdown_seconds: number;
        working_weeks_per_year: number;
        shifts_per_day: number;
      }>('/settings/defaults', { method: 'PUT', body: JSON.stringify(body) }),
    getBehavior: () => request<{ volumes_autosave_enabled: boolean; ocu_enabled: boolean }>('/settings/behavior'),
    setBehavior: (body: { volumes_autosave_enabled?: boolean; ocu_enabled?: boolean }) =>
      request<{ volumes_autosave_enabled: boolean; ocu_enabled: boolean }>('/settings/behavior', { method: 'PUT', body: JSON.stringify(body) }),
    ocu: {
      list: () => request<any[]>('/settings/ocu'),
      get: (id: number) => request<any>(`/settings/ocu/${id}`),
      create: (body: any) => request<any>('/settings/ocu', { method: 'POST', body: JSON.stringify(body) }),
      update: (id: number, body: any) => request<any>(`/settings/ocu/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      delete: (id: number) => request<void>(`/settings/ocu/${id}`, { method: 'DELETE' }),
      getDefaults: () =>
        request<{
          working_days_year: number;
          oee_factor: number;
          shift_time_seconds: number;
          startup_shutdown_seconds: number;
          working_weeks_per_year: number;
          shifts_per_day: number;
        }>('/settings/ocu/defaults'),
      setDefaults: (body: {
        working_days_year?: number;
        oee_factor?: number;
        shift_time_seconds?: number;
        startup_shutdown_seconds?: number;
        working_weeks_per_year?: number;
        shifts_per_day?: number;
      }) =>
        request<{
          working_days_year: number;
          oee_factor: number;
          shift_time_seconds: number;
          startup_shutdown_seconds: number;
          working_weeks_per_year: number;
          shifts_per_day: number;
        }>('/settings/ocu/defaults', { method: 'PUT', body: JSON.stringify(body) }),
    },
    visual: {
      get: () =>
        request<{
          show_alternative_borders: boolean;
          show_rfq_badge: boolean;
          colorize_load_cells: boolean;
          colorize_sum_row: boolean;
          colorize_avg_row: boolean;
          reference_display: 'sap' | 'alias' | 'both';
          machine_display: 'sap' | 'internal' | 'both';
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
        }>('/settings/visual'),
      update: (body: {
        show_alternative_borders: boolean;
        show_rfq_badge: boolean;
        colorize_load_cells: boolean;
        colorize_sum_row: boolean;
        colorize_avg_row: boolean;
        reference_display: 'sap' | 'alias' | 'both';
        machine_display: 'sap' | 'internal' | 'both';
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
      }) => request<any>('/settings/visual', { method: 'PUT', body: JSON.stringify(body) }),
    },
    phases: {
      list: () => request<{ id: number; name: string }[]>('/settings/phases'),
      create: (name: string) => request<{ id: number; name: string }>('/settings/phases', { method: 'POST', body: JSON.stringify({ name }) }),
      update: (id: number, name: string) => request<{ id: number; name: string }>(`/settings/phases/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
      delete: (id: number) => request<void>(`/settings/phases/${id}`, { method: 'DELETE' }),
    },
    designations: {
      list: () =>
        request<
          {
            id: number;
            designation?: string;
            sap_number?: string | null;
            alias?: string | null;
            free_text?: string | null;
            slot_number?: string | null;
            projects?: { id: number; name: string }[];
            machine_lines?: string[];
          }[]
        >('/settings/designations'),
      create: (body: { sap_number?: string; alias?: string; free_text?: string; slot_number?: string; designation?: string }) =>
        request<{
          id: number;
          designation?: string;
          sap_number?: string | null;
          alias?: string | null;
          free_text?: string | null;
          slot_number?: string | null;
          projects?: { id: number; name: string }[];
          machine_lines?: string[];
        }>('/settings/designations', { method: 'POST', body: JSON.stringify(body) }),
      update: (id: number, body: { sap_number?: string; alias?: string; free_text?: string; slot_number?: string; designation?: string }) =>
        request<{
          id: number;
          designation?: string;
          sap_number?: string | null;
          alias?: string | null;
          free_text?: string | null;
          slot_number?: string | null;
          projects?: { id: number; name: string }[];
          machine_lines?: string[];
        }>(`/settings/designations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      delete: (id: number) => request<void>(`/settings/designations/${id}`, { method: 'DELETE' }),
      relatedOperations: (id: number) =>
        request<{
          operations: {
            id: number;
            project_id: number;
            project_client: string;
            project_name: string;
            machine_id: number;
            machine_internal: string | number | null;
            phase_name: string;
            cycle_time_seconds: number;
            is_set: number;
            has_children: number;
            label: string;
            detail_label: string;
          }[];
        }>(`/settings/designations/${id}/related-operations`),
      deleteCascade: (id: number, operation_ids: number[]) =>
        request<{
          operations_deleted: number;
          designation_deleted: boolean;
          operations_remaining: number;
          errors: string[];
        }>(`/settings/designations/${id}/delete-cascade`, {
          method: 'POST',
          body: JSON.stringify({ operation_ids }),
        }),
    },
    machineTypes: {
      list: () => request<{ id: number; name: string; default_machine_usage: number }[]>('/settings/machine-types'),
      create: (body: { name: string; default_machine_usage?: number }) =>
        request<{ id: number; name: string; default_machine_usage: number }>('/settings/machine-types', { method: 'POST', body: JSON.stringify(body) }),
      update: (id: number, body: { name: string; default_machine_usage?: number }) =>
        request<{ id: number; name: string; default_machine_usage: number }>(`/settings/machine-types/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
      delete: (id: number) => request<void>(`/settings/machine-types/${id}`, { method: 'DELETE' }),
      syncFromMachines: () =>
        request<{ inserted: number; types: { id: number; name: string; default_machine_usage: number }[] }>(
          '/settings/machine-types/sync-from-machines',
          { method: 'POST' }
        ),
    },
  },
  machines: {
    list: (params?: { status?: string; statuses?: string; type?: string; types?: string; search?: string }) => {
      const q = toQuery(params || {});
      return request<any[]>(`/machines${q}`);
    },
    types: () => request<string[]>('/machines/types'),
    get: (id: number) => request<any>(`/machines/${id}`),
    activeProjectOperationCount: (id: number) =>
      request<{ count: number; projects: { id: number; client: string; name: string }[] }>(
        `/machines/${id}/active-project-operation-count`
      ),
    operations: (id: number, params?: { year?: number; scenarioId?: number; useContractualVolumes?: boolean }) => {
      const q = toQuery(params || {});
      return request<any[]>(`/machines/${id}/operations${q}`);
    },
    create: (body: any) => request<any>('/machines', { method: 'POST', body: JSON.stringify(body) }),
    import: (machines: any[]) => request<{ created: number; skipped: number; errors: string[]; createdNumbers: number[]; skippedNumbers: number[] }>('/machines/import', { method: 'POST', body: JSON.stringify({ machines }) }),
    update: (id: number, body: any) => request<any>(`/machines/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/machines/${id}`, { method: 'DELETE' }),
  },
  machineGroups: {
    list: () =>
      request<
        {
          id: number;
          name: string;
          created_at: string;
          machines: { id: number; internal_number: string | null; sap_number: string | null; type: string }[];
        }[]
      >('/machine-groups'),
    get: (id: number) => request<any>(`/machine-groups/${id}`),
    create: (name: string, machine_ids: number[] = []) =>
      request<any>('/machine-groups', { method: 'POST', body: JSON.stringify({ name, machine_ids }) }),
    update: (id: number, name: string, machine_ids?: number[]) =>
      request<any>(`/machine-groups/${id}`, { method: 'PUT', body: JSON.stringify({ name, machine_ids }) }),
    delete: (id: number) => request<void>(`/machine-groups/${id}`, { method: 'DELETE' }),
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
    list: (params?: { status?: string; statuses?: string; client?: string; clients?: string; search?: string }) => {
      const q = toQuery(params || {});
      return request<any[]>(`/projects${q}`);
    },
    clients: () => request<string[]>('/projects/clients'),
    get: (id: number) => request<any>(`/projects/${id}`),
    getVolumes: (id: number) => request<{ year: number; volume_value: number; volume_unit: string }[]>(`/projects/${id}/volumes`),
    setVolumes: (id: number, volumes: { year: number; volume_value: number; volume_unit: string; include_in_calculator_after_eop?: number | boolean }[]) => request<any[]>(`/projects/${id}/volumes`, { method: 'PUT', body: JSON.stringify({ volumes }) }),
    getVolumesContract: (id: number) =>
      request<{ year: number; volume_value: number; volume_unit: string; include_in_calculator_after_eop?: number }[]>(`/projects/${id}/volumes-contract`),
    setVolumesContract: (id: number, volumes: { year: number; volume_value: number; volume_unit: string; include_in_calculator_after_eop?: number | boolean }[]) =>
      request<any[]>(`/projects/${id}/volumes-contract`, { method: 'PUT', body: JSON.stringify({ volumes }) }),
    mirrorProjectVolumes: (id: number, direction: 'production_to_contract' | 'contract_to_production') =>
      request<{ ok: boolean }>(`/projects/${id}/volumes-mirror`, { method: 'POST', body: JSON.stringify({ direction }) }),
    create: (body: any) => request<any>('/projects', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: any) => request<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
    addPart: (projectId: number, body: any) => request<any>(`/projects/${projectId}/parts`, { method: 'POST', body: JSON.stringify(body) }),
    updatePart: (projectId: number, partId: number, body: any) => request<any>(`/projects/${projectId}/parts/${partId}`, { method: 'PUT', body: JSON.stringify(body) }),
    getPartVolumes: (projectId: number, partId: number) => request<{ year: number; volume_value: number; volume_unit: string }[]>(`/projects/${projectId}/parts/${partId}/volumes`),
    setPartVolumes: (projectId: number, partId: number, volumes: { year: number; volume_value: number; volume_unit: string }[]) => request<any[]>(`/projects/${projectId}/parts/${partId}/volumes`, { method: 'PUT', body: JSON.stringify({ volumes }) }),
    getPartVolumesContract: (projectId: number, partId: number) =>
      request<{ year: number; volume_value: number; volume_unit: string }[]>(`/projects/${projectId}/parts/${partId}/volumes-contract`),
    setPartVolumesContract: (projectId: number, partId: number, volumes: { year: number; volume_value: number; volume_unit: string }[]) =>
      request<any[]>(`/projects/${projectId}/parts/${partId}/volumes-contract`, { method: 'PUT', body: JSON.stringify({ volumes }) }),
    mirrorPartVolumes: (projectId: number, partId: number, direction: 'production_to_contract' | 'contract_to_production') =>
      request<{ ok: boolean }>(`/projects/${projectId}/parts/${partId}/volumes-mirror`, {
        method: 'POST',
        body: JSON.stringify({ direction }),
      }),
    addPartVolumeYear: (projectId: number, partId: number, year: number, volumeSide: 'production' | 'contract' = 'production') =>
      request<{ year: number; eop: string; eop_extended: boolean }>(`/projects/${projectId}/parts/${partId}/volume-year`, {
        method: 'POST',
        body: JSON.stringify({ year, volumeSide }),
      }),
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
    updateNote: (projectId: number, noteId: number, body: { note: string }) =>
      request<any>(`/projects/${projectId}/notes/${noteId}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteNote: (projectId: number, noteId: number) => request<void>(`/projects/${projectId}/notes/${noteId}`, { method: 'DELETE' }),
    getSessionActor: () => request<{ login: string }>('/projects/session/actor'),
    getAttachments: (projectId: number) =>
      request<{
        storage_configured: boolean;
        absolute_output_dir: string;
        attachments: {
          id: number;
          project_id: number;
          description: string;
          original_filename: string;
          stored_filename: string;
          mime_type: string | null;
          size_bytes: number;
          uploaded_at: string;
          uploaded_by: string | null;
          is_shared: number;
        }[];
      }>(`/projects/${projectId}/attachments`),
    uploadAttachment: async (projectId: number, file: File, description: string, shared = false) => {
      const fd = new FormData();
      fd.append('description', description);
      if (shared) fd.append('shared', '1');
      fd.append('file', file);
      let res: Response;
      try {
        res = await fetch(`${BASE}/projects/${projectId}/attachments`, { method: 'POST', body: fd });
      } catch (e) {
        throw mapFetchFailure(e);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
      return data;
    },
    deleteAttachment: (projectId: number, attachmentId: number) =>
      request<void>(`/projects/${projectId}/attachments/${attachmentId}`, { method: 'DELETE' }),
    attachmentDownloadUrl: (projectId: number, attachmentId: number) =>
      `${BASE}/projects/${projectId}/attachments/${attachmentId}/download`,
    operationsCopySources: (params?: { q?: string; limit?: number }) => {
      const q = toQuery((params || {}) as Record<string, string | number | boolean | undefined | null>);
      return request<{
        operations: {
          id: number;
          project_id: number;
          project_client: string;
          project_name: string;
          machine_id: number;
          phase_id: number;
          cycle_time_seconds: number;
          nests_count: number;
          oee_override: number | null;
          is_set: number;
          alt_cycle_time_seconds: number | null;
          alt_nests_count: number | null;
          alt_oee_override: number | null;
          alt_comment: string | null;
          use_alternative_in_calculator: number;
          phase_name: string;
          machine_internal: number | string;
          machine_sap: string | null;
          machine_type: string | null;
          detail_sap_number?: string | null;
          detail_alias?: string | null;
          detail_free_text?: string | null;
          label: string;
          set_designation_ids?: number[] | null;
          source_designation_id?: number | null;
        }[];
      }>(`/projects/operations-copy-sources${q}`);
    },
    history: (params?: {
      projectId?: number;
      projectIds?: string;
      machineId?: number;
      machineIds?: string;
      partId?: number;
      partIds?: string;
      client?: string;
      clients?: string;
      author?: string;
      authors?: string;
      text?: string;
    }) => {
      const q = toQuery((params || {}) as Record<string, string | number | boolean | undefined | null>);
      return request<any[]>(`/projects/history${q}`);
    },
    historyFilters: () =>
      request<{
        projects: { id: number; client: string; name: string }[];
        clients: string[];
        machines: { id: number; sap_number?: string | null; internal_number?: string | null; type?: string | null }[];
        details: { id: number; label: string }[];
        authors: string[];
      }>('/projects/history/filters'),
  },
  capacity: {
    calculator: (params?: {
      yearFrom?: number;
      yearTo?: number;
      type?: string;
      types?: string;
      machines?: string;
      scenarioId?: number;
      client?: string;
      clients?: string;
      useContractualVolumes?: boolean;
      machineStatus?: 'active' | 'inactive' | 'RFQ' | 'all';
      machineStatuses?: string;
      groupIds?: string;
      widthOp?: 'gte' | 'lte';
      widthValue?: number;
      depthOp?: 'gte' | 'lte';
      depthValue?: number;
      heightOp?: 'gte' | 'lte';
      heightValue?: number;
      strokeOp?: 'gte' | 'lte';
      strokeValue?: number;
      settingsProfile?: 'capacity' | 'ocu';
    }) => {
      const q = new URLSearchParams();
      if (params?.yearFrom != null) q.set('yearFrom', String(params.yearFrom));
      if (params?.yearTo != null) q.set('yearTo', String(params.yearTo));
      if (params?.type) q.set('type', params.type);
      if (params?.types) q.set('types', params.types);
      if (params?.machines) q.set('machines', params.machines);
      if (params?.scenarioId != null) q.set('scenarioId', String(params.scenarioId));
      if (params?.client) q.set('client', params.client);
      if (params?.clients) q.set('clients', params.clients);
      if (params?.useContractualVolumes) q.set('useContractualVolumes', '1');
      if (params?.machineStatuses) q.set('machineStatuses', params.machineStatuses);
      else if (params?.machineStatus != null) q.set('machineStatus', String(params.machineStatus));
      if (params?.groupIds) q.set('groupIds', params.groupIds);
      if (params?.settingsProfile === 'ocu') q.set('settingsProfile', 'ocu');
      const dimPairs = [
        ['width', params?.widthOp, params?.widthValue],
        ['depth', params?.depthOp, params?.depthValue],
        ['height', params?.heightOp, params?.heightValue],
        ['stroke', params?.strokeOp, params?.strokeValue],
      ] as const;
      for (const [prefix, op, val] of dimPairs) {
        if (op && val != null && Number.isFinite(val)) {
          q.set(`${prefix}Op`, op);
          q.set(`${prefix}Value`, String(val));
        }
      }
      const qs = q.toString();
      return request<{ yearFrom: number; yearTo: number; scenarioId: number | null; machines: any[] }>(`/capacity/calculator${qs ? `?${qs}` : ''}`);
    },
    breakdown: (params: {
      year: number;
      line?: string;
      machineId?: number;
      series: string;
      yearFrom?: number;
      yearTo?: number;
      type?: string;
      types?: string;
      client?: string;
      clients?: string;
      scenarioId?: number;
      machineStatus?: 'active' | 'inactive' | 'RFQ' | 'all';
      machineStatuses?: string;
      settingsProfile?: 'capacity' | 'ocu';
      widthOp?: 'gte' | 'lte';
      widthValue?: number;
      depthOp?: 'gte' | 'lte';
      depthValue?: number;
      heightOp?: 'gte' | 'lte';
      heightValue?: number;
      strokeOp?: 'gte' | 'lte';
      strokeValue?: number;
    }) => {
      const q = new URLSearchParams();
      q.set('year', String(params.year));
      q.set('series', params.series);
      if (params.line) q.set('line', params.line);
      if (params.machineId != null) q.set('machineId', String(params.machineId));
      if (params.yearFrom != null) q.set('yearFrom', String(params.yearFrom));
      if (params.yearTo != null) q.set('yearTo', String(params.yearTo));
      if (params.types) q.set('types', params.types);
      else if (params.type) q.set('type', params.type);
      if (params.clients) q.set('clients', params.clients);
      else if (params.client) q.set('client', params.client);
      if (params.scenarioId != null) q.set('scenarioId', String(params.scenarioId));
      if (params.machineStatuses) q.set('machineStatuses', params.machineStatuses);
      else if (params.machineStatus != null) q.set('machineStatus', String(params.machineStatus));
      if (params.settingsProfile === 'ocu') q.set('settingsProfile', 'ocu');
      const dimPairs = [
        ['width', params.widthOp, params.widthValue],
        ['depth', params.depthOp, params.depthValue],
        ['height', params.heightOp, params.heightValue],
        ['stroke', params.strokeOp, params.strokeValue],
      ] as const;
      for (const [prefix, op, val] of dimPairs) {
        if (op && val != null && Number.isFinite(val)) {
          q.set(`${prefix}Op`, op);
          q.set(`${prefix}Value`, String(val));
        }
      }
      return request<{
        year: number;
        series: Partial<
          Record<
            'production' | 'contract' | 'scenario_production' | 'scenario_contract',
            {
              load_percent: number | null;
              clients: {
                client: string;
                load_percent: number;
                share_percent: number;
                projects: {
                  project_id: number;
                  project_name: string;
                  load_percent: number;
                  share_percent: number;
                  details: {
                    detail_label: string;
                    load_percent: number;
                    share_percent: number;
                    has_rfq: boolean;
                  }[];
                }[];
              }[];
            }
          >
        >;
      }>(`/capacity/breakdown?${q.toString()}`);
    },
    settings: (year: number, params?: { settingsProfile?: 'capacity' | 'ocu' }) => {
      const q = params?.settingsProfile === 'ocu' ? '?settingsProfile=ocu' : '';
      return request<any>(`/capacity/settings/${year}${q}`);
    },
    machine: (machineId: number, params?: { yearFrom?: number; yearTo?: number; scenarioId?: number; useContractualVolumes?: boolean; settingsProfile?: 'capacity' | 'ocu' }) => {
      const q = new URLSearchParams();
      if (params?.yearFrom != null) q.set('yearFrom', String(params.yearFrom));
      if (params?.yearTo != null) q.set('yearTo', String(params.yearTo));
      if (params?.scenarioId != null) q.set('scenarioId', String(params.scenarioId));
      if (params?.useContractualVolumes) q.set('useContractualVolumes', '1');
      if (params?.settingsProfile === 'ocu') q.set('settingsProfile', 'ocu');
      const qs = q.toString();
      return request<any>(`/capacity/machine/${machineId}${qs ? `?${qs}` : ''}`);
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
    candidates: (machineId: number, params?: { year?: number; maxLoad?: number; includeOverloadedAlternatives?: boolean; scenarioId?: number; useContractualVolumes?: boolean }) => {
      const q = toQuery((params || {}) as Record<string, string | number | boolean | undefined>);
      return request<{ candidates: any[] }>(`/allocation/candidates/${machineId}${q}`);
    },
    hint: (machineId: number, params: { year: number; operationId: number; operationIds?: string; scenarioId?: number; useContractualVolumes?: boolean }) => {
      const q = toQuery(params as Record<string, string | number | boolean | undefined | null>);
      return request<{
        current_load_percent: number;
        op_load_percent: number;
        suggested_volume_to_reach_100: number;
        suggested_volume_unit: string;
        effective_volume_value: number;
        effective_volume_unit: string;
        load_ratio_sum: number;
        usage: number;
        op_ratio_contrib: number;
        weekly_volume_effective: number;
        working_weeks_per_year: number;
        year_fraction: number;
      }>(`/allocation/hint/${machineId}${q ? `?${q}` : ''}`);
    },
    execute: (body: {
      operationId: number;
      targetMachineId: number;
      volumeToMove: number;
      volumeUnit: string;
      year: number;
      cycleTimeSecondsOnTarget?: number | null;
      useAlternativeCycleOnTarget?: boolean;
      scenarioId?: number;
      useContractualVolumes?: boolean;
    }) => request<any>('/allocation/execute', { method: 'POST', body: JSON.stringify(body) }),
  },
  scenarios: {
    list: (params?: { archived?: boolean }) =>
      request<
        {
          id: number;
          name: string;
          created_at: string;
          scenario_scope?: string;
          source_scenario_id?: number | null;
          source_scenario_name?: string | null;
          updated_at?: string | null;
          archived_at?: string | null;
        }[]
      >(`/scenarios${params?.archived ? '?archived=1' : ''}`),
    get: (id: number) =>
      request<{
        id: number;
        name: string;
        scenario_scope?: string;
        created_at: string;
        updated_at?: string | null;
        source_scenario_id?: number | null;
        archived_at?: string | null;
        snapshot: any;
      }>(`/scenarios/${id}`),
    create: (body: { name: string; scenario_scope: string; sourceScenarioId?: number | null }) =>
      request<{ id: number; name: string; scenario_scope?: string; created_at: string; source_scenario_id?: number | null; updated_at?: string | null }>(
        '/scenarios',
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      ),
    update: (id: number, body: { name?: string; scenario_scope?: string; snapshot?: unknown }) =>
      request<{ id: number; name: string; scenario_scope?: string; created_at: string; source_scenario_id?: number | null; updated_at?: string | null }>(
        `/scenarios/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(body),
        }
      ),
    historyFilters: (scenarioId: number) =>
      request<{
        projects: { id: number; client: string; name: string }[];
        clients: string[];
        machines: { id: number; sap_number?: string | null; internal_number?: string | null; type?: string | null }[];
        details: { id: number; label: string }[];
        authors: string[];
      }>(`/scenarios/${scenarioId}/history/filters`),
    history: (
      scenarioId: number,
      params?: {
        projectId?: number;
        projectIds?: string;
        machineId?: number;
        machineIds?: string;
        partId?: number;
        partIds?: string;
        client?: string;
        clients?: string;
        author?: string;
        authors?: string;
        text?: string;
      }
    ) => {
      const q = toQuery((params || {}) as Record<string, string | number | boolean | undefined | null>);
      return request<any[]>(`/scenarios/${scenarioId}/history${q}`);
    },
    patchProjectStatus: (scenarioId: number, projectId: number, body: { status: 'active' | 'inactive' | 'RFQ' }) =>
      request<{ id: number; status: string; unchanged?: boolean }>(`/scenarios/${scenarioId}/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    patchPartStatus: (scenarioId: number, partId: number, body: { status: 'active' | 'inactive' | 'RFQ' | null }) =>
      request<{ id: number; status: string | null; unchanged?: boolean }>(`/scenarios/${scenarioId}/parts/${partId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    patchOperationStatus: (scenarioId: number, operationId: number, body: { status: 'active' | 'inactive' | 'RFQ' | null }) =>
      request<{ id: number; status: string | null; unchanged?: boolean }>(`/scenarios/${scenarioId}/operations/${operationId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    addableProjects: (scenarioId: number) =>
      request<{ id: number; client: string; name: string; sop: string | null; eop: string | null; status: string }[]>(
        `/scenarios/${scenarioId}/addable-projects`
      ),
    addProjectsFromCapacity: (scenarioId: number, body: { projectIds: number[] }) =>
      request<{
        ok: boolean;
        addedProjectIds: number[];
        skippedAlreadyInBundle: number[];
        notFoundInProduction: number[];
      }>(`/scenarios/${scenarioId}/add-projects-from-capacity`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    deployChallenge: (id: number) =>
      request<{ phrase: string; expiresInSec: number; deployToken: string }>(`/scenarios/${id}/deploy-challenge`),
    applyToProduction: (id: number, body: { challengePhrase: string; deployToken: string }) =>
      request<{ ok: boolean; message: string }>(`/scenarios/${id}/apply-to-production`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    /** Częściowe wgranie: wybrane projekty (całość) lub wybrane detale; bez nadpisywania całej bazy / working_days. */
    applySubsetToProduction: (
      id: number,
      body: { challengePhrase: string; deployToken: string; projectIds: number[]; partIds?: number[] }
    ) =>
      request<{ ok: boolean; message: string; projectsTouched?: number; partsTouched?: number; mode?: string }>(
        `/scenarios/${id}/apply-subset-to-production`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      ),
    delete: (id: number) => request<void>(`/scenarios/${id}`, { method: 'DELETE' }),
    archive: (id: number) => request<{ ok: boolean }>(`/scenarios/${id}/archive`, { method: 'POST' }),
    unarchive: (id: number) => request<{ ok: boolean }>(`/scenarios/${id}/unarchive`, { method: 'POST' }),
  },
};
