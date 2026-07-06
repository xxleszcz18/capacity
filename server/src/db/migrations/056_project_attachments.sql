CREATE TABLE IF NOT EXISTS project_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  uploaded_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_attachments_project_id ON project_attachments(project_id);

INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('project_attachments_output_dir', '');
