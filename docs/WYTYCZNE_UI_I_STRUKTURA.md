# Wytyczne UI, struktury i szaty graficznej

Dokument bazuje na aplikacji **Capacity** (Autoneum). Ma służyć jako punkt odniesienia przy kolejnych projektach wewnętrznych — ta sama marka, podobny stack i spójny wygląd.

Źródła w tym repozytorium:

- tokeny CSS: `client/src/index.css`
- kolory wykresów: `client/src/utils/dataVizColors.ts`
- motywy przestrzeni roboczych: `client/src/utils/workspaceTheme.ts`
- style admin / karty: `client/src/components/AdminAuthUi.tsx`, `AdminHubCards.tsx`

---

## 1. Struktura projektu (zalecana)

```
projekt/
├── client/                 # React + TypeScript + Vite
│   └── src/
│       ├── api/            # klient HTTP (jedna warstwa requestów)
│       ├── components/     # UI współdzielone (+ podfoldery domenowe)
│       ├── context/        # React Context (auth, i18n, tryby pracy)
│       ├── i18n/locales/   # pl, en, de (+ extended-* gdy baza rośnie)
│       ├── pages/          # ekrany routowane
│       ├── utils/          # logika prezentacji / helpery (bez API)
│       ├── App.tsx
│       └── index.css       # tokeny marki + style globalne / ekranowe
├── server/                 # Express + TypeScript
│   └── src/
│       ├── routes/
│       ├── services/       # logika biznesowa
│       ├── db/migrations/  # migracje SQL numerowane
│       ├── middleware/
│       └── utils/
├── docs/                   # dokumentacja (ten plik, logika domenowa)
├── package.json            # skrypty root: dev / build / start
└── README.md
```

### Zasady warstw

| Warstwa | Odpowiedzialność |
|--------|-------------------|
| `pages/` | składanie ekranu, stan lokalny UI, wywołania API |
| `components/` | kontrolki wielokrotnego użytku, bez logiki domenowej „ciężkiej” |
| `utils/` | czyste funkcje (agregacje, formatowanie, mapowanie kolorów) |
| `api/client.ts` | jedyny punkt HTTP do backendu |
| `server/services/` | reguły biznesowe, obliczenia, I/O plików |
| `server/routes/` | walidacja wejścia, auth, cienka orkiestracja |

### Konwencje nazewnictwa

- Ekrany: `PascalCase.tsx` (`AdminDataVisualization.tsx`)
- Helpery: `camelCase.ts` (`dataVizColors.ts`)
- Migracje: `NNN_opis.sql` (kolejne numery, bez edycji starych)
- Trasy UI: polskie ścieżki czytelne dla użytkownika (`/administracja/...`) — spójnie w całym produkcie
- i18n: klucze zagnieżdżone (`dataViz.yearFrom`, `reports.dataViz.seriesProd`)

### Stack referencyjny

- Frontend: React + TypeScript + Vite + React Router
- Backend: Express + TypeScript
- Dane: SQLite (lub inna baza — warstwa `services` izoluje dostęp)
- i18n: PL / EN / DE od startu nowych ekranów
- Wykresy: Recharts (gdy potrzeba)
- Eksport: PDF / Excel w `utils/`, nie w komponentach prezentacyjnych

---

## 2. Marka i kolorystyka bazowa

### 2.1 Tokeny CSS (`:root`)

| Token | Hex | Użycie |
|-------|-----|--------|
| `--cap-green` | `#A4C400` | akcent marki Autoneum (lime), CTA główne, linki aktywne, focus marki |
| `--cap-green-dark` | `#8fa800` | wariant ciemniejszy (hover / nacisk) |
| `--cap-green-light` | `#b8d61a` | wariant jaśniejszy |
| `--cap-yellow` | `#f9a825` | ostrzeżenia miękkie |
| `--cap-red` | `#c62828` | błędy, destrukcja, walidacja krytyczna |
| `--cap-gray` | `#616161` | tekst drugorzędny / meta |

**Zasada:** główny akcent marki to lime `#A4C400`, nie fiolet / indigo typowe dla „AI UI”. Unikać fioletowych gradientów i „glow”.

### 2.2 Paleta Autoneum (wykresy / serie)

| Nazwa | Hex | Rola |
|-------|-----|------|
| Dark Green | `#8A9300` | produkcja, delta dodatnia |
| Green Lime | `#B8C400` | wariant zieleni |
| Dark Blue | `#008BC1` | scenariusz / SOP |
| Light Blue | `#00B0E8` | wariant błękitu |
| Call-off Blue | `#0091EA` | Call offs / SAP (seria bazowa) |
| Dark Orange | `#E86A10` | kontrakt, EOP, overload 100% |
| Light Orange | `#F59B47` | scenariusz kontrakt |
| Dark Grey | `#7A7B7A` | neutralne serie |

