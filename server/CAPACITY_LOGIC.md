# Logika obliczania obciążenia (load %) i capacity

## 1. Dostępność maszyny [s/tydzień]

```
availability_sec_per_week = (working_days_year / 52) * shift_time_seconds * 60 * shifts_per_day * OEE - startup_shutdown_seconds
```

- **working_days_year** – liczba dni roboczych w roku (Ustawienia → Dni robocze)
- **shift_time_seconds** – czas jednej zmiany w **minutach** (np. 450 = 7,5 h)
- **shifts_per_day** – liczba zmian na dobę (1, 2 lub 3) – z ustawień dni roboczych
- **OEE** – z operacji (pole OEE), z maszyny lub domyślny z ustawień
- **startup_shutdown_seconds** – czas uruchomienia/zakończenia [s] odejmowany od dostępności

## 2. Wolumen na tydzień [szt/tydzień]

- **volume_unit = 'annual' (roczny):** `volume_value / working_weeks_per_year` (domyślnie 48 pracujących tygodni)
- **volume_unit = 'monthly' (miesięczny):** `(volume_value * 12) / working_weeks_per_year`
- **volume_unit = 'weekly' (tygodniowy):** `volume_value`

**working_weeks_per_year** (np. 48) jest ustawiane w Ustawieniach → Dni robocze.

## 3. Wymagany czas [s/tydzień] na maszynie

```
required_sec_per_week = suma po wszystkich operacjach na danej maszynie: (weekly_volume * cycle_time_seconds)
```

Dla operacji można ustawić **wolumen na wybrane lata** (Edycja operacji → Wolumeny na wybrane lata).  
Jeśli dla danego roku jest wpis w `operation_volume_by_year`, używana jest ta wartość zamiast domyślnego `volume_value` / `volume_unit` operacji.

## 4. Obciążenie

```
load_percent = round((required_sec_per_week / availability_sec_per_week) * 100)
```

Np. 153% oznacza, że wymagany czas jest o 53% większy niż dostępność (przeciążenie).

## Uwagi

- Upewnij się, że w **Ustawienia → Dni robocze** dla danego roku masz:
  - **Pracujące tygodnie w roku** = 48 (lub inna wartość)
  - **Liczba zmian na dobę** = 1, 2 lub 3
- Przy jednej zmianie i 48 tygodniach roczny wolumen 52479 szt daje 52479/48 ≈ 1093 szt/tydzień.  
  Przy cyklu 60 s: 1093 * 60 = 65 580 s/tydzień wymagane.  
  Dostępność zależy od dni roboczych, czasu zmiany i OEE – jeśli jest za niska, load % będzie wysoki.
