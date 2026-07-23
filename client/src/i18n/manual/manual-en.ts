import type { TranslationTree } from '../types';

export const manualEn: TranslationTree = {
  manual: {
    title: 'User manual',
    subtitle:
      'Complete guide to Autoneum Capacity — features, workflows, and data dependencies. Content follows the language selected in the header (PL / EN / DE).',
    backAdmin: '← Administration',
    toc: 'Table of contents',
    tip: 'Tip',
    seeAlso: 'See also',
    stepsLabel: 'Steps',
    sections: {
      overview: {
        title: '1. Introduction',
        p1:
          'Autoneum Capacity plans and analyzes production-line load. It combines a machine registry, projects with parts and operations, a load calculator, what-if scenarios, Call offs comparisons (SAP Sales Forecast), and trend visualization.',
        p2:
          'Navigation: Calculator, Machines, Projects, Parts, Data visualization, and Administration. Workspaces: Production version, Scenarios, and Call offs (header switches).',
        p3:
          'Access requires login. RBAC permissions limit screens and actions. This manual is under Administration → User manual.',
        stepsTitle: 'Typical workflow',
        step1: 'Sign in; an administrator configures dictionaries (phases, machine types, working days) in Database settings.',
        step2: 'Import or create machines and projects with operations and volumes.',
        step3: 'Review load in the Calculator (filters; sum / average / max average by type).',
        step4: 'Optionally compare Call offs or create a scenario and compare in Data visualization.',
        step5: 'Export PDF/Excel from Calculator or visualization; audit changes in Change history.',
      },
      auth: {
        title: '2. Login and permissions',
        p1:
          'Each session needs a user account. After login, role permissions apply. A guest account (if enabled) is usually read-only.',
        p2:
          'Users and roles: Administration → Users and permissions. Password reset follows email / local procedure.',
        stepsTitle: 'Access flow',
        step1: 'Open the app → login screen.',
        step2: 'Only modules allowed by the role are visible.',
        step3: 'Logout ends the session; without write permission, save actions are blocked.',
        role1: 'Administrator — full config, backup, users, import/export.',
        role2: 'Planner / editor — projects, machines, calculator, scenarios, Call offs (by permission).',
        role3: 'Viewer / guest — read selected screens without changing production data.',
      },
      header: {
        title: '3. Application header',
        p1:
          'The top bar controls data mode and calculation profile. Settings affect Calculator, allocation, Call offs, and visualization reports.',
        contractualTitle: 'Contract volumes',
        contractual:
          'Toggle uses contractual volumes instead of production (with fallback when contractual data is missing). The calculator gets a colored frame (Visual settings).',
        capacityTitle: 'Production version vs Scenarios',
        capacity:
          '“Production version” uses the live database. “Scenarios” switches to a copy — Calculator and Change history show scenario state. Create a scenario from the header control in the Scenarios workspace.',
        callOffsTitle: 'Call offs',
        callOffs:
          'Call offs workspace compares capacity with an SAP Sales Forecast file. With a comparison selected, the Calculator shows dual load (base + Call offs). Create a comparison from the header control.',
        ocuTitle: 'Capacity / OCU',
        ocu:
          'When OCU is enabled in admin settings, the toggle switches OEE/working-days profile to the OCU set. Load formula logic stays the same.',
        langTitle: 'Language',
        lang: 'The flag changes UI and this manual (PL / EN / DE). Choice is stored in the browser.',
      },
      dataModel: {
        title: '4. Data model and dependencies',
        p1:
          'Hierarchy: parts (catalog) → projects → operations (phase + machine + cycle) → machine load in the Calculator. A machine must exist before assignment to an operation.',
        p2:
          'Volume may come from project part, operation fields, or yearly override (production and contractual separately). Scenarios and Call offs are comparison layers on the same machines.',
        dep1: 'Deleting a catalog part requires resolving linked operations.',
        dep2: 'Machine type must exist in the Machine types dictionary.',
        dep3: 'Working days and OEE define machine availability [s/week].',
        dep4: 'A scenario is a snapshot of production (or another scenario / Call offs) with its own history.',
        dep5: 'Call offs volumes come from the SAP file mapped to operations/parts; outside file years Call offs series are empty.',
      },
      calculator: {
        title: '5. Load calculator',
        p1:
          'The table lists machines (by status filters) with load % by year — and optionally months/weeks when expanded. Threshold colors, SOP/EOP and RFQ markers are set in Visual settings.',
        p2:
          'Machine load % = required operation time / availability × machine usage × 100 (see Formulas). In Call offs mode cells show dual base + Call offs.',
        p3:
          'Footer rows: Sum of loads, Average loads, and Max average by type (highest average among machine types in the current filter).',
        p4:
          'The same calculator runs in production, scenario, and Call offs — data source is chosen in the header / navigation.',
        stepsTitle: 'Calculator flow',
        step1: 'Set year range and filters (type, client, status, line, machine dimensions, search).',
        step2: 'Optionally enable contractual volumes and/or OCU profile.',
        step3: 'Expand a year to months/weeks (ISO Mon–Sun) when needed.',
        step4: 'Click a load cell to open allocation (volume move) if permitted.',
        step5: 'Export view or PDF/Excel report; check the overloaded machines bar (>100%).',
        summaryTitle: 'Summary rows',
        summary:
          'Sum = sum of % for visible machines. Average = sum / count. Max average by type = average % per type, then take the maximum (also used as line aggregation in Data visualization).',
        allocTitle: 'Allocation',
        alloc:
          'Allocation suggests machines from the nest or alternatives list. Transfer modes: full, manual, target %. Scope can be years/months/weeks. After save the calculator refreshes.',
        filtersTitle: 'Dimension filters',
        filters:
          'Width / depth / height / stroke filters run client-side on the full payload (fast changes without re-querying the main API). Option to show active machines with zero load when dimension filters are on.',
      },
      machines: {
        title: '6. Machines',
        p1:
          'Registry: SAP, internal number, type, line, location, dimensions, status (active / inactive / RFQ), machine usage, OEE override.',
        p2:
          'Machine detail: description, operations, alternatives, history. Nests group machines for allocation.',
        stepsTitle: 'Flow',
        step1: 'New machine — type from Machine types dictionary.',
        step2: 'RFQ status — visible in scenario calculator when linked to an RFQ project.',
        step3: 'Excel import — Administration → Administrative settings.',
      },
      projects: {
        title: '7. Projects',
        p1:
          'A project groups customer parts with operations. Each part has yearly volumes (production and contractual), SOP/EOP, and operations (phase, machine, cycle, nests, % capacity, OPF).',
        p2:
          'Project status (active / RFQ / inactive) affects the calculator. A part set shares one volume source. Attachments and notes document context.',
        stepsTitle: 'Flow',
        step1: 'Create project (client, name, status).',
        step2: 'Add parts from catalog or new; set SOP/EOP.',
        step3: 'Operations tab — route (machine + phase + cycle).',
        step4: 'Volumes tab — yearly / monthly / weekly; manual year override vs default.',
        step5: 'Manual vs automatic notes; optional file attachments.',
      },
      details: {
        title: '8. Parts (identifiers)',
        p1:
          'Global catalog: SAP no., Alias, Free text. Parts are shared across projects. Validation blocks duplicate identifiers.',
        p2:
          'Project / line columns help locate usage. Deleting a part with operations requires choosing which operations to remove.',
      },
      scenarios: {
        title: '9. Scenarios',
        p1:
          'A scenario is an isolated data copy for simulation without changing production. Create from production, another scenario, or a Call offs comparison.',
        p2:
          'In Scenarios mode, Calculator and History use the copy. Create new production catalog projects/parts after returning to Production version. You can add capacity projects into a scenario and change RFQ/active statuses.',
        p3:
          'Apply to production requires a confirmation challenge and permissions — moves selected scenario changes onto the live database.',
        stepsTitle: 'Scenario flow',
        step1: 'Scenario list — create (optionally from Call offs), open, archive.',
        step2: 'Edit the copy: statuses, volumes, operations, RFQ.',
        step3: 'Check load in the scenario Calculator.',
        step4: 'Compare with production / Call offs in Data visualization (multi-select scenarios).',
        step5: 'Optionally apply changes (or a subset) to production.',
      },
      callOffs: {
        title: '10. Call offs (SAP)',
        p1:
          'A Call offs comparison loads a Sales Forecast Excel file and maps SAP items to operations/parts. Result: Call offs load vs production/contractual capacity.',
        p2:
          'Unmatched items go to a CSV report. The file date range limits Call offs years on charts. Comparisons can be archived.',
        stepsTitle: 'Call offs flow',
        step1: 'Create a comparison (name + Excel) in the Call offs workspace.',
        step2: 'Review SAP matching and the unmatched report.',
        step3: 'Open Calculator in Call offs mode — dual load cells.',
        step4: 'In Data visualization pick the comparison and enable the Call offs series.',
      },
      dataViz: {
        title: '11. Data visualization',
        p1:
          'Load trends (%): lines and machines, or several objects on one comparison chart. Machine type and client filters narrow data like the Calculator. Charts combine production, contract, Call offs (multi-select) and scenarios (multi-select); PDF/Excel reports and Analytics show differences (Δ) between series.',
        p2:
          'Active calculation mode (Capacity / OCU) comes from the app header toggle — badge next to the page title. Scenarios always use Capacity settings. Line / multi-machine / plant aggregation = max of per-type average load % (same as the Calculator’s third summary row). A single machine uses its own %.',
        p3:
          'Dimension filters apply locally to loaded data. Export: PDF (current view or advanced) and Excel with trend tables and analytics.',
        stepsTitle: 'Visualization flow',
        step1: 'Set years, machine status, type, client, RFQ, dimension filters.',
        step2: 'Choose series: contract / production / Call offs (multi) / scenarios (multi) + scenario contract/prod checkboxes.',
        step3: 'On Lines/Machines tabs select entities; optionally one combined chart or yearly bars (including Call offs).',
        step4: 'Set Flex (±% band around contractual series), load/free-capacity metric, Y-axis auto/fixed; export the report.',
        seriesTitle: 'Series sources',
        series:
          'Production and contract — live DB (or OCU profile). Call offs — selected SAP comparisons (each as its own series). Scenarios — parallel series for each selected scenario (distinct colors).',
        aggTitle: 'Aggregation',
        agg:
          'For a machine group: average % within each type, then take the maximum. Charts show the “most loaded type” under the filter, not the sum of % or a flat average of all machines.',
        flexTitle: 'Flex',
        flex:
          'Flex (±%) draws a band around contractual series (including scenario contract). Production and Call offs have no Flex. Visually highlighted in the series bar — band width, not a separate data series.',
      },
      admin: {
        title: '12. Administration',
        p1: 'Configuration, security, backup, and audit. In Scenarios/Call offs mode the card list is limited.',
        dbTitle: 'Database settings',
        db:
          'Working days (Capacity and OCU), phases, parts catalog, machine types, visual settings (threshold colors, sum/avg rows, Data Viz colors), volume autosave.',
        admTitle: 'Administrative settings',
        adm:
          'Automatic/manual backup, restore, Excel import/export (capacity pack, machines, input data), OCU enablement, storage paths, database wipe.',
        usersTitle: 'Users and permissions',
        users:
          'Accounts, roles, permission mapping to screens and API. Without permission a user will not see e.g. project edit or import.',
        histTitle: 'Change history',
        hist:
          'Log of project, machine, and operation changes with filters. In a scenario — history of the scenario copy. Manual vs automatic entries.',
      },
      formulas: {
        title: '13. Calculation formulas',
        p1: 'The capacity engine (server) applies these on every calculator / API recalculation.',
        avail:
          'Availability [s/week] = (working days / 52) × shift time [min] × 60 × shifts/day × OEE − startup/shutdown [s], adjusted by machine usage. OEE: operation > machine > year settings.',
        weekly:
          'Weekly volume: annual ÷ working weeks; monthly × 12 ÷ working weeks; weekly — unchanged.',
        required: 'Required time [s/week] = Σ (weekly vol × cycle / nests) for operations on the machine in the year (SOP/EOP applied).',
        load: 'Machine load % = round(Σ (required / availability with operation OEE) × machine usage × 100).',
        sop: 'SOP/EOP — year/month/week fraction limits volume to periods inside the production window.',
        maxType:
          'Max average by type (Calculator + Data Viz aggregation) = max_t ( average load_% of machines of type t ).',
        isoWeek: 'Expanded calendar weeks: ISO (Monday–Sunday).',
      },
    },
    diagrams: {
      dataModel: {
        title: 'Data hierarchy',
        details: 'Parts\n(catalog)',
        projects: 'Projects\n+ volumes',
        operations: 'Operations\nphase · machine · cycle',
        machines: 'Machines\n+ capacity',
        calculator: 'Calculator\nload %',
      },
      modes: {
        title: 'Modes / workspaces',
        production: 'Production\nversion',
        scenario: 'Scenarios',
        note: 'Call offs = separate SAP comparison workspace',
      },
      calculation: {
        title: 'Load calculation flow',
        settings: 'Working days\nOEE · shifts',
        volumes: 'Volumes\npart / operation',
        ops: 'Operations\non machine',
        result: 'Load %\n+ max by type',
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
        live: 'Production\nDB',
        snap: 'Scenario\nsnapshot',
        calc: 'Scenario\ncalculator',
        compare: 'Multi-scenario\nvisualization',
      },
      callOffs: {
        title: 'Call offs flow',
        file: 'SAP file\nSalesFcst',
        match: 'Map SAP\n→ parts',
        calc: 'Calculator\ndual load',
        viz: 'Chart\nseries',
      },
      dataViz: {
        title: 'Visualization sources',
        base: 'Production /\ncontract',
        sources: 'Call offs +\nscenarios',
        charts: 'Lines /\nmachines',
        export: 'PDF /\nExcel',
      },
      adminMap: {
        title: 'Administration map',
        db: 'Database\nsettings',
        adm: 'Backup\nImport',
        users: 'Users\nRBAC',
        hist: 'History',
        manual: 'Manual',
      },
      dependencies: {
        title: 'Key dependencies',
        phases: 'Phases →\noperations',
        types: 'Machine types →\nform',
        wd: 'Working days →\ncapacity',
        parts: 'Parts →\nprojects',
        machines: 'Machines →\noperations',
      },
    },
  },
};
