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
          'Zarządzanie użytkownikami i rolami: Administracja → Użytkownicy i uprawnienia (wymaga odpowiednich permissionów). Reset hasła — zgodnie z konfiguracją e-mail / procedury lokalnej.',
        stepsTitle: 'Przepływ dostępu',
        step1: 'Otwórz aplikację → ekran logowania (login / hasło).',
        step2: 'Po wejściu widoczne są tylko moduły dozwolone przez rolę.',
        step3: 'Wylogowanie kończy sesję; przy braku uprawnień akcje zapisu są zablokowane.',
        role1: 'Administrator — pełna konfiguracja, backup, użytkownicy, import/eksport.',
        role2: 'Planista / edytor — projekty, maszyny, kalkulator, scenariusze, Call offs (wg uprawnień).',
        role3: 'Podgląd / gość — odczyt wybranych ekranów bez zmian danych produkcyjnych.',
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
          'Gdy OCU jest włączone w ustawieniach administracyjnych, przełącznik zmienia profil parametrów (OEE, dni robocze itd.) na zestaw OCU. Logika wzoru obciążenia pozostaje ta sama.',
        langTitle: 'Język',
        lang: 'Flaga zmienia język interfejsu i tej instrukcji (PL / EN / DE). Wybór jest zapamiętywany w przeglądarce.',
      },
      dataModel: {
        title: '4. Model danych i zależności',
        p1:
          'Hierarchia: detale (katalog) → projekty → operacje (faza + maszyna + cykl) → obciążenie maszyn w Kalkulatorze. Maszyna musi istnieć przed przypisaniem do operacji.',
        p2:
          'Wolumen może pochodzić z detalu projektu, pól operacji lub nadpisania rocznego (produkcyjny i kontraktowy osobno). Scenariusz i Call offs to osobne warstwy porównawcze na tych samych maszynach.',
        dep1: 'Usunięcie detalu z katalogu wymaga rozwiązania powiązanych operacji.',
        dep2: 'Typ maszyny musi być w słowniku Typy maszyn.',
        dep3: 'Dni robocze i OEE określają dostępność [s/tydzień] maszyny.',
        dep4: 'Scenariusz = snapshot produkcji (lub innego scenariusza / Call offs) z własną historią.',
        dep5: 'Call offs = wolumeny z pliku SAP mapowane na operacje/detale; poza latami pliku serie Call offs są puste.',
      },
      calculator: {
        title: '5. Kalkulator obciążenia',
        p1:
          'Tabela pokazuje maszyny (wg filtrów statusu) z % obciążenia w latach — oraz opcjonalnie miesiącach/tygodniach po rozwinięciu. Kolory progów, znaczniki SOP/EOP i RFQ ustawia się w Ustawieniach wizualnych.',
        p2:
          'Obciążenie % maszyny = wymagany czas operacji / dostępność × machine usage × 100 (szczegóły w sekcji wzorów). W trybie Call offs komórki pokazują dualnie: baza + Call offs.',
        p3:
          'Na dole tabeli: Suma obciążeń, Średnia obciążeń oraz Max średnia wg typu (najwyższa średnia wśród typów maszyn w bieżącym filtrze — np. średnia MC vs WJ vs HL).',
        p4:
          'Ten sam kalkulator działa w produkcji, scenariuszu i Call offs — źródło danych wybierasz w nagłówku / nawigacji.',
        stepsTitle: 'Przepływ w kalkulatorze',
        step1: 'Ustaw zakres lat i filtry (typ, klient, status, linia, wymiary maszyn, wyszukiwanie).',
        step2: 'Opcjonalnie włącz wolumeny kontraktowe i/lub profil OCU.',
        step3: 'Rozwiń rok na miesiące/tygodnie (ISO: poniedziałek–niedziela), gdy potrzebujesz szczegółu.',
        step4: 'Kliknij komórkę obciążenia, aby otworzyć alokację (przeniesienie wolumenu) — gdy masz uprawnienia.',
        step5: 'Eksportuj widok lub raport PDF/Excel; sprawdź pasek przeciążonych maszyn (>100%).',
        summaryTitle: 'Wiersze podsumowania',
        summary:
          'Suma = suma % widocznych maszyn. Średnia = suma / liczba maszyn. Max średnia wg typu = dla każdego typu policz średnią %, potem weź maksimum (używane też jako agregacja linii w Wizualizacji).',
        allocTitle: 'Alokacja',
        alloc:
          'Okno alokacji proponuje maszyny z gniazda lub listy alternatyw. Tryby przeniesienia: pełne, ręczne, do docelowego %. Można ograniczyć do lat/miesięcy/tygodni. Po zapisie kalkulator się odświeża.',
        filtersTitle: 'Filtry wymiarów',
        filters:
          'Filtry szerokość / głębokość / wysokość / skok działają po stronie klienta na pełnym wyniku (szybka zmiana bez ponownego pełnego zapytania API). Opcja pokazania maszyn aktywnych bez obciążenia — gdy filtr wymiarów jest aktywny.',
      },
      machines: {
        title: '6. Maszyny',
        p1:
          'Rejestr: SAP, numer wewnętrzny, typ, linia, lokalizacja, wymiary, status (aktywna / nieaktywna / RFQ), machine usage, OEE nadpisany.',
        p2:
          'Szczegóły maszyny: opis, operacje, alternatywy, historia. Gniazda (nests) grupują maszyny do alokacji.',
        stepsTitle: 'Przepływ',
        step1: 'Nowa maszyna — typ ze słownika Typy maszyn.',
        step2: 'Status RFQ — widoczność w kalkulatorze scenariusza po powiązaniu z projektem RFQ.',
        step3: 'Import Excel — Administracja → Ustawienia administracyjne.',
      },
      projects: {
        title: '7. Projekty',
        p1:
          'Projekt grupuje detale klienta z operacjami. Detal ma wolumeny roczne (produkcyjne i kontraktowe), SOP/EOP oraz operacje (faza, maszyna, cykl, gniazda, % capacity, OPF).',
        p2:
          'Status projektu (aktywny / RFQ / nieaktywny) wpływa na kalkulator. Set detali = grupa ze wspólnym źródłem wolumenu. Załączniki i notatki dokumentują kontekst.',
        stepsTitle: 'Przepływ',
        step1: 'Utwórz projekt (klient, nazwa, status).',
        step2: 'Dodaj detale z katalogu lub nowe; ustaw SOP/EOP.',
        step3: 'Zakładka Operacje — trasa (maszyna + faza + cykl).',
        step4: 'Zakładka Wolumeny — roczne / miesięczne / tygodniowe; nadpisanie roku (origin manual) vs domyślne.',
        step5: 'Notatki ręczne vs automatyczne; opcjonalnie załączniki plików.',
      },
      details: {
        title: '8. Detale (oznaczenia)',
        p1:
          'Globalny katalog: Nr SAP, Alias, Free text. Detale są współdzielone między projektami. Walidacja blokuje duplikaty oznaczeń.',
        p2:
          'Kolumny Projekt / linia pomagają znaleźć użycie. Usuwanie detalu z operacjami wymaga wyboru operacji do usunięcia.',
      },
      scenarios: {
        title: '9. Scenariusze',
        p1:
          'Scenariusz to izolowana kopia danych do symulacji bez zmiany produkcji. Możesz utworzyć go z bazy produkcyjnej, z innego scenariusza lub z porównania Call offs.',
        p2:
          'W trybie Scenariusze Kalkulator i Historia działają na kopii. Nowe projekty/detale w katalogu produkcyjnym tworzysz po powrocie do Wersji produkcyjnej. Możesz dodać projekty z capacity do scenariusza i zmienić statusy RFQ/aktywny.',
        p3:
          'Wdrożenie do produkcji (apply) wymaga potwierdzenia (challenge) i odpowiednich uprawnień — przenosi wybrane zmiany ze scenariusza na żywą bazę.',
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
        stepsTitle: 'Przepływ Call offs',
        step1: 'Utwórz porównanie (nazwa + plik Excel) w przestrzeni Call offs.',
        step2: 'Sprawdź dopasowanie SAP i raport unmatched.',
        step3: 'Otwórz Kalkulator w trybie Call offs — dualne komórki obciążenia.',
        step4: 'W Wizualizacji wybierz porównanie z listy i włącz serię Call offs na wykresach.',
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
        p1: 'Panel konfiguracji, bezpieczeństwa, backupu i audytu. W trybie Scenariusze/Call offs lista kart jest ograniczona.',
        dbTitle: 'Ustawienia bazy',
        db:
          'Dni robocze (Capacity i OCU), fazy, katalog detali, typy maszyn, ustawienia wizualne (kolory progów, wiersze sumy/średniej, flex kolorów Data Viz), autozapis wolumenów.',
        admTitle: 'Ustawienia administracyjne',
        adm:
          'Backup automatyczny/ręczny, przywracanie, import/eksport Excel (pakiet capacity, maszyny, dane wejściowe), włączenie OCU, ścieżki storage, czyszczenie bazy.',
        usersTitle: 'Użytkownicy i uprawnienia',
        users:
          'Konta, role, mapowanie permissionów do ekranów i API. Bez uprawnienia użytkownik nie zobaczy np. edycji projektów ani importu.',
        histTitle: 'Historia zmian',
        hist:
          'Rejestr zmian projektów, maszyn i operacji z filtrami. W scenariuszu — historia kopii scenariusza. Wpisy ręczne vs automatyczne.',
      },
      formulas: {
        title: '13. Wzory obliczeniowe',
        p1: 'Silnik capacity (serwer) stosuje poniższe przy każdym przeliczeniu kalkulatora / API.',
        avail:
          'Dostępność [s/tydz] = (dni robocze / 52) × czas zmiany [min] × 60 × zmiany/dobę × OEE − startup/shutdown [s], skorygowane o machine usage. OEE: operacja > maszyna > ustawienia roku.',
        weekly:
          'Wolumen tygodniowy: roczny ÷ tygodnie robocze; miesięczny × 12 ÷ tygodnie; tygodniowy — bez przeliczenia.',
        required: 'Czas wymagany [s/tydz] = Σ (wolumen tyg. × czas cyklu / gniazda) dla operacji na maszynie w roku (z uwzględnieniem SOP/EOP).',
        load: 'Obciążenie % maszyny = round(Σ (czas wymagany / dostępność z OEE operacji) × machine usage × 100).',
        sop: 'SOP/EOP — ułamek roku / miesiąca / tygodnia ogranicza wolumen do okresów w zakresie produkcji.',
        maxType:
          'Max średnia wg typu (kalkulator + agregacja Data Viz) = max_t ( średnia load_% maszyn typu t ).',
        isoWeek: 'Tygodnie kalendarza w rozwinięciu okresów: ISO (poniedziałek–niedziela).',
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
