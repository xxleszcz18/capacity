import type { TranslationTree } from '../types';

export const manualPl: TranslationTree = {
  manual: {
    title: 'Instrukcja obsługi',
    subtitle:
      'Kompletny przewodnik po systemie Autoneum Capacity — funkcje, przepływy pracy i zależności danych. Treść zmienia się wraz z językiem wybranym w nagłówku (PL / EN / DE).',
    backAdmin: '← Administracja',
    toc: 'Spis treści',
    tip: 'Wskazówka',
    seeAlso: 'Zobacz także',
    stepsLabel: 'Kroki postępowania',
    sections: {
      overview: {
        title: '1. Wprowadzenie',
        p1:
          'Autoneum Capacity to aplikacja do planowania i analizy obciążenia linii produkcyjnych. Łączy katalog maszyn, projekty z detalami i operacjami, kalkulator obciążenia, scenariusze „co jeśli”, porównania Call offs (SAP Sales Forecast) oraz wizualizację trendów.',
        p2:
          'Obszary z paska nawigacji: Kalkulator, Maszyny, Projekty, Detale, Wizualizacja danych oraz Administracja. Osobne przestrzenie robocze: Wersja produkcyjna, Scenariusze i Call offs (przełączniki w nagłówku).',
        p3:
          'Dostęp wymaga logowania. Uprawnienia (RBAC) ograniczają widok i akcje według roli. Instrukcja jest dostępna z Administracja → Instrukcja obsługi.',
        p4:
          'Ta instrukcja opisuje typowe przepływy, znaczenie pól, wzory obliczeniowe (sekcja 13) oraz odpowiedzi na najczęstsze pytania (sekcja 14 FAQ). Diagramy na końcu sekcji ilustrują zależności i tryby pracy.',
        stepsTitle: 'Typowy przepływ pracy',
        step1: 'Zaloguj się; administrator konfiguruje słowniki (fazy, typy maszyn, dni robocze) w Ustawieniach bazy.',
        step2: 'Zaimportuj lub utwórz maszyny oraz projekty z operacjami i wolumenami.',
        step3: 'Sprawdź obciążenie w Kalkulatorze (filtry, suma / średnia / max średnia wg typu).',
        step4: 'Opcjonalnie: porównaj Call offs lub utwórz scenariusz i porównaj w Wizualizacji danych.',
        step5: 'Eksportuj raporty PDF/Excel z kalkulatora lub wizualizacji; zmiany audytuj w Historii zmian.',
      },
      auth: {
        title: '2. Logowanie i uprawnienia',
        p1:
          'Każda sesja wymaga konta użytkownika. Po zalogowaniu aplikacja stosuje uprawnienia przypisane do roli. Konto gościa (jeśli włączone) ma ograniczony, zwykle tylko do odczytu, dostęp.',
        p2:
          'Zarządzanie użytkownikami i rolami: Administracja → Użytkownicy i uprawnienia (wymaga odpowiednich permissionów). Reset hasła — zgodnie z konfiguracją e-mail / procedury lokalnej administratora.',
        p3:
          'Bez wymaganego uprawnienia moduł może być niewidoczny w menu, a przyciski zapisu, usuwania lub pobierania są niedostępne. Komunikat „brak uprawnień” oznacza brak wpisu w macierzy roli — skontaktuj się z administratorem.',
        stepsTitle: 'Przepływ dostępu',
        step1: 'Otwórz aplikację → ekran logowania (login / hasło).',
        step2: 'Po wejściu widoczne są tylko moduły dozwolone przez rolę.',
        step3: 'Akcje (edycja, usuwanie, pobieranie, tworzenie RFQ) są włączane osobnymi checkboxami w roli.',
        step4: 'Wylogowanie kończy sesję; przy braku uprawnień akcje zapisu są zablokowane.',
        role1: 'Administrator — pełna konfiguracja, backup, użytkownicy, import/eksport, ścieżki storage.',
        role2: 'Planista / edytor — projekty, maszyny, kalkulator, scenariusze, Call offs (wg uprawnień).',
        role3: 'Podgląd / gość — odczyt wybranych ekranów bez zmian danych produkcyjnych.',
        permMatrix:
          'Macierz roli: zasób × akcja (Podgląd, Szczegóły, Zmiana statusu, Edycja, Usuwanie, Pobieranie, Tworzenie RFQ). Wyłączenie Podglądu usuwa dostęp do modułu; bez Edycji nie zapiszesz zmian.',
        rbacTitle: 'RBAC — zasoby',
        rbac:
          'Główne zasoby: Kalkulator, Maszyny, Projekty, Detale, Scenariusze, Call offs, Ustawienia bazy, Ustawienia administracyjne, Wizualizacja danych, Dane do OCU, Załączniki (administracja), Historia zmian, Zarządzanie użytkownikami / rolami.',
        rfqPermTitle: 'Uprawnienie Tworzenie RFQ',
        rfqPerm:
          'projects.create_rfq pozwala tworzyć tylko projekty ze statusem RFQ oraz edytować detale, operacje i wolumeny w takich projektach — bez pełnej edycji projektów aktywnych/produkcyjnych.',
        downloadPermTitle: 'Pobieranie — załączniki vs Call offs',
        downloadPerm:
          'admin_attachments.download = pobieranie plików załączników w projekcie (oraz lista w Administracji przy view). call_offs.download = plik SAP SalesFcst i raport niedopasowanych — to nie są załączniki projektu. Projekty nie mają osobnej kolumny „Pobieranie” w macierzy ról.',
      },
      header: {
        title: '3. Nagłówek aplikacji',
        p1:
          'Pasek u góry steruje trybem danych i profilem obliczeń. Ustawienia wpływają na Kalkulator, alokację, Call offs i raporty wizualizacji.',
        contractualTitle: 'Wolumeny kontraktowe',
        contractual:
          'Przełącznik używa wolumenów kontraktowych zamiast produkcyjnych (z fallbackiem, gdy brak danych kontraktowych). Kalkulator ma wtedy kolorową ramkę (kolor w Ustawieniach wizualnych).',
        capacityTitle: 'Wersja produkcyjna vs Scenariusze',
        capacity:
          '„Wersja produkcyjna” pracuje na żywej bazie. „Scenariusze” przełącza na kopię wybranego scenariusza — Kalkulator i Historia zmian pokazują wtedy stan scenariusza. Tworzenie nowego scenariusza: przycisk w nagłówku (w przestrzeni Scenariusze).',
        callOffsTitle: 'Call offs',
        callOffs:
          'Przestrzeń Call offs służy do porównań z plikiem SAP Sales Forecast. Po wyborze porównania Kalkulator pokazuje obciążenie dualne (baza + Call offs). Nowe porównanie: kontrolka w nagłówku.',
        ocuTitle: 'Capacity / OCU',
        ocu:
          'Gdy OCU jest włączone w ustawieniach administracyjnych, przełącznik zmienia profil parametrów (OEE, dni robocze itd.) na zestaw OCU. Logika wzoru obciążenia pozostaje ta sama. Scenariusze zawsze liczą profilem Capacity.',
        langTitle: 'Język',
        lang: 'Flaga zmienia język interfejsu i tej instrukcji (PL / EN / DE). Wybór jest zapamiętywany w przeglądarce.',
      },
      dataModel: {
        title: '4. Model danych i zależności',
        p1:
          'Hierarchia: detale (katalog) → projekty → operacje (faza + maszyna + cykl) → obciążenie maszyn w Kalkulatorze. Maszyna musi istnieć przed przypisaniem do operacji.',
        p2:
          'Wolumen może pochodzić z detalu projektu, pól operacji lub nadpisania rocznego (produkcyjny i kontraktowy osobno). Scenariusz i Call offs to osobne warstwy porównawcze na tych samych maszynach.',
        p3:
          'Słowniki (fazy, typy maszyn, dni robocze Capacity/OCU, ustawienia wizualne) muszą być spójne przed masowym importem. Usuwanie elementów wyżej w hierarchii wymaga rozwiązania powiązań niżej.',
        dep1: 'Usunięcie detalu z katalogu wymaga rozwiązania powiązanych operacji.',
        dep2: 'Typ maszyny musi być w słowniku Typy maszyn.',
        dep3: 'Dni robocze i OEE określają dostępność [s/tydzień] maszyny.',
        dep4: 'Scenariusz = snapshot produkcji (lub innego scenariusza / Call offs) z własną historią.',
        dep5: 'Call offs = wolumeny z pliku SAP mapowane na operacje/detale; poza latami pliku serie Call offs są puste.',
        dep6: 'Załączniki projektu wymagają skonfigurowanej ścieżki magazynu w Ustawieniach administracyjnych; pobieranie kontroluje admin_attachments.download.',
      },
      calculator: {
        title: '5. Kalkulator obciążenia',
        p1:
          'Tabela pokazuje maszyny (wg filtrów statusu) z % obciążenia w latach — oraz opcjonalnie miesiącach/tygodniach po rozwinięciu. Kolory progów, znaczniki SOP/EOP i RFQ ustawia się w Ustawieniach wizualnych.',
        p2:
          'Obciążenie % maszyny = wymagany czas operacji / efektywna dostępność × 100 (szczegóły w sekcji wzorów). Efektywna dostępność uwzględnia machine usage. W trybie Call offs komórki pokazują dualnie: baza + Call offs.',
        p3:
          'Na dole tabeli: Suma obciążeń, Średnia obciążeń oraz Max średnia wg typu (najwyższa średnia wśród typów maszyn w bieżącym filtrze — np. średnia MC vs WJ vs HL).',
        p4:
          'Ten sam kalkulator działa w produkcji, scenariuszu i Call offs — źródło danych wybierasz w nagłówku / nawigacji.',
        p5:
          'Pasek przeciążonych maszyn (>100%) pomaga szybko znaleźć wąskie gardła. Klik w komórkę otwiera alokację (przeniesienie wolumenu), jeśli masz uprawnienia edycji.',
        stepsTitle: 'Przepływ w kalkulatorze',
        step1: 'Ustaw zakres lat i filtry (typ, klient, status, linia, wymiary maszyn, wyszukiwanie).',
        step2: 'Opcjonalnie włącz wolumeny kontraktowe i/lub profil OCU.',
        step3: 'Rozwiń rok na miesiące/tygodnie (ISO: poniedziałek–niedziela), gdy potrzebujesz szczegółu.',
        step4: 'Kliknij komórkę obciążenia, aby otworzyć alokację (przeniesienie wolumenu) — gdy masz uprawnienia.',
        step5: 'Sprawdź wiersze sumy / średniej / max średniej wg typu oraz pasek przeciążeń.',
        step6: 'Eksportuj widok lub raport PDF/Excel.',
        summaryTitle: 'Wiersze podsumowania',
        summary:
          'Suma = suma % widocznych maszyn. Średnia = suma / liczba maszyn. Max średnia wg typu = dla każdego typu policz średnią %, potem weź maksimum (używane też jako agregacja linii w Wizualizacji).',
        allocTitle: 'Alokacja',
        alloc:
          'Okno alokacji proponuje maszyny z gniazda lub listy alternatyw. Można ograniczyć zakres do lat/miesięcy/tygodni. Po zapisie kalkulator się odświeża; powstaje operacja-dziecko z wolumenem w operation_volume_by_year.',
        allocModesTitle: 'Tryby przeniesienia',
        allocModes:
          'Pełne (full) — przenosi cały dostępny wolumen; ręczne (manual) — wpisana ilość; do docelowego % (targetPercent) — system wylicza wolumen tak, by obciążenie źródła zbliżyło się do wskazanego %.',
        filtersTitle: 'Filtry wymiarów',
        filters:
          'Filtry szerokość / głębokość / wysokość / skok działają po stronie klienta na pełnym wyniku (szybka zmiana bez ponownego pełnego zapytania API). Opcja pokazania maszyn aktywnych bez obciążenia — gdy filtr wymiarów jest aktywny. Puste wyniki po filtrze wymiarów zwykle oznaczają zbyt wąskie kryteria — wyczyść filtry lub włącz maszyny bez obciążenia.',
        exportTitle: 'Eksport',
        export:
          'Z kalkulatora możesz wyeksportować bieżący widok lub raport PDF/Excel (wymaga calculator.download, jeśli rola to rozróżnia). Eksport respektuje aktywne filtry i tryb (produkcja / scenariusz / Call offs, kontrakt, OCU).',
      },
      machines: {
        title: '6. Maszyny',
        p1:
          'Rejestr: SAP, numer wewnętrzny, typ, linia, lokalizacja, wymiary, status (aktywna / nieaktywna / RFQ), machine usage, OEE nadpisany.',
        p2:
          'Szczegóły maszyny: opis, operacje, alternatywy, historia. Gniazda (nests) grupują maszyny do alokacji.',
        p3:
          'Status RFQ maszyny wpływa na widoczność w kalkulatorze scenariusza przy projektach RFQ. Maszyna nieaktywna zwykle nie wchodzi do obciążenia produkcyjnego (wg filtrów statusu).',
        stepsTitle: 'Przepływ',
        step1: 'Nowa maszyna — typ ze słownika Typy maszyn; uzupełnij wymiary i lokalizację.',
        step2: 'Ustaw machine usage (0,1–1) oraz opcjonalne OEE nadpisane.',
        step3: 'Status RFQ — widoczność w kalkulatorze scenariusza po powiązaniu z projektem RFQ.',
        step4: 'Import Excel — Administracja → Ustawienia administracyjne (po backupie).',
        usageTitle: 'Machine usage',
        usage:
          'Współczynnik 0,1–1 (domyślnie 1). Efektywna dostępność = dostępność bazowa / usage. Przy usage = 0,5 capacity jest dwukrotnie większa, a obciążenie przy tym samym wymaganym czasie spada o połowę.',
        nestsTitle: 'Gniazda (nests) maszyn',
        nests:
          'Gniazdo grupuje maszyny do podpowiedzi alokacji. Nie mylić z gniazdowością operacji (nests_count = liczba detali z jednego cyklu).',
      },
      projects: {
        title: '7. Projekty',
        p1:
          'Projekt grupuje detale klienta z operacjami. Detal ma wolumeny roczne (produkcyjne i kontraktowe), SOP/EOP oraz operacje (faza, maszyna, cykl, gniazda, % capacity, OPF).',
        p2:
          'Status projektu (aktywny / RFQ / nieaktywny) wpływa na kalkulator. Set detali = grupa ze wspólnym źródłem wolumenu. Załączniki i notatki dokumentują kontekst.',
        p3:
          'Na liście Projektów nie ma kolumny pobierania plików — załączniki otwierasz w szczegółach projektu. Uprawnienie pobierania załączników to admin_attachments.download (nie projects.download).',
        stepsTitle: 'Przepływ',
        step1: 'Utwórz projekt (klient, nazwa, status). Przy samym create_rfq wybierz status RFQ.',
        step2: 'Dodaj detale z katalogu lub nowe; ustaw SOP/EOP (MM.YYYY).',
        step3: 'Zakładka Operacje — trasa (maszyna + faza + cykl); opcjonalnie cykl alternatywny i use_alternative_in_calculator.',
        step4: 'Zakładka Wolumeny — roczne / miesięczne / tygodniowe; nadpisanie roku (origin manual_year) vs default_all_years.',
        step5: 'Notatki ręczne vs automatyczne; załączniki plików (wymaga ścieżki magazynu).',
        step6: 'Sprawdź wpływ na Kalkulator (produkcja lub scenariusz).',
        volumesTitle: 'Wolumeny',
        volumes:
          'Produkcyjne i kontraktowe są osobne. Priorytet na rok: operation_volume_by_year → wolumeny projektu/detalu → pola operacji. Kontrakt: project_volumes_contract z fallbackiem do produkcji. Flaga include_in_calculator_after_eop pozwala liczyć wolumen po EOP.',
        attachmentsTitle: 'Załączniki projektu',
        attachments:
          'Dodajesz pliki w szczegółach projektu. Każdy dodany załącznik trafia też do notatek. Bez ścieżki magazynu w Ustawieniach administracyjnych dodawanie jest zablokowane. Pobieranie wymaga admin_attachments.download; lista globalna: Administracja → Załączniki.',
      },
      details: {
        title: '8. Detale (oznaczenia)',
        p1:
          'Globalny katalog: Nr SAP, Alias, Free text. Detale są współdzielone między projektami. Walidacja blokuje duplikaty oznaczeń.',
        p2:
          'Kolumny Projekt / linia pomagają znaleźć użycie. Usuwanie detalu z operacjami wymaga wyboru operacji do usunięcia.',
        p3:
          'Nr SAP detalu jest kluczowy przy mapowaniu Call offs (Sales Forecast). Alias i Free text służą do czytelnych etykiet w kalkulatorze i raportach.',
      },
      scenarios: {
        title: '9. Scenariusze',
        p1:
          'Scenariusz to izolowana kopia danych do symulacji bez zmiany produkcji. Możesz utworzyć go z bazy produkcyjnej, z innego scenariusza lub z porównania Call offs.',
        p2:
          'W trybie Scenariusze Kalkulator i Historia działają na kopii. Nowe projekty/detale w katalogu produkcyjnym tworzysz po powrocie do Wersji produkcyjnej. Możesz dodać projekty z capacity do scenariusza i zmienić statusy RFQ/aktywny.',
        p3:
          'Wdrożenie do produkcji (apply) wymaga potwierdzenia (challenge) i odpowiednich uprawnień — przenosi wybrane zmiany ze scenariusza na żywą bazę.',
        p4:
          'Scenariusze zawsze używają profilu dni roboczych Capacity (nie OCU). W Administracji w trybie scenariusza dostępne są głównie Historia i Instrukcja.',
        stepsTitle: 'Przepływ scenariusza',
        step1: 'Lista scenariuszy — utwórz (ew. ze źródłem Call offs), otwórz, archiwizuj.',
        step2: 'Edytuj kopię: statusy, wolumeny, operacje, RFQ.',
        step3: 'Sprawdź obciążenie w Kalkulatorze scenariusza.',
        step4: 'Porównaj z produkcją / Call offs w Wizualizacji (multiwybór scenariuszy).',
        step5: 'Opcjonalnie: zastosuj zmiany (lub podzbiór) do produkcji.',
      },
      callOffs: {
        title: '10. Call offs (SAP)',
        p1:
          'Porównanie Call offs ładuje plik Sales Forecast (Excel) i mapuje pozycje SAP na operacje/detale w bazie. Wynik: obciążenie Call offs vs capacity produkcyjna/kontraktowa.',
        p2:
          'Niezmapowane pozycje trafiają do raportu (CSV). Zakres dat pliku ogranicza lata z danymi Call offs na wykresach. Porównania można archiwizować.',
        p3:
          'Pobieranie pliku SAP i raportu unmatched wymaga call_offs.download — to osobne uprawnienie od załączników projektów.',
        stepsTitle: 'Przepływ Call offs',
        step1: 'Utwórz porównanie (nazwa + plik Excel) w przestrzeni Call offs.',
        step2: 'Sprawdź dopasowanie SAP i raport unmatched.',
        step3: 'Otwórz Kalkulator w trybie Call offs — dualne komórki obciążenia.',
        step4: 'W Wizualizacji wybierz porównanie (multiwybór) i włącz serie Call offs na wykresach.',
        step5: 'Eksportuj raport PDF/Excel lub pobierz oryginalny plik SAP / CSV unmatched.',
        matchTitle: 'Mapowanie SAP',
        match:
          'Najpierw dokładne dopasowanie znormalizowanego sap_number; inaczej próba po obcięciu 2 ostatnich znaków. Niedopasowane pozycje → raport CSV do ręcznej korekty katalogu / pliku.',
        downloadTitle: 'Pobieranie Call offs',
        download:
          'call_offs.download obejmuje plik SalesFcst oraz raport niedopasowanych referencji. Nie otwiera załączników z karty projektu — te kontroluje admin_attachments.download.',
      },
      dataViz: {
        title: '11. Wizualizacja danych',
        p1:
          'Trendy obciążenia (%): linie i maszyny albo kilka obiektów na jednym wykresie porównawczym. Filtry typu maszyny i klienta zawężają dane jak w Kalkulatorze. Na wykresach łączy się capacity produkcyjne, kontraktowe, Call offs (multiwybór) i scenariusze (multiwybór); raport PDF/Excel oraz Analityka pokazują różnice (Δ) między seriami.',
        p2:
          'Aktywny tryb obliczeń (Capacity / OCU) pochodzi z przełącznika w nagłówku aplikacji — badge przy tytule strony. Scenariusze zawsze używają ustawień Capacity. Agregacja linii / wielu maszyn / zakładu = max średniej obciążenia w ramach typu maszyny (ta sama logika co trzeci wiersz kalkulatora). Pojedyncza maszyna = jej własne %.',
        p3:
          'Filtry wymiarów działają lokalnie na załadowanych danych. Eksport: PDF (bieżący widok lub zaawansowany) oraz Excel z tabelami trendów i analityką.',
        stepsTitle: 'Przepływ wizualizacji',
        step1: 'Ustaw lata, status maszyn, typ, klienta, RFQ, filtry wymiarów.',
        step2: 'Wybierz serie: kontrakt / produkcja / Call offs (multi) / scenariusze (multi) + checkboxy kontrakt/prod scenariuszy.',
        step3: 'Na zakładkach Linie/Maszyny zaznacz obiekty; opcjonalnie jeden wykres porównawczy lub słupki roczne (z Call offs).',
        step4: 'Ustaw Flex (±% wstęgi wokół serii kontraktowych), tryb obciążenie/wolne capacity, oś Y auto/stała; wyeksportuj raport.',
        seriesTitle: 'Źródła serii',
        series:
          'Produkcja i kontrakt — żywa baza (lub profil OCU). Call offs — wybrane porównania SAP (każde jako osobna seria). Scenariusze — równoległe serie dla każdego zaznaczonego scenariusza (osobne kolory).',
        aggTitle: 'Agregacja',
        agg:
          'Dla grupy maszyn: średnia % w każdym typie, potem maksimum z tych średnich. Dzięki temu wykres linii odzwierciedla „najbardziej obciążony typ” w filtrze, a nie sumę % ani czystą średnią arytmetyczną wszystkich maszyn.',
        flexTitle: 'Flex',
        flex:
          'Pole Flex (±%) rysuje wstęgę wokół serii kontraktowych (w tym kontrakt scenariusza). Produkcja i Call offs bez Flex. Wyróżnione wizualnie w pasku serii — to parametr wstęgi, nie osobna seria danych.',
      },
      admin: {
        title: '12. Administracja',
        p1:
          'Panel konfiguracji, bezpieczeństwa, backupu i audytu. W trybie Scenariusze/Call offs lista kart jest ograniczona (głównie Historia i Instrukcja).',
        p2:
          'Karty widoczne są według uprawnień: Ustawienia bazy, Ustawienia administracyjne, Załączniki, Dane do OCU, Użytkownicy i uprawnienia, Historia zmian, Instrukcja obsługi.',
        dbTitle: 'Ustawienia bazy',
        db:
          'Dni robocze (Capacity i OCU), fazy, katalog detali, typy maszyn, autozapis wolumenów oraz powiązane kategorie słownikowe.',
        visualTitle: 'Ustawienia wizualne',
        visual:
          'Kolory progów obciążenia, znaczniki SOP/EOP/RFQ, kolory ramki kontraktowej, wiersze sumy/średniej, kolory Flex i serii Data Viz — konfiguracja w obszarze ustawień bazy / wizualnych.',
        admTitle: 'Ustawienia administracyjne',
        adm:
          'Backup automatyczny/ręczny, przywracanie, import/eksport Excel (pakiet capacity, maszyny, dane wejściowe), włączenie OCU, ścieżki storage, czyszczenie bazy. Przed importem lub restore zawsze zrób backup.',
        pathsTitle: 'Ścieżki i przeglądarka serwera',
        paths:
          'Katalogi backupu i załączników ustawiasz w Ustawieniach administracyjnych. Przycisk przeglądania otwiera Server Storage Browser (foldery na serwerze aplikacji, tworzenie podfolderów, wybór ścieżki względnej).',
        importTitle: 'Import Excel',
        import:
          'Import maszyn / pakietu capacity / danych wejściowych jest w Ustawieniach administracyjnych. Używaj szablonów zgodnych z wersją aplikacji; po imporcie sprawdź Kalkulator i Historie zmian.',
        ocuDataTitle: 'Dane do OCU',
        ocuData:
          'Moduł uzupełnia arkusz Input w Katowice_Data (kolumny X, AB, AC, AD, AE) na podstawie Tabeli przejścia i bazy Capacity. Wgraj oba pliki → Generuj i pobierz ZIP (źródła bez filtrów + wynik). Wymaga admin_ocu.view / .edit.',
        attachAdminTitle: 'Załączniki (administracja)',
        attachAdmin:
          'Globalna lista załączników z lokalizacją na dysku i statusem „plik istnieje”. Podgląd = admin_attachments.view; pobieranie plików w projekcie = admin_attachments.download (wyłączenie view wyłącza też download).',
        usersTitle: 'Użytkownicy i uprawnienia',
        users:
          'Konta, role, mapowanie permissionów do ekranów i API, reset haseł / prośby o odzyskanie dostępu. Bez uprawnienia użytkownik nie zobaczy np. edycji projektów ani importu.',
        histTitle: 'Historia zmian',
        hist:
          'Rejestr zmian projektów, maszyn i operacji z filtrami. W scenariuszu — historia kopii scenariusza. Wpisy ręczne vs automatyczne (w tym notatki o załącznikach).',
      },
      formulas: {
        title: '13. Wzory obliczeniowe',
        p1:
          'Silnik capacity (serwer, capacityService) stosuje poniższe przy każdym przeliczeniu kalkulatora / API. Profile Capacity i OCU mają osobne tabele dni roboczych; scenariusze zawsze liczą Capacity.',
        p2:
          'Wszystkie czasy w sekundach na tydzień; obciążenie raportowane jako % zaokrąglony do liczby całkowitej. Wartość > 100% = przeciążenie.',
        p3:
          'Szczegóły implementacji: server/src/services/capacityService.ts oraz server/CAPACITY_LOGIC.md.',
        avail:
          'Dostępność bazowa [s/tydz] = (working_days_year / 52) × shift_minutes × 60 × shifts_per_day × OEE − startup_shutdown_seconds. Następnie effective_availability = availability_base / machine_usage (usage clamp 0,1–1). Przy usage = 0,5 efektywna capacity jest ×2.',
        oee:
          'Priorytet OEE: nadpisanie na operacji → nadpisanie na maszynie → oee_factor z ustawień roku (profil Capacity lub OCU).',
        usage:
          'machine_usage (0,1–1, domyślnie 1) skaluje dostępną capacity: load = required / (availability_base / usage). Niższy usage = niższe % obciążenia przy tym samym wymaganym czasie.',
        weekly:
          'Wolumen tygodniowy: annual → volume / working_weeks_per_year (domyślnie 48); monthly → (volume × 12) / working_weeks_per_year; weekly → bez przeliczenia.',
        volPriority:
          'Priorytet źródła wolumenu na rok: 1) operation_volume_by_year, 2) wolumeny projektu/detalu, 3) pola volume na operacji. Tryb kontraktowy: project_volumes_contract z fallbackiem do produkcji.',
        required:
          'required_sec_per_week = Σ (weekly_volume × (cycle_time_seconds / max(1, nests_count))). Gniazdowość ≥ 1; przy use_alternative_in_calculator używane są alt_cycle / alt_nests / alt_oee.',
        load:
          'load_percent = round(total_required_sec / effective_availability × 100). Gdy effective_availability ≤ 0 i required > 0 → 100%.',
        sop:
          'SOP/EOP w formacie MM.YYYY; ułamki roku/miesiąca/tygodnia ograniczają wolumen w okresach ramp-up/down. Poza zakresem = 0, chyba że include_in_calculator_after_eop lub ręczne nadpisanie (manual_year).',
        period:
          'Rozwinięcie okresu: rok → miesiące → tygodnie. Wolumen miesięczny/tygodniowy skalowany ułamkiem produkcji w danym okresie (SOP/EOP, origin default vs manual_year).',
        maxType:
          'Max średnia wg typu = max po typach ze (średnia load_% maszyn typu t). Ta sama agregacja w wierszu kalkulatora i na wykresach linii / wielu maszyn w Data Viz.',
        isoWeek:
          'Tygodnie w rozwinięciu okresów: ISO 8601, poniedziałek–niedziela.',
        altCycle:
          'Gdy use_alternative_in_calculator i zdefiniowano alt_cycle_time_seconds > 0: kalkulator bierze cykl/gniazda/OEE alternatywne zamiast podstawowych.',
        contractual:
          'Przełącznik kontraktowy w nagłówku: wolumeny z project_volumes_contract (i kontraktowych pól detalu); brak danych → fallback do wolumenów produkcyjnych. Nie zmienia wzoru dostępności.',
      },
      faq: {
        title: '14. FAQ — pytania i odpowiedzi',
        p1:
          'Poniżej najczęstsze pytania o przyciski, tworzenie obiektów, znaczenie pól, obliczenia, uprawnienia, import/eksport i rozwiązywanie problemów. Numeracja sekcji w spisie treści odpowiada kolejności w instrukcji.',
        q01: 'Jakie są główne obszary nawigacji?',
        a01:
          'Kalkulator, Maszyny, Projekty, Detale, Wizualizacja danych, Administracja. Przestrzenie: Wersja produkcyjna, Scenariusze, Call offs — przełączniki w nagłówku.',
        q02: 'Do czego służy Kalkulator?',
        a02:
          'Pokazuje % obciążenia maszyn w latach (oraz miesiącach/tygodniach), podsumowania sumy/średniej/max średniej wg typu, alokację i eksport. Działa na produkcji, scenariuszu lub Call offs.',
        q03: 'Do czego służą Maszyny?',
        a03:
          'Rejestr linii produkcyjnych: typ, status, wymiary, usage, OEE, operacje i gniazda alokacji. Bez maszyn nie ma obciążenia w kalkulatorze.',
        q04: 'Do czego służą Projekty?',
        a04:
          'Grupują detale klienta, SOP/EOP, operacje (trasa) i wolumeny produkcyjne/kontraktowe. Status aktywny/RFQ/nieaktywny wpływa na to, co wchodzi do kalkulatora.',
        q05: 'Do czego służy katalog Detale?',
        a05:
          'Globalne oznaczenia (SAP, Alias, Free text) współdzielone między projektami; kluczowe przy mapowaniu Call offs.',
        q06: 'Do czego służy Wizualizacja danych?',
        a06:
          'Trendy % obciążenia linii/maszyn, porównanie produkcji, kontraktu, Call offs i scenariuszy, Flex, analityka Δ, eksport PDF/Excel.',
        q07: 'Jak utworzyć projekt?',
        a07:
          'Projekty → Nowy: klient, nazwa, status → dodaj detale → Operacje → Wolumeny → opcjonalnie załączniki. Przy samym create_rfq ustaw status RFQ.',
        q08: 'Jak utworzyć maszynę?',
        a08:
          'Maszyny → Nowa: typ ze słownika Typy maszyn, numer, lokalizacja, wymiary, usage, status. Alternatywnie import Excel w Ustawieniach administracyjnych.',
        q09: 'Jak utworzyć scenariusz?',
        a09:
          'Przestrzeń Scenariusze → utwórz (źródło: produkcja, inny scenariusz lub Call offs) → otwórz → edytuj kopię → sprawdź Kalkulator → opcjonalnie Apply do produkcji.',
        q10: 'Jak utworzyć porównanie Call offs?',
        a10:
          'Przestrzeń Call offs → nowe porównanie: nazwa + plik Excel Sales Forecast → sprawdź mapowanie → otwórz kalkulator dualny / serie w Data Viz.',
        q11: 'Jak utworzyć rolę i użytkownika?',
        a11:
          'Administracja → Użytkownicy i uprawnienia: utwórz rolę i zaznacz permissiony → utwórz użytkownika i przypisz rolę. Wymaga user_management / role_management.',
        q12: 'Co oznaczają przyciski Zapisz / Usuń / Eksport / Alokacja?',
        a12:
          'Zapisz utrwala zmiany (wymaga edit). Usuń usuwa obiekt (delete). Eksport generuje PDF/Excel (download gdzie dotyczy). Alokacja (klik w komórkę kalkulatora) przenosi wolumen między maszynami.',
        q13: 'Co zrobić przy przeciążeniu (>100%)?',
        a13:
          'Sprawdź operacje i wolumeny, alokuj na inną maszynę/gniazdo, zweryfikuj cycle/nests/usage/OEE, rozważ scenariusz what-if lub wolumeny kontraktowe vs produkcyjne.',
        q14: 'Co zrobić przy błędzie zapisu / 403 / „brak uprawnień”?',
        a14:
          'Sprawdź rolę w Użytkownicy i uprawnienia. 403 = brak permissionu. Odśwież sesję (wyloguj/zaloguj). Przy błędzie serwera sprawdź komunikat i Historie zmian.',
        q15: 'Co zrobić, gdy Call offs ma dużo unmatched SAP?',
        a15:
          'Pobierz raport CSV (call_offs.download). Uzupełnij Nr SAP w katalogu Detale / operacjach albo popraw plik Sales Forecast. Mapowanie: exact, potem obcięcie 2 ostatnich znaków.',
        q16: 'Co oznacza komunikat o braku ścieżki załączników?',
        a16:
          'Nie ustawiono magazynu plików. Administrator: Ustawienia administracyjne → ścieżka załączników (przeglądarka serwera) → Zapisz. Potem wróć do projektu.',
        q17: 'Dlaczego po filtrze wymiarów lista maszyn jest pusta?',
        a17:
          'Żadna maszyna nie spełnia kryteriów W/D/H/skok. Wyczyść filtry wymiarów lub włącz opcję pokazywania aktywnych maszyn bez obciążenia.',
        q18: 'Co oznacza RFQ?',
        a18:
          'Status oferty / zapytania. Projekty i maszyny RFQ są widoczne w kalkulatorze według filtrów (szczególnie w scenariuszach). create_rfq ogranicza edycję do projektów RFQ.',
        q19: 'Co oznacza obciążenie % (load%)?',
        a19:
          'Stosunek wymaganego czasu operacji do efektywnej dostępności maszyny w okresie, × 100, zaokrąglony. >100% = przeciążenie. Szczegóły: sekcja 13.',
        q20: 'Co oznaczają SOP i EOP?',
        a20:
          'Start of Production / End of Production w formacie MM.YYYY. Poza zakresem wolumen = 0 (chyba że include_in_calculator_after_eop lub manual_year).',
        q21: 'Co oznaczają wolumeny kontraktowe?',
        a21:
          'Osobny zestaw wolumenów (project_volumes_contract). Przełącznik w nagłówku; brak danych → fallback do produkcji. Kalkulator dostaje kolorową ramkę.',
        q22: 'Co to jest OCU?',
        a22:
          'Drugi profil parametrów dni roboczych/OEE. Przełącznik Capacity/OCU w nagłówku (gdy włączony w adminie). Osobny moduł „Dane do OCU” generuje uzupełniony arkusz Katowice. Scenariusze zawsze Capacity.',
        q23: 'Co to jest Flex w Data Viz?',
        a23:
          'Parametr ±% rysujący wstęgę wokół serii kontraktowych (nie osobna seria danych). Produkcja i Call offs bez Flex.',
        q24: 'Co to jest machine usage?',
        a24:
          'Współczynnik 0,1–1 na maszynie. effective_availability = availability / usage. usage 0,5 podwaja capacity i obniża load o połowę.',
        q25: 'Co to są gniazda (nests) — maszyna vs operacja?',
        a25:
          'Gniazdo maszyn = grupa do alokacji. nests_count na operacji = ile detali z jednego cyklu (czas/szt = cykl/nests). To dwa różne pojęcia.',
        q26: 'Jak liczone jest obciążenie?',
        a26:
          'load% = round(Σ required_sec / effective_availability × 100), gdzie required = Σ weekly_vol × (cycle/nests), a effective_availability = availability_base / usage.',
        q27: 'Jak liczona jest dostępność?',
        a27:
          'availability_base = (working_days_year/52)×shift_minutes×60×shifts_per_day×OEE − startup_shutdown; potem dzielone przez machine_usage.',
        q28: 'Jak przeliczany jest wolumen tygodniowy?',
        a28:
          'Roczny ÷ working_weeks_per_year; miesięczny ×12 ÷ working_weeks; tygodniowy bez zmian. Potem ułamki SOP/EOP / okresu.',
        q29: 'Jak działa agregacja „max średnia wg typu”?',
        a29:
          'Dla każdego typu maszyn licz średnią load%; wynik = maksimum tych średnich. Używane w stopce kalkulatora i agregacji linii w Data Viz.',
        q30: 'Jak działa priorytet wolumenu i OEE?',
        a30:
          'Wolumen: operation_volume_by_year > projekt/detal > pola operacji; kontrakt z fallbackiem. OEE: operacja > maszyna > ustawienia roku.',
        q31: 'Jak pobrać załącznik projektu?',
        a31:
          'Otwórz Projekt → zakładka Załączniki → Pobierz. Wymaga admin_attachments.download i skonfigurowanej ścieżki. Lista globalna: Administracja → Załączniki.',
        q32: 'Jak pobrać plik SAP / raport unmatched?',
        a32:
          'W porównaniu Call offs użyj pobierania pliku SalesFcst lub CSV unmatched. Wymaga call_offs.download — nie mylić z załącznikami projektu.',
        q33: 'Jak zrobić backup i restore?',
        a33:
          'Ustawienia administracyjne: backup ręczny lub harmonogram + katalog. Przywracanie zastępuje bazę — tylko z uprawnieniami admin_settings i po świadomej decyzji.',
        q34: 'Jak importować Excel?',
        a34:
          'Administracja → Ustawienia administracyjne → import (maszyny / pakiet capacity / dane wejściowe). Najpierw backup; użyj aktualnego szablonu; sprawdź wynik w Kalkulatorze.',
        q35: 'Jak zresetować hasło?',
        a35:
          'Zgodnie z lokalną procedurą: prośba o reset / e-mail (jeśli skonfigurowane) albo administrator w Zarządzaniu użytkownikami ustawia nowe hasło / zatwierdza odzyskanie dostępu.',
        q36: 'Jak zmienić język?',
        a36:
          'Flaga w nagłówku (PL / EN / DE). Zmienia UI i tę instrukcję; wybór zapamiętany w przeglądarce.',
        q37: 'Jak przeglądać ścieżki na serwerze?',
        a37:
          'Ustawienia administracyjne → Przeglądaj przy katalogu backupu lub załączników. Browser pokazuje foldery serwera aplikacji, pozwala wejść wyżej/niżej, utworzyć folder i wybrać ścieżkę.',
        q38: 'Co daje uprawnienie Tworzenie RFQ (create_rfq)?',
        a38:
          'Tworzenie i edycja wyłącznie projektów RFQ (detale, operacje, wolumeny). Bez projects.edit nie edytujesz projektów aktywnych/produkcyjnych.',
        q39: 'Dlaczego w Projektach nie ma kolumny Pobieranie w rolach?',
        a39:
          'Pobieranie plików projektów nie jest projects.download — należy do Załączniki (administracja): admin_attachments.view / .download. Dlatego macierz Projektów nie ma kolumny download.',
        q40: 'Czym różni się pobieranie załączników od Call offs?',
        a40:
          'Załączniki = pliki z karty projektu (admin_attachments.*). Call offs download = SalesFcst + unmatched CSV (call_offs.download). To osobne permissiony i osobne pliki.',
        q41: 'Co oznacza cykl alternatywny w kalkulatorze?',
        a41:
          'Gdy operacja ma alt_cycle_time_seconds i włączone use_alternative_in_calculator, load liczy się na cyklu/gniazdach/OEE alternatywnych. Obramowanie w kalkulatorze może sygnalizować użycie alt.',
        q42: 'Jak działa alokacja — tryby full / manual / target%?',
        a42:
          'Full przenosi cały wolumen; manual — wpisaną ilość; targetPercent dobiera wolumen tak, by obciążenie źródła zbliżyło się do wskazanego %. Zakres: lata/miesiące/tygodnie.',
        q43: 'Dlaczego scenariusze ignorują przełącznik OCU?',
        a43:
          'Zgodnie z logiką aplikacji scenariusze zawsze używają profilu Capacity (dni robocze/OEE Capacity), nawet gdy nagłówek pokazuje OCU w produkcji.',
        q44: 'Co robi moduł Dane do OCU?',
        a44:
          'Łączy Tabelę przejścia z Katowice_Data i bazą Capacity, uzupełnia kolumny X/AB/AC/AD/AE na Input i zwraca ZIP. Nie zastępuje przełącznika OCU w kalkulatorze — to narzędzie eksportu danych.',
        q45: 'Jak włączyć widoczność modułu w menu?',
        a45:
          'W roli zaznacz Podgląd (view) dla zasobu. Bez view pozycja menu znika. Szczegóły/edycja/usuwanie to osobne akcje.',
        q46: 'Co oznacza include_in_calculator_after_eop?',
        a46:
          'Flaga na wolumenie roku: pozwala nadal liczyć wolumen w kalkulatorze po dacie EOP detalu/projektu. Bez niej po EOP wolumen = 0.',
        q47: 'Jak czytać dualne komórki w Call offs?',
        a47:
          'Komórka pokazuje obciążenie bazy (produkcja lub kontrakt) oraz obciążenie wynikające z wolumenów Call offs dla zmapowanych pozycji — do porównania forecast vs plan.',
        q48: 'Gdzie szukać dalszej pomocy?',
        a48:
          'Sekcje 1–13 tej instrukcji, diagramy, Historia zmian, CAPACITY_LOGIC.md po stronie serwera oraz administrator aplikacji (role, ścieżki, backup).',
      },
    },
    diagrams: {
      dataModel: {
        title: 'Hierarchia danych',
        details: 'Detale\n(katalog)',
        projects: 'Projekty\n+ wolumeny',
        operations: 'Operacje\nfaza · maszyna · cykl',
        machines: 'Maszyny\n+ capacity',
        calculator: 'Kalkulator\nobciążenia %',
      },
      modes: {
        title: 'Tryby / przestrzenie',
        production: 'Wersja\nprodukcyjna',
        scenario: 'Scenariusze',
        note: 'Call offs = osobna przestrzeń porównania SAP',
      },
      calculation: {
        title: 'Przepływ obliczenia obciążenia',
        settings: 'Dni robocze\nOEE · zmiany',
        volumes: 'Wolumeny\ndetal / operacja',
        ops: 'Operacje\nna maszynie',
        result: 'Obciążenie %\n+ max wg typu',
      },
      projectFlow: {
        title: 'Tworzenie projektu',
        s1: 'Klient +\nnazwa',
        s2: 'Detale\nz katalogu',
        s3: 'Operacje\nper detal',
        s4: 'Wolumeny\nroczne',
        s5: 'Kalkulator',
      },
      scenario: {
        title: 'Scenariusz vs produkcja',
        live: 'Baza\nprodukcyjna',
        snap: 'Snapshot\nscenariusza',
        calc: 'Kalkulator\nscenariusza',
        compare: 'Wizualizacja\nmulti-scenariusz',
      },
      callOffs: {
        title: 'Przepływ Call offs',
        file: 'Plik SAP\nSalesFcst',
        match: 'Mapowanie\nSAP → detale',
        calc: 'Kalkulator\ndual load',
        viz: 'Serie na\nwykresach',
      },
      dataViz: {
        title: 'Wizualizacja — źródła',
        base: 'Produkcja /\nkontrakt',
        sources: 'Call offs +\nscenariusze',
        charts: 'Linie /\nmaszyny',
        export: 'PDF /\nExcel',
      },
      adminMap: {
        title: 'Mapa administracji',
        db: 'Ustawienia\nbazy',
        adm: 'Backup\nImport',
        users: 'Użytkownicy\nRBAC',
        hist: 'Historia',
        manual: 'Instrukcja',
      },
      dependencies: {
        title: 'Kluczowe zależności',
        phases: 'Fazy →\noperacje',
        types: 'Typy maszyn →\nformularz',
        wd: 'Dni robocze →\ncapacity',
        parts: 'Detale →\nprojekty',
        machines: 'Maszyny →\noperacje',
      },
    },
  },
};
