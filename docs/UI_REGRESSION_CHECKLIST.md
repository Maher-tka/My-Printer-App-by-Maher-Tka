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
