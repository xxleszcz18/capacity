-- Rezerwacja kolejnych identyfikatorów dla encji tworzonych w scenariuszu (bez wierszy w tabelach produkcyjnych).
-- Zapobiega kolizji id przy wgraniu do produkcji; nie wpływa na liczniki widocznych rekordów (brak wierszy w projects/parts/operations).

CREATE TABLE IF NOT EXISTS scenario_id_reservations (
  scenario_id INTEGER NOT NULL,
  entity TEXT NOT NULL CHECK (entity IN ('project', 'part', 'operation')),
  reserved_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (scenario_id, entity, reserved_id)
);

CREATE INDEX IF NOT EXISTS idx_scenario_res_entity_rid ON scenario_id_reservations(entity, reserved_id);
