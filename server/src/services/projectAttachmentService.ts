import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db, saveDb } from '../db/connection.js';
import { resolveStoragePath } from '../utils/storagePath.js';

export const ATTACHMENTS_STORAGE_NOT_CONFIGURED = 'ATTACHMENTS_STORAGE_NOT_CONFIGURED';
const SETTING_KEY = 'project_attachments_output_dir';
const SHARED_DIR = 'shared';

export type ProjectAttachmentRow = {
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
};

export function getAttachmentsOutputDirRaw(): string {
  const row = db.prepare('SELECT value FROM admin_settings WHERE key = ?').get(SETTING_KEY) as { value?: string } | undefined;
  return row?.value != null ? String(row.value).trim() : '';
}

export function isAttachmentsStorageConfigured(): boolean {
  return getAttachmentsOutputDirRaw().length > 0;
}

export function resolveAttachmentsDirectory(rawDir?: string): string {
  const raw = (rawDir ?? getAttachmentsOutputDirRaw()).trim();
  if (!raw) {
    const err = new Error(ATTACHMENTS_STORAGE_NOT_CONFIGURED);
    throw err;
  }
  return resolveStoragePath(raw, 'attachments');
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()ąćęłńóśźżĄĆĘŁŃÓŚŹŻ+]/gi, '_');
  return base.slice(0, 180) || 'file';
}

function buildStoredFilename(originalFilename: string): string {
  const stamp = Date.now();
  const rand = crypto.randomBytes(4).toString('hex');
  return `${stamp}_${rand}_${sanitizeFilename(originalFilename)}`;
}

function attachmentStorageDir(row: Pick<ProjectAttachmentRow, 'project_id' | 'is_shared'>): string {
  const root = resolveAttachmentsDirectory();
  const subdir = row.is_shared ? SHARED_DIR : `project_${row.project_id}`;
  const dir = path.join(root, subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function listProjectAttachments(projectId: number): ProjectAttachmentRow[] {
  return db
    .prepare(
      `SELECT * FROM project_attachments
       WHERE project_id = ? OR is_shared = 1
       ORDER BY uploaded_at DESC, id DESC`,
    )
    .all(projectId) as ProjectAttachmentRow[];
}

export function getProjectAttachment(projectId: number, attachmentId: number): ProjectAttachmentRow | null {
  const row = db
    .prepare('SELECT * FROM project_attachments WHERE id = ? AND (project_id = ? OR is_shared = 1)')
    .get(attachmentId, projectId) as ProjectAttachmentRow | undefined;
  return row ?? null;
}

export function getAttachmentAbsolutePath(row: ProjectAttachmentRow): string {
  const subdir = row.is_shared ? SHARED_DIR : `project_${row.project_id}`;
  return path.join(resolveAttachmentsDirectory(), subdir, row.stored_filename);
}

export function createProjectAttachment(
  projectId: number,
  buffer: Buffer,
  originalFilename: string,
  mimeType: string,
  description: string,
  uploadedBy: string,
  isShared = false,
): ProjectAttachmentRow {
  const storedFilename = buildStoredFilename(originalFilename);
  const dir = attachmentStorageDir({ project_id: projectId, is_shared: isShared ? 1 : 0 });
  const fullPath = path.join(dir, storedFilename);
  fs.writeFileSync(fullPath, buffer);

  const now = new Date().toISOString();
  const safeOriginal = sanitizeFilename(originalFilename);
  const r = db
    .prepare(
      `INSERT INTO project_attachments
        (project_id, description, original_filename, stored_filename, mime_type, size_bytes, uploaded_at, uploaded_by, is_shared)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      projectId,
      description.trim(),
      safeOriginal,
      storedFilename,
      mimeType || null,
      buffer.length,
      now,
      uploadedBy,
      isShared ? 1 : 0,
    );

  saveDb();
  return db.prepare('SELECT * FROM project_attachments WHERE id = ?').get(r.lastInsertRowid) as ProjectAttachmentRow;
}

export function deleteProjectAttachment(projectId: number, attachmentId: number): ProjectAttachmentRow | null {
  const row = getProjectAttachment(projectId, attachmentId);
  if (!row) return null;
  try {
    const filePath = getAttachmentAbsolutePath(row);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore missing file */
  }
  db.prepare('DELETE FROM project_attachments WHERE id = ?').run(attachmentId);
  saveDb();
  return row;
}

export function listAllProjectIds(): number[] {
  return (db.prepare('SELECT id FROM projects ORDER BY id').all() as { id: number }[]).map((r) => Number(r.id));
}

export type AdminAttachmentListItem = ProjectAttachmentRow & {
  project_client: string;
  project_name: string;
  /** Katalog względem katalogu głównego załączników, np. `shared` lub `project_12`. */
  relative_dir: string;
  /** Pełna ścieżka pliku na dysku (gdy magazyn skonfigurowany). */
  absolute_path: string | null;
  file_exists: boolean | null;
};

export function listAllAttachmentsForAdmin(): {
  storage_configured: boolean;
  storage_root: string | null;
  attachments: AdminAttachmentListItem[];
} {
  const storageConfigured = isAttachmentsStorageConfigured();
  let storageRoot: string | null = null;
  if (storageConfigured) {
    try {
      storageRoot = resolveAttachmentsDirectory();
    } catch {
      storageRoot = null;
    }
  }

  const rows = db
    .prepare(
      `SELECT a.*,
              TRIM(COALESCE(p.client, '')) AS project_client,
              TRIM(COALESCE(p.name, '')) AS project_name
       FROM project_attachments a
       JOIN projects p ON p.id = a.project_id
       ORDER BY a.uploaded_at DESC, a.id DESC`,
    )
    .all() as (ProjectAttachmentRow & { project_client: string; project_name: string })[];

  const attachments: AdminAttachmentListItem[] = rows.map((row) => {
    const relative_dir = row.is_shared ? SHARED_DIR : `project_${row.project_id}`;
    let absolute_path: string | null = null;
    let file_exists: boolean | null = null;
    if (storageRoot) {
      absolute_path = path.join(storageRoot, relative_dir, row.stored_filename);
      try {
        file_exists = fs.existsSync(absolute_path);
      } catch {
        file_exists = null;
      }
    }
    return {
      ...row,
      project_client: row.project_client,
      project_name: row.project_name,
      relative_dir,
      absolute_path,
      file_exists,
    };
  });

  return { storage_configured: storageConfigured, storage_root: storageRoot, attachments };
}
