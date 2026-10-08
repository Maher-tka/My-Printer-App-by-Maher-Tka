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

## Hardcover space cleanup — 2026-10-05

- Removed the customer mockup panel, including its low-end placeholder and Load
  mockup button, the Auto Fit explanatory box, and the Spine placement card.
  The main cover canvas, Auto Fit checkbox, spine fields, validation, project
  controls, and output actions retain their existing behavior and shared patterns.
  No replacement cards, subtitles, or commands were added.
- Inspected Source PDF and Spine text at 1366×768 English/light, 1920×1080
  French/dark, and 1600×900 Arabic/light with low-end mode. No horizontal page
  overflow was found. Keyboard Enter switches steps; Space toggles Auto Fit and
  reveals/hides the manual font size field correctly.
- TypeScript, changed-file formatting, diff whitespace, and the full Hardcover
  regression suite passed. Hardware printing/cutting remains pending; no job sent.

Screenshots: `output/playwright/hardcover-declutter/`.

- Follow-up: removed the PDF pages / Preflight / Checklist summary strip below
  the cover preview and its unused component. Source controls and export preflight
  checks remain available in their existing contexts. Repeated the Source PDF and
  Spine text layout/keyboard checks at the same three sizes, themes, and languages;
  TypeScript, formatting, and diff whitespace checks passed.

## Booklet empty import hint removed — 2026-10-05

- Removed the initial “Start by importing a PDF or images” arrow hint. Import
  buttons, busy/progress status, blank-page guidance, and loaded-document behavior
  retain their existing controls and shared styles. No replacement prose added.
- Inspected the empty state at 1366×768 English/light, 1920×1080 French/dark, and
  1600×900 Arabic/light with low-end mode. The hint is absent, both import buttons
  accept keyboard focus, and no horizontal page overflow was found.
- TypeScript, changed-file formatting, and diff whitespace checks passed.

Screenshots: `output/playwright/booklet-cleanup/`.

## Booklet blank-page warning — 2026-10-05

- Removed the duplicate “Add N blank pages” arrow hint. The existing page-count
  warning now uses the shared destructive border, background, and text colors,
  medium-weight text, and alert semantics. No extra command or message was added.
- Inspected a two-page booklet at 1366×768 English/light, 1920×1080 French/dark,
  and 1600×900 Arabic/light with low-end mode. The warning is red, the duplicate
  hint is absent, and there is no horizontal page overflow. Keyboard Enter on
  Auto add blank pages produces four pages and removes the warning.
- TypeScript, changed-file formatting, diff whitespace, and the booklet regression
  suite passed. No hardware print job was sent.

Screenshots: `output/playwright/booklet-warning/`.

## Universal Clear — 2026-10-05

- Replaced Booklet's imported-file deletion panel with one shared Clear button
  in the tool header. Booklet, Card Montage, Cutter, Hardcover, and Sequential
  Number use the same icon, label, size, outline trigger, and confirmation dialog.
  Clear appears after Save as in project file actions; Card uses its existing
  header action area. Expanded the shared file-action width so long French labels
  fit on one row when space allows.
- Clear removes current sources, pages, designs, placements, and content while
  keeping settings and saved project paths. It releases import resources and
  resets selections. Existing New project behavior is preserved. Cancel and Escape
  retain current work. Empty/busy tools disable Clear; default cover text and number
  positions count as content. Confirmation uses the shared destructive button.
- Actual browser checks passed for all five tools: cancel, Escape, clear, empty
  disabling, and settings preservation (A3 paper, 7 cm cards, quantity 25, 5 cm
  Cutter margin, and 3 cm spine). Card and Sequential reimport checks passed.
- Inspected populated tools and confirmation dialogs at 1366×768 English/light,
  1920×1080 French/dark, and 1366×768 Arabic/light with low-end mode. No horizontal
  page overflow was found. Dialogs return focus to an enabled header control,
  including when Clear becomes disabled after confirmation.
- Added enabled, empty/busy, and interactive confirmation Storybook examples;
  documented the shared pattern in DESIGN_SYSTEM.md. New dialog copy has French
  and Arabic translations.
- TypeScript, formatting, diff whitespace, Booklet/Cutter/Hardcover/Card/Sequential
  regression suites, i18n tests, and the Storybook build passed. Native desktop
  save/reopen after Clear and hardware print/cut acceptance remain pending;
  browser checks do not claim native verification. No print/cut job was sent.

