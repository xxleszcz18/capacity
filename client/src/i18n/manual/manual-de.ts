import type { TranslationTree } from '../types';

export const manualDe: TranslationTree = {
  manual: {
    title: 'Bedienungsanleitung',
    subtitle:
      'Vollständiger Leitfaden zu Autoneum Capacity — Funktionen, Arbeitsabläufe und Datenabhängigkeiten. Der Inhalt folgt der Sprache in der Kopfzeile (PL / EN / DE).',
    backAdmin: '← Administration',
    toc: 'Inhaltsverzeichnis',
    tip: 'Tipp',
    seeAlso: 'Siehe auch',
    stepsLabel: 'Ablaufschritte',
    sections: {
      overview: {
        title: '1. Einführung',
        p1:
          'Autoneum Capacity dient der Planung und Analyse der Auslastung von Produktionslinien. Es verbindet Maschinenkatalog, Projekte mit Details und Operationen, Auslastungsrechner, Was-wäre-wenn-Szenarien, Call-offs-Vergleiche (SAP Sales Forecast) und Trendvisualisierung.',
        p2:
          'Navigation: Rechner, Maschinen, Projekte, Details, Datenvisualisierung und Administration. Arbeitsbereiche: Produktionsversion, Szenarien und Call offs (Schalter in der Kopfzeile).',
        p3:
          'Zugang erfordert Anmeldung. RBAC-Berechtigungen beschränken Ansichten und Aktionen. Diese Anleitung: Administration → Bedienungsanleitung.',
        stepsTitle: 'Typischer Arbeitsablauf',
        step1: 'Anmelden; Administrator konfiguriert Dictionaries (Phasen, Maschinentypen, Arbeitstage) in Datenbankeinstellungen.',
        step2: 'Maschinen und Projekte mit Operationen und Volumen importieren oder anlegen.',
        step3: 'Auslastung im Rechner prüfen (Filter; Summe / Mittel / Max. Mittel nach Typ).',
        step4: 'Optional: Call offs vergleichen oder Szenario anlegen und in der Visualisierung vergleichen.',
        step5: 'PDF/Excel aus Rechner oder Visualisierung exportieren; Änderungen in der Änderungshistorie prüfen.',
      },
      auth: {
        title: '2. Anmeldung und Berechtigungen',
        p1:
          'Jede Sitzung braucht ein Benutzerkonto. Nach dem Login gelten Rollenberechtigungen. Gastkonto (falls aktiv) ist meist nur lesend.',
        p2:
          'Benutzer und Rollen: Administration → Benutzer und Berechtigungen. Passwort-Reset gemäß E-Mail / lokalem Verfahren.',
        stepsTitle: 'Zugangsablauf',
        step1: 'App öffnen → Anmeldebildschirm.',
        step2: 'Nur erlaubte Module der Rolle sind sichtbar.',
        step3: 'Abmelden beendet die Sitzung; ohne Schreibrecht sind Speicheraktionen gesperrt.',
        role1: 'Administrator — volle Konfiguration, Backup, Benutzer, Import/Export.',
        role2: 'Planer / Editor — Projekte, Maschinen, Rechner, Szenarien, Call offs (nach Recht).',
        role3: 'Betrachter / Gast — ausgewählte Screens lesen ohne Produktionsdaten zu ändern.',
      },
      header: {
        title: '3. Anwendungskopfzeile',
        p1:
          'Die obere Leiste steuert Datenmodus und Berechnungsprofil. Einstellungen wirken auf Rechner, Allokation, Call offs und Visualisierungsberichte.',
        contractualTitle: 'Vertragsvolumen',
        contractual:
          'Schalter nutzt Vertrags- statt Produktionsvolumen (mit Fallback ohne Vertragsdaten). Der Rechner erhält einen farbigen Rahmen (Visuelle Einstellungen).',
        capacityTitle: 'Produktionsversion vs Szenarien',
        capacity:
          '„Produktionsversion“ arbeitet auf der Live-Datenbank. „Szenarien“ wechselt zur Kopie — Rechner und Historie zeigen den Szenariozustand. Neues Szenario: Steuerung in der Kopfzeile im Szenarien-Arbeitsbereich.',
        callOffsTitle: 'Call offs',
        callOffs:
          'Call-offs-Arbeitsbereich vergleicht Capacity mit einer SAP-Sales-Forecast-Datei. Mit gewähltem Vergleich zeigt der Rechner Dual-Auslastung (Basis + Call offs). Neuer Vergleich: Steuerung in der Kopfzeile.',
        ocuTitle: 'Capacity / OCU',
        ocu:
          'Ist OCU in den Admin-Einstellungen aktiv, wechselt der Schalter das Parameterprofil (OEE, Arbeitstage) auf den OCU-Satz. Die Auslastungsformel bleibt gleich.',
        langTitle: 'Sprache',
        lang: 'Die Flagge ändert UI und diese Anleitung (PL / EN / DE). Die Wahl wird im Browser gespeichert.',
      },
      dataModel: {
        title: '4. Datenmodell und Abhängigkeiten',
        p1:
          'Hierarchie: Details (Katalog) → Projekte → Operationen (Phase + Maschine + Zyklus) → Maschinenauslastung im Rechner. Eine Maschine muss vor der Zuweisung existieren.',
        p2:
          'Volumen kann aus Projektdetail, Operationsfeldern oder Jahresoverride kommen (Produktion und Vertrag getrennt). Szenarien und Call offs sind Vergleichsschichten auf denselben Maschinen.',
        dep1: 'Löschen eines Katalogdetails erfordert Auflösung verknüpfter Operationen.',
        dep2: 'Maschinentyp muss im Dictionary Maschinentypen stehen.',
        dep3: 'Arbeitstage und OEE bestimmen die Verfügbarkeit [s/Woche].',
        dep4: 'Szenario = Snapshot der Produktion (oder eines anderen Szenarios / Call offs) mit eigener Historie.',
        dep5: 'Call-offs-Volumina stammen aus der SAP-Datei, gemappt auf Operationen/Details; außerhalb der Dateijahre sind Call-offs-Serien leer.',
      },
      calculator: {
        title: '5. Auslastungsrechner',
        p1:
          'Die Tabelle zeigt Maschinen (nach Statusfiltern) mit Auslastung % je Jahr — optional Monate/Wochen nach Aufklappen. Schwellfarben, SOP/EOP- und RFQ-Marker: Visuelle Einstellungen.',
        p2:
          'Maschinenauslastung % = benötigte Operationszeit / Verfügbarkeit × Machine Usage × 100 (siehe Formeln). Im Call-offs-Modus Dualzellen: Basis + Call offs.',
        p3:
          'Fußzeilen: Summe Auslastungen, Durchschnitt, Max. Durchschnitt nach Typ (höchster Typdurchschnitt im aktuellen Filter).',
        p4:
          'Derselbe Rechner läuft in Produktion, Szenario und Call offs — Datenquelle über Kopfzeile / Navigation.',
        stepsTitle: 'Rechnerablauf',
        step1: 'Jahresbereich und Filter setzen (Typ, Kunde, Status, Linie, Maschinenmaße, Suche).',
        step2: 'Optional Vertragsvolumen und/oder OCU-Profil aktivieren.',
        step3: 'Jahr zu Monaten/Wochen aufklappen (ISO Mo–So), wenn nötig.',
        step4: 'Auslastungszelle klicken → Allokation (Volumenverschiebung), falls erlaubt.',
        step5: 'Ansicht oder PDF/Excel exportieren; Überlastungsleiste (>100%) prüfen.',
        summaryTitle: 'Zusammenfassungszeilen',
        summary:
          'Summe = Summe % sichtbarer Maschinen. Mittel = Summe / Anzahl. Max. Mittel nach Typ = Mittel % je Typ, dann Maximum (auch Linienaggregation in der Visualisierung).',
        allocTitle: 'Allokation',
        alloc:
          'Allokation schlägt Maschinen aus Nest oder Alternativliste vor. Modi: vollständig, manuell, Ziel-%. Umfang: Jahre/Monate/Wochen. Nach Speichern aktualisiert sich der Rechner.',
        filtersTitle: 'Dimensionsfilter',
        filters:
          'Breite / Tiefe / Höhe / Hub laufen clientseitig auf dem vollen Ergebnis (schnelle Änderung ohne erneuten Haupt-API-Call). Option: aktive Maschinen ohne Auslastung anzeigen, wenn Dimensionsfilter aktiv.',
      },
      machines: {
        title: '6. Maschinen',
        p1:
          'Register: SAP, interne Nummer, Typ, Linie, Standort, Maße, Status (aktiv / inaktiv / RFQ), Machine Usage, OEE-Override.',
        p2:
          'Maschinendetail: Beschreibung, Operationen, Alternativen, Historie. Nester gruppieren Maschinen für Allokation.',
        stepsTitle: 'Ablauf',
        step1: 'Neue Maschine — Typ aus Dictionary Maschinentypen.',
        step2: 'RFQ-Status — im Szenario-Rechner sichtbar nach Verknüpfung mit RFQ-Projekt.',
        step3: 'Excel-Import — Administration → Administrative Einstellungen.',
      },
      projects: {
        title: '7. Projekte',
        p1:
          'Ein Projekt gruppiert Kundendetails mit Operationen. Detail hat Jahresvolumen (Produktion und Vertrag), SOP/EOP und Operationen (Phase, Maschine, Zyklus, Nester, % Capacity, OPF).',
        p2:
          'Projektstatus (aktiv / RFQ / inaktiv) beeinflusst den Rechner. Detail-Set teilt eine Volumenquelle. Anhänge und Notizen dokumentieren den Kontext.',
        stepsTitle: 'Ablauf',
        step1: 'Projekt anlegen (Kunde, Name, Status).',
        step2: 'Details aus Katalog oder neu; SOP/EOP setzen.',
        step3: 'Register Operationen — Route (Maschine + Phase + Zyklus).',
        step4: 'Register Volumen — jährlich / monatlich / wöchentlich; manuelles Jahresoverride vs Standard.',
        step5: 'Manuelle vs automatische Notizen; optionale Dateianhänge.',
      },
      details: {
        title: '8. Details (Kennzeichen)',
        p1:
          'Globaler Katalog: SAP-Nr., Alias, Free text. Details werden projektenübergreifend geteilt. Validierung blockiert doppelte Kennzeichen.',
        p2:
          'Spalten Projekt / Linie helfen bei der Verwendung. Löschen mit Operationen erfordert Auswahl der zu löschenden Operationen.',
      },
      scenarios: {
        title: '9. Szenarien',
        p1:
          'Ein Szenario ist eine isolierte Kopie zur Simulation ohne Produktionsänderung. Anlegen aus Produktion, anderem Szenario oder Call-offs-Vergleich.',
        p2:
          'Im Szenario-Modus nutzen Rechner und Historie die Kopie. Neue Produktionskatalog-Projekte/Details nach Rückkehr zur Produktionsversion. Capacity-Projekte können ins Szenario übernommen und RFQ/aktiv gesetzt werden.',
        p3:
          'Übernahme in die Produktion erfordert Bestätigung (Challenge) und Rechte — überträgt gewählte Szenarioänderungen in die Live-DB.',
        stepsTitle: 'Szenarioablauf',
        step1: 'Szenarioliste — anlegen (optional aus Call offs), öffnen, archivieren.',
        step2: 'Kopie bearbeiten: Status, Volumen, Operationen, RFQ.',
        step3: 'Auslastung im Szenario-Rechner prüfen.',
        step4: 'Mit Produktion / Call offs in der Visualisierung vergleichen (Multi-Szenarien).',
        step5: 'Optional: Änderungen (oder Teilmenge) in die Produktion übernehmen.',
      },
      callOffs: {
        title: '10. Call offs (SAP)',
        p1:
          'Ein Call-offs-Vergleich lädt eine Sales-Forecast-Excel und mappt SAP-Positionen auf Operationen/Details. Ergebnis: Call-offs-Auslastung vs Produktions-/Vertrags-Capacity.',
        p2:
          'Unmatched-Positionen landen in einem CSV-Report. Der Dateidatumsbereich begrenzt Call-offs-Jahre in Charts. Vergleiche können archiviert werden.',
        stepsTitle: 'Call-offs-Ablauf',
        step1: 'Vergleich anlegen (Name + Excel) im Call-offs-Arbeitsbereich.',
        step2: 'SAP-Matching und Unmatched-Report prüfen.',
        step3: 'Rechner im Call-offs-Modus — Dual-Auslastungszellen.',
        step4: 'In der Visualisierung Vergleich wählen und Call-offs-Serie aktivieren.',
      },
      dataViz: {
        title: '11. Datenvisualisierung',
        p1:
          'Auslastungstrends (%): Linien und Maschinen oder mehrere Objekte in einem Vergleichschart. Filter für Maschinentyp und Kunde schränken Daten wie im Rechner ein. Charts kombinieren Produktions-, Vertrags-, Call-offs- (Mehrfachauswahl) und Szenarien-Serien (Mehrfachauswahl); PDF/Excel-Berichte und Analytik zeigen Differenzen (Δ) zwischen Serien.',
        p2:
          'Aktiver Berechnungsmodus (Capacity / OCU) kommt vom Umschalter in der App-Kopfzeile — Badge neben dem Seitentitel. Szenarien nutzen immer Capacity-Einstellungen. Aggregation Linie / mehrere Maschinen / Werk = Max. der typweisen Mittelwerte der Auslastung % (wie die dritte Summenzeile im Rechner). Einzelmaschine = eigener %.',
        p3:
          'Dimensionsfilter wirken lokal auf geladene Daten. Export: PDF (aktuelle Ansicht oder erweitert) und Excel mit Trendtabellen und Analytik.',
        stepsTitle: 'Visualisierungsablauf',
        step1: 'Jahre, Maschinenstatus, Typ, Kunde, RFQ, Dimensionsfilter setzen.',
        step2: 'Serien wählen: Vertrag / Produktion / Call offs (Multi) / Szenarien (Multi) + Szenario-Vertrags-/Prod-Checkboxen.',
        step3: 'Unter Linien/Maschinen Objekte markieren; optional ein Vergleichschart oder Jahressäulen (inkl. Call offs).',
        step4: 'Flex (±%-Band um Vertragsserien), Metrik Auslastung/freie Capacity, Y-Achse Auto/Fest; Bericht exportieren.',
        seriesTitle: 'Serienquellen',
        series:
          'Produktion und Vertrag — Live-DB (oder OCU-Profil). Call offs — gewählte SAP-Vergleiche (je eigene Serie). Szenarien — parallele Serien je gewähltem Szenario (eigene Farben).',
        aggTitle: 'Aggregation',
        agg:
          'Für eine Maschinengruppe: Mittel % je Typ, dann Maximum. Charts zeigen den „am stärksten ausgelasteten Typ“ im Filter, nicht die %-Summe und nicht den flachen Durchschnitt aller Maschinen.',
        flexTitle: 'Flex',
        flex:
          'Flex (±%) zeichnet ein Band um Vertragsserien (inkl. Szenario-Vertrag). Produktion und Call offs ohne Flex. Optisch hervorgehoben — Bandbreite, keine eigene Datenserie.',
      },
      admin: {
        title: '12. Administration',
        p1: 'Konfiguration, Sicherheit, Backup und Audit. Im Szenarien-/Call-offs-Modus ist die Kartenliste eingeschränkt.',
        dbTitle: 'Datenbankeinstellungen',
        db:
          'Arbeitstage (Capacity und OCU), Phasen, Detailkatalog, Maschinentypen, visuelle Einstellungen (Schwellfarben, Summen-/Mittelzeilen, Data-Viz-Farben), Volumen-Autosave.',
        admTitle: 'Administrative Einstellungen',
        adm:
          'Automatisches/manuelles Backup, Restore, Excel-Import/Export (Capacity-Paket, Maschinen, Eingabedaten), OCU-Aktivierung, Speicherpfade, DB-Löschung.',
        usersTitle: 'Benutzer und Berechtigungen',
        users:
          'Konten, Rollen, Permission-Mapping auf Screens und API. Ohne Recht sieht der Nutzer z. B. keine Projektbearbeitung oder keinen Import.',
        histTitle: 'Änderungshistorie',
        hist:
          'Protokoll von Projekt-, Maschinen- und Operationsänderungen mit Filtern. Im Szenario — Historie der Szenariokopie. Manuelle vs automatische Einträge.',
      },
      formulas: {
        title: '13. Berechnungsformeln',
        p1: 'Die Capacity-Engine (Server) wendet diese bei jeder Neuberechnung im Rechner / API an.',
        avail:
          'Verfügbarkeit [s/Woche] = (Arbeitstage / 52) × Schichtzeit [min] × 60 × Schichten/Tag × OEE − Startup/Shutdown [s], korrigiert um Machine Usage. OEE: Operation > Maschine > Jahreseinstellungen.',
        weekly:
          'Wochenvolumen: jährlich ÷ Arbeitswochen; monatlich × 12 ÷ Arbeitswochen; wöchentlich — unverändert.',
        required: 'Benötigte Zeit [s/Woche] = Σ (Wochenvol. × Zyklus / Nester) für Operationen auf der Maschine im Jahr (SOP/EOP).',
        load: 'Maschinenauslastung % = round(Σ (benötigt / Verfügbarkeit mit Operations-OEE) × Machine Usage × 100).',
        sop: 'SOP/EOP — Jahres-/Monats-/Wochenanteil begrenzt das Volumen auf Perioden im Produktionsfenster.',
        maxType:
          'Max. Mittel nach Typ (Rechner + Data-Viz-Aggregation) = max_t ( mittleres load_% der Maschinen vom Typ t ).',
        isoWeek: 'Aufgeklappte Kalenderwochen: ISO (Montag–Sonntag).',
      },
    },
    diagrams: {
      dataModel: {
        title: 'Datenhierarchie',
        details: 'Details\n(Katalog)',
        projects: 'Projekte\n+ Volumen',
        operations: 'Operationen\nPhase · Maschine · Zyklus',
        machines: 'Maschinen\n+ Capacity',
        calculator: 'Rechner\nAuslastung %',
      },
      modes: {
        title: 'Modi / Arbeitsbereiche',
        production: 'Produktions-\nversion',
        scenario: 'Szenarien',
        note: 'Call offs = eigener SAP-Vergleichsarbeitsbereich',
      },
      calculation: {
        title: 'Ablauf Auslastungsberechnung',
        settings: 'Arbeitstage\nOEE · Schichten',
        volumes: 'Volumen\nDetail / Operation',
        ops: 'Operationen\nauf Maschine',
        result: 'Auslastung %\n+ Max. nach Typ',
      },
      projectFlow: {
        title: 'Projekt anlegen',
        s1: 'Kunde +\nName',
        s2: 'Details\naus Katalog',
        s3: 'Operationen\npro Detail',
        s4: 'Jahres-\nvolumen',
        s5: 'Rechner',
      },
      scenario: {
        title: 'Szenario vs Produktion',
        live: 'Produktions-\nDB',
        snap: 'Szenario-\nSnapshot',
        calc: 'Szenario-\nrechner',
        compare: 'Multi-Szenario-\nVisualisierung',
      },
      callOffs: {
        title: 'Call-offs-Ablauf',
        file: 'SAP-Datei\nSalesFcst',
        match: 'SAP →\nDetails mappen',
        calc: 'Rechner\nDual Load',
        viz: 'Chart-\nSerien',
      },
      dataViz: {
        title: 'Visualisierung — Quellen',
        base: 'Produktion /\nVertrag',
        sources: 'Call offs +\nSzenarien',
        charts: 'Linien /\nMaschinen',
        export: 'PDF /\nExcel',
      },
      adminMap: {
        title: 'Administrationskarte',
        db: 'Datenbank-\neinstellungen',
        adm: 'Backup\nImport',
        users: 'Benutzer\nRBAC',
        hist: 'Historie',
        manual: 'Anleitung',
      },
      dependencies: {
        title: 'Wichtige Abhängigkeiten',
        phases: 'Phasen →\nOperationen',
        types: 'Maschinentypen →\nFormular',
        wd: 'Arbeitstage →\nCapacity',
        parts: 'Details →\nProjekte',
        machines: 'Maschinen →\nOperationen',
      },
    },
  },
};
