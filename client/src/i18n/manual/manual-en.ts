import type { TranslationTree } from '../types';

export const manualEn: TranslationTree = {
  manual: {
    title: 'User manual',
    subtitle:
      'Complete guide to Autoneum Capacity — modules, workflows, permissions, calculation formulas, and FAQ. Content follows the language selected in the header (PL / EN / DE).',
    backAdmin: '← Administration',
    toc: 'Table of contents',
    tip: 'Tip',
    seeAlso: 'See also',
    stepsLabel: 'Steps',
    sections: {
      overview: {
        title: '1. Introduction',
        p1:
          'Autoneum Capacity plans and analyzes production-line load. It combines a machine registry, projects with parts and operations, a load calculator, what-if scenarios, Call offs comparisons (SAP Sales Forecast), and trend visualization (Data visualization).',
        p2:
          'Main navigation: Calculator, Machines, Projects, Parts, Data visualization, and Administration. Workspaces switched in the header: Production version, Scenarios, and Call offs. Optional Capacity / OCU calculation profile and contractual volumes toggle also live in the header.',
        p3:
          'Access requires login (or guest access if enabled for a role). RBAC permissions hide modules and block actions. This manual is under Administration → User manual and stays available in scenario and Call offs modes.',
        p4:
          'Typical data path: dictionaries and working days → machines and projects with volumes → Calculator load % → optional Call offs or scenarios → comparison charts and PDF/Excel exports. Change history audits edits.',
        stepsTitle: 'Typical workflow',
        step1: 'Sign in; an administrator configures dictionaries (phases, machine types, working days Capacity/OCU) in Database settings.',
        step2: 'Import or create machines and projects with operations, SOP/EOP, and yearly volumes (production and optionally contractual).',
        step3: 'Review load in the Calculator (filters; summary rows: sum / average / max average by type).',
        step4: 'Optionally compare Call offs or create a scenario and compare series in Data visualization.',
        step5: 'Export PDF/Excel from Calculator or visualization; audit changes in Change history; keep backups from Administrative settings.',
      },
      auth: {
        title: '2. Login and permissions',
        p1:
          'Each session needs a user account (login/password) or guest access when a role allows “Continue as guest” without a password. After login, the role’s permission keys control which screens and API actions are available.',
        p2:
          'Users and roles: Administration → Users and permissions (requires user_management / role_management). Password flows: forgot password, email reset link, and change password — according to local email configuration.',
        p3:
          'Without the matching permission, navigation links are hidden and write/download actions return an error. Guest accounts are usually read-only by design of the guest role matrix.',
        stepsTitle: 'Access flow',
        step1: 'Open the app → login screen (username/password) or Continue as guest if offered.',
        step2: 'Only modules allowed by the role appear in the nav and Administration hub.',
        step3: 'Logout ends the session. Save, delete, import, and download buttons stay disabled or fail without permission.',
        step4: 'Administrators assign roles on Users and permissions; edit the permission matrix on Roles & permissions.',
        role1: 'Administrator — typically full config, backup, users/roles, import/export, OCU data, attachments inventory.',
        role2: 'Planner / editor — projects, machines, calculator, scenarios, Call offs (subset of resources/actions).',
        role3: 'Viewer / guest — read selected screens without changing production data.',
        permMatrix:
          'Permission matrix (resource.action): calculator (view, download); machines (view, details, change_status, edit, delete, download); projects (view, details, change_status, edit, delete, create_rfq); designations (view, edit, delete, download); scenarios (view, edit, delete, download); call_offs (view, edit, delete, download); admin_database / admin_settings / admin_data_viz (view, edit, download); admin_ocu (view, edit); admin_attachments (view, download); change_history (view, download); user_management / role_management (view, edit, delete).',
        rbacTitle: 'RBAC in practice',
        rbac:
          'Each key is independent. Example: machines.view shows the list; machines.details opens a machine; machines.edit allows changes; machines.download exports. Turning off a parent view usually removes related UI. Roles are named in the admin UI — the matrix defines the real access.',
        rfqPermTitle: 'RFQ-only project permission',
        rfqPerm:
          'projects.create_rfq (without projects.edit) lets a user create and edit only RFQ projects and open project details for RFQ work. Full project edit still requires projects.edit. Status change and delete follow their own keys.',
        downloadPermTitle: 'Download permissions',
        downloadPerm:
          'calculator.download / machines.download / scenarios.download / call_offs.download / admin_*.download control report and file exports for those areas. Project attachment file download uses admin_attachments.download (separate from Call offs source-file download, which uses call_offs.download). Admin attachments View (admin_attachments.view) shows the inventory; without Download the download action is blocked. Clearing View also clears Download on the role form.',
      },
      header: {
        title: '3. Application header',
        p1:
          'The top bar controls data mode and calculation profile. These settings affect Calculator, allocation, Call offs dual load, and Data visualization reports.',
        contractualTitle: 'Contract volumes',
        contractual:
          'Toggle uses contractual project volumes instead of production volumes. When contractual data is missing for a year, the engine falls back to production volumes. The calculator gets a colored frame (color from Visual settings).',
        capacityTitle: 'Production version vs Scenarios',
        capacity:
          '“Production version” uses the live database. “Scenarios” switches to a scenario copy — Calculator and Change history show that snapshot. Create or open a scenario from the header control / Scenarios list. Applying a scenario to production is a separate confirmed action.',
        callOffsTitle: 'Call offs',
        callOffs:
          'Call offs workspace compares capacity with an imported SAP Sales Forecast file. With a comparison selected, the Calculator shows dual load (base + Call offs). Create a comparison from the Call offs list / header control.',
        ocuTitle: 'Capacity / OCU',
        ocu:
          'When OCU is enabled in Administrative settings, the toggle switches the working-days / OEE profile to the OCU set. Load formula structure stays the same; only the calendar/OEE inputs change. Scenarios always calculate with the Capacity profile. This toggle is not the same as Administration → OCU data (Excel fill/export tool).',
        langTitle: 'Language',
        lang: 'The flag changes UI labels and this manual (PL / EN / DE). The choice is stored in the browser.',
      },
      dataModel: {
        title: '4. Data model and dependencies',
        p1:
          'Hierarchy: parts catalog (identifiers) → projects → operations (phase + machine + cycle + nests) → machine load in the Calculator. A machine must exist before assignment to an operation. Machine types and phases come from Database settings dictionaries.',
        p2:
          'Volume may come from project/part yearly tables, operation fields, or yearly override on the operation (production and contractual tracked separately). Scenarios and Call offs are comparison layers on the same machine structure.',
        p3:
          'Deleting catalog parts, machines, or dictionary entries can break linked operations — the UI asks you to resolve dependencies. Working days and OEE define availability [s/week] used by every load calculation.',
        dep1: 'Deleting a catalog part requires resolving linked operations.',
        dep2: 'Machine type must exist in the Machine types dictionary (default machine usage comes from the type).',
        dep3: 'Working days and OEE (Capacity or OCU profile) define machine availability [s/week].',
        dep4: 'A scenario is a snapshot of production (or another scenario / Call offs) with its own history and calculator state.',
        dep5: 'Call offs volumes come from the SAP file mapped to parts/operations; outside the file year range Call offs series are empty.',
        dep6: 'Project attachments are stored under the configured attachments path; the admin Attachments page inventories files on disk vs database records.',
      },
      calculator: {
        title: '5. Load calculator',
        p1:
          'The table lists machines (by status and other filters) with load % by year — and optionally months/weeks when expanded. Threshold colors, SOP/EOP and RFQ markers are set in Visual settings (Database settings → Visual).',
        p2:
          'Machine load % = round(required time / effective availability × 100), where effective availability = base availability / machine_usage (usage clamped 0.1–1). See Formulas. In Call offs mode cells show dual base + Call offs values.',
        p3:
          'Footer rows: Sum of loads, Average loads, and Max average by type (highest average among machine types in the current filter). The same max-by-type rule aggregates lines in Data visualization.',
        p4:
          'The same calculator runs in production, scenario, and Call offs — the data source is chosen in the header / navigation. Overloaded machines (>100%) appear in the overload bar when present.',
        p5:
          'Click a load cell (when permitted) to open allocation: move volume to another machine in the nest or from the alternatives list. Dimension filters (width/depth/height/stroke) run client-side on the loaded payload.',
        stepsTitle: 'Calculator flow',
        step1: 'Set year range and filters (type, client, status, line, machine dimensions, search).',
        step2: 'Optionally enable contractual volumes and/or the OCU profile in the header.',
        step3: 'Expand a year to months/weeks (ISO Monday–Sunday) when needed.',
        step4: 'Click a load cell to open allocation if your role may edit projects/machines as required.',
        step5: 'Review summary rows and the overloaded machines bar.',
        step6: 'Export the current view or a PDF/Excel report (needs calculator.download where enforced).',
        summaryTitle: 'Summary rows',
        summary:
          'Sum = sum of % for visible machines. Average = sum / count. Max average by type = average % per machine type, then take the maximum (also used as line/plant aggregation in Data visualization).',
        allocTitle: 'Allocation',
        alloc:
          'Allocation suggests target machines from the nest and/or saved alternatives. After execute, split child operations may be created (linked via split_from_operation_id); the calculator refreshes. Scope can be full years or from a selected month/week (partial year fraction).',
        allocModesTitle: 'Transfer modes',
        allocModes:
          'Full — move 100% of the selected detail volume for each selected year (or the remaining fraction from a start month/week). Manual — enter volume to move (capped at available). Target % — calculate volume so the source machine’s remaining load matches the entered %. Optional: new cycle on target, or cycle from the alternative process.',
        filtersTitle: 'Dimension filters',
        filters:
          'Width / depth / height / stroke filters run client-side on the full calculator payload (fast changes without re-querying the main API). Option to show active machines with zero load when dimension filters are on.',
        exportTitle: 'Export',
        export:
          'Export the filtered or selected machine set to PDF or Excel from the calculator toolbar. Report mode labels and machine counts appear in the export header. Requires download permission when enforced by the role.',
      },
      machines: {
        title: '6. Machines',
        p1:
          'Registry fields include SAP number, internal number, type, line/location, dimensions (width/depth/height/stroke), status (active / inactive / RFQ), machine usage, and optional OEE override.',
        p2:
          'Machine detail shows description, assigned operations, alternatives for allocation, and history. Status RFQ machines appear in scenario contexts when linked to RFQ work.',
        p3:
          'Excel/CSV machine import and capacity data packs are available under Administration → Administrative settings. Machine types dictionary supplies default usage when creating machines.',
        stepsTitle: 'Flow',
        step1: 'Create a machine — pick a type from the Machine types dictionary.',
        step2: 'Set status, dimensions, machine usage (0.1–1), and optional OEE override.',
        step3: 'On the detail page, manage alternatives used by allocation and review operations.',
        step4: 'Optionally assign machines to nests (groups) so allocation can propose nest mates.',
        usageTitle: 'Machine usage',
        usage:
          'machine_usage is clamped between 0.1 and 1 (default 1). Effective availability = base availability / usage. Example: usage 0.5 doubles effective capacity and roughly halves load % for the same required time.',
        nestsTitle: 'Nests (machine groups)',
        nests:
          'Nests group machines for allocation candidate lists. Separately, operation nests_count (cavities) is the number of parts produced in one cycle and divides cycle time in the required-time formula — do not confuse the two.',
      },
      projects: {
        title: '7. Projects',
        p1:
          'A project groups customer parts with operations. Each part has yearly volumes (production and contractual), SOP/EOP (MM.YYYY), and operations (phase, machine, cycle, nests_count, % capacity, OPF, optional alternative cycle).',
        p2:
          'Project status (active / RFQ / inactive) affects calculator visibility rules. A part set can share one volume source. Notes (manual vs automatic) and file attachments document context.',
        p3:
          'With projects.create_rfq only, you can create and maintain RFQ projects. Full create/edit of active projects needs projects.edit. Opening details also accepts projects.details or create_rfq.',
        stepsTitle: 'Flow',
        step1: 'Create project (client, name, status).',
        step2: 'Add parts from the catalog or create identifiers; set SOP/EOP.',
        step3: 'Operations tab — route (machine + phase + cycle + nests); optional alternative cycle and “use in calculator”.',
        step4: 'Volumes tab — yearly / monthly / weekly views; manual year override vs default-all-years origin.',
        step5: 'Add manual notes; review automatic notes if generated.',
        step6: 'Upload attachments if the attachments storage path is configured; download requires admin_attachments.download.',
        volumesTitle: 'Volumes',
        volumes:
          'Production and contractual volumes are stored separately. Contractual header mode prefers contractual tables with fallback to production. Operation-level volume_by_year overrides project/part volumes for that year. Origin default_all_years vs manual_year changes how partial SOP/EOP years are treated.',
        attachmentsTitle: 'Attachments',
        attachments:
          'Files are stored under the path from Administrative settings (project attachments directory). Shared attachments can appear on multiple projects. Administration → Attachments lists all records, paths, and whether the file exists on disk. Downloading a project file needs admin_attachments.download — not call_offs.download.',
      },
      details: {
        title: '8. Parts (identifiers)',
        p1:
          'Global catalog under Parts / designations: SAP no., Alias, Free text (and related designation fields). Parts are shared across projects. Validation blocks duplicate identifiers.',
        p2:
          'Project / line columns help locate where a part is used. Deleting a part that still has operations requires choosing which operations to remove.',
        p3:
          'Permissions: designations.view / edit / delete / download. Catalog maintenance is also reachable from Database settings. Imports may update parts as part of a capacity data pack.',
      },
      scenarios: {
        title: '9. Scenarios',
        p1:
          'A scenario is an isolated snapshot for simulation without changing production. Create from production, another scenario, or a Call offs comparison.',
        p2:
          'In Scenarios mode, Calculator and History use the copy. Create new production catalog projects/parts after returning to Production version. You can add capacity projects into a scenario and change RFQ/active statuses inside the snapshot.',
        p3:
          'Apply to production requires a confirmation challenge phrase, a deploy token flow, and permissions — it moves selected scenario changes onto the live database. Archived scenarios are read-oriented.',
        p4:
          'Scenarios always use the Capacity working-days profile (not OCU), even if the header OCU toggle is on in production. Multi-select scenarios in Data visualization for side-by-side series.',
        stepsTitle: 'Scenario flow',
        step1: 'Scenario list — create (optionally from Call offs), open, archive.',
        step2: 'Edit the copy: statuses, volumes, operations, RFQ links.',
        step3: 'Check load in the scenario Calculator (header in Scenarios workspace).',
        step4: 'Compare with production / Call offs in Data visualization (multi-select scenarios).',
        step5: 'Optionally apply selected changes to production via the deploy/challenge confirmation.',
      },
      callOffs: {
        title: '10. Call offs (SAP)',
        p1:
          'A Call offs comparison loads a Sales Forecast Excel file and maps SAP items to parts/operations. Result: Call offs load vs production/contractual capacity on the Calculator and as chart series.',
        p2:
          'Matching: exact normalized sap_number first; otherwise truncated match (drop last 2 characters). Unmatched items go to a CSV report. The file date range limits Call offs years on charts. Comparisons can be archived (read-only, import disabled).',
        p3:
          'call_offs.view / edit / delete / download control the workspace. Downloading the original SAP file or unmatched CSV uses Call offs download permission — separate from project attachment downloads.',
        stepsTitle: 'Call offs flow',
        step1: 'Create a comparison (name + Excel) in the Call offs workspace.',
        step2: 'Review SAP matching stats (exact / truncated / unmatched) and download the unmatched CSV if needed.',
        step3: 'Open Calculator in Call offs mode — dual load cells (base + Call offs).',
        step4: 'In Data visualization pick the comparison(s) and enable Call offs series.',
        step5: 'Optionally create a scenario from the comparison for further what-if edits.',
        matchTitle: 'SAP matching',
        match:
          '1) Exact match on normalized SAP number. 2) Else truncated match (remove last 2 characters). 3) Else unmatched → CSV report. Imported quantities drive Call offs required time with the same cycle/nests/availability rules as capacity.',
        downloadTitle: 'Downloads',
        download:
          'Download source SAP file and unmatched report from the comparison page (call_offs.download). Project RFQ/document attachments use admin_attachments.download instead.',
      },
      dataViz: {
        title: '11. Data visualization',
        p1:
          'Load trends (%): lines and machines, or several objects on one comparison chart. Machine type and client filters narrow data like the Calculator. Charts combine production, contract, Call offs (multi-select) and scenarios (multi-select); PDF/Excel reports and Analytics show differences (Δ) between series.',
        p2:
          'Active calculation mode (Capacity / OCU) comes from the app header toggle — badge next to the page title. Scenarios always use Capacity settings. Line / multi-machine / plant aggregation = max of per-type average load % (same as the Calculator’s third summary row). A single machine uses its own %.',
        p3:
          'Dimension filters apply locally to loaded data. Export: PDF (current view or advanced) and Excel with trend tables and analytics (admin_data_viz permissions).',
        stepsTitle: 'Visualization flow',
        step1: 'Set years, machine status, type, client, RFQ, dimension filters.',
        step2: 'Choose series: contract / production / Call offs (multi) / scenarios (multi) + scenario contract/prod checkboxes.',
        step3: 'On Lines/Machines tabs select entities; optionally one combined chart or yearly bars (including Call offs).',
        step4: 'Set Flex (±% band around contractual series), load/free-capacity metric, Y-axis auto/fixed; export the report.',
        seriesTitle: 'Series sources',
        series:
          'Production and contract — live DB (or OCU profile when selected). Call offs — selected SAP comparisons (each as its own series). Scenarios — parallel series for each selected scenario (distinct colors).',
        aggTitle: 'Aggregation',
        agg:
          'For a machine group: average % within each type, then take the maximum. Charts show the “most loaded type” under the filter, not the sum of % or a flat average of all machines.',
        flexTitle: 'Flex',
        flex:
          'Flex (±%) draws a band around contractual series (including scenario contract). Production and Call offs have no Flex. Visually highlighted in the series bar — band width, not a separate data series.',
      },
      admin: {
        title: '12. Administration',
        p1:
          'Configuration, security, backup, import/export, attachments inventory, OCU Excel tool, and audit. In Scenarios/Call offs mode the hub shows a limited card list (history + this manual); full database/admin cards appear in Production version.',
        p2:
          'Each card is gated by its view permission. Destructive actions (restore, wipe, replace-all import) ask for typed confirmation phrases — follow on-screen prompts and take a backup first.',
        dbTitle: 'Database settings',
        db:
          'Working days for Capacity (and OCU when enabled): working days/year, shifts, shift minutes, startup/shutdown seconds, working weeks/year, OEE factor. Also phases, parts catalog entry points, and machine types (default usage).',
        visualTitle: 'Visual settings',
        visual:
          'Under Database settings → Visual: load threshold colors, sum/average row visibility, SOP/EOP/RFQ markers, contractual calculator frame color, Data visualization palette, workspace themes, reference/machine display modes, page size, period header colors.',
        admTitle: 'Administrative settings',
        adm:
          'App behavior (volumes autosave, enable OCU feature), automatic/manual backup, restore, Excel import/export (capacity input pack, machines template, full/partial bundle), storage paths, and database wipe with backup acknowledgement.',
        pathsTitle: 'Backup and attachments paths',
        paths:
          'Backup output directory and project attachments directory are configured separately (relative or absolute; writability check; optional server folder browser). Defaults are typically backups/ and attachments/. Changing paths does not move existing files automatically — plan migrations carefully.',
        importTitle: 'Excel import / export',
        import:
          'Input data pack: schema tag and _INSTRUKCJA sheet rules; append/update (default) or replace-all (deletes records not in file). Machines template import/export. Bundle export/import: full or partial (machines, projects, designations, parts). Confirm phrases are required for destructive imports. Prefer backup before replace-all or wipe.',
        ocuDataTitle: 'OCU data',
        ocuData:
          'Administration → OCU data: upload Transition table (.xlsx) and Katowice_Data (.xlsx/.xlsm). The tool unhides filtered rows, fills Input columns X, AB, AC, AD, AE from the transition table and Capacity DB, and downloads a ZIP (sources without filters + Katowice_Data_OCU). Needs admin_ocu.view to open and admin_ocu.edit to generate. Separate from the header Capacity/OCU calculation toggle.',
        attachAdminTitle: 'Attachments inventory',
        attachAdmin:
          'Administration → Attachments lists project files, shared badge, relative and full paths, size, author, and whether the file exists on disk. Storage root comes from Administrative settings. View = admin_attachments.view; file download = admin_attachments.download.',
        usersTitle: 'Users and permissions',
        users:
          'Accounts, password resets/approvals, roles, and the resource×action matrix. Guest role can allow login without password. Without permission a user will not see e.g. project edit, import, or OCU generate.',
        histTitle: 'Change history',
        hist:
          'Log of project, machine, and operation changes with filters and download. In a scenario — history of the scenario copy. Manual vs automatic entries. Available also in limited admin mode under Scenarios/Call offs.',
      },
      formulas: {
        title: '13. Calculation formulas',
        p1:
          'The capacity engine (server, capacityService) applies these on every Calculator / API recalculation. Allocation hints reuse the same weekly volume and required-time building blocks.',
        p2:
          'Profiles: Capacity vs OCU use separate working-days tables when OCU is enabled. Scenarios always use Capacity settings. Contractual header mode switches volume sources with fallback.',
        p3:
          'If effective availability ≤ 0 and required time > 0, load is shown as 100%. Values above 100% mean overload.',
        avail:
          'Base availability [s/week] = (working_days_year / 52) × shift_time_minutes × 60 × shifts_per_day × OEE − startup_shutdown_seconds (floored at 0). Shift time in settings is minutes (e.g. 450 = 7.5 h). Defaults when a year row is missing come from the Capacity or OCU template.',
        oee:
          'OEE resolution (resolveOee): operation override (or alt OEE when alternative cycle is used) → machine oee_override → year working-days oee_factor (default 0.85). Machine load % uses machine-level OEE (or settings) for the availability denominator; per-operation OEE feeds allocation ratio hints.',
        usage:
          'machine_usage is clamped to [0.1, 1] (default 1). effective_availability = base_availability / usage. Lower usage → higher effective capacity → lower load % for the same required seconds.',
        weekly:
          'Weekly volume: annual → volume_value / working_weeks_per_year (default 48); monthly → (volume_value × 12) / working_weeks_per_year; weekly → volume_value unchanged.',
        volPriority:
          'Volume source priority for a year: (1) operation_volume_by_year override, (2) project/part volumes (production or contractual per header toggle), (3) operation volume_value / volume_unit fields. Origin default_all_years vs manual_year affects SOP/EOP partial-year handling.',
        required:
          'Required time [s/week] = Σ over operations on the machine: weekly_volume × (cycle_time_seconds / max(1, nests_count)). nests_count = parts per cycle (cavities). If use_alternative_in_calculator is set and alt cycle > 0, use alt_cycle_time_seconds / alt_nests_count (alt nests fall back to base nests when empty).',
        load:
          'Machine load % = round( (Σ required_sec_per_week) / effective_availability × 100 ), with effective_availability = base_availability / usage. Not a flat average of unrelated percentages.',
        sop:
          'SOP/EOP format MM.YYYY. Outside the production window weekly volume is 0 unless include_in_calculator_after_eop / manual year rules apply. Year/month/week fractions scale volume during ramp-up and ramp-down.',
        period:
          'Expanding a year shows months then ISO weeks. Mid-year allocation can start from a month/week (effective_from) so earlier weeks stay on the source machine and later weeks move — weekly rate is not simply re-averaged across the whole year.',
        maxType:
          'Max average by type (Calculator footer + Data Viz aggregation) = max over types of (average load_% of machines of that type in the current filter).',
        isoWeek:
          'Expanded calendar weeks use ISO weeks (Monday–Sunday).',
        altCycle:
          'Alternative process: optional alt cycle, nests, OEE, comment. When “use alternative in calculator” is on, required time and OEE resolution use the alternative fields. Calculator cells may show an alternative border state (unused / all alt / mixed).',
        contractual:
          'Contractual mode reads contractual volume tables first; if missing for the year, falls back to production volumes. Flex bands in Data visualization apply only to contractual series.',
      },
      faq: {
        title: '14. FAQ — questions and answers',
        p1:
          'Short answers to common questions about buttons, create flows, meanings, calculations, permissions, downloads, backup paths, OCU data, and Excel import. For formulas detail see section 13.',
        q01: 'Where do I find this manual?',
        a01: 'Administration → User manual. It remains available in Production, Scenarios, and Call offs admin hubs.',
        q02: 'Why don’t I see Calculator / Machines / Projects in the menu?',
        a02: 'Your role lacks the corresponding *.view permission, or you are in a workspace where that nav item is not shown. Ask an administrator to adjust Roles & permissions.',
        q03: 'How do I log in as guest?',
        a03: 'If a role allows guest login, the login screen shows “Continue as guest”. Access follows that role’s matrix (often read-only).',
        q04: 'How do I reset a forgotten password?',
        a04: 'Use Forgot password on the login screen. Reset depends on email configuration; administrators can also manage recovery on Users and permissions.',
        q05: 'What does the contractual volumes toggle do?',
        a05: 'It switches the Calculator and related views to contractual yearly volumes. Missing contractual data falls back to production volumes. A colored frame appears around the calculator.',
        q06: 'Capacity vs OCU in the header — what changes?',
        a06: 'Only the working-days / OEE profile used for availability. Formulas stay the same. Scenarios ignore OCU and always use Capacity. Enabling the feature is done in Administrative settings.',
        q07: 'Is “OCU data” the same as the OCU toggle?',
        a07: 'No. OCU data is an admin Excel tool (Transition + Katowice_Data → ZIP). The header toggle only switches calculation settings profiles.',
        q08: 'How do I create a machine?',
        a08: 'Machines → add machine, choose a type from the dictionary, set numbers, status, usage, dimensions. Import is under Administrative settings.',
        q09: 'What is machine usage?',
        a09: 'A factor 0.1–1. Effective availability = base / usage. Usage 0.5 ≈ twice the capacity → about half the load %.',
        q10: 'What is nests_count on an operation?',
        a10: 'Number of parts produced in one cycle. Required time uses cycle / nests. Separate from machine nest groups used for allocation candidates.',
        q11: 'How do I create a project?',
        a11: 'Projects → create (client, name, status). Add parts, operations, volumes, SOP/EOP. RFQ-only users can create status RFQ without full projects.edit.',
        q12: 'What do SOP and EOP mean?',
        a12: 'Start and end of production (MM.YYYY). Outside the window volume is zero unless after-EOP inclusion / manual year rules apply.',
        q13: 'Why is load 0% for a year that has a volume?',
        a13: 'Check SOP/EOP window, project/machine status filters, volume origin, contractual fallback, and whether the operation is assigned to a machine visible in filters.',
        q14: 'Why is load over 100%?',
        a14: 'Required weekly seconds exceed effective availability. Reduce volume, improve cycle/nests, add capacity (machines/shifts/OEE), or allocate volume elsewhere.',
        q15: 'How is load % calculated?',
        a15: 'round(required / effective_availability × 100), effective_availability = base_availability / machine_usage. See section 13.',
        q16: 'Does Sum of loads mean plant utilization?',
        a16: 'No. Sum adds machine percentages and can exceed 100%. For “worst type” use Max average by type — the same idea as Data Viz line aggregation.',
        q17: 'How do I open allocation?',
        a17: 'In the Calculator, click a load cell (when edit permissions allow). Pick a detail/operation, target machine, transfer mode, years/period, then Execute.',
        q18: 'What are allocation transfer modes?',
        a18: 'Full volume, manual volume entry, or target remaining load % on the source machine. Optional period from month/week and cycle override on the target.',
        q19: 'What are machine alternatives?',
        a19: 'Saved alternative machines on the machine detail / allocation UI. Candidates also come from the nest. Used when choosing where to move volume.',
        q20: 'How do I create a scenario?',
        a20: 'Open Scenarios workspace → create from production, another scenario, or Call offs. Then switch the header to that scenario to calculate on the copy.',
        q21: 'Does editing a scenario change production?',
        a21: 'Not until you explicitly apply/deploy to production with the confirmation challenge. Until then only the snapshot changes.',
        q22: 'How do I apply a scenario to production?',
        a22: 'Use the scenario deploy flow, enter the challenge phrase, select projects/parts to apply, and confirm. Requires appropriate scenario/production permissions.',
        q23: 'How do I create a Call offs comparison?',
        a23: 'Call offs → create comparison, upload Sales Forecast Excel, review match stats, then open Calculator in Call offs mode.',
        q24: 'How does SAP matching work?',
        a24: 'Exact normalized SAP first; else truncate last 2 characters; else unmatched CSV. See Call offs section.',
        q25: 'Why are Call offs years empty on the chart?',
        a25: 'The imported file’s date coverage does not include those years, or no comparison/series is selected in Data visualization.',
        q26: 'Dual numbers in a Calculator cell — what are they?',
        a26: 'In Call offs mode: base capacity load and Call offs load for the same machine/period.',
        q27: 'How do I export a PDF or Excel from the Calculator?',
        a27: 'Use the export controls on the Calculator toolbar (filtered or selected machines). Needs calculator.download when enforced.',
        q28: 'How do Data visualization series work?',
        a28: 'Enable production, contract, one or more Call offs, and/or scenarios. Colors follow Visual settings. Analytics can show Δ between series.',
        q29: 'What does Flex mean on charts?',
        a29: 'A ±% band around contractual series only (including scenario contract). Not applied to production or Call offs.',
        q30: 'Where are working days and OEE configured?',
        a30: 'Administration → Database settings → Working days (Capacity and, if enabled, OCU) per year, plus default templates.',
        q31: 'Where do I change threshold colors?',
        a31: 'Database settings → Visual settings.',
        q32: 'How do I back up the database?',
        a32: 'Administrative settings: enable automatic backup and/or create a manual backup. Set backup_output_dir and verify it is writable.',
        q33: 'Backup path vs attachments path?',
        a33: 'Two separate settings. Backup stores DB snapshots; attachments stores project files. Moving one path does not move the other.',
        q34: 'How do I restore a backup?',
        a34: 'Administrative settings → choose a backup file / path → restore with confirmation. Take a fresh backup before restore if unsure.',
        q35: 'How do I import Excel capacity data?',
        a35: 'Administrative settings → input data import. Prefer append/update first. Replace-all deletes records not in the file and requires confirmation. Check schema tag / _INSTRUKCJA.',
        q36: 'What is bundle import?',
        a36: 'Export/import of a pack of machines, projects, designations, and parts — full or partial selection — under Administrative settings.',
        q37: 'How do I import only machines?',
        a37: 'Use the machines template import on Administrative settings (Excel/CSV columns documented in the UI help).',
        q38: 'What does wipe/clear database do?',
        a38: 'Deletes application data after confirmations; optional backup acknowledgement. Irreversible without a prior backup file.',
        q39: 'How do I generate OCU data ZIP?',
        a39: 'Administration → OCU data → select Transition table and Katowice_Data → Generate (needs admin_ocu.edit). Download ZIP with filled Input columns X/AB/AC/AD/AE.',
        q40: 'Why can’t I download a project attachment?',
        a40: 'Your role needs admin_attachments.download. View-only inventory is not enough. Also check that the file exists on the configured storage path.',
        q41: 'Attachments download vs Call offs download?',
        a41: 'Project files: admin_attachments.download. Call offs SAP source / unmatched CSV: call_offs.download. They are independent permissions.',
        q42: 'Who can create RFQ projects only?',
        a42: 'Users with projects.create_rfq but without projects.edit. They cannot fully edit non-RFQ production projects.',
        q43: 'Where is Change history?',
        a43: 'Administration → Change history. In scenario mode it shows the scenario copy’s history.',
        q44: 'Why don’t admin cards appear in scenario mode?',
        a44: 'By design the hub is limited (history + manual). Switch header back to Production version for Database/Administrative/OCU/Attachments/Users cards.',
        q45: 'Dimension filters do nothing — why?',
        a45: 'Machines need width/depth/height/stroke filled. Filters apply client-side to the already loaded calculator/viz payload.',
        q46: 'Alternative cycle not used in load — why?',
        a46: 'Set a positive alt cycle and enable “use alternative in calculator” on the operation. Otherwise the base cycle is used.',
        q47: 'ISO week — which days?',
        a47: 'Monday–Sunday (ISO). Shown when you expand years to weeks in the Calculator.',
        q48: 'Where are formulas documented for engineers?',
        a48: 'Section 13 of this manual matches server capacityService logic; server/CAPACITY_LOGIC.md is a short companion for developers.',
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
