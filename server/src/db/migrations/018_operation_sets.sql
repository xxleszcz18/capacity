-- Operacja może dotyczyć pojedynczej części (is_set=0) lub setu 2+ detali (is_set=1).
-- Dla setu: wolumen = liczba setów, cykl wspólny, w jednym cyklu powstaje po 1 szt każdego detalu z setu.
ALTER TABLE operations ADD COLUMN is_set INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS operation_set_members (
  operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  quantity_per_set INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (operation_id, part_id)
);
