import type { TranslationTree } from '../types';

export const manualPl: TranslationTree = {
  manual: {
    title: 'Instrukcja obsługi',
    subtitle:
      'Kompletny przewodnik po systemie Autoneum Capacity — moduły, zależności danych i sposób pracy. Treść zmienia się wraz z wybranym językiem w nagłówku aplikacji.',
    backAdmin: '← Administracja',
    toc: 'Spis treści',
    tip: 'Wskazówka',
    seeAlso: 'Zobacz także',
    stepsLabel: 'Kroki postępowania',
    sections: {
      overview: {
        title: '1. Wprowadzenie',
        p1:
          'Autoneum Capacity to aplikacja do planowania i analizy obciążenia linii produkcyjnych. Łączy katalog maszyn, projekty z detalami i operacjami oraz kalkulator obciążenia z możliwością symulacji scenariuszy „co jeśli”.',
        p2:
          'Główne obszary dostępne z paska nawigacji: Kalkulator, Maszyny, Projekty, Detale oraz Administracja. Tryb Scenariusze (przycisk w nagłówku) ogranicza widok do kopii danych wybranego scenariusza.',
        stepsTitle: 'Typowy przepływ pracy',
        step1: 'Skonfiguruj słowniki w Administracja → Ustawienia bazy (fazy, detale, typy maszyn, dni robocze).',
        step2: 'Zaimportuj lub utwórz maszyny (Maszyny) i projekty z operacjami (Projekty).',
        step3: 'Uzupełnij wolumeny detali w projektach i sprawdź obciążenie w Kalkulatorze.',
        step4: 'Opcjonalnie: utwórz scenariusz, wprowadź zmiany i porównaj wyniki w Wizualizacji danych.',
      },
      header: {
        title: '2. Nagłówek aplikacji',
        p1:
          'Pasek u góry ekranu steruje trybem obliczeń i widocznością danych. Ustawienia nagłówka wpływają na Kalkulator, alokację wolumenów i raporty wizualizacji.',
        contractualTitle: 'Wolumeny kontraktowe',
        contractual:
          'Przełącznik włącza używanie wolumenów kontraktowych zamiast produkcyjnych (z fallbackiem, gdy brak danych kontraktowych). Kalkulator otacza wtedy kolorową ramką (kolor w Ustawienia wizualne).',
        capacityTitle: 'Wersja Produkcyjna vs Scenariusze',
        capacity:
          '„Wersja Produkcyjna” (Capacity) operuje na żywych danych bazy. „Scenariusze” przełącza na kopię wybranego scenariusza — Kalkulator i Historia zmian pokazują wtedy stan scenariusza, nie produkcji.',
        ocuTitle: 'Capacity / OCU',
        ocu:
          'Gdy funkcja OCU jest włączona w ustawieniach administracyjnych, przełącznik w nagłówku zmienia profil parametrów (OEE, dni robocze itd.) na osobny zestaw OCU. Logika obliczeń obciążenia pozostaje taka sama.',
        langTitle: 'Język',
        lang: 'Ikona flagi zmienia język interfejsu i tej instrukcji (polski, angielski, niemiecki). Wybór jest zapamiętywany w przeglądarce.',
      },
      dataModel: {
        title: '3. Model danych i zależności',
        p1:
          'Dane w systemie tworzą hierarchię: detale (katalog) są przypisywane do projektów; w projekcie definiuje się operacje (faza + maszyna + czas cyklu); operacje generują obciążenie maszyn w Kalkulatorze.',
        p2:
          'Maszyna musi istnieć przed przypisaniem do operacji. Faza procesu i typ maszyny pochodzą ze słowników administracyjnych. Wolumen operacji może pochodzić z detalu projektu, z pól operacji lub z nadpisania rocznego.',
        dep1: 'Usunięcie detalu z katalogu wymaga rozwiązania powiązanych operacji.',
        dep2: 'Typ maszyny musi być zdefiniowany w słowniku Typy maszyn.',
        dep3: 'Dni robocze i OEE wpływają na dostępną capacity [s/tydz] każdej maszyny.',
        dep4: 'Scenariusz to kopia stanu produkcyjnego (lub innego scenariusza) z własną historią zmian.',
      },
      calculator: {
        title: '4. Kalkulator obciążenia',
        p1:
          'Tabela pokazuje maszyny aktywne (oraz RFQ w trybie scenariusza) z procentem obciążenia w kolejnych latach. Kliknięcie komórki roku otwiera alokację — przeniesienie wolumenu między maszynami.',
        p2:
          'Obciążenie % = suma (wymagany czas operacji / dostępność maszyny) × machine usage × 100. Wymagany czas = wolumen tygodniowy × (czas cyklu / liczba gniazd).',
        p3:
          'Kolory komórek (OK / ostrzeżenie / przeciążenie), obramowania alternatywnego czasu cyklu i znacznik RFQ konfiguruje się w Administracja → Ustawienia bazy → Ustawienia wizualne.',
        step1: 'Filtruj maszyny po typie, statusie, wymiarach lub wyszukiwaniu.',
        step2: 'Kliknij % obciążenia, aby otworzyć okno alokacji dla danego roku.',
        step3: 'Eksportuj raport PDF lub Excel z widoku kalkulatora.',
        step4: 'Nad tabelą (przy wolumenach kontraktowych, poza scenariuszem) — czerwony pas z maszynami powyżej 100%.',
      },
      machines: {
        title: '5. Maszyny',
        p1:
          'Rejestr maszyn produkcyjnych: numer SAP, numer wewnętrzny, typ, linia, lokalizacja, wymiary, status (aktywna / nieaktywna / RFQ), machine usage i nadpisanie OEE.',
        p2:
          'Szczegóły maszyny obejmują zakładki: opis, operacje na maszynie, alternatywy (inne maszyny mogące wykonać tę samą pracę) oraz historia zmian.',
        step1: 'Nowa maszyna — wybierz typ z listy (słownik Typy maszyn).',
        step2: 'Status RFQ — maszyna widoczna w kalkulatorze scenariusza po powiązaniu z projektem RFQ.',
        step3: 'Import maszyn z Excela — Administracja → Ustawienia administracyjne.',
      },
      projects: {
        title: '6. Projekty',
        p1:
          'Projekt grupuje detale klienta z operacjami produkcyjnymi. Każdy detal w projekcie ma wolumeny roczne (produkcyjne i opcjonalnie kontraktowe), SOP/EOP oraz operacje (faza, maszyna, cykl, gniazda).',
        p2:
          'Status projektu (aktywny, RFQ, archiwum) wpływa na widoczność w kalkulatorze. Set detali to grupa z jednym źródłem wolumenu.',
        step1: 'Utwórz projekt i dodaj detale z katalogu lub nowe.',
        step2: 'Zakładka Operacje — definiuj trasę produkcyjną (maszyna + faza + czas).',
        step3: 'Zakładka Wolumeny — uzupełnij dane roczne; autozapis można włączyć w ustawieniach bazy.',
        step4: 'Notatki projektu dokumentują decyzje i kontekst zmian.',
      },
      details: {
        title: '7. Detale (oznaczenia)',
        p1:
          'Globalny katalog detali: Nr SAP, Alias, Free text. Detale są współdzielone między projektami — zmiana w katalogu widoczna przy kolejnym wyborze w projekcie.',
        p2:
          'Kolumna „Projekt” i „Nr linii” w tabeli detali pomagają zlokalizować użycie. Usuwanie detalu z operacjami wymaga wyboru operacji do usunięcia.',
      },
      scenarios: {
        title: '8. Scenariusze',
        p1:
          'Scenariusz to izolowana kopia danych do symulacji zmian bez modyfikacji wersji produkcyjnej. Tworzysz go z bazy produkcyjnej lub jako kopię innego scenariusza.',
        p2:
          'W trybie Scenariusze nawigacja (Kalkulator, Historia zmian) działa na kopii. Nowe projekty i detale w katalogu tworzysz po powrocie do Wersji Produkcyjnej.',
        step1: 'Lista scenariuszy — utwórz, otwórz podgląd, edytuj nazwę/zakres, archiwizuj.',
        step2: 'Edycja scenariusza — zmiany statusów projektów, wolumenów, operacji w kopii.',
        step3: 'Porównaj scenariusze z produkcją w Wizualizacja danych (zakładka Analityka).',
      },
      admin: {
        title: '9. Administracja',
        p1: 'Panel administracyjny grupuje narzędzia konfiguracji, backupu, raportowania i audytu.',
        dbTitle: 'Ustawienia bazy',
        db:
          'Dni robocze (Capacity i OCU), fazy procesu, katalog detali, typy maszyn, ustawienia wizualne kalkulatora, zachowanie autozapisu wolumenów.',
        admTitle: 'Ustawienia administracyjne',
        adm:
          'Backup automatyczny i ręczny, przywracanie bazy, import/eksport Excel (pełny pakiet, maszyny, dane wejściowe), włączenie OCU, czyszczenie bazy.',
        vizTitle: 'Wizualizacja danych',
        viz:
          'Wykresy trendów obciążenia linii i maszyn, tabela analityczna, wykres różnic (delta) między produkcją a scenariuszem. Eksport PDF/Excel.',
        histTitle: 'Historia zmian',
        hist:
          'Rejestr zmian w projektach, maszynach i operacjach z filtrami (projekt, maszyna, detal, autor, tekst). W scenariuszu — historia kopii scenariusza.',
      },
      formulas: {
        title: '10. Wzory obliczeniowe',
        p1: 'Poniższe wzory stosuje silnik capacity (serwer) przy każdym odświeżeniu kalkulatora.',
        avail:
          'Dostępność [s/tydz] = (dni robocze / 52) × czas zmiany [min] × 60 × zmiany/dobę × OEE − czas uruchomienia/zakończenia [s], skorygowane o machine usage.',
        weekly:
          'Wolumen tygodniowy: roczny ÷ tygodnie robocze; miesięczny × 12 ÷ tygodnie robocze; tygodniowy — bez przeliczenia.',
        required: 'Czas wymagany [s/tydz] = Σ (wolumen tyg. × czas cyklu / gniazda) dla operacji na maszynie w danym roku.',
        load: 'Obciążenie % = round(Σ (czas wymagany operacji / dostępność z OEE operacji) × machine usage × 100).',
        sop: 'SOP/EOP — ułamek roku ogranicza wolumen operacji projektu do miesięcy w zakresie produkcji.',
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
        title: 'Tryby pracy',
        production: 'Wersja\nProdukcyjna',
        scenario: 'Scenariusze\n(kopia danych)',
        note: 'Ten sam interfejs — inne źródło danych',
      },
      calculation: {
        title: 'Przepływ obliczenia obciążenia',
        settings: 'Dni robocze\nOEE · zmiany',
        volumes: 'Wolumeny\ndetal / operacja',
        ops: 'Operacje\nna maszynie',
        result: 'Obciążenie %\nper rok',
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
        compare: 'Analityka\nróżnic',
      },
      adminMap: {
        title: 'Mapa administracji',
        db: 'Ustawienia\nbazy',
        adm: 'Backup\nImport',
        viz: 'Wizualizacja',
        hist: 'Historia',
      },
      dependencies: {
        title: 'Kluczowe zależności',
        phases: 'Fazy →\noperacje',
        types: 'Typy maszyn →\nformularz maszyny',
        wd: 'Dni robocze →\ncapacity',
        parts: 'Detale →\nprojekty',
        machines: 'Maszyny →\noperacje',
      },
    },
  },
};
