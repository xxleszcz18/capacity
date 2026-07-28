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
          'Autoneum Capacity dient der Planung und Analyse der Auslastung von Produktionslinien. Die Anwendung verbindet Maschinenkatalog, Projekte mit Details (Teilen) und Operationen, Auslastungsrechner, Was-wäre-wenn-Szenarien, Call-offs-Vergleiche auf Basis einer SAP-Sales-Forecast-Datei sowie Trendvisualisierung.',
        p2:
          'Hauptnavigation (Produktionsversion): Rechner, Maschinen, Projekte, Details, Datenvisualisierung und Administration. Arbeitsbereiche werden in der Kopfzeile umgeschaltet: Produktionsversion, Szenarien und Call offs.',
        p3:
          'Zugang erfordert Anmeldung (oder Gastzugang, falls freigeschaltet). Rollenbasierte Berechtigungen (RBAC) steuern sichtbare Module und erlaubte Aktionen. Diese Anleitung öffnen Sie unter Administration → Bedienungsanleitung.',
        p4:
          'Änderungen an Projekten, Maschinen und Operationen können in der Änderungshistorie nachvollzogen werden. Berichte lassen sich als PDF oder Excel aus Rechner und Datenvisualisierung exportieren (sofern die jeweilige Download-Berechtigung vorliegt).',
        stepsTitle: 'Typischer Arbeitsablauf',
        step1:
          'Anmelden; ein Administrator konfiguriert Dictionaries (Phasen, Maschinentypen, Arbeitstage Capacity/OCU) und ggf. Speicherpfade in den Administrationsbereichen.',
        step2: 'Maschinen und Projekte mit Operationen und Volumen importieren oder manuell anlegen.',
        step3:
          'Auslastung im Rechner prüfen (Filter; Fußzeilen Summe / Mittel / Max. Mittel nach Typ). Optional Vertragsvolumen oder OCU-Profil aktivieren.',
        step4:
          'Optional: Call-offs-Vergleich anlegen oder Szenario erstellen und in der Datenvisualisierung mit Produktion vergleichen.',
        step5:
          'PDF/Excel aus Rechner oder Visualisierung exportieren; kritische Änderungen in der Änderungshistorie prüfen; vor Import oder DB-Löschung Backup erstellen.',
      },
      auth: {
        title: '2. Anmeldung und Berechtigungen',
        p1:
          'Jede Sitzung benötigt ein Benutzerkonto (Benutzername oder E-Mail und Passwort). Nach dem Login gelten die Berechtigungen der zugewiesenen Rollen (Vereinigung bei mehreren Rollen). Ein Gastzugang erscheint nur, wenn mindestens eine Rolle ohne erforderliche Anmeldung (login_required = aus) mit Berechtigungen existiert.',
        p2:
          'Benutzer und Rollen verwalten Sie unter Administration → Benutzer und Berechtigungen. Passwort-Reset folgt dem lokalen Verfahren (Link „Passwort vergessen“ / E-Mail, sofern konfiguriert). Beim ersten Bootstrap-Admin kann ein Passwortwechsel erzwungen werden.',
        p3:
          'Ohne passende *.view-Berechtigung fehlt der Menüpunkt und die Route ist gesperrt. Schreibaktionen (Speichern, Löschen, Import) erfordern die jeweilige edit-/delete-/create-Berechtigung; Download-Buttons und Datei-Downloads die jeweilige *.download-Berechtigung.',
        stepsTitle: 'Zugangsablauf',
        step1: 'App öffnen → Anmeldebildschirm (oder „Als Gast fortfahren“, falls verfügbar).',
        step2: 'Nur Module und Aktionen der Rolle(n) sind sichtbar bzw. aktiv.',
        step3: 'Abmelden beendet die Sitzung; ohne Schreibrecht sind Speicheraktionen blockiert.',
        step4:
          'Administratoren pflegen Konten unter Benutzer und Rollen unter Rollen (Permission-Matrix).',
        role1:
          'Administrator (Systemrolle) — alle Berechtigungsschlüssel; volle Konfiguration, Backup, Benutzer, Import/Export.',
        role2:
          'Planer / Editor — typischerweise Projekte, Maschinen, Rechner, Szenarien, Call offs (je nach freigeschalteten Rechten).',
        role3:
          'Betrachter / Gast — ausgewählte Screens lesen; die Standard-Gastrolle garantiert mindestens calculator.view, weitere Rechte setzt der Administrator.',
        permMatrix:
          'Permission-Matrix: Ressourcen × Aktionen (view, details, edit, delete, download, change_status, create_rfq u. a.). Schlüssel haben die Form ressource.aktion (z. B. projects.edit, calculator.download).',
        rbacTitle: 'RBAC — Module und Aktionen',
        rbac:
          'Sichtbare Navigation und Routen hängen an *.view (Rechner, Maschinen, Projekte, Details/Kennzeichen, Szenarien, Call offs, Admin-Datenbank, Admin-Einstellungen, Admin-Data-Viz, Admin-OCU, Admin-Anhänge, Änderungshistorie, Benutzer-/Rollenverwaltung). Die Bedienungsanleitung ist für angemeldete Nutzer ohne Extra-Permission erreichbar. ADMIN-Karten im Hub werden zusätzlich nach Rechten gefiltert; im Szenarien-/Call-offs-Modus bleiben dort vor allem Historie und Anleitung.',
        rfqPermTitle: 'Berechtigung „RFQ erstellen“ (projects.create_rfq)',
        rfqPerm:
          'Ermöglicht das Anlegen von Projekten nur mit Status RFQ sowie Bearbeitung/Statuswechsel im RFQ-Bereich. Ohne projects.edit dürfen Nicht-RFQ-Projekte nicht geändert werden; Löschen von Projekten ist mit create_rfq allein nicht vorgesehen. Projektdetail-Zugang ist mit projects.details, projects.edit oder projects.create_rfq möglich.',
        downloadPermTitle: 'Download-Berechtigungen',
        downloadPerm:
          'Projektdatei-Anhänge: admin_attachments.download (nicht projects.*). Call-offs-Quelldatei und Unmatched-CSV: call_offs.download. Rechner-/Szenario-Berichte: calculator.download (im Call-offs-Modus call_offs.download). Weitere Exporte (Admin, Historie, Maschinen, Details …) folgen dem jeweiligen ressource.download.',
      },
      header: {
        title: '3. Anwendungskopfzeile',
        p1:
          'Die obere Leiste steuert Datenmodus und Berechnungsprofil. Einstellungen wirken auf Rechner, Allokation, Call offs und Visualisierungsberichte und werden in der Browser-Sitzung (sessionStorage) gehalten.',
        contractualTitle: 'Vertragsvolumen',
        contractual:
          'Schalter „Vertragsvolumen“ nutzt Vertrags- statt Produktionsvolumen. Fehlen Vertragsdaten, greift der Fallback auf Produktionsvolumen. Der Rechner erhält einen farbigen Rahmen (Farbe in Visuelle Einstellungen).',
        capacityTitle: 'Produktionsversion vs Szenarien',
        capacity:
          '„Produktionsversion“ arbeitet auf der Live-Datenbank. „Szenarien“ wechselt zur Szenariokopie — Rechner und Änderungshistorie zeigen den Szenariozustand. Ohne scenarios.view ist der Schalter deaktiviert. Neues Szenario: Steuerung in der Kopfzeile / Szenarienliste im Szenarien-Arbeitsbereich. In Szenarien ist die Navigation eingeschränkt (u. a. Rechner, Administration, Historie, Anleitung).',
        callOffsTitle: 'Call offs',
        callOffs:
          'Call-offs-Arbeitsbereich vergleicht Capacity mit einer importierten SAP-Sales-Forecast-Datei. Mit gewähltem Vergleich zeigt der Rechner Dual-Auslastung (Basis + Call offs). Ohne call_offs.view ist der Schalter deaktiviert. Navigation im Call-offs-Modus führt zu Vergleichsliste und Call-offs-Rechner.',
        ocuTitle: 'Capacity / OCU',
        ocu:
          'Ist OCU in den Administrativen Einstellungen aktiv (ocu_enabled), kann der Titel-Umschalter das Parameterprofil (Arbeitstage, OEE, Schichten …) auf den OCU-Satz umstellen. Die Auslastungsformel bleibt gleich — nur die Jahresparameter wechseln. Im Szenarien- und Call-offs-Banner ist der Umschalter ausgeblendet; Szenarien rechnen immer mit dem Capacity-Profil.',
        langTitle: 'Sprache',
        lang: 'Die Sprachumschaltung (Flagge) ändert UI und diese Anleitung (PL / EN / DE). Die Wahl wird im Browser gespeichert.',
      },
      dataModel: {
        title: '4. Datenmodell und Abhängigkeiten',
        p1:
          'Hierarchie: Details (globaler Katalog) → Projekte → Operationen (Phase + Maschine + Zykluszeit, Nester, optional Alternative) → Maschinenauslastung im Rechner. Eine Maschine muss existieren, bevor sie einer Operation zugewiesen wird.',
        p2:
          'Volumen kann aus Projektdetail, Operationsfeldern oder Jahresoverride kommen (Produktion und Vertrag getrennt). Allokation speichert Jahresanteile und Split-Operationen. Szenarien und Call offs sind Vergleichsschichten auf denselben Maschinenkonzepten.',
        p3:
          'Dictionaries (Phasen, Maschinentypen, Arbeitstage) und visuelle Schwellen beeinflussen Formulare und Darstellung. Löschungen und Statuswechsel können abhängige Datensätze betreffen — Validierungen blockieren inkonsistente Zustände.',
        dep1: 'Löschen eines Katalogdetails erfordert Auflösung verknüpfter Operationen (Auswahl der zu entfernenden Operationen).',
        dep2: 'Maschinentyp muss im Dictionary Maschinentypen stehen, bevor eine Maschine diesen Typ nutzt.',
        dep3: 'Arbeitstage und OEE (Profil Capacity oder OCU) bestimmen die Basis-Verfügbarkeit [s/Woche].',
        dep4: 'Szenario = Snapshot der Produktion (oder eines anderen Szenarios / Call-offs-Vergleichs) mit eigener Historie; Szenarien nutzen immer Capacity-Arbeitstage.',
        dep5:
          'Call-offs-Volumina stammen aus der SAP-Datei, gemappt auf Operationen/Details; außerhalb des Dateijahresbereichs sind Call-offs-Serien leer.',
        dep6:
          'Machine Usage (0,1–1) skaliert die effektive Verfügbarkeit; Nester teilen die Zykluszeit (Zeit pro Stück = Zyklus / Nester). Alternativzyklus wird nur bei aktivierter Option im Rechner verwendet.',
      },
      calculator: {
        title: '5. Auslastungsrechner',
        p1:
          'Die Tabelle listet Maschinen (nach Status- und anderen Filtern) mit Auslastung % je Jahr — optional Monate/Wochen nach Aufklappen. Schwellfarben, SOP/EOP- und RFQ-Marker sowie Summenzeilen konfigurieren Sie unter Visuelle Einstellungen.',
        p2:
          'Maschinenauslastung % = benötigte Operationszeit / effektive Verfügbarkeit × 100 (siehe Formeln). Machine Usage und OEE fließen in die Verfügbarkeit ein. Im Call-offs-Modus Dualzellen: Basis % / Call-offs %.',
        p3:
          'Fußzeilen: Summe der Auslastungen, Mittelwert und Max. Mittel nach Typ (höchster Typdurchschnitt im aktuellen Filter) — dieselbe Typ-Aggregation nutzt die Datenvisualisierung für Linien/Werke.',
        p4:
          'Derselbe Rechner läuft in Produktion, Szenario und Call offs — Datenquelle über Kopfzeile / Navigation bzw. Vergleichs-ID. Allokation ist im Call-offs-Modus deaktiviert.',
        p5:
          'Überlastete Maschinen (>100 %) erscheinen in der Überlastungsleiste. Dimensionsfilter (Breite/Tiefe/Höhe/Hub) wirken clientseitig auf die geladene Ergebnismenge.',
        stepsTitle: 'Rechnerablauf',
        step1: 'Jahresbereich und Filter setzen (Typ, Kunde, Status, Linie, Maschinennummern, Maße, Suche).',
        step2: 'Optional Vertragsvolumen und/oder OCU-Profil (nur Produktionsversion, wenn OCU aktiv) einschalten.',
        step3: 'Jahr zu Monaten/Wochen aufklappen (ISO Mo–So), wenn Feingranularität nötig ist.',
        step4: 'Auslastungszelle klicken → Allokation (Volumenverschiebung), falls projects.edit und nicht Call-offs-Modus.',
        step5: 'Überlastungsleiste prüfen; Filter und Sichtbarkeit aktiver Maschinen ohne Auslastung ggf. anpassen.',
        step6: 'Ansicht drucken bzw. PDF/Excel-Bericht exportieren (Download-Recht je nach Modus).',
        summaryTitle: 'Zusammenfassungszeilen',
        summary:
          'Summe = Summe % sichtbarer Maschinen. Mittel = Summe / Anzahl. Max. Mittel nach Typ = Mittel % je Maschinentyp, dann Maximum. Das ist keine %-Summe über Typen und kein flacher Durchschnitt aller Maschinen.',
        allocTitle: 'Allokation',
        alloc:
          'Allokation schlägt Zielmaschinen aus demselben Nest bzw. der gespeicherten Alternativenliste vor (typisch unter einer Lastschwelle, bevorzugte gleiche Linie/Standort). Nach Speichern entstehen Jahresvolumen-Splits (Elternoperation behält Rest, Kindoperation auf Zielmaschine). Der Rechner aktualisiert sich danach.',
        allocModesTitle: 'Allokationsmodi und Zeitraum',
        allocModes:
          'Volumenverschiebung: gesamtes Detailvolumen, manuell eingegebenes Volumen oder Ziel-Auslastung % der Quellmaschine. Zeitraum: ganzes Jahr oder ab Monat/Woche (ISO). Zyklus auf Ziel: unverändert, neue Zeit oder alternativer Prozesszyklus. Mehre Jahre möglich. Kandidaten ohne projects.edit nicht ausführbar.',
        filtersTitle: 'Dimensionsfilter',
        filters:
          'Breite / Tiefe / Höhe / Hub laufen clientseitig auf dem vollen API-Ergebnis (schnelle Änderung ohne erneuten Haupt-API-Call). Fehlen Maßangaben in Stammdaten, kann der Filter warnen. Option: aktive Maschinen ohne Auslastung anzeigen, wenn Dimensionsfilter aktiv.',
        exportTitle: 'Export',
        export:
          'Bericht (PDF/Excel) erfordert calculator.download bzw. im Call-offs-Modus call_offs.download. „Als PDF drucken“ exportiert die aktuelle Ansicht (außerhalb Call offs). Dual-% erscheinen in Call-offs-Exporten als Basis/Call-offs.',
      },
      machines: {
        title: '6. Maschinen',
        p1:
          'Register: SAP-Nummer, interne Nummer, Typ (Dictionary), Linie/Standort, Maße, Status (aktiv / inaktiv / RFQ), Machine Usage (0,1–1), optional OEE-Override. Typen können Standardwerte liefern.',
        p2:
          'Maschinendetail: Beschreibung, verknüpfte Operationen, Alternativen (für Allokationskandidaten), Historie. Nest-Gruppen verknüpfen Maschinen für Allokationsvorschläge.',
        p3:
          'RFQ-Maschinen werden im Szenario-Rechner sichtbar, wenn sie mit RFQ-Projekten verknüpft sind (je nach Filtern/Statusregeln). Excel-Import von Maschinen erfolgt über Administrative Einstellungen.',
        stepsTitle: 'Maschinenablauf',
        step1: 'Neue Maschine anlegen — Typ aus Dictionary Maschinentypen wählen; Usage und Maße setzen.',
        step2: 'Status aktiv/inaktiv/RFQ und Linie pflegen; optional OEE-Override.',
        step3: 'Unter Alternativen Maschinen für Allokation verknüpfen.',
        step4: 'Optional Massenimport per Excel in Administration → Administrative Einstellungen.',
        usageTitle: 'Machine Usage',
        usage:
          'Machine Usage wird auf 0,1–1 begrenzt (Standard 1). Effektive Verfügbarkeit = Basisverfügbarkeit / Usage. Niedrigerer Usage-Wert vergrößert die effektive Capacity und senkt die Auslastung % bei gleicher benötigter Zeit (Beispiel: 0,5 → doppelte effektive Verfügbarkeit).',
        nestsTitle: 'Nester und Alternativen',
        nests:
          'Operations-Nester (nests_count): Stückzahl aus einem Zyklus; Zeit pro Stück = Zykluszeit / max(1, Nester). Alternativprozess: alt_cycle_time_seconds, alt_nests_count, alt_oee_override — greifen, wenn „Alternative im Rechner“ aktiv ist. Maschinen-Alternativen und Nest-Zugehörigkeit steuern Allokationskandidaten.',
      },
      projects: {
        title: '7. Projekte',
        p1:
          'Ein Projekt gruppiert Kundendetails mit Operationen. Jedes Detail hat Jahresvolumen (Produktion und Vertrag), SOP/EOP und Operationen (Phase, Maschine, Zyklus, Nester, % Capacity, OPF, optional Alternative).',
        p2:
          'Projektstatus (aktiv / RFQ / inaktiv) beeinflusst die Sichtbarkeit und den Rechner. Detail-Sets können eine gemeinsame Volumenquelle teilen (Projekt / Share / Override). Anhänge und Notizen (manuell / automatisch) dokumentieren den Kontext.',
        p3:
          'Mit projects.create_rfq allein lassen sich nur RFQ-Projekte anlegen und im RFQ-Rahmen bearbeiten. Vollständige Bearbeitung braucht projects.edit; Löschen projects.delete.',
        stepsTitle: 'Projektablauf',
        step1: 'Projekt anlegen (Kunde, Name, Status) — RFQ nur mit entsprechendem Recht.',
        step2: 'Details aus Katalog wählen oder neu anlegen; SOP/EOP (Format MM.YYYY) setzen.',
        step3: 'Register Operationen — Route (Maschine + Phase + Zyklus / Nester / optional Alternative).',
        step4: 'Register Volumen — jährlich / monatlich / wöchentlich; manuelles Jahresoverride vs. Standard für alle Jahre; Vertragsvolumen separat.',
        step5: 'Notizen (manuell vs. automatisch) und optionale Dateianhänge (Speicherpfad muss in Admin gesetzt sein).',
        step6: 'Status und Filter im Rechner prüfen; bei Bedarf Allokation aus dem Rechner anstoßen.',
        volumesTitle: 'Volumenquellen',
        volumes:
          'Priorität je Jahr grob: Allokations-/Split-Jahreszeilen → operation_volume_by_year → effektives Detail-/Projektvolumen → Operationsfelder volume_value/unit. Detailmodi: Override, Projektvolumen, Share (%). Vertragsmodus: Vertragstabellen zuerst, sonst Fallback Produktion. Origin default_all_years skaliert Teiljahre mit SOP/EOP-Monatsanteil; manual_year behandelt eingegebene Jahreswerte anders in Teiljahren.',
        attachmentsTitle: 'Anhänge',
        attachments:
          'Dateien am Projektdetail. Upload/Verwaltung erfordert Projekt-Schreibrecht und konfiguriertes Verzeichnis project_attachments_output_dir. Download der Datei erfordert admin_attachments.download. Globale Übersicht: Administration → Anhänge (admin_attachments.view).',
      },
      details: {
        title: '8. Details (Kennzeichen)',
        p1:
          'Globaler Katalog von Teilen/Kennzeichen: SAP-Nr., Alias, Free text. Details werden projektenübergreifend geteilt. Validierung blockiert doppelte Kennzeichen.',
        p2:
          'Spalten zu Projekt / Linie helfen, Verwendungen zu finden. Löschen eines Details mit Operationen erfordert die Auswahl, welche Operationen entfernt werden.',
        p3:
          'Der Katalog ist unter Details in der Hauptnavigation und auch über Datenbankeinstellungen erreichbar (je nach Berechtigung designations.* / admin_database).',
      },
      scenarios: {
        title: '9. Szenarien',
        p1:
          'Ein Szenario ist eine isolierte Datenkopie zur Simulation ohne direkte Änderung der Produktionsdaten. Anlegen aus Produktion, einem anderen Szenario oder einem Call-offs-Vergleich.',
        p2:
          'Im Szenario-Modus nutzen Rechner und Historie die Kopie. Neue Produktionskatalog-Projekte/Details legen Sie nach Rückkehr zur Produktionsversion an. Capacity-Projekte können ins Szenario übernommen und Status (inkl. RFQ/aktiv) geändert werden.',
        p3:
          'Szenarien rechnen immer mit dem Capacity-Arbeitstageprofil (nicht OCU). Vergleich mehrerer Szenarien erfolgt in der Datenvisualisierung (Mehrfachauswahl).',
        p4:
          'Übernahme in die Produktion (API apply / apply-subset) erfordert Bestätigung (Challenge) und passende Rechte — überträgt gewählte Szenarioänderungen in die Live-DB. Vollübernahme kann Snapshot-Inhalte inkl. Arbeitstage ersetzen; Teilübernahme betrifft ausgewählte Projekte/Details ohne working_days.',
        stepsTitle: 'Szenarioablauf',
        step1: 'Szenarioliste — anlegen (optional aus Call offs), öffnen, archivieren.',
        step2: 'Kopie bearbeiten: Status, Volumen, Operationen, RFQ.',
        step3: 'Auslastung im Szenario-Rechner prüfen.',
        step4: 'Mit Produktion / Call offs in der Visualisierung vergleichen (Multi-Szenarien).',
        step5: 'Optional: Änderungen (oder Teilmenge) nach Bestätigung in die Produktion übernehmen.',
      },
      callOffs: {
        title: '10. Call offs (SAP)',
        p1:
          'Ein Call-offs-Vergleich lädt eine Sales-Forecast-Excel und mappt SAP-Positionen auf Operationen/Details. Ergebnis: Call-offs-Auslastung im Vergleich zur Produktions-/Vertrags-Capacity.',
        p2:
          'Nicht zuordenbare Positionen landen im Unmatched-Bericht (CSV). Der Dateidatumsbereich begrenzt Call-offs-Jahre in Charts und Rechner. Vergleiche können archiviert werden.',
        p3:
          'Im Call-offs-Rechner erscheinen Dualzellen (Basis / Call offs). Allokation ist dort nicht verfügbar. Berichte und Datei-Downloads brauchen call_offs.download.',
        stepsTitle: 'Call-offs-Ablauf',
        step1: 'Vergleich anlegen (Name + Excel) im Call-offs-Arbeitsbereich.',
        step2: 'SAP-Matching und Unmatched-Report prüfen.',
        step3: 'Rechner im Call-offs-Modus öffnen — Dual-Auslastungszellen.',
        step4: 'In der Datenvisualisierung Vergleich wählen und Call-offs-Serie(n) aktivieren.',
        step5: 'Optional Quelldatei oder Unmatched-CSV herunterladen; Vergleich archivieren.',
        matchTitle: 'SAP-Zuordnung',
        match:
          'Zuerst exakter Treffer auf normalisierte sap_number; sonst Versuch nach Abschneiden der letzten zwei Zeichen. Treffer binden Forecast-Volumen an passende Details/Operationen.',
        downloadTitle: 'Downloads',
        download:
          'Quell-Excel und Unmatched-CSV: Recht call_offs.download. Das ist unabhängig von Projektanhängen (admin_attachments.download).',
      },
      dataViz: {
        title: '11. Datenvisualisierung',
        p1:
          'Auslastungstrends (%): Linien und Maschinen oder mehrere Objekte in einem Vergleichschart. Filter für Maschinentyp und Kunde schränken Daten wie im Rechner ein. Charts kombinieren Produktions-, Vertrags-, Call-offs- (Mehrfachauswahl) und Szenarien-Serien (Mehrfachauswahl); PDF/Excel-Berichte und Analytik zeigen Differenzen (Δ) zwischen Serien.',
        p2:
          'Aktiver Berechnungsmodus (Capacity / OCU) kommt vom Umschalter in der App-Kopfzeile — Badge neben dem Seitentitel. Szenarien nutzen immer Capacity-Einstellungen. Aggregation Linie / mehrere Maschinen / Werk = Max. der typweisen Mittelwerte der Auslastung % (wie die dritte Summenzeile im Rechner). Einzelmaschine = eigener %.',
        p3:
          'Dimensionsfilter wirken lokal auf geladene Daten. Export: PDF (aktuelle Ansicht oder erweitert) und Excel mit Trendtabellen und Analytik (admin_data_viz.download bzw. Modulrechte).',
        stepsTitle: 'Visualisierungsablauf',
        step1: 'Jahre, Maschinenstatus, Typ, Kunde, RFQ, Dimensionsfilter setzen.',
        step2:
          'Serien wählen: Vertrag / Produktion / Call offs (Multi) / Szenarien (Multi) sowie Szenario-Vertrags-/Produktions-Checkboxen.',
        step3:
          'Unter Linien/Maschinen Objekte markieren; optional ein Vergleichschart oder Jahressäulen (inkl. Call offs).',
        step4:
          'Flex (±%-Band um Vertragsserien), Metrik Auslastung/freie Capacity, Y-Achse Auto/Fest; Bericht exportieren.',
        seriesTitle: 'Serienquellen',
        series:
          'Produktion und Vertrag — Live-DB (oder OCU-Profil in der Produktionsversion). Call offs — gewählte SAP-Vergleiche (je eigene Serie). Szenarien — parallele Serien je gewähltem Szenario (eigene Farben).',
        aggTitle: 'Aggregation',
        agg:
          'Für eine Maschinengruppe: Mittel % je Typ, dann Maximum. Charts zeigen den „am stärksten ausgelasteten Typ“ im Filter, nicht die %-Summe und nicht den flachen Durchschnitt aller Maschinen.',
        flexTitle: 'Flex',
        flex:
          'Flex (±%) zeichnet ein Band um Vertragsserien (inkl. Szenario-Vertrag). Produktion und Call offs ohne Flex. Optisch hervorgehoben — Bandbreite, keine eigene Datenserie.',
      },
      admin: {
        title: '12. Administration',
        p1:
          'Konfiguration, Sicherheit, Backup und Audit. Im Szenarien-/Call-offs-Modus ist die Kartenliste eingeschränkt (typisch Änderungshistorie und Bedienungsanleitung).',
        p2:
          'Datenvisualisierung liegt in der Hauptnavigation (nicht als Admin-Karte). Unterkarten der Datenbankeinstellungen: Phasen, Details, Maschinentypen, Visuelle Einstellungen, Arbeitstage.',
        dbTitle: 'Datenbankeinstellungen',
        db:
          'Arbeitstage (Capacity und — wenn OCU aktiv — OCU), Phasen, Detailkatalog, Maschinentypen, Volumen-Autosave und Einstiege zu visuellen Optionen. Diese Parameter steuern Verfügbarkeit und Formularlisten.',
        visualTitle: 'Visuelle Einstellungen',
        visual:
          'Schwellfarben und Darstellung im Rechner (Summen-/Mittelzeilen, Vertragsrahmen, Call-offs-Importpanel-Farben), Workspace-Themes und Farben der Datenvisualisierung.',
        admTitle: 'Administrative Einstellungen',
        adm:
          'Automatisches/manuelles Backup und Restore, Excel-/Paket-Import und -Export (Capacity-Paket, Maschinen, Eingabedaten), OCU-Aktivierung (ocu_enabled), Speicherpfade, optionale DB-Löschung mit Bestätigung.',
        pathsTitle: 'Speicherpfade',
        paths:
          'Backup-Verzeichnis und Verzeichnis für Projektanhänge (project_attachments_output_dir) setzen. Ohne Anhänge-Pfad sind Uploads nicht nutzbar; Server-Speicherbrowser hilft bei der Auswahl.',
        importTitle: 'Import / Export',
        import:
          'Capacity-Bundle (Vorlage / vollständiger oder partieller Import), Capacity-Daten-Excel, Maschinenimport, Exporte. Vor destruktiven Aktionen Backup erstellen. Rechte: admin_settings.edit / .download je Aktion.',
        ocuDataTitle: 'OCU-Daten',
        ocuData:
          'Unter Administration → OCU-Daten: Überleitungstabelle und Katowice_Data hochladen, ZIP generieren (admin_ocu.view / .edit). Das ist ein Datenexport-Pipeline-Schritt, keine alternative Auslastungsformel. OCU-Arbeitstage bleiben unter Datenbankeinstellungen.',
        attachAdminTitle: 'Anhänge (Admin)',
        attachAdmin:
          'Globale Inventarliste der Projektanhänge, Pfade und Speicherstatus (admin_attachments.view). Datei-Download weiterhin admin_attachments.download.',
        usersTitle: 'Benutzer und Berechtigungen',
        users:
          'Konten, Rollen, Permission-Matrix. Systemrollen Administrator und Gast. login_required steuert, ob eine Rolle für „Als Gast fortfahren“ geeignet ist.',
        histTitle: 'Änderungshistorie',
        hist:
          'Protokoll von Projekt-, Maschinen- und Operationsänderungen mit Filtern. Im Szenario — Historie der Szenariokopie. Manuelle vs. automatische Einträge. Export mit change_history.download.',
      },
      formulas: {
        title: '13. Berechnungsformeln',
        p1:
          'Die Capacity-Engine auf dem Server wendet diese Regeln bei jeder Neuberechnung (Rechner / API) an. Profil Capacity und OCU unterscheiden nur die Jahresparameter (Arbeitstage-Tabellen); die Formeln sind identisch. Szenarien erzwingen Capacity.',
        p2:
          'Angezeigte Maschinenauslastung % nutzt die effektive Maschinenverfügbarkeit (inkl. Machine Usage und Maschinen-/Jahres-OEE). Benötigte Zeit summiert Operationszeiten ohne OEE im Zähler.',
        p3:
          'Werte > 100 % bedeuten Überlastung. Bei effektiver Verfügbarkeit ≤ 0 und positivem Bedarf wird 100 % gesetzt.',
        avail:
          'Basis-Verfügbarkeit [s/Woche] = round( (Arbeitstage_Jahr / 52) × Schichtzeit_min × 60 × Schichten/Tag × OEE − Startup/Shutdown_s ), mindestens 0. Schichten/Tag mindestens 1. Divisor ist fest 52 (Kalenderwochen); working_weeks_per_year fließt nur in die Volumenumrechnung, nicht in die Verfügbarkeit.',
        oee:
          'OEE-Auflösung resolveOee: Operations-Override (>0) → Maschinen-Override (>0) → oee_factor der Jahreseinstellungen (Capacity oder OCU). Für die angezeigte Maschinen-load_% im Rechner wird die Maschinenverfügbarkeit mit Maschinen-/Jahres-OEE gebildet; Operations-OEE fließt in interne Lastverhältnisse (z. B. Allokationshinweise) und Alternativpfade ein. Bei Alternativzyklus: alt_oee_override falls >0, sonst Operations-OEE.',
        usage:
          'Machine Usage = clamp(machine_usage, 0,1…1), Standard 1. Effektive Verfügbarkeit = Basisverfügbarkeit / Usage. Höheres Usage → kleinere effektive Verfügbarkeit → höhere Auslastung %; Usage 0,5 verdoppelt die effektive Capacity und halbiert die Auslastung bei gleichem Bedarf.',
        weekly:
          'Wochenvolumen: weekly = Wert; annual = Wert / working_weeks_per_year (min. 1, typ. 48); monthly = (Wert × 12) / working_weeks_per_year.',
        volPriority:
          'Volumenpriorität je Operation/Jahr: (1) Allokations-Familienanteil bzw. Split-Kind nur über operation_volume_by_year (fehlende Zeile → 0), (2) operation_volume_by_year inkl. Periodensplit ab Monat/Woche, (3) effektives Detail-/Projektvolumen, (4) Operationsfelder volume_value/unit. Detail: Override → Projekt → Share %.',
        required:
          'Benötigte Zeit [s/Woche] = Σ (Wochenvolumen × (Zykluszeit_s / max(1, nests_count))) über Operationen der Maschine im betrachteten Zeitraum. Mit Alternativzyklus: alt_cycle_time_seconds und alt_nests_count (falls >0, sonst nests_count).',
        load:
          'Maschinenauslastung % = round( (Σ benötigte_s_pro_Woche / effektive_Verfügbarkeit) × 100 ). effektive_Verfügbarkeit = Basis (mit Maschinen-OEE) / Usage. Das ist die im Rechner angezeigte load_percent / utilization_percent.',
        sop:
          'SOP/EOP im Format MM.YYYY begrenzen Produktionsmonate im Jahr. Außerhalb des Fensters: Wochenvolumen 0 (außer count_after_eop / include_in_calculator_after_eop für Jahre nach EOP). default_all_years: Wochenvolumen × (ProdMonate/12). manual_year in Teiljahren: Jahreswert kann als Volumen nur für aktive Monate interpretiert werden.',
        period:
          'Monats-/Wochenaufschlüsselung: Operationen außerhalb des SOP/EOP-Monats entfallen. Periodensplits in operation_volume_by_year (effective_from_month/week, volume_value_before) steuern Ratenwechsel innerhalb des Jahres. Monats-% bei Wochenberechnung = Max. der Wochen-% im Monat.',
        maxType:
          'Max. Mittel nach Typ (Rechner-Fußzeile und Data-Viz-Aggregation) = max über Typen t von (Mittelwert load_% der Maschinen vom Typ t). Clientseitig aus den Maschinen-%.',
        isoWeek:
          'Aufgeklappte Kalenderwochen: ISO-Wochen Montag–Sonntag; Teilwochen an Monatsrändern werden mitgezählt.',
        altCycle:
          'Alternativzyklus aktiv, wenn use_alternative_in_calculator und alt_cycle_time_seconds > 0. Dann zählen Alternativzyklus, Alternativ-Nester und Alternativ-OEE. Kachelrand im Rechner kann all_alt / unused / mixed signalisieren. Allokation kann auf Zielmaschine Alternativ- oder Zwangzyklus setzen.',
        contractual:
          'Vertragsvolumen-Schalter: zuerst Vertragstabellen; ist kein Vertragswert auflösbar → Fallback Produktionsvolumen. Reiner Vertrags-Override ohne Daten kann 0 ergeben. Allokationsanteile können je nach API-Flag am Vertrag skaliert werden.',
      },
      faq: {
        title: '14. FAQ — Fragen und Antworten',
        p1:
          'Kurzantworten zu Bedienung, Bedeutungen und typischen Problemen. Details stehen in den Abschnitten 1–13.',
        q01: 'Wie melde ich mich an?',
        a01:
          'Öffnen Sie die App und geben Sie Benutzername oder E-Mail sowie Passwort ein. Nach erfolgreicher Anmeldung landen Sie auf der Startseite bzw. der zuvor angeforderten Seite. Bei erzwungenem Passwortwechsel erscheint der Änderungsdialog.',
        q02: 'Was bedeutet „Als Gast fortfahren“?',
        a02:
          'Gastzugang ohne Passwort ist nur verfügbar, wenn eine Rolle mit deaktiviertem „Anmeldung erforderlich“ und Berechtigungen existiert. Standardmäßig hat die Gastrolle mindestens Rechner-Ansicht; weitere Rechte setzt der Administrator.',
        q03: 'Wie ändere ich die Sprache?',
        a03:
          'Über die Flagge in der Kopfzeile (PL / EN / DE). UI und diese Anleitung folgen der Wahl; sie wird im Browser gespeichert.',
        q04: 'Was unterscheiden Produktionsversion, Szenarien und Call offs?',
        a04:
          'Produktionsversion = Live-Daten. Szenarien = isolierte Kopie zum Simulieren. Call offs = Vergleich mit SAP-Sales-Forecast. Umschaltung in der Kopfzeile; Navigation und verfügbare Admin-Karten ändern sich je Modus.',
        q05: 'Wozu der Schalter Vertragsvolumen?',
        a05:
          'Er rechnet mit Vertrags- statt Produktionsvolumen. Fehlen Vertragsdaten, greift Fallback auf Produktion. Der Rechner bekommt einen farbigen Rahmen aus den Visuellen Einstellungen.',
        q06: 'Wann erscheint Capacity / OCU?',
        a06:
          'Nur wenn OCU in Administrativen Einstellungen aktiviert ist und Sie nicht im Szenarien-/Call-offs-Banner sind. Der Schalter wechselt Arbeitstage/OEE-Profil; Formeln bleiben gleich. Szenarien nutzen immer Capacity.',
        q07: 'Warum fehlt ein Menüpunkt?',
        a07:
          'Ihrer Rolle fehlt die *.view-Berechtigung für dieses Modul, oder der aktuelle Arbeitsbereich blendet den Punkt aus (z. B. Maschinen/Projekte im Szenarienmodus).',
        q08: 'Wie lege ich eine Maschine an?',
        a08:
          'Navigation Maschinen → neu. Typ aus Dictionary wählen, Nummern, Linie, Status, Usage und Maße setzen. Alternativen im Maschinendetail pflegen. Massenimport: Administrative Einstellungen.',
        q09: 'Wie lege ich ein Projekt an?',
        a09:
          'Projekte → neu: Kunde, Name, Status. Mit create_rfq nur RFQ. Danach Details, Operationen und Volumen ergänzen.',
        q10: 'Wie füge ich Details (Teile) hinzu?',
        a10:
          'Im Projekt aus dem Katalog wählen oder neues Kennzeichen anlegen (SAP/Alias/Free text). Katalog auch unter Details bzw. Datenbankeinstellungen. Duplikate werden blockiert.',
        q11: 'Wie erfasse ich Operationen?',
        a11:
          'Im Projektregister Operationen: Phase, Maschine, Zykluszeit, Nester, optional Alternativzyklus und Flags. Die Maschine muss zuvor existieren.',
        q12: 'Wo pflege ich Volumen?',
        a12:
          'Im Projektregister Volumen: Produktion und Vertrag, Einheiten jährlich/monatlich/wöchentlich, Override vs. Standard. Jahresoverrides und Allokationssplits haben Vorrang vor Basiswerten.',
        q13: 'Was bedeuten SOP und EOP?',
        a13:
          'Start of Production / End of Production im Format MM.YYYY. Außerhalb des Fensters zählt Volumen in der Regel nicht (Ausnahmen: manuelle Overrides / count_after_eop). Teiljahre werden anteilig behandelt.',
        q14: 'Was bedeutet Status RFQ?',
        a14:
          'Anfrage-/Angebotsstatus für Projekte und ggf. Maschinen. RFQ-Daten erscheinen unter speziellen Filter-/Szenarioregeln. create_rfq beschränkt Bearbeitung auf RFQ-Projekte.',
        q15: 'Wie wird die Auslastung % berechnet?',
        a15:
          'Benötigte Zeit aller Operationen auf der Maschine geteilt durch effektive Verfügbarkeit (Arbeitstage, Schichten, OEE, Startup/Shutdown, Machine Usage), × 100, gerundet. Siehe Abschnitt 13.',
        q16: 'Warum ist die Auslastung über 100 %?',
        a16:
          'Der Wochenbedarf an Sekunden übersteigt die effektive Verfügbarkeit — Überlastung. Prüfen Sie Volumen, Zyklus/Nester, Usage, OEE und Arbeitstage; ggf. Allokation auf andere Maschinen.',
        q17: 'Was bewirkt Machine Usage?',
        a17:
          'Wert 0,1–1. Effektive Verfügbarkeit = Basis / Usage. Kleinerer Wert → mehr effektive Capacity → niedrigere %. Standard 1.',
        q18: 'Was sind Nester (nests)?',
        a18:
          'Anzahl Stücke aus einem Maschinenzyklus. Zeit pro Stück = Zyklus / Nester. Zusätzlich können Nest-Gruppen Maschinen für Allokationsvorschläge bündeln.',
        q19: 'Was bedeuten Summe, Mittel und Max. Mittel nach Typ?',
        a19:
          'Summe: Addition der % sichtbarer Maschinen. Mittel: Summe/Anzahl. Max. Mittel nach Typ: pro Typ mitteln, dann das Maximum — zeigt den am stärksten ausgelasteten Typ, nicht die Summe aller %.',
        q20: 'Wie klappe ich Monate und Wochen auf?',
        a20:
          'Im Rechner das Jahr expandieren. Wochen folgen ISO (Montag–Sonntag). Monatsauslastung bei Wochenberechnung entspricht dem Maximum der Wochen im Monat.',
        q21: 'Wie starte ich eine Allokation?',
        a21:
          'Im Rechner eine Auslastungszelle klicken (projects.edit, nicht Call-offs-Modus). Zielmaschine aus Nest/Alternativen wählen, Modus und Zeitraum setzen, ausführen.',
        q22: 'Welche Allokationsmodi gibt es?',
        a22:
          'Gesamtes Detailvolumen verschieben; manuell eingegebenes Volumen; Ziel-Auslastung % der Quellmaschine. Zeitraum ganzes Jahr oder ab Monat/Woche. Zyklus auf Ziel: unverändert, neu oder alternativ.',
        q23: 'Warum ist Allokation grau / deaktiviert?',
        a23:
          'Keine projects.edit-Berechtigung, Call-offs-Modus, fehlende Operationen im Jahr oder Maschine/Filter lässt keinen sinnvollen Transfer zu.',
        q24: 'Wie wirken Dimensionsfilter?',
        a24:
          'Clientseitig auf Breite/Tiefe/Höhe/Hub der geladenen Maschinen. Kein erneuter Haupt-API-Call. Fehlende Maße in Stammdaten können die Filterung einschränken oder Warnungen auslösen.',
        q25: 'Wie exportiere ich den Rechner?',
        a25:
          'Über Bericht PDF/Excel (calculator.download bzw. call_offs.download) oder „Als PDF drucken“ für die Ansicht. Dual-% erscheinen im Call-offs-Export.',
        q26: 'Wie erstelle ich ein Szenario?',
        a26:
          'Arbeitsbereich Szenarien → anlegen aus Produktion, anderem Szenario oder Call-offs-Vergleich. Anschließend Kopie bearbeiten und im Szenario-Rechner prüfen.',
        q27: 'Warum ändert OCU das Szenario nicht?',
        a27:
          'Szenarien rechnen fest mit Capacity-Arbeitstagen/OEE. OCU gilt in der Produktionsversion (und Visualisierung dort), wenn der Schalter aktiv ist.',
        q28: 'Kann ich Szenarioänderungen in die Produktion übernehmen?',
        a28:
          'Ja, über die Apply-/Teilübernahme-Funktion mit Bestätigungs-Challenge und Rechten. Vollübernahme ersetzt Snapshot-Inhalte (inkl. Arbeitstage); Teilübernahme ausgewählte Projekte/Details ohne working_days. Prüfen Sie vorab Backup und Historie.',
        q29: 'Wie lege ich einen Call-offs-Vergleich an?',
        a29:
          'Call-offs-Arbeitsbereich → neuer Vergleich: Name und Sales-Forecast-Excel. Nach Import Matching und Unmatched prüfen, dann Rechner/Visualisierung nutzen.',
        q30: 'Wie mappt Capacity SAP-Nummern?',
        a30:
          'Zuerst exakte normalisierte sap_number, sonst Versuch ohne die letzten zwei Zeichen. Nicht Treffer → Unmatched-CSV.',
        q31: 'Wo finde ich den Unmatched-Bericht?',
        a31:
          'Im Call-offs-Vergleich, sofern verfügbar. Download braucht call_offs.download.',
        q32: 'Was bedeuten Dualzellen Basis / Call offs?',
        a32:
          'In derselben Zelle: Auslastung aus Capacity-Basisdaten und aus Call-offs-Volumen. Legende im Call-offs-Rechner. Allokation bleibt aus.',
        q33: 'Worin unterscheiden sich Projektanhänge und Call-offs-Downloads?',
        a33:
          'Anhänge = Dateien am Projekt (Download: admin_attachments.download). Call offs = importierte SAP-Quelldatei und Unmatched-CSV (call_offs.download). Unterschiedliche Rechte und Orte.',
        q34: 'Warum kann ich Anhänge nicht hochladen?',
        a34:
          'Fehlendes Projekt-Schreibrecht oder fehlender/ungültiger Speicherpfad project_attachments_output_dir in Administrativen Einstellungen.',
        q35: 'Warum kann ich Anhänge nicht herunterladen?',
        a35:
          'Es fehlt admin_attachments.download — unabhängig von projects.view/edit. Die Admin-Anhängeliste braucht admin_attachments.view.',
        q36: 'Wie erstelle ich ein Backup?',
        a36:
          'Administration → Administrative Einstellungen: manuelles Backup und/oder Zeitplan sowie Backup-Pfad. Vor Import oder DB-Löschung Backup empfohlen.',
        q37: 'Wie stelle ich ein Backup wieder her?',
        a37:
          'Ebenfalls unter Administrative Einstellungen: Restore-Funktion. Danach Anmeldung und Daten prüfen. Rechte admin_settings.edit erforderlich.',
        q38: 'Welche Importe gibt es?',
        a38:
          'Capacity-Bundle (Vorlage/partiell/voll), Capacity-Daten-Excel, Maschinenimport u. a. unter Administrative Einstellungen. Nach Import Rechner und Stichproben prüfen.',
        q39: 'Was passiert bei „Datenbank löschen“?',
        a39:
          'Destruktive Admin-Aktion mit Bestätigung; oft mit optionalem Backup davor. Nur mit entsprechenden Rechten — danach sind Produktionsdaten weg.',
        q40: 'Wozu dient „OCU-Daten“?',
        a40:
          'Separater Admin-Schritt: Überleitung + Katowice_Data → generiertes ZIP. Nicht zu verwechseln mit dem Capacity/OCU-Berechnungsprofil.',
        q41: 'Wo stelle ich Schwellfarben und Summenzeilen ein?',
        a41:
          'Datenbankeinstellungen → Visuelle Einstellungen: Rechnerfarben, Schwellen, Vertragsrahmen, Data-Viz-Farben, Themes.',
        q42: 'Wo pflege ich Arbeitstage und OEE-Defaults?',
        a42:
          'Datenbankeinstellungen → Arbeitstage für Capacity und (wenn aktiv) OCU. Jahreszeilen und Default-Schlüssel capacity_default_* / ocu_default_*.',
        q43: 'Passwort vergessen — was tun?',
        a43:
          'Link auf dem Anmeldebildschirm nutzen bzw. Administrator um Reset bitten. Erzwungener Wechsel nach Bootstrap/Admin-Vorgabe ist möglich.',
        q44: 'Was darf ich nur mit „RFQ erstellen“?',
        a44:
          'RFQ-Projekte anlegen und im RFQ-Rahmen bearbeiten; keine Löschung über dieses Recht allein und keine Bearbeitung fremder Nicht-RFQ-Projekte ohne projects.edit.',
        q45: 'Was ist Flex in der Visualisierung?',
        a45:
          'Ein ±%-Band um Vertragsserien (inkl. Szenario-Vertrag). Keine eigene Datenserie; Produktion und Call offs haben kein Flex-Band.',
        q46: 'Wie aggregiert die Visualisierung Linien?',
        a46:
          'Wie Max. Mittel nach Typ: je Typ mittlere Auslastung, dann Maximum. Eine einzelne Maschine zeigt ihren eigenen %.',
        q47: 'Manuelle vs. automatische Historieneinträge?',
        a47:
          'Die Änderungshistorie unterscheidet manuelle Notizen/Einträge und automatisch protokollierte Systemänderungen an Projekten, Maschinen und Operationen. Im Szenario sehen Sie die Historie der Kopie.',
        q48: 'Auslastung 0 trotz Volumen — typische Ursachen?',
        a48:
          'Außerhalb SOP/EOP; Operation nicht auf der Maschine; Filter blendet die Maschine aus; Vertragsmodus ohne Daten und Fallback unerwartet; Call-offs-Jahr außerhalb Dateibereich; Status inaktiv; fehlende Arbeitstage/Verfügbarkeit 0 bei gleichzeitigem Sonderfall — prüfen Sie SOP/EOP, Status, Filter, Volumenquelle und Profil (Capacity/OCU).',
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
