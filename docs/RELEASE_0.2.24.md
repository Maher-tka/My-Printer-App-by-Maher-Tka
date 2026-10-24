# v0.2.24 - Faster Fast Print and independent page rotation

- Find saved printer presets directly beside Printer. The list shows presets
  from every printer and identifies their owning queue, paper and tray. Choosing
  a preset switches to its printer and restores its captured settings. New or
  edited presets appear when reopening the list; unavailable or removed presets
  block printing until a valid choice is made.
- Click a page or image inside the sheet preview, then choose Rotate selected.
  Each PDF or Word page rotates independently, including two pages from the
  same file. The selection outline and page number identify the target. Arrow
  keys select visible items; R, Space or Enter rotates the focused selection.
  Rotate all remains available under Options.
- Group paper, color, orientation and quality controls together. Keep Polaroid
  directly under Printer, use compact layout tiles, and put navigation and
  editing controls beneath the preview. Copies stays beside output totals.
  The range editor appears when Page range is selected; controls wrap in
  smaller windows, with English, French and Arabic RTL support.
- Select a prepared page without rebuilding the sheet or disabling Print.
  Unchanged preview refreshes skip the edit delay, and a bounded four-document
  PDF cache reduces repeated opens when switching between PDFs and photos.
  Artwork changes still refresh the preview before printing.

Validation includes full release checks, hidden native layouts in both themes,
preset selection, independent page rotations, filtered/combined batches,
preview-to-print proof comparisons, repaint/resource checks and a single-core
preview benchmark. Live high-DPI, screen-reader and workshop hardware latency
checks remain pending. No hardware print jobs were used during these checks.

Installed Setup builds receive this stable release through automatic updates.
Portable users replace their executable manually. Saved projects, artwork,
printer presets and Windows printer defaults are preserved.
