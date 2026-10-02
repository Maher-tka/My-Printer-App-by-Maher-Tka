# UI regression checklist

This is a verification ledger. Pending means not yet verified; it is not a claim of success. Production logic is not being rewritten. Baseline is the existing working feature and existing automated coverage, not a newly invented feature.

| Module           | Existing features protected                                                                                                                                        | Before                                                        | After / validation                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------- |
| Shell            | Hash routes, paid tool access, Ctrl+K, import handoff, account menu, unsaved session checks                                                                        | Existing implementation inspected                             | Pending visual/keyboard QA                   |
| Dashboard        | Local recent projects, PDF/artwork import, jobs, real export history                                                                                               | Existing handlers inspected                                   | Pending QA                                   |
| Booklet          | PDF/images, reorder/blank/delete pages, sheet modes, custom paper/orientation, RTL/scale/creep, front/back, 3D preview, project save, preflight, PDF/JPG/PNG/print | Hook and UI boundaries inspected; existing test:booklet suite | Pending regression/visual QA                 |
| Hardcover        | Source import, dimensions/spine, design/text, batch, cover preview/mockup, quotes, preflight and export                                                            | Existing implementation and test:hardcover suite              | Pending regression/visual QA                 |
| QR               | Hardcover back-cover text/URL control                                                                                                                              | Present in BackCoverEditor; no standalone route               | Pending visual QA; no fake standalone module |
| Sticker/Cutter   | Library/import, artwork editor, print/cutline/marks visibility/locks, contours/background removal, transformations/duplicate                                       | Existing implementation and test:cutter/test:sticker suites   | Pending regression/visual QA                 |
| Big Sheet/Mimaki | Bounded large-sheet canvas, nesting/alignment, dimensions, registration/crop marks, layers, EPS/PDF/FineCut output                                                 | Existing cutter workflow and geometry/export tests            | Pending regression/visual QA                 |
| Sequential       | Design, ranges/prefix/suffix, number position, quantity, cut-stack and backs, save/print/PDF                                                                       | Existing implementation and test:sequential suite             | Pending regression/visual QA                 |
| Jobs             | Board/list/calendar, customer data, quotes/deposit, search, unsaved job switch prompt                                                                              | Existing test:jobs coverage                                   | Pending tests and QA                         |
| Settings         | Performance preset, backups/restoration, updates, license, diagnostics                                                                                             | Existing handlers inspected                                   | Pending visual QA                            |
| Dialogs          | Keyboard, focus, confirmation, preflight, import/export progress/cancel                                                                                            | Existing Radix/custom dialogs                                 | Pending QA                                   |

## Required desktop visual passes

| Pass                                      | Shell/Home | Booklet | Cutter/Mimaki | Hardcover/Sequential/Settings |
| ----------------------------------------- | ---------- | ------- | ------------- | ----------------------------- |
| 1: structure and surface hierarchy        | Pending    | Pending | Pending       | Pending                       |
| 2: density, contrast, alignment, overflow | Pending    | Pending | Pending       | Pending                       |
| 3: keyboard/focus and final sizes         | Pending    | Pending | Pending       | Pending                       |

Desktop targets: 1920×1080 and 1366×768. Also consider 1600×900. Inspect real scroll containers, enabled actions, print canvas visibility, readable labels, and output preview accuracy.

## Checks

- TypeScript and production build: pending.
- Automated production suites: pending.
- Formatting and diff whitespace: pending.
- Native printer hardware execution: requires connected printer; do not send an unsolicited print job.
- Performance: inspect computed no-blur/no-animation low-end styling; preserve render queues and memory bounds. No claim of hardware benchmarking without measurements.
- Figma editable system: in progress.
- Lovable: installed but connection returns USER_NOT_LOGGED_IN; no remote prototype replaces the app.
