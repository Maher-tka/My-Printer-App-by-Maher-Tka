# UI regression checklist

Future UI changes must follow [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), including its button hierarchy, action grouping, subtitle policy, and acceptance checklist. Record verification for each change; the historical entries below remain pending until actually checked.

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

## Card Montage cutting rectangle — 2026-10-04

Scoped change: one optional 0.25 px rectangle checkbox in auto-mode Setup, an
independent color picker with black default/non-white fallback, and shared settings
tabs following the app's LTR/RTL direction. No duplicate outline control in Advanced.

- Checked empty state and a representative white-card PDF at 1366×768.
- Checked white-card controls at 1366×768 (English/light and Arabic/dark),
  1920×1080 (French/dark), and 1600×900 (Arabic/light).
- Arabic passes used low-end mode. Labels, color control, scrolling, paper preview,
  and page width were inspected; no horizontal page overflow was found.
- Keyboard Space toggles the checkbox; Tab reaches the enabled color picker.
  Pure white selections resolve to black; preview and export use matching color.
- New strings have French/Arabic translations. Hex values and artwork remain LTR.
- Reused existing Setup/Advanced tabs and shared tokens; checkbox has one home,
  introduces no primary command or explanatory subtitle, and exposes disabled state.
- Added `SettingsDirections` Storybook example for shared tabs with enabled and
  disabled controls in LTR/RTL.
- Card layout/PDF tests, TypeScript, production build, and Storybook build passed.
  Full-screen RTL visual checks for other shared-tab consumers (Booklet, Cutter,
  Hardcover, Sequential Number) remain pending; the Card screen and generic shared
  tab direction examples were verified.
- Native hardware printing and
  physical low-end PC performance benchmarks remain pending; no print job was sent.

Screenshots: `output/playwright/card-montage/outline-final-*.png` and
`outline-1366-empty.png`. This entry does not mark unrelated historical checks complete.

## Shared PDF/artboard selector — 2026-10-04

- Card Montage and Hardcover now use one shared selector: thumbnails, selected
  indication, Previous/Next, number jump, and incremental thumbnail loading.
- Verified independent front artboard 3/back artboard 4 selection on a four-artboard
  PDF-compatible AI fixture at 1366×768/light. Browser export contained exactly two
  A4 pages with designs 3 and 4, ten impressions per selected side.
- Verified Previous/Next and invalid number reset; preserved card dimensions and
  embedded font programs in regression tests.
- Verified ten-page PDF in Arabic/RTL, 1600×900/light, low-end mode: three initial
  thumbnails, direct jump to page 9, batch loading to seven thumbnails shared with
  back source, front selection 9/back selection 2 unchanged.
- Verified French/dark at 1920×1080 with keyboard Enter selecting thumbnail 3.
  No accidental horizontal page overflow in the inspected Card layouts.
- Verified Hardcover front selector chooses page 3 from four-page source in the
  browser; Hardcover import, calculations, source, export, and drop tests passed.
- Added enabled/progressive and disabled shared-selector Storybook examples.
  Production and Storybook builds passed.
- Full-screen Arabic/low-end Hardcover visual pass and physical hardware printing
  remain pending. Existing unrelated ledger entries retain their previous status.

Screenshots: `artboard-selector-1366-selected.png`, `selector-1920-dark-fr.png`,
`selector-1600-rtl-low-end.png`, and `hardcover-shared-selector.png` under
`output/playwright/card-montage/`.

## Hardcover workflow prompts removed — 2026-10-05

- Removed the requested “No PDF yet” badge, drag/drop explanation, and initial
  upload warning from the Source PDF panel.
- Retained the shared Import PDF and optional Import back PDF buttons, their
  existing hierarchy, drop handlers, loaded-source information, and import errors.
  No new controls, subtitles, styling, or production behavior were introduced.
