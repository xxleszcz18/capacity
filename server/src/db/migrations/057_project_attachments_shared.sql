ALTER TABLE project_attachments ADD COLUMN is_shared INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_project_attachments_shared ON project_attachments(is_shared);
