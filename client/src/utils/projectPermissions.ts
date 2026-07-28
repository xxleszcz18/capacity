/** Client helpers for project RBAC (mirrors server permissions.ts). */

export function canCreateProject(hasPermission: (key: string) => boolean): boolean {
  return hasPermission('projects.edit') || hasPermission('projects.create_rfq');
}

/** Pełna edycja albo tylko projekty RFQ przy create_rfq. */
export function canEditProjectContent(
  hasPermission: (key: string) => boolean,
  projectStatus: string | null | undefined
): boolean {
  if (hasPermission('projects.edit')) return true;
  if (hasPermission('projects.create_rfq') && projectStatus === 'RFQ') return true;
  return false;
}

/** Pobieranie plików załączników projektu — wymaga Pobierania przy „Załączniki”. */
export function canDownloadProjectAttachments(hasPermission: (key: string) => boolean): boolean {
  return hasPermission('admin_attachments.download');
}

/** Statusy dostępne przy tworzeniu: RFQ-only gdy brak pełnej edycji. */
export function allowedCreateProjectStatuses(
  hasPermission: (key: string) => boolean
): Array<'active' | 'inactive' | 'RFQ'> {
  if (hasPermission('projects.edit')) return ['active', 'inactive', 'RFQ'];
  if (hasPermission('projects.create_rfq')) return ['RFQ'];
  return [];
}
