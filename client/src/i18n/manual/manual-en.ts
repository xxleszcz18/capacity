import type { TranslationTree } from '../types';

export const manualEn: TranslationTree = {
  manual: {
    title: 'User manual',
    subtitle:
      'Complete guide to the Autoneum Capacity system — modules, data dependencies, and workflows. Content follows the language selected in the application header.',
    backAdmin: '← Administration',
    toc: 'Table of contents',
    tip: 'Tip',
    seeAlso: 'See also',
    stepsLabel: 'Steps',
    sections: {
      overview: {
        title: '1. Introduction',
        p1:
          'Autoneum Capacity is an application for planning and analyzing production line load. It combines a machine registry, projects with parts and operations, and a load calculator with scenario simulation.',
        p2:
          'Main areas in the navigation bar: Calculator, Machines, Projects, Parts, and Administration. Scenario mode (header button) limits the view to a copy of the selected scenario data.',
        stepsTitle: 'Typical workflow',
        step1: 'Configure dictionaries in Administration → Database settings (phases, parts, machine types, working days).',
        step2: 'Import or create machines (Machines) and projects with operations (Projects).',
        step3: 'Enter part volumes in projects and review load in the Calculator.',
        step4: 'Optionally: create a scenario, apply changes, and compare results in Data visualization.',
      },
      header: {
        title: '2. Application header',
        p1:
          'The top bar controls calculation mode and data visibility. Header settings affect the Calculator, volume allocation, and visualization reports.',
        contractualTitle: 'Contract volumes',
        contractual:
          'Toggle uses contractual volumes instead of production volumes (with fallback when contractual data is missing). The calculator is then framed in a configurable color (Visual settings).',
        capacityTitle: 'Production version vs Scenarios',
        capacity:
          '“Production version” (Capacity) works on live database data. “Scenarios” switches to a copy of the selected scenario — Calculator and Change history then show scenario state, not production.',
        ocuTitle: 'Capacity / OCU',
        ocu:
          'When OCU is enabled in administrative settings, the header toggle switches parameter profile (OEE, working days, etc.) to a separate OCU set. Load calculation logic remains the same.',
        langTitle: 'Language',
        lang: 'The flag icon changes UI and manual language (Polish, English, German). The choice is stored in the browser.',
      },
      dataModel: {
        title: '3. Data model and dependencies',
        p1:
          'Data forms a hierarchy: parts (catalog) are assigned to projects; operations (phase + machine + cycle time) are defined per project; operations drive machine load in the Calculator.',
        p2:
          'A machine must exist before assignment to an operation. Process phase and machine type come from administrative dictionaries. Operation volume may come from project part, operation fields, or a yearly override.',
        dep1: 'Deleting a catalog part requires resolving linked operations.',
        dep2: 'Machine type must be defined in the Machine types dictionary.',
        dep3: 'Working days and OEE affect each machine’s available capacity [s/week].',
        dep4: 'A scenario is a copy of production (or another scenario) state with its own change history.',
      },
      calculator: {
        title: '4. Load calculator',
        p1:
          'The table shows active machines (and RFQ in scenario mode) with load percentage per year. Clicking a year cell opens allocation — moving volume between machines.',
        p2:
          'Load % = sum (required operation time / machine availability) × machine usage × 100. Required time = weekly volume × (cycle time / nest count).',
        p3:
          'Cell colors (OK / warning / overload), alternative cycle borders, and RFQ badge are configured in Administration → Database settings → Visual settings.',
        step1: 'Filter machines by type, status, dimensions, or search.',
        step2: 'Click load % to open allocation for that year.',
        step3: 'Export PDF or Excel report from the calculator view.',
        step4: 'Above the table (with contract volumes, outside scenario mode) — red bar listing machines above 100%.',
      },
      machines: {
        title: '5. Machines',
        p1:
          'Production machine registry: SAP number, internal number, type, line, location, dimensions, status (active / inactive / RFQ), machine usage, and OEE override.',
        p2:
          'Machine detail tabs: description, operations on machine, alternatives (other machines for the same work), and change history.',
        step1: 'New machine — select type from list (Machine types dictionary).',
        step2: 'RFQ status — machine visible in scenario calculator when linked to an RFQ project.',
        step3: 'Machine import from Excel — Administration → Administrative settings.',
      },
      projects: {
        title: '6. Projects',
        p1:
          'A project groups customer parts with production operations. Each part has yearly volumes (production and optional contractual), SOP/EOP, and operations (phase, machine, cycle, nests).',
        p2:
          'Project status (active, RFQ, archive) affects calculator visibility. A part set is a group with one volume source.',
        step1: 'Create project and add parts from catalog or new entries.',
        step2: 'Operations tab — define routing (machine + phase + time).',
        step3: 'Volumes tab — enter yearly data; auto-save can be enabled in database settings.',
        step4: 'Project notes document decisions and change context.',
      },
      details: {
        title: '7. Parts (designations)',
        p1:
          'Global parts catalog: SAP no., alias, free text. Parts are shared across projects — catalog edits appear on next selection in a project.',
        p2:
          '“Project” and “Line no.” columns help locate usage. Deleting a part with operations requires choosing operations to remove.',
      },
      scenarios: {
        title: '8. Scenarios',
        p1:
          'A scenario is an isolated data copy for simulating changes without modifying production. Create from production database or as a copy of another scenario.',
        p2:
          'In Scenario mode, navigation (Calculator, Change history) works on the copy. Create new projects and catalog parts after switching back to Production version.',
        step1: 'Scenario list — create, open preview, edit name/scope, archive.',
        step2: 'Scenario edit — change project statuses, volumes, operations in the copy.',
        step3: 'Compare scenarios with production in Data visualization (Analytics tab).',
      },
      admin: {
        title: '9. Administration',
        p1: 'The administration panel groups configuration, backup, reporting, and audit tools.',
        dbTitle: 'Database settings',
        db:
          'Working days (Capacity and OCU), process phases, parts catalog, machine types, calculator visual settings, volume auto-save behavior.',
        admTitle: 'Administrative settings',
        adm:
          'Automatic and manual backup, database restore, Excel import/export (full bundle, machines, input data), OCU enablement, database clear.',
        vizTitle: 'Data visualization',
        viz:
          'Load trend charts for lines and machines, analytics table, delta chart (production vs scenario). PDF/Excel export.',
        histTitle: 'Change history',
        hist:
          'Log of changes to projects, machines, and operations with filters (project, machine, part, author, text). In scenario mode — scenario copy history.',
      },
      formulas: {
        title: '10. Calculation formulas',
        p1: 'The capacity engine (server) applies these formulas on each calculator refresh.',
        avail:
          'Availability [s/week] = (working days / 52) × shift time [min] × 60 × shifts/day × OEE − startup/shutdown [s], adjusted by machine usage.',
        weekly:
          'Weekly volume: annual ÷ working weeks; monthly × 12 ÷ working weeks; weekly — no conversion.',
        required: 'Required time [s/week] = Σ (weekly vol. × cycle time / nests) for operations on the machine in that year.',
        load: 'Load % = round(Σ (required op. time / availability with op. OEE) × machine usage × 100).',
        sop: 'SOP/EOP — year fraction limits project operation volume to months within the production range.',
      },
    },
    diagrams: {
      dataModel: {
        title: 'Data hierarchy',
        details: 'Parts\n(catalog)',
        projects: 'Projects\n+ volumes',
        operations: 'Operations\nphase · machine · cycle',
        machines: 'Machines\n+ capacity',
        calculator: 'Load\ncalculator %',
      },
      modes: {
        title: 'Work modes',
        production: 'Production\nversion',
        scenario: 'Scenarios\n(data copy)',
        note: 'Same UI — different data source',
      },
      calculation: {
        title: 'Load calculation flow',
        settings: 'Working days\nOEE · shifts',
        volumes: 'Volumes\npart / operation',
        ops: 'Operations\non machine',
        result: 'Load %\nper year',
      },
      projectFlow: {
        title: 'Creating a project',
        s1: 'Client +\nname',
        s2: 'Parts\nfrom catalog',
        s3: 'Operations\nper part',
        s4: 'Yearly\nvolumes',
        s5: 'Calculator',
      },
      scenario: {
        title: 'Scenario vs production',
        live: 'Production\ndatabase',
        snap: 'Scenario\nsnapshot',
        calc: 'Scenario\ncalculator',
        compare: 'Delta\nanalytics',
      },
      adminMap: {
        title: 'Administration map',
        db: 'Database\nsettings',
        adm: 'Backup\nImport',
        viz: 'Visualization',
        hist: 'History',
      },
      dependencies: {
        title: 'Key dependencies',
        phases: 'Phases →\noperations',
        types: 'Machine types →\nmachine form',
        wd: 'Working days →\ncapacity',
        parts: 'Parts →\nprojects',
        machines: 'Machines →\noperations',
      },
    },
  },
};
