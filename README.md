# Capacity Planning Application

Aplikacja Autoneum do planowania i analizy obciążenia linii oraz maszyn.  
Stack: **React (TypeScript)** + **Express (TypeScript)** + **SQLite (sql.js)**.

Pełna instrukcja w aplikacji: **Administracja → Instrukcja obsługi** (PL / EN / DE).

## Funkcje (przegląd)

| Obszar | Opis |
|--------|------|
| **Logowanie / RBAC** | Konta, role, uprawnienia do ekranów i API |
| **Kalkulator** | Obciążenie % w latach / miesiącach / tygodniach (ISO); filtry; suma / średnia / **max średnia wg typu**; alokacja wolumenów; eksport PDF/Excel |
| **Maszyny** | CRUD, wymiary, status, OEE, alternatywy, gniazda, import Excel |
| **Projekty** | Detale, operacje, wolumeny prod./kontraktowe, SOP/EOP, sety, notatki, załączniki |
| **Detale** | Katalog SAP / Alias / Free text, walidacja duplikatów |
| **Scenariusze** | Snapshot „co jeśli”, edycja kopii, źródło z produkcji / scenariusza / Call offs, apply do produkcji |
| **Call offs** | Import Sales Forecast (SAP), mapowanie, kalkulator dualny, serie w wizualizacji |
| **Wizualizacja danych** | Trendy linii/maszyn, analityka, multiwybór scenariuszy, Call offs, Flex ±%, filtry wymiarów, PDF/Excel |
| **Administracja** | Ustawienia bazy (dni robocze Capacity/OCU, słowniki, wizualne), backup/import, użytkownicy, historia zmian |

### Tryby w nagłówku

- **Wolumeny kontraktowe** — kalkulator używa wolumenów kontraktowych (fallback na produkcyjne).
- **Wersja produkcyjna / Scenariusze / Call offs** — przestrzenie robocze (różne źródło danych).
- **Capacity / OCU** — osobny profil parametrów (OEE, dni robocze), ta sama formuła obciążenia.
- **Język** — PL / EN / DE.

### Agregacja (kalkulator + wizualizacja)

Dla grupy maszyn: średnia `%` w ramach każdego **typu**, potem **maksimum** z tych średnich (wiersz „Max średnia wg typu” oraz serie linii w Data Viz).

## Uruchomienie

### Wymagania

- Node.js 18+

### Instalacja

```bash
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### Tryb deweloperski

```bash
npm run dev
```

- API: `http://localhost:3001`
- UI (Vite): `http://localhost:5173` (proxy `/api` → 3001)
- Baza: `server/capacity.db` (migracje przy starcie)

### Budowa produkcyjna

```bash
npm run build
npm start
```

Serwer serwuje UI z `client/dist`. Po aktualizacji kodu na drugim komputerze: `git pull` → `npm run build` → restart `npm start` → twarde odświeżenie (Ctrl+F5).

## Przepływy (skrót)

1. **Master data** → słowniki i maszyny → projekty z operacjami i wolumenami → Kalkulator.  
2. **Alokacja** → przeciążona maszyna → kandydaci (gniazdo / alternatywy) → przeniesienie wolumenu.  
3. **Scenariusz** → utwórz snapshot → edytuj kopię → porównaj w Data Viz → opcjonalnie apply do produkcji.  
4. **Call offs** → plik SalesFcst → mapowanie SAP → kalkulator dualny / serie na wykresach.  
5. **Wizualizacja** → serie bazowe + Call offs + multi-scenariusze → Flex → eksport.

Szczegóły wzorów (dostępność, wolumen tygodniowy, obciążenie, SOP/EOP, max wg typu): instrukcja w aplikacji, sekcja „Wzory obliczeniowe”, oraz `server/CAPACITY_LOGIC.md`.

## API (skrót)

- Auth / users / roles — `/api/auth`, `/api/users`, …
- Settings, machines, nests, alternatives, projects — jak wcześniej
- `GET /api/capacity/calculator` — m.in. `scenarioId`, `useContractualVolumes`, `settingsProfile=ocu`
- Call offs — `/api/call-offs` (lista, upload, calculator)
- Scenarios — `/api/scenarios` (CRUD, snapshot, apply, historia)
- Allocation — `/api/allocation/…`

## GitHub

Repozytorium: **[github.com/xxleszcz18/capacity](https://github.com/xxleszcz18/capacity)** (`main`).

```powershell
git push -u origin main
```

W `.gitignore`: `node_modules/`, `*.db`, lokalne backupy itd.

## Zasady capacity (skrót)

- **Dostępność** z dni roboczych, czasu zmiany, OEE i startup/shutdown; OEE: operacja > maszyna > ustawienia roku.  
- **Obciążenie %** = wymagany czas / dostępność × machine usage.  
- **Alokacja**: kandydaci z gniazda lub alternatyw; wykonanie = zmniejszenie wolumenu + nowa operacja na maszynie docelowej.  
- **% capacity** na maszynie dzielonej: suma operacji = 100% (walidacja przy zapisie).
