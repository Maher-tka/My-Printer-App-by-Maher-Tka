# Performance audit — 2026-10-24

Local improvements for startup, card export, Cutter Montage and native Fast Print.
Changes are included in v0.2.25. Existing sticker work in the working tree was preserved.

## Changes and measurements

| Area                                |          Before |         After | Scope of measurement                                                                                                                               |
| ----------------------------------- | --------------: | ------------: | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial production JavaScript       | 1,647,819 bytes | 926,260 bytes | Entry and its static imports; dynamically loaded tools excluded. About 44% less JavaScript on initial load, not a measured launch-time percentage. |
| Cutter sheet grouping               |        284.0 ms |       17.5 ms | Median of five runs: 20,000 placements, 500 sheets; about 16× faster.                                                                              |
| Card PDF export                     |         63.2 ms |       27.5 ms | Median of three runs: 24 PDF pages sharing one compressed photo; about 2.3× faster.                                                                |
| Card PDF size                       | 2,180,653 bytes | 114,317 bytes | Original JPEG stream shared once across all sides, rather than copied 24 times; about 95% smaller.                                                 |
| Fast Print navigation page requests |              33 |            22 | Twelve sheets of a PDF, automatic source orientation, one CPU core.                                                                                |

These are synthetic local measurements on the main PC. The native navigation
sample took 2,066 ms before and 2,060 ms after, including waits and proof encoding;
it establishes fewer page requests, **not** a meaningful wall-clock speedup. Workshop and
physical low-end PC performance remain unmeasured.

- Startup now imports lightweight project validation directly. Loading the
  dashboard no longer pulls artwork serialization and Cutter editor geometry
  into the initial dependency graph. Existing validation and project formats
  are preserved, including the original projectFiles validation export.
- Cutter Montage partitions placements into sheets once. Grouping and the
  layout view use those partitions instead of repeatedly filtering the entire
  job. Empty and sparse sheets, fixed lengths, last-sheet trimming, production
  bounds and repeated-layout counts remain equivalent. Large sheet counts no
  longer spread the placement array into a function argument list.
- Card export embeds all selected PDF pages together, preserving shared image
  and font resources, page rotations, crop boxes, transparency groups and
  original artwork quality. Font validation still blocks missing font data.
- Ordinary Fast Print previews no longer load the first selected PDF page while
  rendering every later sheet. The existing six-million-pixel cache, source
  version checks and special ID/Polaroid paths remain in place.

## Validation

- `npm test`: all suites passed, covering access, licensing, print preferences,
  exports, booklet, projects, Cutter, stickers, hardcover, preflight, jobs,
  backup, sequential numbering, cards, Fast Print, appearance, i18n and updates.
- Typecheck, production build and native helper compilation passed.
- All 24 card output pages are pixel-identical before/after, including mixed
  rotations and crop boxes. All 31 native A4/A3, layout, rotation, fit,
  grayscale and navigation proofs are pixel-identical.
- Existing native source-direction verification passed in English, French and
  Arabic: mixed JPEG/EXIF/PDF orientation, manual orientation, A4/A3 dimensions,
  seven selected pages, two copies and 14-sheet totals. Independent PDF-page
  rotation, selection, filtering and reset checks also passed in all three languages.
- Offscreen Cutter layout checks passed at 1366×768 and 1920×1080 using light
  and dark themes, English/French/Arabic, RTL and low-end mode. All 12 fixture
  placements remained in the active project snapshot; no document-level
  horizontal overflow or renderer errors occurred. Screenshots were reviewed.
  Tab navigation moved focus to Export PDF in the hidden renderer.
- UI action placement, shared components, titles, controls and styling were
  preserved. Existing long Arabic AI Sticker Maker button text remains cramped
  in the narrow design sidebar; this performance pass does not revise that UI.
- No interactive desktop control, hardware printing, release publication or
  workshop source deployment was performed.

Evidence is in `output/performance-audit/`: `results.json`, production startup
bundle reports, before/after PDFs and PNGs, build/test logs and `ui/results.json`.
`scripts/verify-app-performance.mjs --capture-baseline` captures the JavaScript
implementations before an optimization; running it without that flag compares
the changed implementation. Native comparison requires the matching instrumented
`FastPrint-audit-before.exe` and `FastPrint-audit-after.exe` in `out/native/`, built
with `scripts/build-fast-print-native.ps1 -OutputName <name>` and the same
`VerifyPerformance` harness.
