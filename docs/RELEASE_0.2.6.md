# v0.2.6 — Card Montage, languages, and a cleaner production workspace

- Simplified Book Cover: removed the empty PDF prompts and the hint/Next cards
  from every step. Use the step navigation to move between Source PDF, Book
  measurements, Spine text, and Export.
- Added Card Montage with front/back artwork, independent PDF/Illustrator page
  selection, A4 layouts, spacing controls, cutting guides, and PDF export/printing.
- Added English, French, and Arabic interface selection with Arabic RTL support.
- Standardized production actions, tool headers, project controls, and settings
  tabs across the workspace.
- Improved Book Cover PDF dropping, page selection, and multilingual spine text
  detection, including local OCR for scanned covers and protection for manual edits.
- Improved mixed-sticker order layouts and Illustrator print/cut PDF exports,
  including separate sheet PDFs, repeat counts, and native layer verification.
- Added owner subscription controls for plan tools, customer overrides, and batch
  exports, with production access checked in the desktop process.

Installed Setup builds receive this stable release through automatic updates.
Portable builds must be replaced manually. Saved projects and settings are retained.

Release validation runs formatting, TypeScript, all automated production suites,
Storybook, and the production build. The Windows release workflow builds and
publishes the installer, portable app, update metadata, and checksums. Visual and
hardware checks still pending are recorded in `docs/UI_REGRESSION_CHECKLIST.md`;
the automated checks do not replace physical printer/cutter acceptance.
