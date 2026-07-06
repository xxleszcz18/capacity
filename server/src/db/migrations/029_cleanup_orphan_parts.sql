-- Porządki: w projektach trzymaj tylko detale użyte przez operacje (główne part_id lub członkowie setów).
DELETE FROM parts
WHERE id NOT IN (
  SELECT o.part_id
  FROM operations o
  UNION
  SELECT osm.part_id
  FROM operation_set_members osm
);