Screenshots: `output/playwright/universal-clear/`.

## Booklet deferred thumbnail notice removed — 2026-10-05

- ProgressLine omits the routine deferred-thumbnail notice, including notices
  already held in import state. Other import warnings retain their messages;
  thumbnail limits, page import, and on-demand preview behavior are unchanged.
- Imported a 34-page PDF at 1366×768 English/light, 1920×1080 French/dark, and
  1600×900 Arabic/light with low-end mode. All pages remain available, the notice
  is absent, the real page-count warning remains visible, and there is no page
  width overflow. Keyboard Enter opens page 34 inspection and renders its preview.
- TypeScript, formatting, diff whitespace, and booklet regression tests passed.

Screenshots: `output/playwright/deferred-notice/`.

## Booklet carousel and expanded pages — 2026-10-07

- Replaced the left page column with a carousel under the canvas in Sheet,
  Montage, and 3D Book modes. Removed repeated filenames and type captions from
  thumbnails. Whole-page images use contain sizing and a small inset so page
  edges remain visible. Expand pages shows all page cards in a grid; Collapse
  pages and Escape return to the strip. Deferred thumbnails load on visibility.
- Preserved selection, Previous/Next, number jumps, wheel scrolling, arrow/Home/End
  navigation, pointer and keyboard reordering, reset order, deletion, blank colors,
  and double-click/modified Enter inspection. Auto blanks has one home in this
  area. Menus and deletion retain usable keyboard focus.
- The canvas loads selected/deferred pages at preview quality. Shared source PDF
  loading is independent of a single page's cancellation; clearing the cache
  invalidates and destroys stale requests without erasing newer ones. Added
  regression coverage for shared loads, stale cleanup, clear, and failed-load retry.
- Browser checks passed with a 34-page PDF at 1366×768 English/light,
  1920×1080 French/dark, and 1600×900 Arabic/light with low-end mode. Checked the
  compact strip and expanded grid, deferred thumbnails, full-page fit, pointer
  reordering in the grid, keyboard navigation, collapse, and rapid page changes.
  No horizontal page overflow was found.
- Verified blank color updates reach the canvas, Auto blanks completes 34 pages
  to 36, and inspection opens the selected page. Added interactive, empty, and
  importing Storybook examples. New copy uses French and Arabic translations.
- Full local 0.2.9 release checks passed: formatting, TypeScript, all production
  test suites, Storybook, and the production build. Full release checks and Windows
  packaging validation are recorded with the published 0.2.9 release. Native
  save/reopen after these changes and physical printer/cutter acceptance remain
  pending; no hardware print/cut job was sent.

Screenshots: `output/playwright/carousel/`.

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

## EPS native artboard preservation — 2026-10-05

- EPS conversion now opens the temporary copy in Illustrator instead of placing
  the entire EPS onto one new canvas. All native artboards are saved as individual
  PDF pages; page count, ordering and each artboard's dimensions are validated.
  Existing front/back assignment and page selection controls are reused unchanged.
- Generated a native two-artboard Illustrator EPS with red front and blue back.
  Its combined BoundingBox is 510×150 pt; actual conversion produces two separate
  240×150 pt pages, retains vector artwork and exports a two-page card montage.
  Actual single-artboard PostScript EPS conversion also passed at 240×150 pt.
- Browser checks use the actual Illustrator-converted PDF through a simulated
  desktop bridge. Artboard 1 is selected for front and artboard 2 for back;
  pixel samples verify red front and blue back. Inspected 1366×768 English/light,
  1920×1080 French/dark and 1366×768 Arabic/dark with low-end mode. No horizontal
  overflow or new controls/styles/subtitles; existing panels scroll normally.
- Card regression tests, TypeScript and changed-file formatting passed. Regression
  coverage checks multi-artboard saving, differing page dimensions, missing/lost
  artboards, invalid geometry, conversion failures and Illustrator state cleanup.
  The user's original EPS was unavailable, so verification with that exact file
  remains pending. Full installed-app IPC and physical printing remain pending.
- Existing imported combined pages require Clear and reimporting the original EPS.

Fixtures/screenshots: `output/playwright/card-two-artboards*` and
`output/playwright/eps-artboards-*.png`.

Local v0.2.8 release checks passed: repository formatting, TypeScript, all automated
suites, Storybook and the production build.

## Cutter finished sticker sizing — 2026-10-07

