CREATE TABLE machine_alternatives (
  machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  alternative_machine_id INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  PRIMARY KEY (machine_id, alternative_machine_id),
  CHECK (machine_id != alternative_machine_id)
);
