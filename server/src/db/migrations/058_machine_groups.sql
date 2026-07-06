CREATE TABLE IF NOT EXISTS machine_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS machine_group_members (
  group_id INTEGER NOT NULL REFERENCES machine_groups(id) ON DELETE CASCADE,
  machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, machine_id)
);

CREATE INDEX IF NOT EXISTS idx_machine_group_members_machine ON machine_group_members(machine_id);
