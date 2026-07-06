import type { TranslationTree } from '../types';

export const manualDe: TranslationTree = {
  manual: {
    title: 'Bedienungsanleitung',
    subtitle:
      'Vollständiger Leitfaden zum Autoneum-Capacity-System — Module, Datenabhängigkeiten und Arbeitsabläufe. Der Inhalt folgt der in der Kopfzeile gewählten Sprache.',
    backAdmin: '← Administration',
    toc: 'Inhaltsverzeichnis',
    tip: 'Tipp',
    seeAlso: 'Siehe auch',
    stepsLabel: 'Schritte',
    sections: {
      overview: {
        title: '1. Einführung',
        p1:
          'Autoneum Capacity ist eine Anwendung zur Planung und Analyse der Produktionslinienauslastung. Sie verbindet Maschinenregister, Projekte mit Teilen und Operationen sowie einen Auslastungskalkulator mit Szenariosimulation.',
        p2:
          'Hauptbereiche in der Navigationsleiste: Kalkulator, Maschinen, Projekte, Teile und Administration. Der Szenariomodus (Kopfzeilen-Schalter) beschränkt die Ansicht auf eine Kopie der gewählten Szenariodaten.',
        stepsTitle: 'Typischer Arbeitsablauf',
        step1: 'Wörterbücher in Administration → Datenbankeinstellungen konfigurieren (Phasen, Teile, Maschinentypen, Arbeitstage).',
        step2: 'Maschinen importieren oder anlegen (Maschinen) und Projekte mit Operationen (Projekte).',
        step3: 'Teilevolumen in Projekten erfassen und Auslastung im Kalkulator prüfen.',
        step4: 'Optional: Szenario erstellen, Änderungen vornehmen und Ergebnisse in der Datenvisualisierung vergleichen.',
      },
      header: {
        title: '2. Anwendungskopfzeile',
        p1:
          'Die obere Leiste steuert Berechnungsmodus und Datensichtbarkeit. Kopfzeileneinstellungen beeinflussen Kalkulator, Volumenallokation und Visualisierungsberichte.',
        contractualTitle: 'Vertragsvolumen',
        contractual:
          'Schalter verwendet Vertragsvolumen statt Produktionsvolumen (mit Fallback bei fehlenden Vertragsdaten). Der Kalkulator wird dann mit konfigurierbarer Farbe umrahmt (Visuelle Einstellungen).',
        capacityTitle: 'Produktionsversion vs. Szenarien',
        capacity:
          '„Produktionsversion“ (Capacity) arbeitet mit Live-Datenbankdaten. „Szenarien“ wechselt zur Kopie des gewählten Szenarios — Kalkulator und Änderungsverlauf zeigen dann den Szenariozustand, nicht die Produktion.',
        ocuTitle: 'Capacity / OCU',
        ocu:
          'Wenn OCU in den administrativen Einstellungen aktiviert ist, schaltet der Kopfzeilen-Umschalter den Parameterprofil (OEE, Arbeitstage usw.) auf einen separaten OCU-Satz. Die Auslastungslogik bleibt gleich.',
        langTitle: 'Sprache',
        lang: 'Das Flaggen-Symbol ändert UI- und Anleitungssprache (Polnisch, Englisch, Deutsch). Die Wahl wird im Browser gespeichert.',
      },
      dataModel: {
        title: '3. Datenmodell und Abhängigkeiten',
        p1:
          'Daten bilden eine Hierarchie: Teile (Katalog) werden Projekten zugeordnet; Operationen (Phase + Maschine + Zykluszeit) werden pro Projekt definiert; Operationen erzeugen Maschinenauslastung im Kalkulator.',
        p2:
          'Eine Maschine muss existieren, bevor sie einer Operation zugewiesen wird. Prozessphase und Maschinentyp stammen aus administrativen Wörterbüchern. Operationsvolumen kann vom Projektteil, Operationsfeldern oder einer Jahresüberschreibung stammen.',
        dep1: 'Löschen eines Katalogteils erfordert Auflösung verknüpfter Operationen.',
        dep2: 'Maschinentyp muss im Wörterbuch Maschinentypen definiert sein.',
        dep3: 'Arbeitstage und OEE beeinflussen die verfügbare Capacity [s/Woche] jeder Maschine.',
        dep4: 'Ein Szenario ist eine Kopie des Produktions- (oder eines anderen Szenario-)Zustands mit eigenem Änderungsverlauf.',
      },
      calculator: {
        title: '4. Auslastungskalkulator',
        p1:
          'Die Tabelle zeigt aktive Maschinen (und RFQ im Szenariomodus) mit Auslastung in Prozent pro Jahr. Klick auf eine Jahreszelle öffnet die Allokation — Volumenverschiebung zwischen Maschinen.',
        p2:
          'Auslastung % = Summe (benötigte Operationszeit / Maschinenverfügbarkeit) × machine usage × 100. Benötigte Zeit = Wochenvolumen × (Zykluszeit / Nestanzahl).',
        p3:
          'Zellenfarben (OK / Warnung / Überlast), alternative Zyklusrahmen und RFQ-Kennzeichnung werden in Administration → Datenbankeinstellungen → Visuelle Einstellungen konfiguriert.',
        step1: 'Maschinen nach Typ, Status, Abmessungen oder Suche filtern.',
        step2: 'Auf Auslastung % klicken, um Allokation für dieses Jahr zu öffnen.',
        step3: 'PDF- oder Excel-Bericht aus der Kalkulatoransicht exportieren.',
        step4: 'Über der Tabelle (bei Vertragsvolumen, außerhalb des Szenariomodus) — roter Balken mit Maschinen über 100 %.',
      },
      machines: {
        title: '5. Maschinen',
        p1:
          'Produktionsmaschinenregister: SAP-Nummer, interne Nummer, Typ, Linie, Standort, Abmessungen, Status (aktiv / inaktiv / RFQ), machine usage und OEE-Überschreibung.',
        p2:
          'Maschinendetail-Registerkarten: Beschreibung, Operationen auf Maschine, Alternativen (andere Maschinen für dieselbe Arbeit) und Änderungsverlauf.',
        step1: 'Neue Maschine — Typ aus Liste wählen (Wörterbuch Maschinentypen).',
        step2: 'RFQ-Status — Maschine im Szenario-Kalkulator sichtbar bei Verknüpfung mit RFQ-Projekt.',
        step3: 'Maschinenimport aus Excel — Administration → Administrative Einstellungen.',
      },
      projects: {
        title: '6. Projekte',
        p1:
          'Ein Projekt gruppiert Kundenteile mit Produktionsoperationen. Jedes Teil hat Jahresvolumen (Produktion und optional Vertrag), SOP/EOP und Operationen (Phase, Maschine, Zyklus, Nester).',
        p2:
          'Projektstatus (aktiv, RFQ, Archiv) beeinflusst die Kalkulatorsichtbarkeit. Ein Teile-Set ist eine Gruppe mit einer Volumenquelle.',
        step1: 'Projekt anlegen und Teile aus Katalog oder neu hinzufügen.',
        step2: 'Registerkarte Operationen — Fertigungsroute definieren (Maschine + Phase + Zeit).',
        step3: 'Registerkarte Volumen — Jahresdaten erfassen; Autospeichern in Datenbankeinstellungen aktivierbar.',
        step4: 'Projektnotizen dokumentieren Entscheidungen und Änderungskontext.',
      },
      details: {
        title: '7. Teile (Bezeichnungen)',
        p1:
          'Globaler Teilekatalog: SAP-Nr., Alias, Freitext. Teile werden projektübergreifend genutzt — Katalogänderungen erscheinen bei der nächsten Auswahl im Projekt.',
        p2:
          'Spalten „Projekt“ und „Liniennr.“ helfen bei der Nutzungssuche. Löschen eines Teils mit Operationen erfordert Auswahl zu löschender Operationen.',
      },
      scenarios: {
        title: '8. Szenarien',
        p1:
          'Ein Szenario ist eine isolierte Datenkopie zur Simulation von Änderungen ohne Produktionsänderung. Erstellung aus Produktionsdatenbank oder als Kopie eines anderen Szenarios.',
        p2:
          'Im Szenariomodus arbeitet die Navigation (Kalkulator, Änderungsverlauf) auf der Kopie. Neue Projekte und Katalogteile nach Rückkehr zur Produktionsversion anlegen.',
        step1: 'Szenarioliste — erstellen, Vorschau öffnen, Name/Umfang bearbeiten, archivieren.',
        step2: 'Szenariobearbeitung — Projektstatus, Volumen, Operationen in der Kopie ändern.',
        step3: 'Szenarien mit Produktion in Datenvisualisierung vergleichen (Registerkarte Analyse).',
      },
      admin: {
        title: '9. Administration',
        p1: 'Das Administrationspanel bündelt Konfiguration, Backup, Berichterstattung und Audit.',
        dbTitle: 'Datenbankeinstellungen',
        db:
          'Arbeitstage (Capacity und OCU), Prozessphasen, Teilekatalog, Maschinentypen, Kalkulator-Visualeinstellungen, Autospeichern der Volumen.',
        admTitle: 'Administrative Einstellungen',
        adm:
          'Automatisches und manuelles Backup, Datenbankwiederherstellung, Excel-Import/Export (volles Paket, Maschinen, Eingabedaten), OCU-Aktivierung, Datenbank leeren.',
        vizTitle: 'Datenvisualisierung',
        viz:
          'Auslastungstrenddiagramme für Linien und Maschinen, Analysetabelle, Delta-Diagramm (Produktion vs. Szenario). PDF-/Excel-Export.',
        histTitle: 'Änderungsverlauf',
        hist:
          'Protokoll von Änderungen an Projekten, Maschinen und Operationen mit Filtern (Projekt, Maschine, Teil, Autor, Text). Im Szenariomodus — Szenariokopie-Verlauf.',
      },
      formulas: {
        title: '10. Berechnungsformeln',
        p1: 'Die Capacity-Engine (Server) wendet diese Formeln bei jeder Kalkulatoraktualisierung an.',
        avail:
          'Verfügbarkeit [s/Woche] = (Arbeitstage / 52) × Schichtzeit [min] × 60 × Schichten/Tag × OEE − An-/Abfahrt [s], angepasst um machine usage.',
        weekly:
          'Wochenvolumen: jährlich ÷ Arbeitswochen; monatlich × 12 ÷ Arbeitswochen; wöchentlich — keine Umrechnung.',
        required: 'Benötigte Zeit [s/Woche] = Σ (Wochenvol. × Zykluszeit / Nester) für Operationen auf der Maschine in diesem Jahr.',
        load: 'Auslastung % = round(Σ (benötigte Op.-Zeit / Verfügbarkeit mit Op.-OEE) × machine usage × 100).',
        sop: 'SOP/EOP — Jahresanteil begrenzt Projektvolumen der Operation auf Monate im Produktionszeitraum.',
      },
    },
    diagrams: {
      dataModel: {
        title: 'Datenhierarchie',
        details: 'Teile\n(Katalog)',
        projects: 'Projekte\n+ Volumen',
        operations: 'Operationen\nPhase · Maschine · Zyklus',
        machines: 'Maschinen\n+ Capacity',
        calculator: 'Auslastungs-\nkalkulator %',
      },
      modes: {
        title: 'Arbeitsmodi',
        production: 'Produktions-\nversion',
        scenario: 'Szenarien\n(Datenkopie)',
        note: 'Gleiche UI — andere Datenquelle',
      },
      calculation: {
        title: 'Auslastungsberechnung',
        settings: 'Arbeitstage\nOEE · Schichten',
        volumes: 'Volumen\nTeil / Operation',
        ops: 'Operationen\nauf Maschine',
        result: 'Auslastung %\npro Jahr',
      },
      projectFlow: {
        title: 'Projekt anlegen',
        s1: 'Kunde +\nName',
        s2: 'Teile\naus Katalog',
        s3: 'Operationen\npro Teil',
        s4: 'Jahres-\nvolumen',
        s5: 'Kalkulator',
      },
      scenario: {
        title: 'Szenario vs. Produktion',
        live: 'Produktions-\ndatenbank',
        snap: 'Szenario-\nSnapshot',
        calc: 'Szenario-\nKalkulator',
        compare: 'Delta-\nAnalyse',
      },
      adminMap: {
        title: 'Administrationskarte',
        db: 'Datenbank-\neinstellungen',
        adm: 'Backup\nImport',
        viz: 'Visualisierung',
        hist: 'Verlauf',
      },
      dependencies: {
        title: 'Wichtige Abhängigkeiten',
        phases: 'Phasen →\nOperationen',
        types: 'Maschinentypen →\nMaschinenformular',
        wd: 'Arbeitstage →\nCapacity',
        parts: 'Teile →\nProjekte',
        machines: 'Maschinen →\nOperationen',
      },
    },
  },
};
