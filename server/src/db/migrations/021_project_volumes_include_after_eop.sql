-- Flaga: liczyć ten rok w kalkulatorze mimo że jest po dacie EOP (zmienione ręcznie)
ALTER TABLE project_volumes ADD COLUMN include_in_calculator_after_eop INTEGER NOT NULL DEFAULT 0;
