CREATE TABLE process_phases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

INSERT INTO process_phases (name) VALUES
  ('Piankowanie'),
  ('Spienianie'),
  ('Cięcie prasa'),
  ('Cięcie WJ'),
  ('THM');
