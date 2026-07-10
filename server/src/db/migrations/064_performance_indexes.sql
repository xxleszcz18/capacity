CREATE INDEX IF NOT EXISTS idx_operations_machine_id ON operations(machine_id);
CREATE INDEX IF NOT EXISTS idx_operations_project_id ON operations(project_id);
CREATE INDEX IF NOT EXISTS idx_operations_part_id ON operations(part_id);
CREATE INDEX IF NOT EXISTS idx_parts_project_id ON parts(project_id);
CREATE INDEX IF NOT EXISTS idx_nest_machines_machine_id ON nest_machines(machine_id);
