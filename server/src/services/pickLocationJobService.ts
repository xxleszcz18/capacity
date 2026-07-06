import crypto from 'crypto';
import { pickWindowsDbFile, pickWindowsFolder } from '../utils/windowsFolderPicker.js';

export type PickLocationTarget = 'backup' | 'attachments' | 'backup-file';

export type PickLocationJobStatus = 'pending' | 'done' | 'cancelled' | 'error';

export type PickLocationJob = {
  status: PickLocationJobStatus;
  path?: string;
  error?: string;
};

const jobs = new Map<string, PickLocationJob>();

function pickErrorMessage(error?: string): string {
  if (error === 'NOT_WINDOWS') {
    return 'Wybór lokalizacji przez okno systemowe jest dostępny tylko na Windows.';
  }
  if (error === 'TIMEOUT') {
    return 'Przekroczono czas oczekiwania na wybór folderu. Spróbuj ponownie lub wpisz ścieżkę ręcznie.';
  }
  return error || 'Nie udało się otworzyć wyboru lokalizacji.';
}

export function startPickLocationJob(target: PickLocationTarget, initialDir?: string): string {
  const jobId = crypto.randomUUID();
  jobs.set(jobId, { status: 'pending' });

  void (async () => {
    try {
      const result =
        target === 'backup-file'
          ? await pickWindowsDbFile('Wybierz plik backupu bazy', initialDir ?? '')
          : await pickWindowsFolder(
              target === 'attachments'
                ? 'Wybierz folder przechowywania załączników projektów'
                : 'Wybierz lokalizację backupu bazy',
            );
      if (result.error) {
        jobs.set(jobId, { status: 'error', error: pickErrorMessage(result.error) });
        return;
      }
      if (result.chosen && result.path) {
        jobs.set(jobId, { status: 'done', path: result.path });
        return;
      }
      jobs.set(jobId, { status: 'cancelled' });
    } catch (e: any) {
      jobs.set(jobId, { status: 'error', error: pickErrorMessage(e?.message) });
    }
  })();

  return jobId;
}

export function getPickLocationJob(jobId: string): PickLocationJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  if (job.status !== 'pending') {
    jobs.delete(jobId);
  }
  return job;
}
