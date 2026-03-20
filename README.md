# Capacity Planning Application

Aplikacja do planowania i obliczania capacity dla maszyn oraz linii (gniazd).  
Stack: **React (TypeScript)** + **Express (TypeScript)** + **SQLite (sql.js)**.

## Funkcje

- **Ustawienia** – dni robocze, OEE, czas zmiany, czas uruchomienie/zakończenie (per rok); przelicz z miesięcy.
- **Maszyny** – CRUD, typ, SAP, OEE nadpisany, status, lokalizacja; alternatywy; projekty; zajętość.
- **Gniazda** – definicja zespołów maszyn (nests), przypisywanie maszyn do gniazd.
- **Projekty** – klient, nazwa, SOP/EOP, status (aktywny/nieaktywny/RFQ); części; operacje (maszyna, faza, cykl, wolumen, OEE, % capacity, OPF); notatki.
- **Kalkulator** – tabela capacity wg lat (obciążenie %), filtry: typ maszyny, numery maszyn (oddzielone przecinkiem); szczegóły → maszyna.
- **Alokacja** – wykrywanie przeciążonych maszyn; propozycja wolnych maszyn (z gniazda lub z listy alternatyw, opcjonalnie ta sama lokalizacja); wykonanie alokacji (przeniesienie części wolumenu operacji na wybraną maszynę).

## Uruchomienie

### Wymagania

- Node.js 18+

### Instalacja

```bash
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### Serwer (API + baza)

```bash
cd server
npm run dev
```

Serwer nasłuchuje na `http://localhost:3001`. Baza SQLite jest zapisywana w pliku `server/capacity.db` (tworzony przy pierwszym uruchomieniu; migracje wykonują się automatycznie).

### Klient (React)

```bash
cd client
npm run dev
```

Aplikacja jest dostępna pod `http://localhost:5173`. Proxy przekierowuje `/api` na `http://localhost:3001`.

### Jednocześnie (z katalogu głównego)

```bash
npm run dev
```

Uruchamia serwer i klienta równolegle (wymaga `concurrently` w root: `npm install`).

## API (skrót)

- `GET/POST/PUT/DELETE /api/settings` – dni robocze (konfiguracja roczna)
- `POST /api/settings/from-months` – przelicz sumę dni z miesięcy I–XII
- `GET/POST/PUT/DELETE /api/machines` – maszyny; `GET /api/machines/:id/operations` – operacje na maszynie
- `GET/POST/PUT/DELETE /api/nests`, `POST /api/nests/:id/machines`, `DELETE /api/nests/:id/machines/:machineId`
- `GET /api/alternatives/machine/:machineId`, `POST /api/alternatives`, `DELETE /api/alternatives/:machineId/:alternativeMachineId`
- `GET/POST/PUT/DELETE /api/projects` – projekty, części, operacje, notatki (podścieżki jak w planie)
- `GET /api/capacity/calculator?yearFrom=&yearTo=&type=&machines=` – dane do kalkulatora
- `GET /api/capacity/machine/:machineId`, `GET /api/capacity/year/:year`, `GET /api/capacity/nests/year/:year`
- `GET /api/allocation/overloaded?year=&threshold=`
- `GET /api/allocation/candidates/:machineId?year=&maxLoad=`
- `POST /api/allocation/execute` – body: `{ operationId, targetMachineId, volumeToMove, volumeUnit }`

## GitHub

Repozytorium Git jest w katalogu projektu (gałąź `main`). W `.gitignore` są m.in. `node_modules/`, `*.db` i folder `.tools/` (lokalny portable Git).

1. Utwórz **nowe, puste** repozytorium na [GitHub](https://github.com/new) (bez README z poziomu strony, jeśli masz już lokalny commit).
2. Wypchnij kod (podstaw swój URL):

```powershell
.\scripts\push-to-github.ps1 -RemoteUrl "https://github.com/TWOJ_USER/NAZWA_REPO.git"
```

Przy HTTPS GitHub wymaga **Personal Access Token** zamiast hasła. Alternatywnie: `git remote add origin ...` oraz `git push -u origin main` z zainstalowanym Git for Windows.

## Zasady

- **Capacity:** dostępność [s/tydzień] z ustawień (dni robocze, czas zmiany, OEE) minus czas uruchomienie/zakończenie; obciążenie % = wymagany czas (suma wolumen×cykl) / dostępność. OEE: nadpis operacji > nadpis maszyny > ustawienia.
- **Alokacja:** kandydaci = maszyny z tego samego gniazda LUB z listy alternatyw; opcjonalnie ten sam kod lokalizacji. Wykonanie = zmniejszenie wolumenu wybranej operacji + utworzenie nowej operacji na maszynie docelowej z przeniesionym wolumenem.
- **Procent capacity:** dla maszyny dzielonej między operacje suma % capacity musi wynosić 100% (walidacja przy zapisie operacji).
