ALTER TABLE project_notes ADD COLUMN machine_id INTEGER REFERENCES machines(id) ON DELETE SET NULL;
ALTER TABLE project_notes ADD COLUMN part_id INTEGER REFERENCES parts(id) ON DELETE SET NULL;
ALTER TABLE project_notes ADD COLUMN operation_id INTEGER REFERENCES operations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_machine_id ON project_notes(machine_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_part_id ON project_notes(part_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_operation_id ON project_notes(operation_id);
