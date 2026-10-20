# v0.2.17 - Native Fast Print and complete sheet previews

- Open Fast Print directly from Explorer in a small standalone Windows dialog.
  Ordinary image/PDF previews open without loading the app dashboard or Electron.
  Print PDFs, common images and DOCX documents. Word documents require installed
  Microsoft Word or LibreOffice; a converter is not bundled with the installer.
- Choose A4/A3, color or black and white, and 1, 2, 4, 6, 8, 9, 12 or 16 pages
  per sheet. Consecutive images fill sheets together; documents retain their page
  order and begin separate sheet groups. Keep saved driver presets, copies,
  orientation and manufacturer printer properties in the same dialog.
- Use Polaroid 8 PIC or 9 PIC directly under the printer selector, with A4/color
  selected automatically. Preview the complete composed sheets, including every
  selected photo, rotation, framing, additional sheets and blank final slots.
  Preview preparation works before sign-in; actual printing still checks access.
- Replace the overlapping native/rounded control painting that caused sharp
  underlays and flicker. Buffered controls, bounded preview caches and retained
  previews during preparation improve redraws. Light/dark themes and English,
  French and Arabic layouts use the shared app design tokens.
- Keep explicit copy counts when switching printers and ignore stale printer
  responses. Editing an input refreshes its preview; changes detected at Print
  require review. Original PDFs remain editable while the preview is open.
  Missing or invalid inputs keep Print unavailable.
- Correct black-and-white artwork for the built-in Microsoft PDF/XPS printers
  while retaining hardware driver validation and complete encrypted driver
  settings. Original artwork, saved projects and Windows printer defaults are
  preserved.

Installed Setup builds receive this stable release through automatic updates.
Portable builds must be replaced manually.

Validation includes the full release checks; hidden repaint, printer-state,
source-edit and grayscale regressions; real fifteen-photo Polaroid batches and
exact eight/nine-photo selections; DOCX/image proofs; and the ID test photos with
off-center/rotated placements. Proof generation submits no hardware print jobs.
Live desktop keyboard/dropdown interaction, high DPI/high contrast, low-memory
workshop performance and physical printer output remain pending. Detailed results
are recorded in UI_REGRESSION_CHECKLIST.md.
