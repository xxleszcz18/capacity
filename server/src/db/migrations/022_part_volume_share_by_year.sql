-- Udział % w wolumenie projektu dla detalu – osobno na dany rok (nadpisuje volume_share_percent dla tego roku)
CREATE TABLE IF NOT EXISTS part_volume_share_by_year (
  part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  share_percent REAL NOT NULL,
  PRIMARY KEY (part_id, year)
);