- TypeScript, component formatting, and component diff whitespace checks passed.
- Browser checks passed across all four steps at 1366×768 (English/light),
  1920×1080 (French/dark), and 1600×900 (Arabic/light, low-end mode). Inspected
  screenshots and checked page width; no horizontal page overflow was found.
  Keyboard Enter switches steps with visible focus. The preview, import controls,
  and production validation remain available; footer hint cards are absent.
- Removed the footer hint cards and “Next” buttons from every workflow step:
  Source PDF, Book measurements, Spine text, and Export. All steps remain
  accessible through the existing workflow navigation.
  TypeScript, page formatting, and diff whitespace checks passed. Full release
  checks for 0.2.6 passed: formatting, TypeScript, all tests, Storybook, and production
  build. No hardware print job was sent; physical printer/cutter acceptance remains
  pending. Other historical pending checks retain their existing status.

Screenshots: `output/playwright/release-0.2.6/`.

## Cutter masking canvas wheel zoom — 2026-10-05

- Ctrl + scroll zooms the shared Prepare artwork / Cut lines canvas within the
  existing 45–250% limits. Zoom anchors to the cursor where scrolling permits;
  unmodified wheel events retain normal scrolling. The native non-passive wheel
  listener prevents browser zoom locally and is removed on unmount.
- In-progress pointer drawing, dragging, and panning retain their original scale.
  Zoom changes only editor view state; it creates no artwork undo entry.
  Existing zoom controls remain in their shared toolbar; the existing translated
  shortcut is listed inside Keyboard shortcuts. No new command or subtitle added.
- Browser checks passed for zoom in/out, both limits, cursor anchoring, normal
  scrolling, Fit, keyboard zoom, expanded canvas, and both editing steps. Drew and
  applied a rectangle mask after zooming; checked that Ctrl + scroll during the
  drawing did not change its scale.
- Inspected 1366×768 English/light, 1920×1080 French/dark, and 1366×768 Arabic/light
  with low-end mode. No horizontal page overflow was found.
- TypeScript, changed-file formatting, diff whitespace, and the full cutter
  regression suite passed. Hardware printing/cutting remains pending; no job sent.

Screenshots: `output/playwright/cutter-wheel/`.

## Card Montage EPS import — 2026-10-05

- Existing front/back file pickers and drop areas now accept EPS alongside AI,
  PDF, PNG and JPG. Reused existing shared controls, busy state and error area;
  no new primary action, duplicate command, heading subtitle or styling system.
- Windows imports use installed Adobe Illustrator to embed EPS on a page sized
  from its BoundingBox/HiResBoundingBox. The stored project contains converted
  PDF bytes with the original EPS filename; reopening/exporting needs no further
  Illustrator conversion. Fonts must be installed or outlined and images embedded.
- Actual Illustrator conversion of representative front/back EPS files and a
  two-page montage export passed, including original page-dimension verification.
  Automated tests cover text/binary headers, invalid/oversized input, bounding
  boxes, converter errors, Illustrator cleanup, project roundtrip and vector export.
- Browser file selection, back-side drag/drop, keyboard Tab access and the
  browser-only import error were checked. Browser success checks used the real
  converted PDFs through a stubbed desktop bridge; full desktop IPC and installed
  release checks remain pending.
- Inspected the empty state at 1366×768 and loaded artwork at 1366×768
  English/light, 1920×1080 French/dark, 1366×768 Arabic/dark and 1920×1080
  Arabic/light. Arabic passes used low-end mode. No horizontal page overflow;
  new format, EPS status, help and error text has French/Arabic translations.
- TypeScript, production build, Card regression tests, translation tests,
  changed-file formatting and diff whitespace passed. No hardware print job sent;
  physical printing and workshop released-build acceptance remain pending.

Screenshots and native conversion fixtures: `output/playwright/card-eps-*`.

## Card Montage zero-spacing cutting lines — 2026-10-05

- Zero spacing uses continuous vertical/horizontal guides through every card
  boundary and outer trim edge, extending across the full A4 page. Shared
  boundaries are drawn once. Preview, PDF and printing share the same geometry,
  existing 0.25 px stroke, color setting and enable/disable control.