Odcienie 60% (porównania): `#66B9DA`, `#B9BE66`, `#F1A670`.

### 2.3 Semantyka serii na wykresach

| Seria | Kolor domyślny | Styl linii |
|-------|----------------|-----------|
| Capacity produkcyjne | `#8A9300` | ciągła |
| Capacity kontraktowe | `#E86A10` | ciągła |
| Scenariusz prod. | `#008BC1` | kreskowana |
| Scenariusz kontrakt | `#F59B47` | kreskowana |
| Call offs (1.) | `#0091EA` | gęsta kreska |
| Call offs (kolejne) | kontrastowe (pomarańcz, zieleń, szary, fiolet…) + **różne dash** | nie dwa podobne błękity obok siebie |

Przy wielu seriach porównawczych: **różny kolor + różny `strokeDasharray`**. Nie polegać wyłącznie na odcieniu tej samej barwy.

### 2.4 Motywy przestrzeni roboczych

Każdy „workspace” ma własny klimat tła i akcentu (czytelne przełączanie trybu pracy):

| Workspace | Tło strony | Akcent |
|-----------|------------|--------|
| Capacity (produkcja) | `#f7f8fa` | `#A4C400` |
| Scenariusze | `#e4ecf7` / `#e8f0fa` | `#1565c0` |
| Call offs | `#FFFDDA` / `#FFF8E3` | `#7A6510` / `#A68920` |

Kolory motywów mogą być konfigurowalne w ustawieniach wizualnych — zawsze z bezpiecznym fallbackiem do powyższych domyślnych.

---

## 3. Typografia i powierzchnia

### Tekst

- Font bazowy: `system-ui, -apple-system, sans-serif` (czytelny, bez Inter/Roboto jako „tożsamości marki”)
- Tło aplikacji: jasne (`#fff` / `#f7f8fa`) — **preferować light mode**
- Hierarchia:
  - tytuł strony: ~`1.25–1.75rem`, `font-weight` normalny/600, `line-height` ~1.2
  - intro / opis: `#666` lub `#455a64`, 14px
  - meta / hint: 12–13px, `#666` / `#888`
  - błędy: `var(--cap-red)` lub `#c62828`
  - sukces: `#2e7d32`

### Karty i panele

```
background: white
border: 1px solid #eee
border-radius: 8px
box-shadow: 0 1px 3px rgba(0,0,0,0.08–0.1)
padding: 1–1.25rem
```

Karty hubów admina: lista pionowa, `maxWidth: 720`, gap `0.75rem` — jedna kolumna, bez „dashboardowych” kafelków statystyk.

### Formularze / filtry

- Toolbar filtrów: tło `#f8fbff`, obramowanie `#e3edf7`, radius `10px`
- Inputy: border `#cfd8dc` / `#bdbdbd`, radius `4–6px`, padding `0.45–0.55rem`
- Etykiety filtrów: 13–14px, `inline-flex`, gap mały
- Zaawansowane filtry: zwijane (`▸` / `▾`), aktywny stan: tło `#f1f8e9`, border `#c5e1a5`

### Tabele

- Nagłówek: `#f5f5f5`, sticky gdy długi scroll
- Cień tabeli: `0 1px 3px rgba(0,0,0,0.1)`
- Komórki admin: padding `0.75rem`
- Wąskie kolumny okresów (CW): font 10–11px, wyśrodkowane

---

## 4. Przyciski i interakcje

### Role przycisków

| Rola | Tło | Tekst | Uwagi |
|------|-----|-------|-------|
| Primary (marka) | `var(--cap-green)` | biały | zapis, potwierdzenie, główne CTA |
| Info / edycja | `#2196f3` | biały | edycja, nawigacja pomocnicza |
| Danger | `#c62828` | biały | usuwanie |
| Secondary | `#9e9e9e` | biały | anuluj / zamknij |
| Neutral | biały + border `#bdbdbd` | `#333` | akcje drugorzędne |
| Disabled | `#bdbdbd` | `#757575` | `cursor: not-allowed` |

Radius przycisków: **4px** (ew. 6px dla większych CTA). Bez pełnych „pill” (`border-radius: 999px`) jako domyślny wzorzec.

### Hover / active (globalnie)

```css
button:not(:disabled):hover  { filter: brightness(1.2); box-shadow: 0 0 0 2px rgba(0,0,0,0.15); }
button:not(:disabled):active { filter: brightness(0.85); }
```

