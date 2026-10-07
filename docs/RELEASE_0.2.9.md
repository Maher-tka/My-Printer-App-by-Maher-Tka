# v0.2.9 — Booklet carousel and simpler workspaces

- Moved Booklet pages into an interactive carousel below the canvas, giving the
  preview more width. Thumbnails show the whole page without repeated PDF filenames.
- Added Expand pages / Collapse pages to switch between the compact strip and
  a grid of all pages. Deferred thumbnails load as they become visible.
- Kept page selection, Previous/Next, page-number jumps, keyboard navigation,
  mouse-wheel scrolling, pointer/keyboard reordering, deletion, blank-page colors,
  and full-page inspection. Auto blanks has one visible home in the carousel.
- Improved selected-page previews and shared PDF loading so fast navigation does
  not cancel another page's preview. Cleared imports release their cached resources.
- Added one shared Clear button across all five production tools. Confirmation
  clears current content while retaining tool settings and saved files.
- Preserved source PDF transparency groups and referenced color profiles in Card
  Montage export and front/back printing.
- Simplified Book Cover by removing the customer mockup and redundant explanation,
  placement, and summary cards. Removed duplicate Booklet hints and routine
  thumbnail-generation notices; the page-count warning now uses red alert styling.

Installed Setup builds receive this stable release through automatic updates.
Portable builds must be replaced manually.

Validation covers formatting, TypeScript, automated production suites, Storybook,
the production build, and browser interaction/layout checks at 1366×768,
1920×1080, and 1600×900, including French/dark, Arabic RTL, and low-end mode.
Native save/reopen and physical printer/cutter acceptance still pending are
recorded in `docs/UI_REGRESSION_CHECKLIST.md`.
