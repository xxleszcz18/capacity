-- Katalog detali (oznaczeń) do wyboru przy tworzeniu części w projektach
CREATE TABLE IF NOT EXISTS part_designations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  designation TEXT NOT NULL UNIQUE
);