Nav nieaktywny: hover tła marki `rgba(164, 196, 0, 0.2)`.  
Nav aktywny: tło = akcent workspace, tekst biały, `border-radius: 4px`.

---

## 5. Stany systemowe (loading, empty, error)

### Ładowanie danych

- Panel / badge w tonacji limonkowej: tło `#f4f8e0`, border `#c5d86d`, tekst `#4a5f00`
- Spinner: pierścień z `border-top-color: var(--cap-green)`
- Overlay: półprzezroczyste białe tło, treść pod spodem lekko wyszarzała (`opacity` + lekki grayscale)

### Empty / brak danych

- Tekst `#666` / `#999`, bez dużych ilustracji dekoracyjnych

### Statusy (chip)

- Active: tło `#e8f5e9`, tekst `#2e7d32`
- Inactive: stonowany szary
- Warning: amber / `#b45309` dla ostrzeżeń miękkich

---

## 6. Układ ekranów

1. **Header** — logo/marka, nawigacja główna, przełączniki trybu (workspace / język / użytkownik).
2. **Banner workspace** (gdy tryb ≠ produkcja) — wyraźny kolor sekcji, krótki opis kontekstu.
3. **Treść** — biały panel lub bezpośrednia treść na tle strony; unikaj zagnieżdżonych kart w kartach.
4. **Filtry** — pasek nad tabelą/wykresem; zaawansowane schowane.
5. **Jedna główna praca na sekcję** — tytuł + krótki opis + kontrolki + wynik (tabela / wykres).

### Responsywność

- Toolbar filtrów: `flex-wrap`
- Siatki 2-kolumnowe (np. wolumeny): zawijanie do 1 kolumny poniżej ~1280px
- Tabele szerokie: `overflow-x: auto`, sticky nagłówek gdy sensowny

### Nawigacja lokalna (np. szczegóły encji)

- Lewy sticky nav (~11rem) + elastyczna kolumna treści (`min-width: 0`)

---

## 7. Wykresy i legenda

- Oś / siatka: `#eceff1`, tekst `#333`
- Linia referencyjna 100% obciążenia: pomarańcz `#E86A10`, dash
- Linia 0% wolnego capacity: zieleń `#8A9300`
- Legenda pod wykresem, kolorowe kropki 8–10px
- Etykiety okresów: język UI (`lip`, `CW27`) — lokalizacja przez `toLocaleDateString` / i18n, bez hardcode PL w logice

---

## 8. i18n i copy

- Każdy nowy string UI → klucze PL + EN + DE
- Komunikaty błędów API mapowane przez warstwę `te()` / słownik błędów
- Etykiety raportów PDF/Excel też przez i18n / `reportLabels`

---

## 9. Czego unikać

- Fiolet / indigo jako motyw domyślny, neonowe glow, dark mode „dla ozdoby”
- Karty ze statystykami w hero / hubie admina bez potrzeby
- Identycznych kolorów dla serii porównawczych (szczególnie dwa błękity Call offs)
- Hardcodowanych nazw miesięcy tylko po polsku
- Mieszania logiki biznesowej w komponentach czysto wizualnych
- Pomijania tokenów CSS (`var(--cap-green)`) na rzecz losowych zieleni

---

## 10. Checklist nowego ekranu

- [ ] Tokeny marki / workspace zamiast ad-hoc hexów (tam gdzie to akcent)
- [ ] Panel: białe tło, border `#eee`, radius 8, lekki cień
- [ ] Primary CTA = lime Autoneum; danger = czerwony; cancel = szary
- [ ] Filtry w toolbarze; zaawansowane zwijane
- [ ] Stany: loading (limonkowy badge), empty, error
- [ ] Teksty w i18n (PL/EN/DE)
- [ ] Serie wykresów: czytelny kontrast kolorów + dash
- [ ] Layout nie rozjeżdża się na ~1280px / mobile toolbar

---

## 11. Szybki „starter” tokenów dla nowego projektu

```css
:root {
  --brand: #A4C400;
  --brand-dark: #8fa800;
  --brand-light: #b8d61a;
  --danger: #c62828;
  --warning: #f9a825;
  --text-muted: #616161;
  --surface: #ffffff;
  --page-bg: #f7f8fa;
  --border: #eeeeee;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

Przy nowym produkcie Autoneum skopiuj ten plik do `docs/` i dostosuj wyłącznie sekcje domenowe (nazwy workspace, serie wykresów) — **nie zmieniaj** bazowego lime marki bez decyzji brandingowej.
