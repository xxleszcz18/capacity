-- Wymiary maszyny (mm): szerokość, głębokość, wysokość, skok
ALTER TABLE machines ADD COLUMN width_mm REAL;
ALTER TABLE machines ADD COLUMN depth_mm REAL;
ALTER TABLE machines ADD COLUMN height_mm REAL;
ALTER TABLE machines ADD COLUMN stroke_mm REAL;