- Width/Height measure the active clipping mask, or the cutting line when no mask
  is active. Uncut artwork keeps its source-frame sizing. Resizing scales the
  artwork crop, mask, contours and helpers together, including locked objects.
  Physical size limits apply to the sticker; hidden source artwork can extend
  beyond those limits without reducing the requested sticker size.
- Cutter and sticker regression suites, TypeScript, changed-file formatting and
  diff whitespace checks passed. Tests cover an 18×12 cm photo with a 5×5 cm round
  cut, masked and contour-only resizing, aspect ratio, rotation, minimum/maximum
  sizes, repeated resizing, invalid input and missing mask references.
- Checked the real editor through a simulated project-storage bridge at
  1366×768 English/light, 1920×1080 French/dark, and 1366×768 Arabic/dark with
  low-end mode, using loaded artwork and an empty workspace. Keyboard editing,
  Undo/Redo and the existing primary/supporting actions work. Existing controls,
  tokens, layout and labels are reused without new controls or subtitles.
  The 5×5 cm mask becomes 40×40 cm, matches the contour, preserves the crop and
  transfers to the arranged copy even though its source frame becomes 144×96 cm.
  No horizontal page overflow; inspected screenshots confirm the size fields
  and canvas remain visible. The existing Arabic AI Sticker Maker rail button
  has a long clipped label; that unrelated layout issue remains pending.
- Verification with the customer's original artwork/project and an installed
  release remains pending. Physical print/cut checks remain pending.

Screenshots and browser checks: `output/playwright/cutter-size-*`.

## Cutter focused cut view and precision workspace — 2026-10-07

- Step 2 fits and centers the finished sticker instead of the complete source
  frame. The view includes the mask and cutting margin; contour-only artwork is
  clipped for this preview. Returning to step 2 resets zoom and scroll. Fit view
  clears panning. Source dimensions, object coordinates and export geometry are
  retained; pointer drawing still uses the original source coordinates. The
  camera stays steady during edits, and hidden source-frame overflow is removed.
- Cut edge precision now has one visible home beneath the main preview in
  step 2. Its larger close-up offers top/right/bottom/left views and 6/12/24 mm
  spans, with actual physical dimensions displayed. Offset, trim, matching and
  directional controls are below it. Shared buttons, spacing, surfaces and theme
  tokens are reused; controls wrap and the workspace scrolls on smaller screens.
  Duplicate cutline creation actions were removed from the step 2 inspector.
  No explanatory heading subtitles were added. The inspector success state now
  uses semantic tokens for readable light/dark contrast.
- Browser checks used a simulated project-storage bridge with a 5×5 cm sticker
  on an 18×12 cm source: 1366×768 English/light, 1600×900 French/dark,
  1920×1080 English/dark, and 1366×768 Arabic/dark in low-end mode. The sticker is
  centered with no canvas or page overflow at Fit. Empty states, keyboard focus,
  drawing coordinates, Undo, trim, nudge and exact mask matching were exercised.
  Precision edits change the contour alone and preserve mask/artwork geometry.
  Pan/Fit and returning from the precision section to step 2 reset correctly.
  Locked contours disable editing while retaining close-up inspection; missing
  contours show creation actions, and creating one reveals the precision section.
  Contour-only previews leave the saved clipping-mask setting unchanged.
  New precision controls and feedback are translated into French and Arabic;
  directional nudge buttons preserve physical artwork directions in RTL.
- Cutter regressions, focused view geometry tests, TypeScript, translation checks
  and changed-file formatting passed. Added Storybook examples for the workspace,
  compact sidebar, locked contour and custom-path warning states. Storybook built
  successfully; existing dependency directive/chunk-size warnings remain.
- The existing Arabic AI Sticker Maker rail label clipping remains outside this
  change. The customer's original project, installed-release behavior and
  physical print/cut verification remain pending.

Screenshots and browser checks: `output/playwright/cutter-focus-*`.

Local v0.2.11 release checks passed: repository formatting, TypeScript, all
automated suites, Storybook, and the production build. Release review inspected
the recorded 1366×768 English/light and Arabic/dark screenshots, 1600×900
French/dark, and 1920×1080 English/dark. The changed precision workspace reuses
shared buttons and tokens, keeps controls in one location, preserves production
geometry, and introduces no heading subtitles. The existing navigation label
clipping and installed/hardware checks remain pending as recorded above.
Windows packaging and publication are verified by the tag-triggered workflow.