- Spaced-mode corner crosses and auto-mode optional outlines retain their behavior.
  Reused existing Advanced controls; updated their zero-mode labels in English,
  French and Arabic. No additional command, subtitle or styling system added.
- Regression tests verify full-sheet endpoints, all boundaries, fractional card
  dimensions, single-card layouts, both A4 orientations and disabled guides.
  PDF stream checks verify exact line placement and thickness on front/back pages.
- Inspected empty and loaded previews, 1366×768 English/light, 1920×1080
  French/dark and 1366×768 Arabic/dark with low-end mode. No horizontal page
  overflow; the long French label wraps within its panel. Keyboard Space toggles
  guides; Tab reaches the color input and disabling guides disables that input.
- TypeScript, Card regression tests, translation tests, changed-file formatting
  and diff whitespace passed. Physical printing/cutting remains pending; no
  hardware job was sent.

Screenshots: `output/playwright/card-lines-*`.

## Card Montage front-only cutting lines and Clear — 2026-10-05

- Zero-spacing sheet cutting lines appear on the front only in previews,
  exported PDFs and front/back/both print preparation. Back-only printing also
  omits them. Artwork placement, sheet dimensions, spaced-mode crop crosses and
  auto-mode optional rectangles retain their behavior.
- Renamed the existing file-clearing command from New project to Clear, using
  the shared ActionButton reset icon, ghost variant and existing translations.
  Clear removes loaded front/back artwork, resets preview/print selection and
  messages, and preserves montage settings. It is disabled while busy or empty.
  No new command duplication, primary action, heading subtitle or styling system.
- Inspected loaded sources, Clear focus, Advanced controls and both previews at
  1366×768 English/light, 1920×1080 French/dark and 1366×768 Arabic/dark with
  low-end mode. No horizontal page overflow; labels wrap without clipping.
  Keyboard Tab shows the shared focus ring and Enter clears both sources;
  empty-state, disabled Clear, preview zoom reset and retained mode were checked.
- TypeScript, Card regression tests, translation tests, changed-file formatting
  and diff whitespace passed. Tests check front/back PDF strokes and all three
  print-side selections in both sheet orientations. Physical printing/cutting
  and packaged desktop checks remain pending; no hardware job was sent.

Screenshots: `output/playwright/card-front-only-*.png` and
`output/playwright/card-clear-empty-1366.png`.

## Startup updates before workspace — 2026-10-05

- Installed Setup builds hold workspace mounting during the launch update check,
  download and installation. Available stable updates install silently and
  relaunch before work begins. Browser, development and portable builds bypass
  the automatic startup update. Existing background checks retain project-save
  protection and do not take over an open workspace.
- Startup checks have a 15-second deadline; downloads have a 10-minute deadline.
  Offline/check/download/installer failures release the workspace. A download
  completing after the deadline cannot automatically restart current work.
  State subscriptions ignore stale initial snapshots after receiving an event.
- Reused shared surface/color/radius tokens, translated status text and accessible
  progress semantics. No commands, heading subtitles, animation or new primary
  action were introduced. Storybook covers checking, downloading and installing.
- Browser checks with a simulated desktop update bridge exercised all three
  startup states, workspace release on error and background update behavior at
  1366×768 English/light, 1920×1080 French/dark and 1600×900 Arabic/dark with
  low-end mode. Screenshots inspected; no horizontal overflow or clipping.
  Progress exposes its actual percentage; no keyboard-only action is required.
- Updater regression tests and TypeScript passed. Tests exercise startup silent
  install/relaunch, deadlines, canceled/failed installation, late downloads,
  recurring checks, retries, duplicate installation and unsaved-work protection.
  A real subscriber-to-newer-version startup installation remains pending until
  a subsequent stable release exists. No hardware print/cut job was sent.

Screenshots: `output/playwright/startup-update-*.png`.

Local v0.2.7 release checks passed: repository formatting, TypeScript, all automated
suites, Storybook and the production build. Windows packaging and publication are
verified separately by the tag-triggered release workflow.
